import { fetchRss } from "../util/rss.js";
import { cached } from "../util/cache.js";

const FEED_TTL = 6 * 60 * 60 * 1000; // 6h these feeds update at most weekly

function atRes(url, res) {
  return url ? url.replace(/\/(thumb|screen|large|wallpaper\d*|publicationjpg|original)\//, `/${res}/`) : url;
}

function pubDate(raw) {
  const t = raw?.querySelector("pubDate, published, updated")?.textContent?.trim();
  const d = t ? new Date(t) : null;
  return d && !isNaN(d) ? d.toISOString() : null;
}

export function makeDjangoplicity({ key, label, feedUrl, home }) {
  async function list() {
    return cached(`feed:${key}`, FEED_TTL, async () => {
      const items = await fetchRss(feedUrl);
      return items
        .filter((i) => i.image)
        .map((i) => ({
          id: `${key}:${i.link}`,
          source: key,
          sourceLabel: label,
          title: i.title,
          credit: i.credit || label,
          description: i.description,
          imageUrl: atRes(i.image, "screen"),
          hdUrl: atRes(i.image, "large"),
          pageUrl: i.link,
          date: pubDate(i.raw),
          meta: { home },
        }));
    });
  }

  return {
    key,
    label,
    async fetchList() {
      return list();
    },
  };
}
