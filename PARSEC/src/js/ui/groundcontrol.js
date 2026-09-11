/* Ground Control — the full-screen homelab overlay.
 *
 * Hidden until you ask for it (G, the dock button, or the palette), so the
 * picture stays the picture. Once open it is a proper dashboard: sectors,
 * icons, the hostname and the raw IP behind it, optional reachability dots,
 * drag to reorder, and type-to-filter without touching the mouse.
 */

import { el, clear, icons } from "../util/dom.js";
import { getSettings } from "../state.js";
import {
  getStations, sectorsOf, searchStations, hostLabel, ipLabel, ipUrl,
  hasHostname, monogram, reorderStations, updateStation, frecency, recordOpens,
} from "../features/stations.js";
import { iconFor, backfillIcons } from "../features/favicons.js";

const PINNED_MAX = 6;

export function initGroundControl(overlayRoot, { health, onConfigure, onOpenStation, onToast }) {
  let settings = getSettings();
  let isOpen = false;
  let query = "";
  let focusIndex = -1;
  let cards = [];       // rendered card elements, in visual order
  let dragId = null;

  const filter = el("input", {
    class: "gc-filter", type: "text", spellcheck: false, autocomplete: "off",
    placeholder: "Filter — name, host, IP, port, tag…", "aria-label": "Filter stations",
  });
  const count = el("span", { class: "gc-count" });
  const statusBtn = el("button", { class: "icon-btn gc-recheck", html: icons.refresh, title: "Re-check reachability" });
  const gearBtn = el("button", { class: "icon-btn", html: icons.gear, title: "Configure Ground Control" });
  const closeBtn = el("button", { class: "icon-btn", html: icons.close, title: "Close (Esc)" });

  const header = el("div", { class: "gc-header" }, [
    el("div", { class: "gc-titles" }, [
      el("div", { class: "gc-title", text: "Ground Control" }),
      count,
    ]),
    el("div", { class: "gc-tools" }, [filter, statusBtn, gearBtn, closeBtn]),
  ]);

  const banner = el("div", { class: "gc-banner", hidden: true });
  const body = el("div", { class: "gc-body" });
  const foot = el("div", { class: "gc-foot" });
  const shell = el("div", { class: "gc-shell" }, [header, banner, body, foot]);
  const root = el("div", { class: "gc-root", hidden: true, role: "dialog", "aria-label": "Ground Control" }, [shell]);
  root.addEventListener("mousedown", (e) => { if (e.target === root) close(); });
  overlayRoot.append(root);

  /* ---------- helpers ---------- */

  const density = () => settings.gcDensity || "normal";
  const showIp = () => settings.gcShowIp !== false && density() !== "compact";
  const showHost = () => settings.gcShowHost !== false && density() !== "compact";
  const showNote = () => settings.gcShowNote !== false && density() === "detail";
  const showTags = () => settings.gcShowTags === true && density() === "detail";
  const showStatus = () => settings.gcHealth !== "off";

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = el("textarea", { value: text, style: { position: "fixed", opacity: "0" } });
      document.body.append(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* nothing more we can do */ }
      ta.remove();
    }
    onToast?.(`Copied ${text}`);
  }

  function iconNode(st) {
    const data = settings.gcIcons !== false ? iconFor(st) : null;
    if (data) return el("span", { class: "gc-icon", style: { backgroundImage: `url("${data}")` } });
    const m = monogram(st);
    return el("span", { class: "gc-icon mono", style: { "--mono": m.color }, text: m.letters });
  }

  function openStation(st, e = {}) {
    const viaIp = !!e.altKey && !!ipUrl(st);
    const newTab = !!(e.ctrlKey || e.metaKey || e.button === 1);
    if (!newTab) close();
    onOpenStation(st, { newTab, viaIp });
  }

  /* ---------- card ---------- */

  function cardEl(st) {
    const ip = ipLabel(st);
    const lines = [];

    if (showHost() && hasHostname(st)) {
      lines.push(el("span", { class: "gc-host", text: hostLabel(st) }));
    }
    if (ip && (showIp() || !hasHostname(st))) {
      const chip = el("button", {
        class: "gc-ip", type: "button", title: `Copy ${ip}`, text: ip,
        onclick: (e) => { e.stopPropagation(); e.preventDefault(); copy(ip); },
      });
      lines.push(chip);
    }
    if (showNote() && st.note) lines.push(el("span", { class: "gc-note", text: st.note }));
    if (showTags() && st.tags.length) {
      lines.push(el("span", { class: "gc-tags" }, st.tags.map((t) => el("span", { class: "gc-tag", text: t }))));
    }

    const state = showStatus() ? health.get(st.id) : "off";
    const card = el("a", {
      class: `gc-card ${density()}${state !== "off" ? ` st-${state}` : ""}`,
      href: st.url,
      draggable: !query,
      title: st.note || st.label,
      dataset: { id: st.id },
    }, [
      el("span", { class: "gc-card-top" }, [
        iconNode(st),
        showStatus() ? el("span", { class: "gc-dot", title: statusTitle(state) }) : null,
      ]),
      el("span", { class: "gc-card-text" }, [
        el("span", { class: "gc-label", text: st.label }),
        lines.length ? el("span", { class: "gc-lines" }, lines) : null,
      ]),
    ]);

    card.addEventListener("click", (e) => {
      if (e.target.closest(".gc-ip")) return;
      e.preventDefault();
      openStation(st, e);
    });
    card.addEventListener("auxclick", (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      openStation(st, e);
    });
    card.addEventListener("dragstart", (e) => {
      dragId = st.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", st.id); } catch { /* Firefox-ism, harmless */ }
    });
    card.addEventListener("dragend", () => {
      dragId = null;
      card.classList.remove("dragging");
      [...body.querySelectorAll(".drop-before, .drop-after")].forEach((n) => n.classList.remove("drop-before", "drop-after"));
    });
    card.addEventListener("dragover", (e) => {
      if (!dragId || dragId === st.id) return;
      e.preventDefault();
      const r = card.getBoundingClientRect();
      const after = settings.gcLayout === "list" ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
      card.classList.toggle("drop-after", after);
      card.classList.toggle("drop-before", !after);
    });
    card.addEventListener("dragleave", () => card.classList.remove("drop-before", "drop-after"));
    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      const after = card.classList.contains("drop-after");
      card.classList.remove("drop-before", "drop-after");
      await dropOn(st, after);
    });

    return card;
  }

  function statusTitle(state) {
    if (state === "up") return "Responding";
    if (state === "down") return health.isAway() ? "No answer — you may be off this network" : "Not responding";
    if (state === "checking") return "Checking…";
    return "Not checked yet";
  }

  /* ---------- drag & drop ---------- */

  async function dropOn(target, after) {
    const id = dragId;
    dragId = null;
    if (!id || id === target.id) return;

    const all = [...getStations()].sort((a, b) => a.order - b.order);
    const moving = all.find((s) => s.id === id);
    if (!moving) return;

    const rest = all.filter((s) => s.id !== id);
    const at = rest.findIndex((s) => s.id === target.id);
    rest.splice(at + (after ? 1 : 0), 0, moving);

    if (moving.group !== target.group) await updateStation(id, { group: target.group });
    await reorderStations(rest.map((s) => s.id));
    render();
  }

  /* ---------- sections ---------- */

  /** Open a whole sector in background tabs — the "maintenance evening" button. */
  async function openSector(name, stations) {
    if (stations.length > 8 && !confirm(`Open all ${stations.length} services in ${name}?`)) return;
    for (const st of stations) {
      if (chrome?.tabs?.create) chrome.tabs.create({ url: st.url, active: false });
      else window.open(st.url, "_blank", "noopener");
    }
    await recordOpens(stations.map((s) => s.id));
    onToast?.(`Opened ${stations.length} tab${stations.length === 1 ? "" : "s"} from ${name}.`);
    close();
  }

  function sectionEl(title, stations, extraClass = "", { openable = false } = {}) {
    const grid = el("div", { class: `gc-grid ${settings.gcLayout === "list" ? "as-list" : ""} ${extraClass}` });
    if (settings.gcColumns > 0 && settings.gcLayout !== "list") {
      grid.style.gridTemplateColumns = `repeat(${settings.gcColumns}, minmax(0, 1fr))`;
    }
    for (const st of stations) {
      const card = cardEl(st);
      cards.push(card);
      grid.append(card);
    }
    const parts = [];
    if (title && settings.gcShowSectorTitles !== false) {
      parts.push(el("h3", { class: "gc-sector-title" }, [
        el("span", { text: title }),
        el("span", { class: "gc-sector-count", text: String(stations.length) }),
        openable && stations.length > 1
          ? el("button", {
              class: "gc-sector-open", type: "button",
              title: `Open all ${stations.length} in ${title}`,
              html: `${icons.external}<span>Open all</span>`,
              onclick: () => openSector(title, stations),
            })
          : null,
      ]));
    }
    parts.push(grid);
    return el("section", { class: "gc-section" }, parts);
  }

  function emptyState() {
    return el("div", { class: "gc-empty" }, [
      el("div", { class: "gc-empty-title", text: "No stations yet" }),
      el("p", { class: "gc-empty-text", text:
        "Add the things you actually run — Proxmox, Portainer, Home Assistant, the NAS — and they become searchable from the tab you already open a hundred times a day." }),
      el("div", { class: "btn-row" }, [
        el("button", { class: "btn primary-btn", text: "Add your first station", onclick: () => { close(); onConfigure?.(); } }),
      ]),
    ]);
  }

  function noMatches() {
    return el("div", { class: "gc-empty" }, [
      el("div", { class: "gc-empty-title", text: "Nothing matches" }),
      el("p", { class: "gc-empty-text", text: `No station matches “${query}”. Names, hostnames, IPs, ports, sectors and tags are all searchable.` }),
    ]);
  }

  /* ---------- render ---------- */

  function render() {
    cards = [];
    clear(body);
    const all = getStations();
    shell.dataset.density = density();
    shell.dataset.layout = settings.gcLayout || "sectors";

    count.textContent = all.length ? `${all.length} station${all.length === 1 ? "" : "s"}` : "";

    if (!all.length) {
      body.append(emptyState());
      renderFoot();
      return;
    }

    if (query) {
      const hits = searchStations(query).map((h) => h.st);
      body.append(hits.length ? sectionEl("", hits, "flat") : noMatches());
    } else {
      if (settings.gcPinnedRow !== false) {
        const pinned = all.filter((s) => s.pinned);
        if (pinned.length) {
          body.append(sectionEl("Pinned", pinned.slice(0, PINNED_MAX), "pinned"));
        } else {
          // Nothing pinned — fall back to what you actually open, once there is
          // enough history for the row to say something.
          const frequent = [...all].sort((a, b) => frecency(b) - frecency(a)).filter((s) => s.opens > 0);
          if (frequent.length >= 3) body.append(sectionEl("Frequent", frequent.slice(0, PINNED_MAX), "pinned"));
        }
      }
      if (settings.gcLayout === "sectors") {
        for (const sector of sectorsOf(all)) {
          body.append(sectionEl(sector.name, sector.items, "", { openable: true }));
        }
      } else {
        body.append(sectionEl("", [...all].sort((a, b) => a.order - b.order), "flat"));
      }
    }

    if (focusIndex >= cards.length) focusIndex = cards.length - 1;
    paintFocus();
    renderFoot();
    renderBanner();
  }

  function renderBanner() {
    const away = showStatus() && settings.gcAwayDetect !== false && health.isAway();
    banner.hidden = !away;
    if (away) {
      banner.textContent = "Nothing on this list is answering — you are probably not on your home network.";
    }
  }

  function renderFoot() {
    foot.innerHTML = getStations().length
      ? "<kbd>↑↓←→</kbd> move · <kbd>Enter</kbd> open · <kbd>Alt</kbd>+<kbd>1…9</kbd> jump · <kbd>Alt</kbd>+<kbd>Enter</kbd> via IP · <kbd>Esc</kbd> close"
      : "";
  }

  function paintFocus() {
    cards.forEach((c, i) => c.classList.toggle("focused", i === focusIndex));
    if (focusIndex >= 0) cards[focusIndex]?.scrollIntoView({ block: "nearest" });
  }

  /* ---------- keyboard ---------- */

  function moveFocus(dx, dy) {
    if (!cards.length) return;
    if (focusIndex < 0) { focusIndex = 0; paintFocus(); return; }
    if (dx) {
      focusIndex = Math.min(cards.length - 1, Math.max(0, focusIndex + dx));
      paintFocus();
      return;
    }
    // Vertical: nearest card on the row above/below, by horizontal centre.
    const from = cards[focusIndex].getBoundingClientRect();
    const cx = from.left + from.width / 2;
    let best = -1;
    let bestScore = Infinity;
    cards.forEach((c, i) => {
      if (i === focusIndex) return;
      const r = c.getBoundingClientRect();
      const below = r.top > from.top + 4;
      const above = r.bottom < from.bottom - 4;
      if ((dy > 0 && !below) || (dy < 0 && !above)) return;
      const score = Math.abs(r.left + r.width / 2 - cx) + Math.abs(r.top - from.top) * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { focusIndex = best; paintFocus(); }
  }

  function onKey(e) {
    if (!isOpen) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }

    if (e.altKey && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const card = cards[Number(e.key) - 1];
      if (card) {
        const st = getStations().find((s) => s.id === card.dataset.id);
        if (st) openStation(st, e);
      }
      return;
    }

    // While there is text in the filter, left/right belong to the caret.
    const editing = document.activeElement === filter && filter.value.length > 0;

    switch (e.key) {
      case "ArrowRight": if (editing) break; e.preventDefault(); moveFocus(1, 0); break;
      case "ArrowLeft": if (editing) break; e.preventDefault(); moveFocus(-1, 0); break;
      case "ArrowDown": e.preventDefault(); moveFocus(0, 1); break;
      case "ArrowUp": e.preventDefault(); moveFocus(0, -1); break;
      case "Home": if (editing) break; e.preventDefault(); focusIndex = 0; paintFocus(); break;
      case "End": if (editing) break; e.preventDefault(); focusIndex = cards.length - 1; paintFocus(); break;
      case "Enter": {
        if (focusIndex < 0) break;
        e.preventDefault();
        const st = getStations().find((s) => s.id === cards[focusIndex].dataset.id);
        if (st) openStation(st, e);
        break;
      }
      default:
        break;
    }
  }

  /* ---------- open & close ---------- */

  async function runHealth({ force = false } = {}) {
    if (settings.gcHealth === "off") return;
    await health.checkAll(getStations(), { force, timeoutMs: settings.gcHealthTimeout || 2000 });
  }

  function open() {
    settings = getSettings();
    query = "";
    filter.value = "";
    focusIndex = -1;
    render();
    root.hidden = false;
    isOpen = true;
    requestAnimationFrame(() => {
      root.classList.add("on");
      filter.focus();
    });

    if (settings.gcHealth !== "off") {
      runHealth({ force: false });
      if (settings.gcHealth === "interval") health.start(getStations, settings.gcHealthInterval || 60);
    }
    // Fill in icons we have never seen, quietly, after the panel is up.
    backfillIcons(getStations()).then((n) => { if (n && isOpen) render(); });
  }

  function close() {
    if (!isOpen) return;
    root.classList.remove("on");
    isOpen = false;
    health.stop();
    setTimeout(() => { if (!isOpen) root.hidden = true; }, 220);
  }

  filter.addEventListener("input", () => {
    query = filter.value.trim();
    focusIndex = query ? 0 : -1;
    render();
  });
  closeBtn.addEventListener("click", () => close());
  gearBtn.addEventListener("click", () => { close(); onConfigure?.(); });
  statusBtn.addEventListener("click", async () => {
    if (settings.gcHealth === "off") { onToast?.("Reachability checks are off — turn them on in Ground Control settings."); return; }
    await runHealth({ force: true });
  });

  // Probe results arrive one by one — repaint the dots, never the whole grid.
  health.onChange(() => {
    if (!isOpen || !showStatus()) return;
    for (const card of cards) {
      const state = health.get(card.dataset.id);
      card.classList.remove("st-up", "st-down", "st-unknown", "st-checking");
      card.classList.add(`st-${state}`);
      const dot = card.querySelector(".gc-dot");
      if (dot) dot.title = statusTitle(state);
    }
    renderBanner();
  });
  addEventListener("keydown", onKey, true);

  return {
    open, close,
    toggle() { isOpen ? close() : open(); },
    isOpen: () => isOpen,
    update(next) {
      settings = next;
      if (isOpen) render();
    },
    refresh() { if (isOpen) render(); },
  };
}
