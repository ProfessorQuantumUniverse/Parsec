/* Most-visited shortcuts. Uses the optional "topSites" permission and Chrome's
 * built-in local favicon service (no favicons are fetched from the network!!!!!!!!!!!!!!). */

import { el, clear } from "../util/dom.js";

function faviconUrl(pageUrl, size = 32) {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", pageUrl);
  u.searchParams.set("size", String(size));
  return u.toString();
}

function hasPerm() {
  return new Promise((resolve) =>
    chrome.permissions.contains({ permissions: ["topSites"] }, resolve)
  );
}

function getSites() {
  return new Promise((resolve) => {
    if (!chrome.topSites) return resolve([]);
    chrome.topSites.get((sites) => resolve(sites || []));
  });
}

export function initTopSites(container) {
  async function render() {
    const sites = (await getSites()).slice(0, 10);
    clear(container);
    for (const s of sites) {
      let host = s.url;
      try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch {} // ?
      container.append(
        el("a", { class: "site-tile", href: s.url, title: s.title || host }, [
          el("span", { class: "site-fav", style: { backgroundImage: `url("${faviconUrl(s.url)}")` } }),
          el("span", { class: "site-label", text: s.title || host }),
        ])
      );
    }
  }

  return {
    async update(settings) {
      if (settings.showTopSites && (await hasPerm())) {
        container.style.display = "";
        await render();
      } else {
        container.style.display = "none";
        clear(container);
      }
    },
  };
}
