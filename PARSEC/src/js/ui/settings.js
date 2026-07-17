
import { el, clear, icons } from "../util/dom.js";
import { BRAND } from "../brand.js";
import {
  getSettings, updateSettings, resetSettings, ACCENTS, SEARCH_ENGINES,
  getFavorites, removeFavorite, exportConfig, importConfig, getHistory,
} from "../state.js";
import { PROVIDER_INFO } from "../providers/index.js";
import { guessLocationFromTimeZone, searchCities } from "../features/geo.js";

/* ---- small control builders ---- */

function row(label, control, hint) {
  return el("label", { class: "set-row" }, [
    el("div", { class: "set-row-text" }, [
      el("span", { class: "set-label", text: label }),
      hint && el("span", { class: "set-hint", text: hint }),
    ]),
    control,
  ]);
}

function toggle(key, get, set) {
  const input = el("input", { type: "checkbox", checked: !!get()[key] });
  input.addEventListener("change", () => set({ [key]: input.checked }));
  return el("span", { class: "switch" }, [input, el("span", { class: "switch-track" })]);
}

function select(key, options, get, set) {
  const sel = el("select", { class: "set-select" },
    options.map(([v, label]) => el("option", { value: v, text: label, selected: get()[key] === v })));
  sel.addEventListener("change", () => set({ [key]: sel.value }));
  return sel;
}

function slider(key, min, max, step, get, set, fmt) {
  const val = el("span", { class: "slider-val" });
  const input = el("input", { type: "range", min, max, step, value: get()[key] });
  const show = () => (val.textContent = fmt ? fmt(input.value) : input.value);
  input.addEventListener("input", () => { show(); set({ [key]: Number(input.value) }); });
  show();
  return el("div", { class: "slider-wrap" }, [input, val]);
}

export function initSettings(overlayRoot, { onSourcesChanged, onSelectImage, requestPerm, replayIntro }) {
  let activeTab = "sources";
  const panel = el("aside", { class: "settings-panel", hidden: true });
  const backdrop = el("div", { class: "settings-backdrop", hidden: true, onclick: () => close() });
  overlayRoot.append(backdrop, panel);

  const get = getSettings;
  const set = async (patch) => {
    const before = get().sources.join(",");
    await updateSettings(patch);
    if ("sources" in patch && patch.sources.join(",") !== before) onSourcesChanged?.();
  };

  const TABS = [
    ["sources", "Sources"],
    ["look", "Look"],
    ["widgets", "Widgets"],
    ["location", "Location"],
    ["data", "Data"],
    ["favorites", "Favorites"],
  ];

  async function renderBody() {
    const body = el("div", { class: "settings-body" });
    if (activeTab === "sources") renderSources(body);
    else if (activeTab === "look") renderLook(body);
    else if (activeTab === "widgets") renderWidgets(body);
    else if (activeTab === "location") renderLocation(body);
    else if (activeTab === "data") renderData(body);
    else if (activeTab === "favorites") await renderFavorites(body);
    return body;
  }

  function renderSources(body) {
    body.append(el("p", { class: "set-section-hint", text:
      "Choose which telescopes and archives feed your rotation. Enabled sources are interleaved so consecutive tabs come from different observatories." }));
    const grid = el("div", { class: "source-grid" });
    for (const p of PROVIDER_INFO) {
      const on = get().sources.includes(p.key);
      const cb = el("input", { type: "checkbox", checked: on });
      cb.addEventListener("change", () => {
        const s = new Set(get().sources);
        cb.checked ? s.add(p.key) : s.delete(p.key);
        if (s.size === 0) { cb.checked = true; s.add(p.key); }
        set({ sources: [...s] });
      });
      grid.append(el("label", { class: "source-card" }, [
        cb,
        el("div", {}, [
          el("div", { class: "source-name", text: p.label }),
          el("div", { class: "source-blurb", text: p.blurb }),
        ]),
      ]));
    }
    body.append(grid);
    body.append(row("Change image", select("cadence", [
      ["per-tab", "Every new tab"],
      ["hourly", "Hourly"],
      ["daily", "Once a day"],
      ["manual", "Only when I press next"],
    ], get, set), "How often the picture rotates."));
  }

  function renderLook(body) {
    // accent swatches
    const sw = el("div", { class: "swatches" }, ACCENTS.map((c) => {
      const b = el("button", { class: "swatch", style: { background: c }, title: c });
      if (get().accent === c) b.classList.add("active");
      b.addEventListener("click", () => { set({ accent: c }); [...sw.children].forEach((x) => x.classList.remove("active")); b.classList.add("active"); });
      return b;
    }));
    const custom = el("input", { type: "color", value: get().accent, class: "swatch-custom", title: "Custom accent" });
    custom.addEventListener("input", () => set({ accent: custom.value }));
    sw.append(custom);
    body.append(row("Accent colour", sw));

    body.append(row("UI tint", select("theme", [
      ["cosmos", "Cosmos (purple)"],
      ["midnight", "Midnight (blue)"],
      ["mono", "Mono (neutral)"],
    ], get, set)));
    body.append(row("Image fit", select("imageFit", [["cover", "Fill screen (cover)"], ["contain", "Fit whole image (contain)"]], get, set)));
    body.append(row("Darken", slider("dim", 0, 0.85, 0.05, get, set, (v) => `${Math.round(v * 100)}%`)));
    body.append(row("Background blur", slider("blur", 0, 24, 1, get, set, (v) => `${v}px`)));
    body.append(row("Vignette", toggle("vignette", get, set)));
    body.append(row("Twinkling starfield", toggle("starfield", get, set), "A subtle animated star layer. Pauses when the tab is hidden."));
  }

  function renderWidgets(body) {
    body.append(el("input", { class: "set-text", type: "text", placeholder: "Your name (for the greeting)", value: get().name,
      oninput: (e) => set({ name: e.target.value.slice(0, 40) }) }));
    const toggles = [
      ["showGreeting", "Greeting"],
      ["showClock", "Clock"],
      ["showDate", "Date"],
      ["showSearch", "Search bar"],
      ["showMoon", "Moon phase"],
      ["showSun", "Sun & golden hour"],
      ["showOnThisDay", "On this day in space"],
      ["showNerdStats", "Nerd stats (sidereal time…)"],
      ["showTopSites", "Most-visited shortcuts"],
    ];
    for (const [k, label] of toggles) {
      const control = k === "showTopSites"
        ? topSitesToggle()
        : toggle(k, get, set);
      body.append(row(label, control));
    }
    body.append(el("hr", { class: "set-divider" }));
    body.append(row("24-hour clock", toggle("clock24h", get, set)));
    body.append(row("Show seconds", toggle("showSeconds", get, set)));
    body.append(row("Search engine", select("searchEngine",
      Object.entries(SEARCH_ENGINES).map(([k, v]) => [k, v.label]), get, set)));
  }

  function topSitesToggle() {
    const input = el("input", { type: "checkbox", checked: !!get().showTopSites });
    input.addEventListener("change", async () => {
      if (input.checked) {
        const granted = await requestPerm(["topSites"]);
        if (!granted) { input.checked = false; return; }
      }
      set({ showTopSites: input.checked });
    });
    return el("span", { class: "switch" }, [input, el("span", { class: "switch-track" })]);
  }

  function renderLocation(body) {
    const loc = get().location || {};
    body.append(el("p", { class: "set-section-hint", html:
      "Powers sunrise, sunset, golden hour and sidereal time. <b>No GPS, no permission, no network</b> — computed on-device and never sent anywhere." }));

    const status = el("div", { class: "loc-current" });
    const showStatus = () => {
      const l = get().location;
      status.innerHTML = l
        ? `<span class="loc-pin">◎</span> <b>${l.label}</b> · ${(+l.lat).toFixed(2)}°, ${(+l.lon).toFixed(2)}°`
        : `<span class="set-hint">No location set — sun times are hidden.</span>`;
    };
    showStatus();

    // 1) time-zone guess (offline)
    const guess = guessLocationFromTimeZone();
    const tzBtn = el("button", { class: "btn primary-btn",
      text: guess ? `Use my time zone — ${guess.label}` : "Use my time zone",
      onclick: () => { if (guess) { set({ location: guess }); showStatus(); } } });

    // 2) city search
    const search = el("input", { class: "set-text", type: "text", placeholder: "Search for a city…" });
    const results = el("div", { class: "city-results" });
    search.addEventListener("input", () => {
      clear(results);
      for (const c of searchCities(search.value)) {
        results.append(el("button", { class: "city-opt", type: "button", text: `${c.name}, ${c.cc}`,
          onclick: () => { set({ location: { lat: c.lat, lon: c.lon, label: c.name } }); search.value = c.name; clear(results); showStatus(); } }));
      }
    });

    // 3) manual entry (collapsible)
    const lat = el("input", { class: "set-text small", type: "number", step: "0.0001", placeholder: "Latitude", value: loc.lat ?? "" });
    const lon = el("input", { class: "set-text small", type: "number", step: "0.0001", placeholder: "Longitude", value: loc.lon ?? "" });
    const saveManual = () => {
      const la = parseFloat(lat.value), lo = parseFloat(lon.value);
      if (Number.isFinite(la) && Number.isFinite(lo)) { set({ location: { lat: la, lon: lo, label: "Custom" } }); showStatus(); }
    };
    [lat, lon].forEach((i) => i.addEventListener("change", saveManual));

    body.append(
      status,
      el("div", { class: "btn-row" }, [tzBtn]),
      search, results,
      el("details", { class: "set-details" }, [
        el("summary", { text: "Enter coordinates manually" }),
        el("div", { class: "latlon-row" }, [lat, lon]),
      ]),
      get().location ? el("div", { class: "btn-row" }, [
        el("button", { class: "btn", text: "Clear location", onclick: () => { set({ location: null }); showStatus(); } }),
      ]) : null,
    );
  }

  function renderData(body) {
    body.append(el("p", { class: "set-section-hint", text:
      "Optional NASA API key (free at api.nasa.gov) lifts APOD's shared rate limit. Everything works without it." }));
    body.append(el("input", { class: "set-text", type: "text", placeholder: "NASA API key (optional)", value: get().nasaApiKey,
      onchange: (e) => set({ nasaApiKey: e.target.value.trim() }) }));

    const exportBtn = el("button", { class: "btn", text: "Export settings & favorites" });
    exportBtn.addEventListener("click", async () => {
      const data = await exportConfig();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = el("a", { href: url, download: "spatium-config.json" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
    const importInput = el("input", { type: "file", accept: "application/json", style: { display: "none" } });
    importInput.addEventListener("change", async () => {
      const file = importInput.files[0];
      if (!file) return;
      try {
        await importConfig(JSON.parse(await file.text()));
        onSourcesChanged?.();
        rerender();
      } catch (e) { alert(`Import failed: ${e.message}`); }
    });
    const importBtn = el("button", { class: "btn", text: "Import…", onclick: () => importInput.click() });
    const resetBtn = el("button", { class: "btn danger", text: "Reset everything" });
    resetBtn.addEventListener("click", async () => {
      if (confirm("Reset all settings to defaults? Favorites are kept.")) { await resetSettings(); onSourcesChanged?.(); rerender(); }
    });

    const introBtn = el("button", { class: "btn", text: "Replay intro", onclick: () => { close(); replayIntro?.(); } });
    body.append(el("div", { class: "btn-row wrap" }, [exportBtn, importBtn, importInput, introBtn, resetBtn]));
    body.append(el("hr", { class: "set-divider" }));
    body.append(el("p", { class: "set-section-hint", html:
      `${BRAND.name} is free & open source. No accounts, no telemetry, no ads. ` +
      `<a href="${BRAND.github}" target="_blank" rel="noopener">Source &amp; credits →</a>` }));
  }

  async function renderFavorites(body) {
    const favs = await getFavorites();
    if (!favs.length) {
      body.append(el("p", { class: "set-section-hint", text: "No favorites yet. Press the heart (or F) on an image you love and it will appear here." }));
    } else {
      const grid = el("div", { class: "fav-grid" });
      for (const f of favs) {
        const tile = el("div", { class: "fav-tile", style: { backgroundImage: `url("${f.imageUrl}")` }, title: f.title });
        tile.addEventListener("click", () => { onSelectImage?.(f); close(); });
        const rm = el("button", { class: "fav-remove", html: icons.close, title: "Remove", onclick: async (e) => {
          e.stopPropagation(); await removeFavorite(f.id); rerender();
        } });
        tile.append(el("span", { class: "fav-caption", text: f.title }), rm);
        grid.append(tile);
      }
      body.append(grid);
    }

    const hist = await getHistory();
    if (hist.length) {
      body.append(el("h3", { class: "fav-subhead", text: "Recently seen" }));
      const strip = el("div", { class: "hist-strip" });
      for (const h of hist.slice(0, 20)) {
        const t = el("div", { class: "hist-tile", style: { backgroundImage: `url("${h.imageUrl}")` }, title: h.title });
        t.addEventListener("click", () => { onSelectImage?.(h); close(); });
        strip.append(t);
      }
      body.append(strip);
    }
  }

  function rerender() {
    renderBody().then((body) => {
      const old = panel.querySelector(".settings-body");
      if (old) old.replaceWith(body);
    });
  }

  async function build() {
    clear(panel);
    const tabs = el("div", { class: "settings-tabs" }, TABS.map(([id, label]) => {
      const b = el("button", { class: "tab-btn" + (id === activeTab ? " active" : ""), text: label });
      b.addEventListener("click", () => { activeTab = id; build(); });
      return b;
    }));
    const header = el("div", { class: "settings-header" }, [
      el("div", { class: "settings-title", text: `${BRAND.name} settings` }),
      el("button", { class: "icon-btn", html: icons.close, title: "Close (Esc)", onclick: () => close() }),
    ]);
    panel.append(header, tabs, await renderBody());
  }

  function open() { build(); backdrop.hidden = false; panel.hidden = false; requestAnimationFrame(() => panel.classList.add("open")); }
  function close() { panel.classList.remove("open"); backdrop.hidden = true; setTimeout(() => (panel.hidden = true), 220); }

  return {
    open, close,
    toggle() { panel.hidden ? open() : close(); },
    isOpen: () => !panel.hidden,
  };
}
