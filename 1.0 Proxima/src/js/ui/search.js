
import { el, clear } from "../util/dom.js";
import { SEARCH_ENGINES } from "../state.js";

export function initSearch(container) {
  const input = el("input", {
    class: "search-input",
    type: "text",
    placeholder: "Search the web…",
    autocomplete: "off",
    spellcheck: false,
    "aria-label": "Search the web",
  });
  const form = el("form", { class: "search-form" }, [
    el("span", { class: "search-icon", html:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>' }),
    input,
  ]);

  let engine = "duckduckgo";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    // If it looks like a URL, go straight there.
    if (/^https?:\/\//i.test(q) || /^[\w-]+\.[a-z]{2,}(\/\S*)?$/i.test(q)) {
      location.href = /^https?:/i.test(q) ? q : `https://${q}`;
      return;
    }
    location.href = SEARCH_ENGINES[engine].url + encodeURIComponent(q);
  });

  clear(container).append(form);

  return {
    update(settings) {
      engine = SEARCH_ENGINES[settings.searchEngine] ? settings.searchEngine : "duckduckgo";
      container.style.display = settings.showSearch ? "" : "none";
      input.placeholder = `Search with ${SEARCH_ENGINES[engine].label}…`;
    },
    focus() { input.focus(); },
  };
}
