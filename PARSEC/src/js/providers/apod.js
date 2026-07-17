import { fetchJson } from "../util/rss.js";
import { cached } from "../util/cache.js";

const KEY = "apod";
const LABEL = "NASA APOD";
const DAY_TTL = 12 * 60 * 60 * 1000;

function apiKey(settings) {
  return (settings?.nasaApiKey || "").trim() || "DEMO_KEY";
}

function normalize(d) {
  if (!d || d.media_type !== "image") return null;
  return {
    id: `${KEY}:${d.date}`,
    source: KEY,
    sourceLabel: LABEL,
    title: d.title,
    credit: d.copyright ? d.copyright.replace(/\n/g, " ").trim() : "NASA / APOD",
    description: d.explanation,
    imageUrl: d.url,
    hdUrl: d.hdurl || d.url,
    pageUrl: `https://apod.nasa.gov/apod/ap${d.date.slice(2).replace(/-/g, "")}.html`,
    date: d.date,
    meta: { home: "https://apod.nasa.gov/apod/" },
  };
}

export const apod = {
  key: KEY,
  label: LABEL,
  async fetchList(settings) {
    // A handful of recent + random days gives variety without a key-eating firehose.
    return cached(`feed:${KEY}`, DAY_TTL, async () => {
      const base = `https://api.nasa.gov/planetary/apod?api_key=${apiKey(settings)}`;
      const [today, random] = await Promise.allSettled([
        fetchJson(base),
        fetchJson(`${base}&count=8`),
      ]);
      const out = [];
      if (today.status === "fulfilled") out.push(normalize(today.value));
      if (random.status === "fulfilled" && Array.isArray(random.value)) {
        out.push(...random.value.map(normalize));
      }
      return out.filter(Boolean);
    });
  },
};
