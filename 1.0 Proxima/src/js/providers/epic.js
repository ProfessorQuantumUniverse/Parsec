import { fetchJson } from "../util/rss.js";
import { cached } from "../util/cache.js";

const KEY = "epic";
const LABEL = "NASA EPIC · Earth";
const TTL = 6 * 60 * 60 * 1000;

function imageUrl(item) {
  // item.image = "epic_1b_20260713005516", item.date = "2026-07-13 00:50:27"
  const [y, m, d] = item.date.split(" ")[0].split("-");
  return `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/png/${item.image}.png`;
}

export const epic = {
  key: KEY,
  label: LABEL,
  async fetchList() {
    return cached(`feed:${KEY}`, TTL, async () => {
      const items = await fetchJson("https://epic.gsfc.nasa.gov/api/natural");
      return items.map((it) => {
        const c = it.centroid_coordinates || {};
        const lat = typeof c.lat === "number" ? c.lat.toFixed(1) : "?";
        const lon = typeof c.lon === "number" ? c.lon.toFixed(1) : "?";
        return {
          id: `${KEY}:${it.identifier}`,
          source: KEY,
          sourceLabel: LABEL,
          title: "Earth from one million miles",
          credit: "NASA / NOAA · DSCOVR EPIC",
          description:
            (it.caption || "The sunlit face of Earth photographed by the DSCOVR spacecraft from L1.") +
            `  Sub-satellite point centred over ${lat}°, ${lon}°.`,
          imageUrl: imageUrl(it),
          hdUrl: imageUrl(it),
          pageUrl: "https://epic.gsfc.nasa.gov/",
          date: it.date?.replace(" ", "T") + "Z",
          meta: { home: "https://epic.gsfc.nasa.gov/", lat, lon },
        };
      });
    });
  },
};
