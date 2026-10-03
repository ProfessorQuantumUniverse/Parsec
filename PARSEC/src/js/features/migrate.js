/* One-off repair for APOD entries saved before APOD moved to science.nasa.gov.
 *
 * Favorites, history and the last shown image keep the old apod.nasa.gov image
 * links, which now only redirect to an HTML page. Every entry's id carries its
 * date, so each one is looked up on the new API and rewritten in place — same
 * id, new image/page links. Nothing is ever removed: a day the new API can't
 * resolve is left as it was and flagged so it isn't looked up again. Network
 * failures leave the entry untouched for the next tab to retry. */

import { storageGet, storageSet } from "../util/cache.js";
import { BRAND } from "../brand.js";
import { fetchApodDay, isLegacyApod } from "../providers/apod.js";

const FAV_KEY = `${BRAND.ns}_favorites`;
const HISTORY_KEY = `${BRAND.ns}_history`;
const CURRENT_KEY = `${BRAND.ns}_current`;
const BATCH = 4; // be polite to the new API

const needsLookup = (x) => isLegacyApod(x) && !x.legacyChecked;

export async function migrateLegacyApod() {
  const data = await storageGet([FAV_KEY, HISTORY_KEY, CURRENT_KEY]);
  const favs = data[FAV_KEY] || [];
  const history = data[HISTORY_KEY] || [];
  const current = data[CURRENT_KEY];

  const dates = [...new Set([...favs, ...history, current].filter(needsLookup).map((x) => x.id.slice(5)))];
  if (!dates.length) return 0;

  const found = new Map(); // date → new image, or null when the day can't be resolved
  for (let i = 0; i < dates.length; i += BATCH) {
    const chunk = dates.slice(i, i + BATCH);
    const results = await Promise.allSettled(chunk.map(fetchApodDay));
    results.forEach((r, j) => { if (r.status === "fulfilled") found.set(chunk[j], r.value); });
  }

  const upgrade = (x) => {
    if (!needsLookup(x) || !found.has(x.id.slice(5))) return x;
    const fresh = found.get(x.id.slice(5));
    return fresh ? { ...x, ...fresh, id: x.id } : { ...x, legacyChecked: true };
  };

  // Re-read right before writing, in case a favorite was toggled meanwhile.
  const latest = await storageGet([FAV_KEY, HISTORY_KEY, CURRENT_KEY]);
  const patch = {};
  if (latest[FAV_KEY]) patch[FAV_KEY] = latest[FAV_KEY].map(upgrade);
  if (latest[HISTORY_KEY]) {
    patch[HISTORY_KEY] = latest[HISTORY_KEY].map((h) => {
      const u = upgrade(h);
      // History keeps a slim shape.
      return u === h ? h : { id: h.id, title: u.title, imageUrl: u.imageUrl, source: h.source,
        sourceLabel: u.sourceLabel, ts: h.ts, ...(u.legacyChecked ? { legacyChecked: true } : {}) };
    });
  }
  if (latest[CURRENT_KEY]) patch[CURRENT_KEY] = upgrade(latest[CURRENT_KEY]);
  await storageSet(patch);
  return [...found.values()].filter(Boolean).length;
}
