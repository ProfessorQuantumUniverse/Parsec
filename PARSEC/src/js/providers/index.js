/* Provider registry + pool assembly.
 *
 * A "provider" knows how to fetch a list of normalized images from one source.
 * The pool builder pulls from every source the user has enabled, shuffles them
 * into a deduped, interleaved rotation and hands it to the app. Each source is
 * fetched independently so one slow/broken feed never blocks the others. */

import { apod } from "./apod.js";
import { makeDjangoplicity } from "./djangoplicity.js";
import { epic } from "./epic.js";
import { nasalibrary } from "./nasalibrary.js";
import { nasaiotd } from "./nasaiotd.js";

const hubble = makeDjangoplicity({
  key: "hubble",
  label: "Hubble Picture of the Week",
  feedUrl: "https://esahubble.org/images/potw/feed/",
  home: "https://esahubble.org/images/potw/",
});

const webb = makeDjangoplicity({
  key: "webb",
  label: "James Webb (ESA/Webb)",
  feedUrl: "https://esawebb.org/images/feed/",
  home: "https://esawebb.org/images/",
});

const eso = makeDjangoplicity({
  key: "eso",
  label: "ESO Picture of the Week",
  feedUrl: "https://www.eso.org/public/images/potw/feed/",
  home: "https://www.eso.org/public/images/potw/",
});

export const PROVIDERS = {
  apod,
  hubble,
  webb,
  eso,
  epic,
  nasalib: nasalibrary,
  nasaiotd,
};

/** Display metadata for the settings UI (order matters). */
export const PROVIDER_INFO = [
  { key: "apod", label: "NASA APOD", blurb: "Astronomy Picture of the Day" },
  { key: "hubble", label: "Hubble", blurb: "ESA/Hubble Picture of the Week" },
  { key: "webb", label: "James Webb", blurb: "ESA/Webb image releases" },
  { key: "eso", label: "ESO", blurb: "Very Large Telescope, Chile — Picture of the Week" },
  { key: "epic", label: "EPIC · Earth", blurb: "Full-disk Earth from DSCOVR at L1" },
  { key: "nasalib", label: "NASA Library", blurb: "Rotating deep-sky search queries" },
  { key: "nasaiotd", label: "NASA Image of the Day", blurb: "The classic curated daily feed" },
];

function shuffle(arr, seed) {
  // Deterministic-ish interleave: seeded so the same day feels stable within a session.
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a rotation pool from the enabled sources.
 * @param {string[]} sources enabled provider keys
 * @param {object} settings full settings (for API keys etc.)
 * @returns {Promise<{images: object[], errors: object[]}>}
 */
export async function buildPool(sources, settings) {
  const active = sources.filter((k) => PROVIDERS[k]);
  const results = await Promise.allSettled(
    active.map((k) => PROVIDERS[k].fetchList(settings))
  );

  const perSource = {};
  const errors = [];
  results.forEach((r, i) => {
    const key = active[i];
    if (r.status === "fulfilled") perSource[key] = (r.value || []).filter((x) => x && x.imageUrl);
    else errors.push({ source: key, message: String(r.reason?.message || r.reason) });
  });

  // Round-robin interleave so consecutive images come from different telescopes.
  const seed = Math.floor(Date.now() / 864e5);
  const queues = active.map((k) => shuffle(perSource[k] || [], seed + k.length));
  const images = [];
  const seen = new Set();
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const img = q.shift();
      if (!img) continue;
      added = true;
      if (seen.has(img.imageUrl)) continue;
      seen.add(img.imageUrl);
      images.push(img);
    }
  }
  return { images, errors };
}
