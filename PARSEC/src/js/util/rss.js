/* Fetch + parse RSS/Atom feeds in the page context (DOMParser is available here). */

const UA_TIMEOUT = 12000;

export async function fetchText(url, { timeout = UA_TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: "omit", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson(url, opts) {
  const txt = await fetchText(url, opts);
  return JSON.parse(txt);
}

/** Parse an RSS feed into a normalized list of items. */
export async function fetchRss(url, opts) {
  const xml = await fetchText(url, opts);
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("RSS parse error");

  return [...doc.querySelectorAll("item, entry")].map((item) => {
    const get = (sel) => item.querySelector(sel)?.textContent?.trim() || "";
    const title = get("title");
    const link =
      item.querySelector("link")?.getAttribute("href") || get("link") || get("guid");
    const description = get("description") || get("summary") || get("content");

    // Image can live in <enclosure>, <media:content>, <media:thumbnail>, or the description HTML.
    let image =
      item.querySelector("enclosure[url]")?.getAttribute("url") ||
      item.querySelector("*|content[url], *|thumbnail[url]")?.getAttribute("url") ||
      "";
    if (!image) {
      const m = description.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) image = m[1];
    }

    // credit / author fields used by Djangoplicity (ESA/ESO) feeds
    const credit =
      get("credit") ||
      item.getElementsByTagNameNS?.("*", "credit")?.[0]?.textContent?.trim() ||
      "";

    return { title, link, description: stripHtml(description), image, credit, raw: item };
  });
}

export function stripHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}
