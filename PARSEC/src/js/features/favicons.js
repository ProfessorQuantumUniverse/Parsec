/* Icons for stations.
 *
 * Unlike the most-visited tiles (which use Chrome's local favicon service),
 * homelab services are only reachable from your own machine, so there is no
 * local cache to read from — we have to ask the service itself. That needs an
 * optional host permission, which is requested in context and never at install.
 *
 * Everything fetched is downscaled to 64px, stored as a data URL and rendered
 * from the cache only. The result: the panel looks identical whether you are
 * at home or on hotel wifi, and nothing is ever fetched while you are looking.
 */

import { storageGet, storageSet, storageRemove } from "../util/cache.js";
import { BRAND } from "../brand.js";
import { parts } from "./stations.js";

const ICON_KEY = `${BRAND.ns}_icons`;
const FETCH_TIMEOUT = 2500;
const STALE_AFTER = 30 * 24 * 3600e3; // re-check a month-old icon, in the background
const RETRY_FAILED_AFTER = 3 * 24 * 3600e3;
const ICON_PX = 64;
const MAX_HTML = 200_000;

let _cache = null; // { [origin]: { data, ts, ok } }

/* ---------- permission ---------- */

export function hasIconPermission() {
  return new Promise((resolve) =>
    chrome.permissions.contains({ origins: ["*://*/*"] }, (ok) => resolve(!!ok && !chrome.runtime.lastError))
  );
}

/** Must be called from a user gesture (a click in the panel). */
export function requestIconPermission() {
  return new Promise((resolve) =>
    chrome.permissions.request({ origins: ["*://*/*"] }, (granted) => resolve(!!granted && !chrome.runtime.lastError))
  );
}

export function dropIconPermission() {
  return new Promise((resolve) =>
    chrome.permissions.remove({ origins: ["*://*/*"] }, (ok) => resolve(!!ok))
  );
}

/* ---------- cache ---------- */

export async function primeIconCache() {
  if (_cache) return _cache;
  const d = await storageGet(ICON_KEY);
  _cache = d[ICON_KEY] && typeof d[ICON_KEY] === "object" ? d[ICON_KEY] : {};
  return _cache;
}

async function saveCache() {
  await storageSet({ [ICON_KEY]: _cache || {} });
}

export async function clearIconCache() {
  _cache = {};
  await storageRemove(ICON_KEY);
}

export function iconCacheStats() {
  const entries = Object.values(_cache || {});
  const bytes = entries.reduce((n, e) => n + (e.data ? e.data.length : 0), 0);
  return { total: entries.length, ok: entries.filter((e) => e.ok).length, bytes };
}

function keyFor(st) {
  const p = parts(st);
  return p.origin || st.url;
}

/** Synchronous read — the UI never waits on the network to draw a card. */
export function iconFor(st) {
  if (st.icon?.mode === "monogram") return null;
  if (st.icon?.mode === "custom" && st.icon.data) return st.icon.data;
  const hit = _cache?.[keyFor(st)];
  return hit?.ok ? hit.data : null;
}

export function iconState(st) {
  if (st.icon?.mode === "monogram") return "off";
  if (st.icon?.mode === "custom" && st.icon.data) return "custom";
  const hit = _cache?.[keyFor(st)];
  if (!hit) return "none";
  return hit.ok ? "cached" : "failed";
}

function isStale(entry) {
  if (!entry) return true;
  const age = Date.now() - (entry.ts || 0);
  return entry.ok ? age > STALE_AFTER : age > RETRY_FAILED_AFTER;
}

/* ---------- image handling ---------- */

function loadImage(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    const done = (fn) => (v) => { img.onload = img.onerror = null; fn(v); };
    img.onload = done(() => resolve(img));
    img.onerror = done(() => reject(new Error("decode failed")));
    img.src = objectUrl;
  });
}

/** Blob → square 64px data URL. Handles ico, png, svg and friends. */
async function toDataUrl(blob) {
  if (!blob || blob.size === 0 || blob.size > 2_000_000) throw new Error("unusable blob");
  const type = blob.type || "";
  if (type && !type.startsWith("image/") && type !== "application/octet-stream") throw new Error("not an image");

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImage(objectUrl);
    const w = img.naturalWidth || ICON_PX;
    const h = img.naturalHeight || ICON_PX;
    if (!w || !h) throw new Error("empty image");

    const canvas = document.createElement("canvas");
    canvas.width = ICON_PX;
    canvas.height = ICON_PX;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    const scale = Math.min(ICON_PX / w, ICON_PX / h);
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    ctx.drawImage(img, Math.round((ICON_PX - dw) / 2), Math.round((ICON_PX - dh) / 2), dw, dh);

    const out = canvas.toDataURL("image/webp", 0.92);
    if (!out || out.length < 64) throw new Error("encode failed");
    return out;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Turn a file the user picked into a stored icon. */
export async function fileToIcon(file) {
  return toDataUrl(file);
}

/* ---------- discovery ---------- */

function timeoutSignal(ms) {
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** A failed request tells us two very different things: "this host is not
 *  there" (stop immediately) versus "that path is not there" (try the next). */
async function grab(url) {
  let res;
  try {
    res = await fetch(url, {
      credentials: "omit",
      cache: "no-cache",
      redirect: "follow",
      signal: timeoutSignal(FETCH_TIMEOUT),
    });
  } catch (cause) {
    const err = new Error("unreachable");
    err.unreachable = true; // DNS, refused connection, timeout, or a cert we can't accept
    throw err;
  }
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res;
}

/** Read <link rel="icon"> out of the service's own HTML, largest first. */
async function iconsFromMarkup(pageUrl) {
  const res = await grab(pageUrl);
  const type = res.headers.get("content-type") || "";
  if (!type.includes("html")) return [];
  const html = (await res.text()).slice(0, MAX_HTML);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = res.url || pageUrl;

  const links = [...doc.querySelectorAll('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i], link[rel="apple-touch-icon-precomposed" i]')];
  return links
    .map((l) => {
      const href = l.getAttribute("href");
      if (!href || href.startsWith("data:")) return null;
      const size = Math.max(0, ...String(l.getAttribute("sizes") || "").split(/\s+/)
        .map((s) => parseInt(s, 10)).filter(Number.isFinite));
      try { return { url: new URL(href, base).toString(), size }; } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.size - a.size)
    .slice(0, 4)
    .map((x) => x.url);
}

function wellKnown(st) {
  const p = parts(st);
  if (!p.origin) return [];
  const dir = p.path ? new URL(p.path.replace(/[^/]*$/, ""), p.origin).toString() : null;
  const names = ["favicon.ico", "favicon.png", "favicon.svg", "apple-touch-icon.png"];
  const urls = names.map((n) => `${p.origin}/${n}`);
  if (dir && dir !== `${p.origin}/`) urls.unshift(`${dir}favicon.ico`);
  return urls;
}

/**
 * Find and cache an icon for one station. Returns "ok" | "failed" | "skipped".
 * Never throws — a homelab is full of self-signed certs and half-awake boxes.
 */
export async function refreshIcon(st, { force = false } = {}) {
  await primeIconCache();
  if (st.icon?.mode === "monogram" || (st.icon?.mode === "custom" && st.icon.data)) return "skipped";

  const key = keyFor(st);
  if (!key) return "skipped";
  if (!force && !isStale(_cache[key])) return _cache[key].ok ? "ok" : "failed";

  const fail = async () => {
    _cache[key] = { data: null, ts: Date.now(), ok: false };
    await saveCache();
    return "failed";
  };

  const candidates = [];
  try {
    candidates.push(...(await iconsFromMarkup(st.url)));
  } catch (e) {
    // Nothing answered at all — walking a list of paths on a host that isn't
    // there would cost one timeout each for no possible gain.
    if (e.unreachable) return fail();
  }
  for (const u of wellKnown(st)) if (!candidates.includes(u)) candidates.push(u);

  let misses = 0;
  for (const url of candidates) {
    try {
      const res = await grab(url);
      const data = await toDataUrl(await res.blob());
      _cache[key] = { data, ts: Date.now(), ok: true };
      await saveCache();
      return "ok";
    } catch (e) {
      if (e.unreachable && ++misses >= 2) break; // the host stopped answering mid-way
    }
  }

  return fail();
}

/** Refresh a whole list with a small concurrency budget. */
export async function refreshIcons(stations, { force = false, onProgress } = {}) {
  if (!(await hasIconPermission())) return { ok: 0, failed: 0, skipped: stations.length, denied: true };
  await primeIconCache();

  // Several services usually live on one box; one lookup per origin is enough.
  const queue = [];
  const origins = new Set();
  for (const s of stations) {
    if (s.icon?.mode === "monogram" || (s.icon?.mode === "custom" && s.icon.data)) continue;
    const key = keyFor(s);
    if (!key || origins.has(key)) continue;
    origins.add(key);
    queue.push(s);
  }
  const tally = { ok: 0, failed: 0, skipped: stations.length - queue.length, denied: false };
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      const st = queue[cursor++];
      const result = await refreshIcon(st, { force });
      if (result === "ok") tally.ok++;
      else if (result === "failed") tally.failed++;
      else tally.skipped++;
      onProgress?.(++done, queue.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return tally;
}

/**
 * Quietly fill gaps after the overlay has already painted. Only touches
 * stations with no cached icon at all, so it stays silent on a normal open.
 */
export async function backfillIcons(stations) {
  if (!stations.length) return 0;
  if (!(await hasIconPermission())) return 0;
  await primeIconCache();
  // Most-used first, so a long list still gets its important icons on day one.
  const missing = stations
    .filter((s) => s.icon?.mode === "auto" && isStale(_cache[keyFor(s)]))
    .sort((a, b) => (b.opens || 0) - (a.opens || 0));
  if (!missing.length) return 0;
  const tally = await refreshIcons(missing.slice(0, 12));
  return tally.ok;
}
