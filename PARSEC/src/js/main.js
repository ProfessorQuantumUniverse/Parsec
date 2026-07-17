/*Nice that you found the Core! Welcome! Contributions are happily welcomed!!!*/

import { $, el } from "./util/dom.js";
import { BRAND } from "./brand.js";
import { cacheGet, cacheSet, storageGet, storageSet } from "./util/cache.js";
import {
  loadSettings, getSettings, updateSettings, onSettingsChange,
  isFavorite, toggleFavorite, pushHistory, getHistory,
} from "./state.js";
import { buildPool } from "./providers/index.js";
import { initClock } from "./ui/clock.js";
import { initSearch } from "./ui/search.js";
import { initWidgets } from "./ui/widgets.js";
import { initInfo } from "./ui/info.js";
import { initTopSites } from "./ui/topsites.js";
import { initSettings } from "./ui/settings.js";
import { createStarfield } from "./features/starfield.js";
import { runOnboarding } from "./ui/onboarding.js";

const POOL_KEY = "pool";
const POOL_TTL = 6 * 60 * 60 * 1000;
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

/** Advance to the next image the viewer hasn't seen recently. */
async function advance() {
  if (!pool.length) return;
  const recent = new Set((await getHistory()).slice(0, RECENT_MAX).map((h) => h.id));
  let target = (index + 1) % pool.length;
  for (let step = 0; step < pool.length; step++) {
    const cand = (index + 1 + step) % pool.length;
    if (!recent.has(pool[cand].id)) { target = cand; break; }
  }
  await showAt(target);
}

async function next() { await advance(); }
async function prev() { await showAt(index - 1); }
async function shuffle() {
  if (pool.length < 2) return;
  let r = index;
  while (r === index) r = Math.floor(Math.random() * pool.length);
  await showAt(r);
}

/* ---------- pool building ---------- */

async function refreshPool({ force = false } = {}) {
  const s = getSettings();
  const sig = s.sources.slice().sort().join(",");
  const cached = await cacheGet(POOL_KEY);
  const meta = (await storageGet("pool_sig")).pool_sig;

  if (!force && cached && meta === sig) {
    pool = cached;
  } else {
    try {
      const { images, errors } = await buildPool(s.sources, s);
      if (images.length) {
        pool = images;
        await cacheSet(POOL_KEY, pool, POOL_TTL);
        await storageSet({ pool_sig: sig });
        if (errors.length) console.info("Parsec: some sources failed", errors);
      } else if (cached) {
        pool = cached;
        toast("Couldn't reach some sources — showing cached images.");
      } else {
        throw new Error("empty pool");
      }
    } catch {
      if (cached) pool = cached;
      else { toast("Couldn't reach the cosmos. It'll retry on your next tab."); return; }
    }
  }
  if (current) {
    const found = pool.findIndex((x) => x.id === current.id);
    if (found >= 0) index = found;
  }
}

/* ---------- presentation ---------- */

function applyPresentation(s) {
  const root = document.documentElement;
  root.style.setProperty("--accent", s.accent);
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
  if (e.key === "Escape") {
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
    case "/": e.preventDefault(); search.focus(); break;
    case "h": setZen(!zen); break;
    case "?": shortcutsHelp(); break;
  }
}

/* ---------- module wiring ---------- */

const clock = initClock(els.clock);
const search = initSearch(els.search);
const widgets = initWidgets(els.widgets);
const topsites = initTopSites(els.topsites);
const info = initInfo({
  bar: els.infobar, controls: els.controls, overlayRoot: els.overlay,
  handlers: {
    onPrev: prev, onNext: next, onShuffle: shuffle,
    onToggleFav: favorite, onDownload: download, onSettings: () => settings.toggle(),
  },
});
const settings = initSettings(els.overlay, {
  onSourcesChanged: async () => { await refreshPool({ force: true }); await showAt(0); toast("Sources updated."); },
  onSelectImage: async (image) => {
    const found = pool.findIndex((x) => x.id === image.id);
    if (found >= 0) await showAt(found);
    else { pool.unshift(image); index = 0; await paint(image); await saveCursor(); }
  },
  requestPerm,
  replayIntro: () => runIntro(),
});

function applyAllWidgets(s) {
  clock.update(s); search.update(s); widgets.update(s); topsites.update(s); info.update(s);
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
  await showAt(0);
}

/* ---------- boot ---------- */

async function boot() {
  const s = await loadSettings();
  applyAll(s);

  if (!s.onboarded) {
    await runIntro();
    return;
  }

  // 1) Instant paint from last cached image (offline-friendly, zero network wait)
  const stored = (await storageGet(CURRENT_KEY))[CURRENT_KEY];
  if (stored) { try { await paint(stored, false); } catch {} }

  // 2) Build/refresh the pool
  await refreshPool();
  if (!pool.length) return;

  // 3) First selection vs. cadence-driven rotation
  const cursor = (await storageGet(CURSOR_KEY))[CURSOR_KEY];
  if (!current) {
    await showAt(cursor?.index ?? 0, { animate: true });
  } else if (shouldAdvance(cursor, s.cadence)) {
    await advance();
  } else {
    preload(pool[(index + 1) % pool.length].imageUrl).catch(() => {});
  }
}

onSettingsChange((s) => applyAll(s));
addEventListener("keydown", onKey);
boot();
