/* NASA Image & Video Library — a rotating set of nerdy search queries so the
 * pool stays surprising. No API key required. */

import { fetchJson } from "../util/rss.js";
import { cached } from "../util/cache.js";

const KEY = "nasalib";
const LABEL = "NASA Image Library";
const TTL = 6 * 60 * 60 * 1000;

export const NASA_QUERIES = [
  "nebula", "spiral galaxy", "supernova remnant", "star cluster", "aurora from space",
  "solar flare", "saturn rings", "jupiter storm", "protoplanetary disk", "crab nebula",
  "pulsar", "milky way core", "eagle nebula", "orion nebula", "helix nebula",
  "gravitational lens", "comet nucleus", "galaxy collision", "planetary nebula", "cosmic dust",
];

function largest(links = []) {
  // Search links give a ~thumb; derive higher-res siblings from the asset naming scheme.
  const thumb = links.find((l) => l.render === "image" || /~thumb/.test(l.href))?.href || links[0]?.href;
  if (!thumb) return null;
  return {
    display: thumb.replace(/~(thumb|small|medium)\./, "~large."),
    hd: thumb.replace(/~(thumb|small|medium|large)\./, "~orig."),
  };
}

function pickQueries(n = 2) {
  const day = Math.floor(Date.now() / 864e5);
  const start = day % NASA_QUERIES.length;
  return Array.from({ length: n }, (_, i) => NASA_QUERIES[(start + i * 7) % NASA_QUERIES.length]);
}

export const nasalibrary = {
  key: KEY,
  label: LABEL,
  queries: NASA_QUERIES,
  async fetchList() {
    return cached(`feed:${KEY}`, TTL, async () => {
      const queries = pickQueries(2);
      const results = await Promise.allSettled(
        queries.map((q) =>
          fetchJson(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image`)
        )
      );
      const out = [];
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const items = r.value?.collection?.items || [];
        for (const it of items.slice(0, 12)) {
          const d = it.data?.[0];
          const urls = largest(it.links);
          if (!d || !urls) continue;
          out.push({
            id: `${KEY}:${d.nasa_id}`,
            source: KEY,
            sourceLabel: LABEL,
            title: d.title || "Untitled",
            credit: d.center ? `NASA / ${d.center}` : "NASA",
            description: d.description || d.description_508 || "",
            imageUrl: urls.display,
            hdUrl: urls.hd,
            pageUrl: `https://images.nasa.gov/details/${d.nasa_id}`,
            date: d.date_created,
            meta: { home: "https://images.nasa.gov/", keywords: d.keywords },
          });
        }
      }
      return out;
    });
  },
};
