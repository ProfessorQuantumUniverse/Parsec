/* The jump palette.
 *
 * It lives inside the existing search field, so it costs nothing when it has
 * nothing to say: type a few letters and your own services rank above the web
 * search; type a port number and you land on the thing listening there.
 *
 * Prefixes: ">" commands, "@" stations only, "#" by tag.
 */

import { el, clear, icons } from "../util/dom.js";
import { getSettings } from "../state.js";
import {
  searchStations, filterByTag, hostLabel, ipLabel, ipUrl, monogram, hasHostname,
} from "../features/stations.js";
import { iconFor } from "../features/favicons.js";

const MAX_ROWS = 8;
/* Below this score a match is too vague to hijack the Enter key — the list
 * still shows, you just have to reach for the arrow keys. */
const AUTOSELECT_SCORE = 600;

export function initPalette({ mount, input, form, commands = [], onOpenStation }) {
  const list = el("div", { class: "palette", hidden: true, role: "listbox", id: "parsec-palette" });
  const hint = el("div", { class: "palette-hint" });
  const box = el("div", { class: "palette-box", hidden: true }, [list, hint]);
  mount.append(box);

  let rows = [];        // [{ kind, st?, cmd?, score }]
  let selected = -1;
  let open = false;
  let prefixed = false; // ">", "@" or "#" — an explicit ask, so preselect
  let settings = getSettings();

  const enabled = () => settings.gcEnabled !== false;
  const stationsOn = () => enabled() && settings.gcPaletteStations !== false;
  const commandsOn = () => settings.gcPaletteCommands !== false;

  /* ---------- matching ---------- */

  function matchCommands(q) {
    if (!commandsOn()) return [];
    const needle = q.toLowerCase().trim();
    return commands
      .map((cmd) => {
        const hay = `${cmd.label} ${(cmd.keywords || []).join(" ")}`.toLowerCase();
        if (!needle) return { cmd, score: 500 - commands.indexOf(cmd) };
        const idx = hay.indexOf(needle);
        if (idx < 0) return null;
        return { cmd, score: idx === 0 ? 900 : 700 - idx };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }

  function compute(raw) {
    const text = raw.trim();
    prefixed = /^[>@#]/.test(text);
    if (!text && !open) return [];

    if (text.startsWith(">")) {
      return matchCommands(text.slice(1)).slice(0, MAX_ROWS).map((c) => ({ kind: "cmd", ...c }));
    }
    if (text.startsWith("@")) {
      if (!stationsOn()) return [];
      return searchStations(text.slice(1).trim()).slice(0, MAX_ROWS)
        .map(({ st, score }) => ({ kind: "station", st, score }));
    }
    if (text.startsWith("#")) {
      if (!stationsOn()) return [];
      return filterByTag(text.slice(1).trim()).slice(0, MAX_ROWS)
        .map((st) => ({ kind: "station", st, score: 800 }));
    }

    const hits = stationsOn()
      ? searchStations(text).slice(0, MAX_ROWS).map(({ st, score }) => ({ kind: "station", st, score }))
      : [];
    if (hits.length) return hits;

    // Nothing of yours matched — offer commands, but only on a solid hit.
    if (text) {
      return matchCommands(text).filter((c) => c.score >= 700).slice(0, 4)
        .map((c) => ({ kind: "cmd", ...c }));
    }
    return matchCommands("").slice(0, MAX_ROWS).map((c) => ({ kind: "cmd", ...c }));
  }

  /* ---------- rendering ---------- */

  function iconNode(st) {
    const data = settings.gcIcons !== false ? iconFor(st) : null;
    if (data) return el("span", { class: "pal-icon", style: { backgroundImage: `url("${data}")` } });
    const m = monogram(st);
    return el("span", { class: "pal-icon mono", style: { "--mono": m.color }, text: m.letters });
  }

  function renderStationRow(st, i) {
    const ip = ipLabel(st);
    const meta = [];
    if (hasHostname(st)) meta.push(el("span", { class: "pal-host", text: hostLabel(st) }));
    if (ip && (!hasHostname(st) || settings.gcShowIp !== false)) {
      meta.push(el("span", { class: "pal-ip", text: ip }));
    }
    return el("div", {
      class: "pal-row" + (i === selected ? " sel" : ""),
      role: "option", "aria-selected": String(i === selected), dataset: { i: String(i) },
    }, [
      iconNode(st),
      el("span", { class: "pal-main" }, [
        el("span", { class: "pal-label", text: st.label }),
        meta.length ? el("span", { class: "pal-meta" }, meta) : null,
      ]),
      el("span", { class: "pal-sector", text: st.group }),
    ]);
  }

  function renderCommandRow(cmd, i) {
    return el("div", {
      class: "pal-row cmd" + (i === selected ? " sel" : ""),
      role: "option", "aria-selected": String(i === selected), dataset: { i: String(i) },
    }, [
      el("span", { class: "pal-icon glyph", html: icons[cmd.icon] || icons.next }),
      el("span", { class: "pal-main" }, [
        el("span", { class: "pal-label", text: cmd.label }),
        cmd.hint ? el("span", { class: "pal-meta" }, [el("span", { class: "pal-host", text: cmd.hint })]) : null,
      ]),
      cmd.key ? el("span", { class: "pal-sector", text: cmd.key }) : null,
    ]);
  }

  function render() {
    clear(list);
    rows.forEach((r, i) => {
      list.append(r.kind === "station" ? renderStationRow(r.st, i) : renderCommandRow(r.cmd, i));
    });

    const row = rows[selected];
    if (row?.kind === "station" && row.st.ip) {
      hint.innerHTML = "<kbd>Enter</kbd> open · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> new tab · <kbd>Alt</kbd>+<kbd>Enter</kbd> via IP";
    } else if (rows.length) {
      hint.innerHTML = "<kbd>Enter</kbd> open · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> new tab · <kbd>&gt;</kbd> commands";
    } else {
      hint.innerHTML = "";
    }
    hint.hidden = !rows.length;
  }

  function show() {
    if (box.hidden) {
      box.hidden = false;
      requestAnimationFrame(() => box.classList.add("on"));
    }
    open = true;
    input.setAttribute("aria-expanded", "true");
  }

  function hide() {
    box.classList.remove("on");
    box.hidden = true;
    list.hidden = true;
    clear(list);
    open = false;
    selected = -1;
    rows = [];
    input.setAttribute("aria-expanded", "false");
  }

  function refresh({ force = false } = {}) {
    if (!enabled() && !commandsOn()) { hide(); return false; }
    // Clearing the field puts the search bar back the way it was.
    if (!input.value.trim() && !force) { hide(); return false; }
    rows = compute(input.value);
    if (!rows.length) { hide(); return false; }
    // A single letter is never a strong enough signal to take the Enter key.
    const confident = input.value.trim().length >= 2 && rows[0].score >= AUTOSELECT_SCORE;
    selected = force || prefixed || confident ? 0 : -1;
    list.hidden = false;
    render();
    show();
    return true;
  }

  /* ---------- actions ---------- */

  function activate(i, e = {}) {
    const row = rows[i];
    if (!row) return false;
    if (row.kind === "cmd") {
      hide();
      input.value = "";
      row.cmd.run();
      return true;
    }
    const viaIp = !!e.altKey && !!ipUrl(row.st);
    const newTab = !!(e.ctrlKey || e.metaKey);
    hide();
    input.value = "";
    onOpenStation(row.st, { newTab, viaIp });
    return true;
  }

  function move(delta) {
    if (!rows.length) return;
    const next = selected + delta;
    selected = next < 0 ? rows.length - 1 : next >= rows.length ? 0 : next;
    render();
    list.querySelector(".pal-row.sel")?.scrollIntoView({ block: "nearest" });
  }

  /* ---------- wiring ---------- */

  input.addEventListener("input", () => refresh());
  input.addEventListener("focus", () => { if (input.value.trim()) refresh(); });
  input.addEventListener("blur", () => setTimeout(() => { if (!box.matches(":hover")) hide(); }, 120));

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); open ? move(1) : refresh({ force: true }); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); move(-1); return; }
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); hide(); return; }
    if (e.key === "Tab" && open && rows.length) {
      const row = rows[selected >= 0 ? selected : 0];
      if (row?.kind === "station") { e.preventDefault(); input.value = row.st.label; refresh(); }
      return;
    }
    if (e.key === "Enter" && open && selected >= 0) {
      e.preventDefault();
      activate(selected, e);
    }
  });

  list.addEventListener("mousemove", (e) => {
    const row = e.target.closest(".pal-row");
    if (!row) return;
    const i = Number(row.dataset.i);
    if (i !== selected) { selected = i; render(); }
  });
  list.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the input
  list.addEventListener("click", (e) => {
    const row = e.target.closest(".pal-row");
    if (row) activate(Number(row.dataset.i), e);
  });

  form.addEventListener("submit", () => hide());

  return {
    update(next) {
      settings = next;
      if (open) refresh();
    },
    /** Ctrl+K: focus the field and show what you have, query or not.
     *  Returns false when there is nothing to show at all. */
    open() {
      input.focus();
      input.select();
      return refresh({ force: true });
    },
    close: hide,
    isOpen: () => open,
    refreshIcons: () => { if (open) render(); },
  };
}
