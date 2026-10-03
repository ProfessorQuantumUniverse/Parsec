/* NASA APOD — Astronomy Picture of the Day.
 *
 * In autumn 2026 APOD moved from apod.nasa.gov to science.nasa.gov/apod and the
 * old api.nasa.gov/planetary/apod endpoint stopped working. The new home is a
 * WordPress REST route that needs no API key:
 *
 *   GET /wp-json/wp/v2/apod-basic                 newest first, ?page & ?per_page (max 25)
 *   GET /wp-json/wp/v2/apod-basic?date_from=YYMMDD&date_to=YYMMDD
 *   GET /wp-json/wp/v2/apod-basic/YYMMDD          a single day
 *
 * Each entry: { date, title, permalink, media_type, explanation (HTML),
 * credit (HTML), copyright (HTML), alt, url (= the article page), hdurl }.
 * hdurl points at an image CDN that resizes on the fly via ?w=&h=&fit=. */

import { fetchJson, stripHtml } from "../util/rss.js";
import { cached } from "../util/cache.js";

const KEY = "apod";
const LABEL = "NASA APOD";
const API = "https://science.nasa.gov/wp-json/wp/v2/apod-basic";
const HOME = "https://science.nasa.gov/apod/";

const LATEST_TTL = 60 * 60 * 1000; // today's picture lands ~04:00 UTC — look often
const ARCHIVE_TTL = 12 * 60 * 60 * 1000; // a fresh handful of random days twice a day
const LATEST_COUNT = 10;
const ARCHIVE_PAGES = 3;
const ARCHIVE_PER_PAGE = 8;
const FIRST_DAY = Date.UTC(1995, 5, 16);
const MAX_DISPLAY = 2560; // px on the long edge for the background, HD keeps the original

// Old archive days without a migrated image point at a generic thumbnail.
const PLACEHOLDER = /\/images\/misc\/news-thumbnail\./i;

/** Ask the image CDN for a screen-sized rendition instead of the full original. */
function displayUrl(hdurl) {
  try {
    const u = new URL(hdurl);
    const w = Number(u.searchParams.get("w")) || 0;
    const h = Number(u.searchParams.get("h")) || 0;
    const scale = w && h ? Math.min(1, MAX_DISPLAY / Math.max(w, h)) : 1;
    if (scale >= 1) return hdurl;
    u.searchParams.set("w", String(Math.round(w * scale)));
    u.searchParams.set("h", String(Math.round(h * scale)));
    return u.href;
  } catch {
    return hdurl;
  }
}

function cleanCredit(html) {
  const text = stripHtml(html).replace(/^[^:]{0,40}Credit[^:]{0,30}:\s*/i, "").trim();
  return text || "NASA / APOD";
}

function cleanExplanation(html) {
  // The trailing "Tomorrow's picture" / housekeeping notes follow a double <br>.
  const body = (html || "").split(/<br\s*\/?>\s*<br\s*\/?>/i)[0];
  return stripHtml(body).replace(/^Explanation:\s*/i, "");
}

function normalize(d) {
  if (!d || d.media_type !== "image" || !d.hdurl || PLACEHOLDER.test(d.hdurl)) return null;
  return {
    id: `${KEY}:${d.date}`,
    source: KEY,
    sourceLabel: LABEL,
    title: stripHtml(d.title),
    credit: cleanCredit(d.credit || d.copyright),
    description: cleanExplanation(d.explanation),
    imageUrl: displayUrl(d.hdurl),
    hdUrl: d.hdurl,
    pageUrl: d.permalink || d.url || HOME,
    date: d.date,
    meta: { home: HOME },
  };
}

async function fetchPage(page, perPage) {
  const list = await fetchJson(`${API}?per_page=${perPage}&page=${page}`);
  return Array.isArray(list) ? list : [];
}

/** The newest days — short TTL so today's upload shows up soon after it is posted. */
function latest() {
  return cached(`feed:${KEY}:latest`, LATEST_TTL, async () => {
    const items = (await fetchPage(1, LATEST_COUNT)).map(normalize).filter(Boolean);
    // The very newest image is "today's" APOD; the rotation shows it first, once.
    if (items[0]) items[0].latest = true;
    return items;
  });
}

/** A few random pages from 30 years of archive, rerolled every ARCHIVE_TTL. */
function archive() {
  return cached(`feed:${KEY}:archive`, ARCHIVE_TTL, async () => {
    const days = Math.floor((Date.now() - FIRST_DAY) / 864e5);
    // A few days are missing from the archive, so stay clear of the last page.
    const pages = Math.max(2, Math.floor(days / ARCHIVE_PER_PAGE) - 5);
    const picks = new Set();
    while (picks.size < ARCHIVE_PAGES) picks.add(2 + Math.floor(Math.random() * (pages - 1)));
    const results = await Promise.allSettled([...picks].map((p) => fetchPage(p, ARCHIVE_PER_PAGE)));
    const out = results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).map(normalize).filter(Boolean);
    if (!out.length) throw new Error("APOD archive unavailable");
    return out;
  });
}

export const apod = {
  key: KEY,
  label: LABEL,
  async fetchList() {
    const [recent, random] = await Promise.allSettled([latest(), archive()]);
    if (recent.status === "rejected" && random.status === "rejected") throw recent.reason;
    return [
      ...(recent.status === "fulfilled" ? recent.value : []),
      ...(random.status === "fulfilled" ? random.value : []),
    ];
  },
};
