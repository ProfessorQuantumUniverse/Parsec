/* Ground Control's own settings panel.
 *
 * Deliberately separate from the main settings: a homelab is a lot of knobs,
 * and people without one should never have to scroll past them.
 */

import { el, clear, icons } from "../util/dom.js";
import { getSettings, updateSettings } from "../state.js";
import {
  getStations, addStation, addMany, updateStation, removeStation, replaceAll,
  onStationsChange, parseTarget, suggestLabel, suggestGroup, sectorNames, renameSector,
  hostLabel, ipLabel, monogram, parseBulk, parseForeignConfig, exportStations,
  isIpLiteral, DEFAULT_SECTOR,
} from "../features/stations.js";
import {
  hasIconPermission, requestIconPermission, dropIconPermission,
  refreshIcons, refreshIcon, iconFor, iconState, fileToIcon,
  clearIconCache, iconCacheStats, primeIconCache,
} from "../features/favicons.js";

/* ---------- control builders (same visual language as the main settings) ---------- */

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
    options.map(([v, label]) => el("option", { value: String(v), text: label, selected: String(get()[key]) === String(v) })));
  sel.addEventListener("change", () => {
    const raw = sel.value;
    set({ [key]: /^-?\d+$/.test(raw) ? Number(raw) : raw });
  });
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

export function initStationsPanel(overlayRoot, { onChanged, onToast, sync }) {
  let activeTab = "stations";
  let editing = null;   // station id whose editor is expanded
  let focusAdd = false; // put the caret back in the add field after a redraw

  const panel = el("aside", { class: "settings-panel gc-settings", hidden: true });
  const backdrop = el("div", { class: "settings-backdrop gc-backdrop", hidden: true, onclick: () => close() });
  overlayRoot.append(backdrop, panel);

  const get = getSettings;
  const set = async (patch) => {
    await updateSettings(patch);
  };

  const TABS = [
    ["stations", "Stations"],
    ["sectors", "Sectors"],
    ["look", "Look"],
    ["icons", "Icons"],
    ["status", "Status"],
    ["data", "Data"],
  ];

  function notify(msg) {
    onToast?.(msg);
  }

  // Station writes notify onStationsChange, which repaints the panel for us.
  async function mutate(fn, msg) {
    await fn();
    onChanged?.();
    if (msg) notify(msg);
  }

  /* ---------- stations tab ---------- */

  function sectorDatalist() {
    const id = "gc-sectors";
    return el("datalist", { id }, sectorNames().map((n) => el("option", { value: n })));
  }

  function quickAdd() {
    const input = el("input", {
      class: "set-text", type: "text", spellcheck: false,
      placeholder: "192.168.1.50:8123 · https://pve.home.arpa:8006 · nas.local",
      "aria-label": "New station address",
    });
    const preview = el("div", { class: "gc-add-preview" });

    const describe = () => {
      const target = parseTarget(input.value);
      if (!input.value.trim()) { preview.textContent = ""; preview.classList.remove("on"); return; }
      if (!target) { preview.textContent = "Not a URL or host:port yet…"; preview.classList.add("on"); return; }
      preview.textContent = `${suggestLabel(target.host, target.port)} · ${target.url} · ${suggestGroup(target.port)}`;
      preview.classList.add("on");
    };

    const submit = async () => {
      const target = parseTarget(input.value);
      if (!target) { notify("That doesn't look like an address — try 192.168.1.50:8123"); return; }
      const st = await addStation({
        url: target.url,
        label: suggestLabel(target.host, target.port),
        group: suggestGroup(target.port),
        ip: isIpLiteral(target.host) ? target.host : "",
      });
      input.value = "";
      preview.textContent = "";
      preview.classList.remove("on");
      editing = st.id;
      focusAdd = true;
      onChanged?.();
      rerender();
      if (await hasIconPermission()) refreshIcon(st).then(() => rerender());
    };

    input.addEventListener("input", describe);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });

    return el("div", { class: "gc-add" }, [
      el("div", { class: "gc-add-row" }, [input, el("button", { class: "btn primary-btn", text: "Add", onclick: submit })]),
      preview,
    ]);
  }

  function stationEditor(st) {
    const field = (label, value, key, opts = {}) => {
      const input = el("input", {
        class: "set-text", type: "text", value: value || "", placeholder: opts.placeholder || "",
        spellcheck: false, list: opts.list || null,
      });
      const commit = () => {
        const v = input.value.trim();
        if (v === (st[key] || "")) return;
        mutate(() => updateStation(st.id, { [key]: v }));
      };
      input.addEventListener("change", commit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });
      return el("label", { class: "gc-field" }, [
        el("span", { class: "gc-field-label", text: label }),
        input,
      ]);
    };

    const iconFile = el("input", { type: "file", accept: "image/*", style: { display: "none" } });
    iconFile.addEventListener("change", async () => {
      const file = iconFile.files[0];
      if (!file) return;
      try {
        const data = await fileToIcon(file);
        await mutate(() => updateStation(st.id, { icon: { mode: "custom", data, color: st.icon.color } }), "Icon set.");
      } catch {
        notify("Couldn't read that image.");
      }
    });

    const state = iconState(st);
    const iconRow = el("div", { class: "btn-row wrap" }, [
      el("button", { class: "btn", text: "Upload icon", onclick: () => iconFile.click() }),
      el("button", { class: "btn", text: "Fetch icon", onclick: async () => {
        if (!(await hasIconPermission())) { notify("Allow network access on the Icons tab first."); return; }
        notify("Looking for an icon…");
        const res = await refreshIcon({ ...st, icon: { ...st.icon, mode: "auto" } }, { force: true });
        if (res === "ok") { await mutate(() => updateStation(st.id, { icon: { mode: "auto", data: null, color: st.icon.color } }), "Icon found."); }
        else notify("No icon found — self-signed certificates usually cause this. Upload one instead.");
      } }),
      st.icon.mode !== "monogram"
        ? el("button", { class: "btn", text: "Use monogram", onclick: () => mutate(() => updateStation(st.id, { icon: { mode: "monogram", data: null, color: st.icon.color } })) })
        : el("button", { class: "btn", text: "Use icon", onclick: () => mutate(() => updateStation(st.id, { icon: { mode: "auto", data: null, color: st.icon.color } })) }),
      el("input", {
        type: "color", class: "swatch-custom", title: "Monogram colour",
        value: st.icon.color || "#ff5c00",
        onchange: (e) => mutate(() => updateStation(st.id, { icon: { ...st.icon, color: e.target.value } })),
      }),
      iconFile,
    ]);

    return el("div", { class: "gc-editor" }, [
      field("Label", st.label, "label", { placeholder: "Home Assistant" }),
      field("URL", st.url, "url", { placeholder: "https://ha.home.arpa:8123" }),
      field("IP address", st.ip, "ip", { placeholder: "192.168.1.50 (or 192.168.1.50:8123)" }),
      field("Sector", st.group, "group", { placeholder: DEFAULT_SECTOR, list: "gc-sectors" }),
      field("Note", st.note, "note", { placeholder: "runs on the NUC" }),
      field("Tags", st.tags.join(", "), "tags", { placeholder: "docker, critical" }),
      el("div", { class: "gc-field-note", text: `Icon: ${state === "cached" ? "fetched" : state === "custom" ? "uploaded" : state === "failed" ? "not found" : state === "off" ? "monogram" : "not fetched yet"}` }),
      iconRow,
      el("div", { class: "gc-editor-flags" }, [
        row("Pin to the top row", (() => {
          const i = el("input", { type: "checkbox", checked: st.pinned });
          i.addEventListener("change", () => mutate(() => updateStation(st.id, { pinned: i.checked })));
          return el("span", { class: "switch" }, [i, el("span", { class: "switch-track" })]);
        })()),
        row("Include in reachability checks", (() => {
          const i = el("input", { type: "checkbox", checked: st.health !== "off" });
          i.addEventListener("change", () => mutate(() => updateStation(st.id, { health: i.checked ? "on" : "off" })));
          return el("span", { class: "switch" }, [i, el("span", { class: "switch-track" })]);
        })()),
      ]),
      el("div", { class: "btn-row" }, [
        el("button", { class: "btn danger", text: "Delete station", onclick: () => {
          if (confirm(`Delete “${st.label}”?`)) mutate(() => removeStation(st.id), "Station deleted.");
        } }),
      ]),
    ]);
  }

  function stationRow(st) {
    const data = iconFor(st);
    const m = monogram(st);
    const icon = data
      ? el("span", { class: "gc-icon small", style: { backgroundImage: `url("${data}")` } })
      : el("span", { class: "gc-icon small mono", style: { "--mono": m.color }, text: m.letters });

    const open = editing === st.id;
    const head = el("button", { class: "gc-item-head" + (open ? " open" : ""), type: "button" }, [
      icon,
      el("span", { class: "gc-item-text" }, [
        el("span", { class: "gc-item-label", text: st.label }),
        el("span", { class: "gc-item-sub", text: [hostLabel(st), ipLabel(st)].filter(Boolean).join("  ·  ") }),
      ]),
      el("span", { class: "gc-item-sector", text: st.group }),
      el("span", { class: "gc-item-chev", html: icons.next }),
    ]);
    head.addEventListener("click", () => { editing = open ? null : st.id; rerender(); });

    return el("div", { class: "gc-item" + (open ? " open" : "") }, [head, open ? stationEditor(st) : null]);
  }

  function renderStations(body) {
    body.append(el("p", { class: "set-section-hint", text:
      "Paste an address and press Enter. Ports you are likely to run are recognised, so the label and sector fill themselves in." }));
    const adder = quickAdd();
    body.append(adder, sectorDatalist());
    if (focusAdd) {
      focusAdd = false;
      requestAnimationFrame(() => adder.querySelector("input")?.focus());
    }

    const list = getStations();
    if (!list.length) {
      body.append(el("p", { class: "set-section-hint", text: "Nothing here yet. Everything below stays hidden until you add something." }));
      return;
    }

    const bySector = new Map();
    for (const st of [...list].sort((a, b) => a.order - b.order)) {
      if (!bySector.has(st.group)) bySector.set(st.group, []);
      bySector.get(st.group).push(st);
    }
    for (const [sector, items] of bySector) {
      body.append(el("h3", { class: "fav-subhead", text: `${sector} · ${items.length}` }));
      const wrap = el("div", { class: "gc-items" });
      items.forEach((st) => wrap.append(stationRow(st)));
      body.append(wrap);
    }
  }

  /* ---------- sectors tab ---------- */

  function renderSectors(body) {
    const list = getStations();
    if (!list.length) {
      body.append(el("p", { class: "set-section-hint", text: "Sectors appear once you have stations. They are just labels — rename one here and every station in it follows." }));
      return;
    }
    body.append(el("p", { class: "set-section-hint", text:
      "Rename a sector and every station in it moves with it. Drag cards between sectors in the overlay itself." }));

    for (const name of sectorNames(list)) {
      const items = list.filter((s) => s.group === name);
      const input = el("input", { class: "set-text", type: "text", value: name, spellcheck: false });
      const commit = () => {
        const next = input.value.trim();
        if (!next || next === name) { input.value = name; return; }
        mutate(() => renameSector(name, next), `Sector renamed to ${next}.`);
      };
      input.addEventListener("change", commit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });

      body.append(el("div", { class: "gc-sector-row" }, [
        input,
        el("span", { class: "gc-sector-count", text: String(items.length) }),
        name === DEFAULT_SECTOR ? null : el("button", {
          class: "btn", text: "Dissolve", title: `Move these ${items.length} back to ${DEFAULT_SECTOR}`,
          onclick: () => mutate(() => renameSector(name, DEFAULT_SECTOR)),
        }),
      ]));
    }
  }

  /* ---------- look tab ---------- */

  function renderLook(body) {
    body.append(el("p", { class: "set-section-hint", text:
      "Ground Control opens with G or the grid button in the dock. Nothing here shows up on the tab itself." }));

    body.append(row("Ground Control", toggle("gcEnabled", get, set), "Turn the whole thing off without losing your stations."));
    body.append(row("Homelab hits in search", toggle("gcPaletteStations", get, set), "Type a name, host, IP or port in the search field."));
    body.append(row("Commands in search", toggle("gcPaletteCommands", get, set), "Type > in the search field for Parsec's own actions."));
    body.append(el("hr", { class: "set-divider" }));

    body.append(row("Layout", select("gcLayout", [
      ["sectors", "Grouped by sector"],
      ["grid", "One flat grid"],
      ["list", "List"],
    ], get, set)));
    body.append(row("Card detail", select("gcDensity", [
      ["compact", "Compact — icon and name"],
      ["normal", "Normal — plus hostname"],
      ["detail", "Detailed — plus IP and note"],
    ], get, set)));
    body.append(row("Columns", select("gcColumns", [
      [0, "Fit to width"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [7, "7"], [8, "8"],
    ], get, set)));
    body.append(row("Backdrop", slider("gcDim", 0.2, 0.95, 0.05, get, set, (v) => `${Math.round(v * 100)}%`),
      "How much of the picture the overlay covers."));

    body.append(el("hr", { class: "set-divider" }));
    body.append(row("Hostnames", toggle("gcShowHost", get, set)));
    body.append(row("IP addresses", toggle("gcShowIp", get, set), "Click one to copy it."));
    body.append(row("Notes", toggle("gcShowNote", get, set), "Detailed cards only."));
    body.append(row("Tags", toggle("gcShowTags", get, set), "Detailed cards only."));
    body.append(row("Sector headings", toggle("gcShowSectorTitles", get, set)));
    body.append(row("Pinned row", toggle("gcPinnedRow", get, set), "A row on top with your pinned — or most used — stations."));
  }

  /* ---------- icons tab ---------- */

  async function renderIcons(body) {
    const granted = await hasIconPermission();
    await primeIconCache();
    const stats = iconCacheStats();

    body.append(el("p", { class: "set-section-hint", html:
      "Homelab services are only reachable from your own machine, so Chrome has no icon for them. " +
      "Parsec can ask each service you added for its favicon, shrink it to 64&nbsp;px and keep it locally. " +
      "<b>Only hosts you entered yourself are ever contacted</b>, and rendering always comes from the cache — " +
      "so the panel looks the same on hotel wifi as it does at home." }));

    const statusLine = el("div", { class: "gc-perm" + (granted ? " on" : "") }, [
      el("span", { class: "gc-perm-dot" }),
      el("span", { text: granted ? "Network access granted" : "Network access not granted — monograms only" }),
    ]);
    body.append(statusLine);

    body.append(el("div", { class: "btn-row wrap" }, [
      granted
        ? el("button", { class: "btn", text: "Revoke access", onclick: async () => {
            await dropIconPermission();
            rerender();
            notify("Access revoked. Cached icons are kept.");
          } })
        : el("button", { class: "btn primary-btn", text: "Allow network access", onclick: async () => {
            const ok = await requestIconPermission();
            rerender();
            if (!ok) { notify("No problem — monograms it is."); return; }
            notify("Fetching icons…");
            const tally = await refreshIcons(getStations(), { force: true });
            onChanged?.();
            rerender();
            notify(`${tally.ok} icon${tally.ok === 1 ? "" : "s"} found, ${tally.failed} not available.`);
          } }),
      el("button", { class: "btn", text: "Refresh all icons", onclick: async () => {
        if (!(await hasIconPermission())) { notify("Allow network access first."); return; }
        notify("Refreshing icons…");
        const tally = await refreshIcons(getStations(), { force: true });
        onChanged?.();
        rerender();
        notify(`${tally.ok} found, ${tally.failed} not available.`);
      } }),
      el("button", { class: "btn", text: "Clear icon cache", onclick: async () => {
        await clearIconCache();
        onChanged?.();
        rerender();
        notify("Icon cache cleared.");
      } }),
    ]));

    body.append(row("Show icons", toggle("gcIcons", get, set), "Off means monograms everywhere."));

    body.append(el("p", { class: "set-section-hint", text:
      `${stats.ok} of ${stats.total} cached hosts have an icon · about ${Math.round(stats.bytes / 1024)} KB stored.` }));

    body.append(el("hr", { class: "set-divider" }));
    body.append(el("p", { class: "set-section-hint", text:
      "If a service uses a self-signed certificate — Proxmox on 8006 and Portainer on 9443 usually do — the fetch will fail " +
      "no matter what, because the extension makes its own trust decision. Upload an icon for those on the Stations tab." }));
  }

  /* ---------- status tab ---------- */

  function renderStatus(body) {
    body.append(el("p", { class: "set-section-hint", text:
      "A reachability check asks each service whether it answers at all. It cannot read anything — the response is opaque by design — " +
      "and it is off until you switch it on." }));

    body.append(row("Reachability checks", select("gcHealth", [
      ["off", "Off"],
      ["onopen", "When Ground Control opens"],
      ["interval", "Keep checking while open"],
    ], get, set)));
    body.append(row("Check every", select("gcHealthInterval", [
      [30, "30 seconds"], [60, "1 minute"], [300, "5 minutes"],
    ], get, set), "Only while the overlay is open."));
    body.append(row("Give up after", select("gcHealthTimeout", [
      [1000, "1 second"], [2000, "2 seconds"], [4000, "4 seconds"],
    ], get, set)));
    body.append(row("Away detection", toggle("gcAwayDetect", get, set),
      "When nothing answers at all, say so once instead of turning every dot red."));

    body.append(el("hr", { class: "set-divider" }));
    body.append(el("p", { class: "set-section-hint", text:
      "Individual stations can opt out on the Stations tab — useful for anything that is meant to be asleep." }));
  }

  /* ---------- data tab ---------- */

  async function renderSync(body) {
    const status = (await sync?.status?.()) || { available: false };

    body.append(el("h3", { class: "fav-subhead", text: "Sync across browsers" }));
    if (!status.available) {
      body.append(el("p", { class: "set-section-hint", text:
        "This browser doesn't offer sync storage, so the list stays on this machine." }));
      return;
    }

    body.append(el("p", { class: "set-section-hint", text:
      "Carries your stations to every browser you are signed into, through the browser's own sync — " +
      "no Parsec account and no server of ours. Icons stay local on each machine: they are a few kilobytes each " +
      "and every device can fetch its own from the same network anyway." }));

    const on = get().gcSync === true;
    const syncSwitch = el("input", { type: "checkbox", checked: on });
    syncSwitch.addEventListener("change", async () => {
      await set({ gcSync: syncSwitch.checked });
      setTimeout(rerender, 700); // let the first reconcile finish before reporting
    });
    body.append(row("Sync my stations",
      el("span", { class: "switch" }, [syncSwitch, el("span", { class: "switch-track" })]),
      "Off keeps everything on this machine only."));

    if (on) {
      const when = status.updatedAt
        ? new Date(status.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : "never";
      const pct = Math.round((status.bytes / status.budget) * 100);
      body.append(el("div", { class: "gc-perm" + (status.error ? "" : " on") }, [
        el("span", { class: "gc-perm-dot" }),
        el("span", { text: status.error
          || (status.remoteCount
            ? `${status.remoteCount} stations in sync · last written ${when}`
            : "Nothing sent yet — it will go up in a moment.") }),
      ]));

      body.append(el("div", { class: "btn-row wrap" }, [
        el("button", { class: "btn", text: "Send mine now", onclick: async () => {
          notify("Sending…");
          const ok = await sync.pushNow();
          rerender();
          if (ok) notify("Stations sent to sync.");
        } }),
        el("button", { class: "btn", text: "Take the synced list", onclick: async () => {
          if (!confirm("Replace the stations on this machine with the synced list?")) return;
          const ok = await sync.pullNow();
          onChanged?.();
          rerender();
          notify(ok ? "Synced list applied." : "Nothing to take yet.");
        } }),
        el("button", { class: "btn danger", text: "Clear synced copy", onclick: async () => {
          if (!confirm("Remove the station list from sync storage? The list on this machine is kept.")) return;
          await sync.clearRemote();
          rerender();
          notify("Synced copy cleared.");
        } }),
      ]));

      if (status.bytes) {
        body.append(el("p", { class: "set-section-hint", text:
          `About ${Math.round(status.bytes / 1024 * 10) / 10} KB of the sync budget used (${pct}%).` }));
      }
      body.append(el("p", { class: "set-section-hint", text:
        "If two machines change the list at once, the later change wins — this is a list, not a database." }));
    }

    body.append(el("hr", { class: "set-divider" }));
  }

  function renderData(body) {
    body.append(el("h3", { class: "fav-subhead", text: "Add many at once" }));
    body.append(el("p", { class: "set-section-hint", text:
      "One per line: Label | URL | IP | Sector. Everything except the URL is optional." }));
    const bulk = el("textarea", {
      class: "set-text gc-bulk", rows: 6, spellcheck: false,
      placeholder: "Proxmox | https://pve.home.arpa:8006 | 192.168.1.2 | Infrastructure\nPortainer | 192.168.1.4:9443\nhttps://jellyfin.home.arpa",
    });
    body.append(bulk);
    body.append(el("div", { class: "btn-row" }, [
      el("button", { class: "btn primary-btn", text: "Add these", onclick: async () => {
        const parsed = parseBulk(bulk.value);
        if (!parsed.length) { notify("Nothing in there parsed as an address."); return; }
        const added = await addMany(parsed);
        bulk.value = "";
        onChanged?.();
        rerender();
        notify(`${added.length} station${added.length === 1 ? "" : "s"} added.`);
      } }),
    ]));

    body.append(el("hr", { class: "set-divider" }));
    body.append(el("h3", { class: "fav-subhead", text: "Import & export" }));
    body.append(el("p", { class: "set-section-hint", text:
      "Reads Parsec station files, and makes a decent job of Heimdall and Homarr exports too — anything with a URL and a name in it." }));

    const file = el("input", { type: "file", accept: "application/json,.json", style: { display: "none" } });
    file.addEventListener("change", async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        const json = JSON.parse(await f.text());
        const own = Array.isArray(json?.stations) ? json.stations : null;
        const found = own || parseForeignConfig(json);
        if (!found.length) { notify("No links found in that file."); return; }
        const added = await addMany(found);
        onChanged?.();
        rerender();
        notify(`${added.length} of ${found.length} imported${added.length < found.length ? " (the rest were already there)" : ""}.`);
      } catch (e) {
        notify(`Import failed: ${e.message}`);
      } finally {
        file.value = "";
      }
    });

    body.append(el("div", { class: "btn-row wrap" }, [
      el("button", { class: "btn", text: "Import…", onclick: () => file.click() }),
      el("button", { class: "btn", text: "Export stations", onclick: () => {
        const data = exportStations();
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const a = el("a", { href: url, download: "parsec-stations.json" });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } }),
      file,
      el("button", { class: "btn danger", text: "Remove all stations", onclick: () => {
        if (!getStations().length) return;
        if (confirm(`Remove all ${getStations().length} stations? Settings and icons are kept.`)) {
          mutate(() => replaceAll([]), "All stations removed.");
        }
      } }),
    ]));
  }

  /* ---------- shell ---------- */

  async function renderBody() {
    const body = el("div", { class: "settings-body" });
    if (activeTab === "stations") renderStations(body);
    else if (activeTab === "sectors") renderSectors(body);
    else if (activeTab === "look") renderLook(body);
    else if (activeTab === "icons") await renderIcons(body);
    else if (activeTab === "status") renderStatus(body);
    else if (activeTab === "data") { await renderSync(body); renderData(body); }
    return body;
  }

  function rerender() {
    if (panel.hidden) return;
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
      el("div", { class: "settings-title", text: "Ground Control" }),
      el("button", { class: "icon-btn", html: icons.close, title: "Close (Esc)", onclick: () => close() }),
    ]);
    panel.append(header, tabs, await renderBody());
  }

  function open(tab) {
    if (tab) activeTab = tab;
    build();
    backdrop.hidden = false;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("open"));
  }

  function close() {
    panel.classList.remove("open");
    backdrop.hidden = true;
    setTimeout(() => (panel.hidden = true), 220);
  }

  onStationsChange(() => rerender());

  return {
    open, close,
    toggle() { panel.hidden ? open() : close(); },
    isOpen: () => !panel.hidden,
  };
}
