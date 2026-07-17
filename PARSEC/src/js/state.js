/* Central settings + persisted collections (favorites, history).
 * Single source of truth, saved to chrome.storage.local. No server, ever. */

import { storageGet, storageSet } from "./util/cache.js";
import { BRAND } from "./brand.js";

const SETTINGS_KEY = `${BRAND.ns}_settings_v1`;
const FAV_KEY = `${BRAND.ns}_favorites`;
const HISTORY_KEY = `${BRAND.ns}_history`;

export const ALL_SOURCES = ["apod", "hubble", "webb", "eso", "epic", "nasalib", "nasaiotd"];

export const DEFAULTS = {
  version: 1,
  onboarded: false,
  name: "",
  sources: [...ALL_SOURCES],
  cadence: "daily", // per-tab | hourly | daily | manual
  // presentation
  imageFit: "cover", // cover | contain
  dim: 0.35, // 0..0.85 darken overlay
  blur: 0, // 0..24 px background blur
  vignette: true,
  accent: "#00d4ff",
  theme: "cosmos", // cosmos | midnight | mono (UI tint)
  // widgets
  showClock: true,
  showGreeting: true,
  showSearch: true,
  showMoon: true,
  showSun: true,
  showOnThisDay: true,
  showNerdStats: false,
  showTopSites: false,
  starfield: true,
  // clock
  clock24h: true,
  showSeconds: false,
  showDate: true,
  // search
  searchEngine: "duckduckgo",
  // location (for sun times) — manual or detected
  location: null, // { lat, lon, label }
  // NASA API key (optional, bring-your-own)
  nasaApiKey: "",
};

export const SEARCH_ENGINES = {
  duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  google: { label: "Google", url: "https://www.google.com/search?q=" },
  bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
  ecosia: { label: "Ecosia", url: "https://www.ecosia.org/search?q=" },
  startpage: { label: "Startpage", url: "https://www.startpage.com/sp/search?query=" },
  brave: { label: "Brave", url: "https://search.brave.com/search?q=" },
};

export const ACCENTS = ["#00d4ff", "#b384c9", "#7ef0c0", "#ffd479", "#ff8fb3", "#ff9a76"];

let _settings = { ...DEFAULTS };
const _subs = new Set();

export async function loadSettings() {
  const data = await storageGet(SETTINGS_KEY);
  _settings = { ...DEFAULTS, ...(data[SETTINGS_KEY] || {}) };
  // guard against an emptyy source list
  if (!Array.isArray(_settings.sources) || _settings.sources.length === 0) {
    _settings.sources = [...ALL_SOURCES];
  }
  return _settings;
}

export function getSettings() {
  return _settings;
}

export async function updateSettings(patch) {
  _settings = { ..._settings, ...patch };
  await storageSet({ [SETTINGS_KEY]: _settings });
  _subs.forEach((fn) => fn(_settings));
  return _settings;
}

export async function resetSettings() {
  _settings = { ...DEFAULTS };
  await storageSet({ [SETTINGS_KEY]: _settings });
  _subs.forEach((fn) => fn(_settings));
  return _settings;
}

export function onSettingsChange(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

/* ---------- Favorites --- */

export async function getFavorites() {
  const d = await storageGet(FAV_KEY);
  return d[FAV_KEY] || [];
}

export async function isFavorite(id) {
  return (await getFavorites()).some((f) => f.id === id);
}

export async function toggleFavorite(image) {
  const favs = await getFavorites();
  const idx = favs.findIndex((f) => f.id === image.id);
  let next;
  if (idx >= 0) next = favs.filter((f) => f.id !== image.id);
  else next = [image, ...favs].slice(0, 300);
  await storageSet({ [FAV_KEY]: next });
  return idx < 0; // true if now favorited
}

export async function removeFavorite(id) {
  const favs = await getFavorites();
  await storageSet({ [FAV_KEY]: favs.filter((f) => f.id !== id) });
}

/* ------ History (last seen) ------- */

export async function pushHistory(image) {
  const d = await storageGet(HISTORY_KEY);
  const list = d[HISTORY_KEY] || [];
  if (list[0]?.id === image.id) return;
  const entry = {
    id: image.id, title: image.title, imageUrl: image.imageUrl,
    source: image.source, sourceLabel: image.sourceLabel, ts: Date.now(),
  };
  await storageSet({ [HISTORY_KEY]: [entry, ...list.filter((x) => x.id !== image.id)].slice(0, 60) });
}

export async function getHistory() {
  const d = await storageGet(HISTORY_KEY);
  return d[HISTORY_KEY] || [];
}

/* ---------- Import / export ---------- */

export async function exportConfig() {
  return {
    exported: new Date().toISOString(),
    app: BRAND.ns,
    version: 1,
    settings: _settings,
    favorites: await getFavorites(),
  };
}

export async function importConfig(obj) {
  if (!obj || (obj.app !== BRAND.ns && obj.app !== "spatium")) throw new Error(`Not a ${BRAND.name} config file.`);
  if (obj.settings) await updateSettings({ ...DEFAULTS, ...obj.settings });
  if (Array.isArray(obj.favorites)) await storageSet({ [FAV_KEY]: obj.favorites.slice(0, 300) });
}
