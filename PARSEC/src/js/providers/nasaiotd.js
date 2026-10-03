/* NASA Image of the Day — the classic curated daily feed (RSS). No key. */

import { fetchRss, stripHtml } from "../util/rss.js";
import { cached } from "../util/cache.js";

const KEY = "nasaiotd";
const LABEL = "NASA Image of the Day";
const TTL = 2 * 60 * 60 * 1000; // a new image most weekdays

export const nasaiotd = {
  key: KEY,
  label: LABEL,
  async fetchList() {
    return cached(`feed:${KEY}`, TTL, async () => {
      const items = await fetchRss("https://www.nasa.gov/feeds/iotd-feed/");
      const out = items
        .filter((i) => i.image)
        .map((i) => {
          const pub = i.raw?.querySelector("pubDate")?.textContent?.trim();
          const d = pub ? new Date(pub) : null;
          return {
            id: `${KEY}:${i.link}`,
            source: KEY,
            sourceLabel: LABEL,
            title: i.title,
            credit: i.credit || "NASA",
            description: stripHtml(i.description),
            imageUrl: i.image,
            hdUrl: i.image,
            pageUrl: i.link,
            date: d && !isNaN(d) ? d.toISOString() : null,
            meta: { home: "https://www.nasa.gov/image-of-the-day/" },
          };
        });
      if (out[0]) out[0].latest = true; // newest first
      return out;
    });
  },
};
