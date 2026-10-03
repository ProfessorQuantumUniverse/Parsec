/*Nice that you found the Core! Welcome! Contributions are happily welcomed!!!*/

import { $, el } from "./util/dom.js";
import { BRAND } from "./brand.js";
import { cacheEntry, cacheSet, storageGet, storageSet } from "./util/cache.js";
import {
  loadSettings, getSettings, updateSettings, onSettingsChange,
  isFavorite, toggleFavorite, pushHistory, getHistory, getSeenLatest, markLatestSeen,
} from "./state.js";
import { buildPool } from "./providers/index.js";
import { initClock } from "./ui/clock.js";
import { initSearch } from "./ui/search.js";
import { initWidgets } from "./ui/widgets.js";
import { initInfo } from "./ui/info.js";
import { initTopSites } from "./ui/topsites.js";
import { initSettings } from "./ui/settings.js";
import { initPalette } from "./ui/palette.js";
import { initGroundControl } from "./ui/groundcontrol.js";
import { initStationsPanel } from "./ui/stations-panel.js";
import { createStarfield } from "./features/starfield.js";
import { createHealth } from "./features/health.js";
import { createSync } from "./features/sync.js";
import { loadStations, onStationsChange, recordOpen, ipUrl } from "./features/stations.js";
import { primeIconCache } from "./features/favicons.js";
import { runOnboarding } from "./ui/onboarding.js";

const POOL_KEY = "pool";
const POOL_TTL = 3 * 60 * 60 * 1000;
const POOL_RETRY_TTL = 15 * 60 * 1000; // some source failed — try again soon
const POOL_VERSION = 2; // bump when the shape of pool entries changes
const FRESH_WAIT = 1500; // ms a stale-pool boot waits for the network before using what it has
const CURSOR_KEY = `${BRAND.ns}_cursor`;
const CURRENT_KEY = `${BRAND.ns}_current`;
const RECENT_MAX = 8; // avoid repeating the last N images when advancing

const els = {
  bgA: $("#bg-a"), bgB: $("#bg-b"), scrim: $(".scrim"), vignette: $(".vignette"),
  starfield: $("#starfield"), loader: $("#loader"),
  clock: $("#clock"), search: $("#search"), topsites: $("#topsites"), widgets: $("#widgets"),
  infobar: $("#infobar"), controls: $("#controls"), overlay: $("#overlay"), toast: $("#toast"),
  app: $(".app"),
};

let pool = [];
let index = 0;
let current = null;
let frontLayer = els.bgA;
let starfield = null;
let onboardingActive = false;
let userNavigated = false; // the viewer picked an image themselves since this tab opened
let poolRefreshing = null; // { sig, promise } of the network rebuild in flight
let rotatedThisTab = false; // this tab already moved on to a new image when it opened

/* ---------- background painting with crossfade + Ken Burns ---------- */

function preload(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error("image failed"));
    img.src = url;
  });
}

async function paint(image, animate = true) {
  const s = getSettings();
  els.loader.classList.add("on");
  try {
    await preload(image.imageUrl);
  } catch {
    els.loader.classList.remove("on");
    throw new Error("load-failed");
  }
  const back = frontLayer === els.bgA ? els.bgB : els.bgA;
  back.style.backgroundImage = `url("${image.imageUrl}")`;
  back.style.backgroundSize = s.imageFit === "contain" ? "contain" : "cover";
  back.classList.toggle("kenburns", s.imageFit !== "contain" && !matchMedia("(prefers-reduced-motion: reduce)").matches);
  void back.offsetWidth; // reflow so the transition runs
  back.classList.add("visible");
  frontLayer.classList.remove("visible");
  frontLayer = back;
  els.loader.classList.remove("on");

  current = image;
  const fav = await isFavorite(image.id);
  info.setImage(image, fav);
  document.title = `${image.title} · ${BRAND.name}`;
  pushHistory(image);
  if (image.latest) markLatestSeen(image.id);
  await storageSet({ [CURRENT_KEY]: image });
}

/* ---------- rotation logic ---------- */

function nowDayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function shouldAdvance(cursor, cadence) {
  if (cadence === "manual") return false;
  if (cadence === "per-tab") return true;
  if (!cursor) return true;
  if (cadence === "hourly") return Date.now() - (cursor.rotatedAt || 0) > 3600e3;
  if (cadence === "daily") return cursor.dayStamp !== nowDayStamp();
  return true;
}

async function saveCursor() {
  await storageSet({ [CURSOR_KEY]: { index, id: current?.id, rotatedAt: Date.now(), dayStamp: nowDayStamp() } });
}

async function showAt(i, { animate = true, record = true } = {}) {
  if (!pool.length) return;
  index = ((i % pool.length) + pool.length) % pool.length;
  let attempts = 0;
  while (attempts < pool.length) {
    try {
      await paint(pool[index], animate);
      if (record) await saveCursor();
      preload(pool[(index + 1) % pool.length].imageUrl).catch(() => {}); // warm next
      return;
    } catch {
      index = (index + 1) % pool.length; // broken URL → skip
      attempts++;
    }
  }
  toast("None of the current images could be loaded. Check your connection.");
}

/* Each source flags its newest upload as `latest`. Those jump the queue once,
 * so today's APOD (and friends) actually get seen instead of drowning in the
 * archive. APOD wins ties, then whatever was published most recently. */
const freshRank = (img) => (img.source === "apod" ? 1e15 : 0) + (Date.parse(img.date) || 0);

async function unseenLatestIndex({ source } = {}) {
  const seen = new Set(await getSeenLatest());
  let best = -1;
  pool.forEach((img, i) => {
    if (!img.latest || seen.has(img.id) || img.id === current?.id) return;
    if (source && img.source !== source) return;
    if (best < 0 || freshRank(img) > freshRank(pool[best])) best = i;
  });
  return best;
}

/** Advance to the next image: a fresh upload if there is one, else one not seen recently. */
async function advance() {
  if (!pool.length) return;
  const fresh = await unseenLatestIndex();
  if (fresh >= 0) return showAt(fresh);
  const recent = new Set((await getHistory()).slice(0, RECENT_MAX).map((h) => h.id));
  let target = (index + 1) % pool.length;
  for (let step = 0; step < pool.length; step++) {
    const cand = (index + 1 + step) % pool.length;
    if (!recent.has(pool[cand].id)) { target = cand; break; }
  }
  await showAt(target);
}

async function next() { userNavigated = true; await advance(); }
async function prev() { userNavigated = true; await showAt(index - 1); }
async function shuffle() {
  if (pool.length < 2) return;
  userNavigated = true;
  let r = index;
  while (r === index) r = Math.floor(Math.random() * pool.length);
  await showAt(r);
}

/* ---------- pool building ----------
 * Stale-while-revalidate: a tab always starts from whatever pool it has on
 * disk, however old, and refreshes it in the background when it has expired
 * or was built on an earlier day. Only a first run ever waits on the network. */

function poolSig() {
  return `v${POOL_VERSION}|` + getSettings().sources.slice().sort().join(",");
}

function dayStampOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** The pool on disk, or null if there is none for the current sources. */
async function loadCachedPool() {
  const [entry, meta] = await Promise.all([cacheEntry(POOL_KEY), storageGet("pool_sig")]);
  if (!entry || !Array.isArray(entry.value) || !entry.value.length || meta.pool_sig !== poolSig()) return null;
  return { images: entry.value, stale: entry.stale || dayStampOf(entry.stored) !== nowDayStamp() };
}

function setPool(images) {
  pool = images;
  const found = current ? pool.findIndex((x) => x.id === current.id) : -1;
  index = found >= 0 ? found : Math.min(index, Math.max(0, pool.length - 1));
}

/** Fetch every source and store the result. Resolves to the new images, or null. */
function fetchPool() {
  const s = getSettings();
  const sig = poolSig();
  if (poolRefreshing?.sig === sig) return poolRefreshing.promise;
  const promise = buildPool(s.sources, s)
    .then(async ({ images, errors }) => {
      if (errors.length) console.info("Parsec: some sources failed", errors);
      if (!images.length) return null;
      await cacheSet(POOL_KEY, images, errors.length ? POOL_RETRY_TTL : POOL_TTL);
      await storageSet({ pool_sig: sig });
      return images;
    })
    .catch(() => null)
    .finally(() => { if (poolRefreshing?.promise === promise) poolRefreshing = null; });
  poolRefreshing = { sig, promise };
  return promise;
}

/** Make sure there is a pool. With `force`, wait for a network rebuild. */
async function refreshPool({ force = false } = {}) {
  const cached = await loadCachedPool();
  if (cached && !force) {
    setPool(cached.images);
    if (cached.stale) fetchPool().then((images) => images && setPool(images));
    return;
  }
  const images = await fetchPool();
  if (images) setPool(images);
  else if (cached) { setPool(cached.images); toast("Couldn't reach some sources — showing cached images."); }
  else if (!pool.length) toast("Couldn't reach the cosmos. It'll retry on your next tab.");
}

/** Index of the image a fresh start should open with. */
async function firstPick(fallback = 0) {
  const fresh = await unseenLatestIndex();
  return fresh >= 0 ? fresh : fallback;
}

/* ---------- presentation ---------- */

function applyPresentation(s) {
  const root = document.documentElement;
  root.style.setProperty("--accent", s.accent);
  root.style.setProperty("--gc-dim", String(s.gcDim ?? 0.55));
  root.dataset.theme = s.theme || "cosmos";
  els.scrim.style.opacity = String(s.dim);
  const blur = s.blur ? `blur(${s.blur}px) saturate(1.05)` : "none";
  [els.bgA, els.bgB].forEach((l) => {
    l.style.filter = blur;
    l.style.backgroundSize = s.imageFit === "contain" ? "contain" : "cover";
  });
  els.vignette.style.display = s.vignette ? "" : "none";

  if (s.starfield && !starfield) starfield = createStarfield(els.starfield);
  else if (!s.starfield && starfield) {
    starfield.destroy(); starfield = null;
    els.starfield.getContext("2d").clearRect(0, 0, innerWidth, innerHeight);
  }
}

/* ---------- toast ---------- */

let toastTimer = 0;
function toast(msg, ms = 4000) {
  els.toast.textContent = msg;
  els.toast.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("on"), ms);
}

/* ---------- downloads & favorites ---------- */

const slug = (s) => (s || "image").toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

async function download() {
  if (!current) return;
  toast("Preparing full-resolution download…", 8000);
  try {
    const res = await fetch(current.hdUrl, { credentials: "omit" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("+xml", "");
    const a = el("a", { href: url, download: `${BRAND.ns}-${slug(current.title)}.${ext}` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    els.toast.classList.remove("on");
  } catch {
    window.open(current.hdUrl, "_blank", "noopener");
  }
}

async function favorite() {
  if (!current) return;
  const nowFav = await toggleFavorite(current);
  info.setFav(nowFav);
  toast(nowFav ? "Added to favorites ♥" : "Removed from favorites");
}

/* ---------- permissions ---------- */

function requestPerm(permissions) {
  return new Promise((resolve) => chrome.permissions.request({ permissions }, resolve));
}

/* ---------- zen mode & shortcuts ---------- */

let zen = false;
function setZen(on) { zen = on; document.body.classList.toggle("zen", zen); }

function shortcutsHelp() {
  if ($(".help-overlay")) return;
  const rows = [
    ["→ / N / Space", "Next image"], ["← / P", "Previous image"], ["R", "Shuffle"],
    ["F", "Favorite"], ["I", "Image details"], ["D", "Download HD"],
    ["G", "Ground Control"], ["Ctrl + K", "Jump to a service"],
    ["S / ,", "Settings"], ["/", "Focus search"], ["H", "Zen mode (hide UI)"], ["Esc", "Close / exit"],
  ];
  const box = el("div", { class: "help-overlay", onclick: (e) => { if (e.target === box) box.remove(); } }, [
    el("div", { class: "help-card" }, [
      el("h2", { text: "Keyboard shortcuts" }),
      el("dl", { class: "help-list" }, rows.flatMap(([k, v]) => [el("dt", {}, [el("kbd", { text: k })]), el("dd", { text: v })])),
      el("button", { class: "btn", text: "Got it", onclick: () => box.remove() }),
    ]),
  ]);
  els.overlay.append(box);
  requestAnimationFrame(() => box.classList.add("open"));
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

function onKey(e) {
  if (onboardingActive) return;

  // Reaches the palette from anywhere, including inside the search field.
  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    if (!palette.open()) toast("Nothing to jump to yet — add your services under Ground Control.");
    return;
  }

  if (e.key === "Escape") {
    if (stationsPanel.isOpen()) return stationsPanel.close();
    if (groundControl.isOpen()) return groundControl.close();
    if (settings.isOpen()) return settings.close();
    if (info.isDetailOpen()) return info.toggleDetail(false);
    const help = $(".help-overlay"); if (help) return help.remove();
    if (zen) return setZen(false);
    return;
  }
  if (isTyping(e)) return;
  switch (e.key) {
    case "ArrowRight": case "n": case " ": e.preventDefault(); next(); break;
    case "ArrowLeft": case "p": prev(); break;
    case "r": shuffle(); break;
    case "f": favorite(); break;
    case "i": info.toggleDetail(); break;
    case "d": download(); break;
    case "s": case ",": settings.toggle(); break;
    case "g": groundControl.toggle(); break;
    case "/": e.preventDefault(); search.focus(); break;
    case "h": setZen(!zen); break;
    case "?": shortcutsHelp(); break;
  }
}

/* ---------- ground control ---------- */

/** Open one of your own services. Alt goes via the raw IP, Ctrl opens a tab. */
async function openStation(st, { newTab = false, viaIp = false } = {}) {
  const url = (viaIp && ipUrl(st)) || st.url;
  await recordOpen(st.id);
  if (newTab) window.open(url, "_blank", "noopener");
  else location.href = url;
}

/* Actions the palette offers behind ">" — the half of it that is useful
 * whether or not you run anything at home. */
const PALETTE_COMMANDS = [
  { id: "ground", label: "Open Ground Control", hint: "your homelab board", key: "G", icon: "grid",
    keywords: ["homelab", "dashboard", "stations", "services"], run: () => groundControl.open() },
  { id: "next", label: "Next image", key: "N", icon: "next", keywords: ["image", "advance"], run: () => next() },
  { id: "prev", label: "Previous image", key: "P", icon: "prev", keywords: ["image", "back"], run: () => prev() },
  { id: "shuffle", label: "Shuffle the cosmos", key: "R", icon: "shuffle", keywords: ["random"], run: () => shuffle() },
  { id: "fav", label: "Favorite this image", key: "F", icon: "heart", keywords: ["like", "save"], run: () => favorite() },
  { id: "details", label: "Image details", key: "I", icon: "info", keywords: ["about", "caption"], run: () => info.toggleDetail(true) },
  { id: "download", label: "Download full resolution", key: "D", icon: "download", keywords: ["save", "wallpaper"], run: () => download() },
  { id: "zen", label: "Zen mode", key: "H", icon: "eye", keywords: ["hide", "clean"], run: () => setZen(!zen) },
  { id: "settings", label: "Settings", key: "S", icon: "gear", keywords: ["options", "preferences"], run: () => settings.open() },
  { id: "stations", label: "Configure Ground Control", icon: "grid",
    keywords: ["add station", "homelab settings", "edit"], run: () => stationsPanel.open() },
];

/* ---------- module wiring ---------- */

const clock = initClock(els.clock);
const search = initSearch(els.search);
const widgets = initWidgets(els.widgets);
const topsites = initTopSites(els.topsites);
const health = createHealth();
const sync = createSync({
  onNote: (msg) => toast(msg),
  onAdopt: () => applyAllWidgets(getSettings()),
});
const palette = initPalette({
  mount: search.mount, input: search.input, form: search.form,
  commands: PALETTE_COMMANDS,
  onOpenStation: openStation,
});
const info = initInfo({
  bar: els.infobar, controls: els.controls, overlayRoot: els.overlay,
  handlers: {
    onPrev: prev, onNext: next, onShuffle: shuffle,
    onToggleFav: favorite, onDownload: download,
    onGroundControl: () => groundControl.toggle(),
    onSettings: () => settings.toggle(),
  },
});
const groundControl = initGroundControl(els.overlay, {
  health,
  onConfigure: () => stationsPanel.open(),
  onOpenStation: openStation,
  onToast: toast,
});
const stationsPanel = initStationsPanel(els.overlay, {
  onChanged: () => applyAllWidgets(getSettings()),
  onToast: toast,
  sync,
});
const settings = initSettings(els.overlay, {
  openGroundControl: () => stationsPanel.open(),
  onSourcesChanged: async () => { await refreshPool({ force: true }); await showAt(await firstPick()); toast("Sources updated."); },
  onSelectImage: async (image) => {
    userNavigated = true;
    const found = pool.findIndex((x) => x.id === image.id);
    if (found >= 0) await showAt(found);
    else { pool.unshift(image); index = 0; await paint(image); await saveCursor(); }
  },
  requestPerm,
  replayIntro: () => runIntro(),
});

function applyAllWidgets(s) {
  clock.update(s); search.update(s); widgets.update(s); topsites.update(s); info.update(s);
  palette.update(s); groundControl.update(s); sync.update(s);
}

function applyAll(s) { applyPresentation(s); applyAllWidgets(s); }

/* ---------- onboarding ---------- */

async function runIntro() {
  onboardingActive = true;
  els.app.classList.add("dim-for-intro");
  const poolPromise = refreshPool(); // fetch in the background while the user reads
  await runOnboarding(els.overlay);
  onboardingActive = false;
  els.app.classList.remove("dim-for-intro");
  applyAll(getSettings());
  await poolPromise.catch(() => {});
  await refreshPool({ force: true }); // sources may have changed during intro
  await showAt(await firstPick());
}

/* ---------- boot ---------- */

/** The toolbar popup links here with #ground or #stations. */
function openFromHash() {
  const where = location.hash.replace("#", "").toLowerCase();
  if (where === "ground") groundControl.open();
  else if (where === "stations") stationsPanel.open();
  else return;
  history.replaceState(null, "", location.pathname); // a reload shouldn't reopen it
}

async function boot() {
  const [s] = await Promise.all([loadSettings(), loadStations(), primeIconCache()]);
  applyAll(s);

  if (!s.onboarded) {
    await runIntro();
    return;
  }

  openFromHash();

  // 1) Instant paint from last cached image (offline-friendly, zero network wait)
  const stored = (await storageGet(CURRENT_KEY))[CURRENT_KEY];
  if (stored) { try { await paint(stored, false); } catch {} }

  // 2) Pool: cached copy right away, network refresh in the background if it's old
  const cached = await loadCachedPool();
  let refresh = null;
  if (cached) {
    setPool(cached.images);
    if (cached.stale) {
      refresh = fetchPool();
      // Usually the network is quick — then this tab starts on the fresh pool directly.
      const quick = await Promise.race([refresh, new Promise((r) => setTimeout(() => r(undefined), FRESH_WAIT))]);
      if (quick !== undefined) { if (quick) setPool(quick); refresh = null; }
    }
  } else {
    await refreshPool({ force: true });
  }
  if (!pool.length) return;

  // 3) First selection vs. cadence-driven rotation
  await rotateOnOpen(s.cadence);

  // 4) The fresh pool arrived late: swap it in, and show a new upload if one came with it
  if (refresh) {
    const images = await refresh;
    if (!images) return;
    setPool(images);
    if (!userNavigated) await showLateArrival(s.cadence);
  }
}


async function rotateOnOpen(cadence) {
  const cursor = (await storageGet(CURSOR_KEY))[CURSOR_KEY];
  if (!current) {
    await showAt(await firstPick(cursor?.index ?? 0));
    rotatedThisTab = true;
  } else if (shouldAdvance(cursor, cadence)) {
    await advance();
    rotatedThisTab = true;
  } else if (!(await showFreshApod(cadence))) {
    preload(pool[(index + 1) % pool.length].imageUrl).catch(() => {});
  }
}

/** Even when it isn't time to rotate yet, a brand-new APOD gets its moment the day it appears. */
async function showFreshApod(cadence) {
  if (cadence === "manual") return false;
  const i = await unseenLatestIndex({ source: "apod" });
  if (i < 0) return false;
  await showAt(i);
  rotatedThisTab = true;
  return true;
}

async function showLateArrival(cadence) {
  if (!rotatedThisTab) return showFreshApod(cadence);
  // This tab already rotated — swap to a fresh upload, if the refresh brought one.
  const i = await unseenLatestIndex();
  if (i >= 0) await showAt(i);
}

/** A tab left open for hours quietly picks up new images when you come back to it. */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || onboardingActive || !pool.length) return;
  const cached = await loadCachedPool();
  if (!cached || cached.stale) fetchPool().then((images) => images && setPool(images));
});

onSettingsChange((s) => applyAll(s));
onStationsChange(() => {
  applyAllWidgets(getSettings());
  sync.notifyLocalChange();
});
addEventListener("keydown", onKey);
boot();
