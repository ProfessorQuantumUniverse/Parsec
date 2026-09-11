/* Ground Control — the data layer for your homelab.
 *
 * A "station" is one service you run: a label, a URL, optionally the raw IP
 * behind it, a sector (group), tags and a note. Everything lives in
 * chrome.storage.local next to your favorites. No server, ever.
 */

import { storageGet, storageSet } from "../util/cache.js";
import { BRAND } from "../brand.js";

const STATIONS_KEY = `${BRAND.ns}_stations`;

let _stations = [];
let _loaded = false;
const _subs = new Set();

/* Ports that almost always speak TLS, used to guess the scheme when you
 * paste a bare "host:port" without one. */
export const TLS_PORTS = new Set([443, 5001, 8006, 8007, 8443, 8920, 9443, 10000]);

/* Recognising the usual suspects turns "192.168.1.50:8123" into a filled-in
 * form instead of an empty one. Purely a suggestion — always overridable. */
export const KNOWN_PORTS = {
  53: { label: "Pi-hole", group: "Network" },
  81: { label: "Nginx Proxy Manager", group: "Network" },
  1880: { label: "Node-RED", group: "Automation" },
  2283: { label: "Immich", group: "Media" },
  3000: { label: "Grafana", group: "Monitoring" },
  3001: { label: "Uptime Kuma", group: "Monitoring" },
  4533: { label: "Navidrome", group: "Media" },
  5000: { label: "Synology DSM", group: "Storage" },
  5001: { label: "Synology DSM", group: "Storage" },
  5055: { label: "Overseerr", group: "Media" },
  5601: { label: "Kibana", group: "Monitoring" },
  6767: { label: "Bazarr", group: "Media" },
  7575: { label: "Homarr", group: "Infrastructure" },
  7878: { label: "Radarr", group: "Media" },
  8006: { label: "Proxmox VE", group: "Infrastructure" },
  8007: { label: "Proxmox Backup Server", group: "Infrastructure" },
  8086: { label: "InfluxDB", group: "Monitoring" },
  8096: { label: "Jellyfin", group: "Media" },
  8112: { label: "Deluge", group: "Downloads" },
  8123: { label: "Home Assistant", group: "Smart Home" },
  8181: { label: "Tautulli", group: "Media" },
  8200: { label: "Duplicati", group: "Storage" },
  8384: { label: "Syncthing", group: "Storage" },
  8686: { label: "Lidarr", group: "Media" },
  8920: { label: "Jellyfin", group: "Media" },
  8989: { label: "Sonarr", group: "Media" },
  9000: { label: "Portainer", group: "Infrastructure" },
  9090: { label: "Prometheus", group: "Monitoring" },
  9091: { label: "Transmission", group: "Downloads" },
  9443: { label: "Portainer", group: "Infrastructure" },
  9696: { label: "Prowlarr", group: "Media" },
  19999: { label: "Netdata", group: "Monitoring" },
  32400: { label: "Plex", group: "Media" },
};

export const DEFAULT_SECTOR = "Unsorted";

/* ---------- parsing ---------- */

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function isIpLiteral(host) {
  if (!host) return false;
  const bare = String(host).replace(/^\[|\]$/g, "");
  return IPV4.test(bare) || /^[0-9a-f]*:[0-9a-f:]*$/i.test(bare);
}

/** Turn anything a human might paste into { scheme, host, port, path, url }. */
export function parseTarget(raw) {
  let s = String(raw || "").trim().replace(/\s+/g, "");
  if (!s) return null;

  let scheme = "";
  const m = s.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (m) { scheme = m[1].toLowerCase(); s = s.slice(m[0].length); }
  s = s.replace(/^[^@/]*@/, ""); // strip any user:pass@ — we never store credentials

  const cut = s.search(/[/?#]/);
  const hostport = cut >= 0 ? s.slice(0, cut) : s;
  const rawPath = cut >= 0 ? s.slice(cut) : "";
  const path = rawPath === "/" ? "" : rawPath; // so "host/" and "host" are one station

  let host = hostport;
  let port = null;
  const v6 = hostport.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (v6) {
    host = `[${v6[1]}]`;
    port = v6[2] ? Number(v6[2]) : null;
  } else {
    const bits = hostport.split(":");
    if (bits.length === 2 && /^\d+$/.test(bits[1])) { host = bits[0]; port = Number(bits[1]); }
    else if (bits.length > 2) { host = `[${hostport}]`; } // bare IPv6
  }
  if (!host) return null;
  if (!/^\[[^\]]+\]$/.test(host) && !/^[a-z0-9._-]+$/i.test(host)) return null;
  if (port !== null && (port < 1 || port > 65535)) return null;
  if (!isIpLiteral(host) && !host.includes(".") && port === null && !scheme) return null; // a bare word is not a host

  if (!scheme) {
    if (port !== null) scheme = TLS_PORTS.has(port) ? "https" : "http";
    else scheme = isIpLiteral(host) ? "http" : "https";
  }

  return { scheme, host, port, path, url: buildUrl({ scheme, host, port, path }) };
}

export function buildUrl({ scheme, host, port, path }) {
  const isDefault = (scheme === "https" && port === 443) || (scheme === "http" && port === 80);
  return `${scheme}://${host}${port && !isDefault ? `:${port}` : ""}${path || ""}`;
}

/** Best-effort label from a host name: "ha.home.arpa" → "Ha", plus port hints. */
export function suggestLabel(host, port) {
  const known = port != null ? KNOWN_PORTS[port] : null;
  if (known) return known.label;
  const bare = String(host || "").replace(/^\[|\]$/g, "");
  if (!bare) return "Service";
  if (isIpLiteral(bare)) return port ? `Service on ${port}` : "Service";
  const first = bare.split(".")[0].replace(/[-_]+/g, " ").trim();
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Service";
}

export function suggestGroup(port) {
  return (port != null && KNOWN_PORTS[port]?.group) || DEFAULT_SECTOR;
}

/* ---------- shape ---------- */

function makeId() {
  return `st_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function normalizeStation(input = {}) {
  const target = parseTarget(input.url || input.target || "");
  const url = target ? target.url : String(input.url || "").trim();
  const label = String(input.label || "").trim().slice(0, 60);
  return {
    id: input.id || makeId(),
    label: label || suggestLabel(target?.host, target?.port),
    group: String(input.group || "").trim().slice(0, 40) || DEFAULT_SECTOR,
    url,
    ip: String(input.ip || "").trim().slice(0, 60),
    note: String(input.note || "").trim().slice(0, 160),
    tags: (Array.isArray(input.tags) ? input.tags : String(input.tags || "").split(","))
      .map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 8),
    icon: {
      mode: input.icon?.mode === "custom" ? "custom" : input.icon?.mode === "monogram" ? "monogram" : "auto",
      data: typeof input.icon?.data === "string" ? input.icon.data : null,
      color: input.icon?.color || null,
    },
    health: input.health === "off" ? "off" : "on",
    pinned: !!input.pinned,
    order: Number.isFinite(input.order) ? input.order : 0,
    opens: Number.isFinite(input.opens) ? input.opens : 0,
    lastOpened: Number.isFinite(input.lastOpened) ? input.lastOpened : 0,
  };
}

/** Structured view of a station's URL — never throws, even on junk input. */
export function parts(st) {
  try {
    const u = new URL(st.url);
    return {
      scheme: u.protocol.replace(":", ""),
      host: u.hostname,
      explicitPort: u.port ? Number(u.port) : null,
      port: u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80,
      path: (u.pathname === "/" ? "" : u.pathname) + u.search,
      origin: u.origin,
    };
  } catch {
    return { scheme: "http", host: st.url || "", explicitPort: null, port: null, path: "", origin: "" };
  }
}

/** "ha.home.arpa:8123" — what the card shows as the host line. */
export function hostLabel(st) {
  const p = parts(st);
  return p.explicitPort ? `${p.host}:${p.explicitPort}` : p.host;
}

/** "192.168.1.50:8123" — the IP line, or "" when no IP is known. */
export function ipLabel(st) {
  if (!st.ip) return "";
  if (st.ip.includes(":") && !st.ip.startsWith("[")) return st.ip; // user already gave host:port
  const p = parts(st);
  return p.explicitPort ? `${st.ip}:${p.explicitPort}` : st.ip;
}

/** The URL an alt-click should open: same scheme and path, but via the IP. */
export function ipUrl(st) {
  if (!st.ip) return null;
  const p = parts(st);
  const carriesPort = st.ip.includes(":") && !st.ip.startsWith("[");
  const host = carriesPort ? st.ip : st.ip + (p.explicitPort ? `:${p.explicitPort}` : "");
  return `${p.scheme}://${host}${p.path}`;
}

/** Is the host a name rather than an address? Decides whether both lines show. */
export function hasHostname(st) {
  return !isIpLiteral(parts(st).host);
}

const MONO_HUES = [8, 28, 48, 168, 194, 214, 262, 292, 322];

export function monogram(st) {
  const label = st.label || parts(st).host || "?";
  const words = label.split(/[\s._-]+/).filter(Boolean);
  const letters = (words.length > 1 ? words[0][0] + words[1][0] : label.slice(0, 2)).toUpperCase();
  if (st.icon?.color) return { letters, color: st.icon.color };
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { letters, color: `hsl(${MONO_HUES[h % MONO_HUES.length]} 72% 58%)` };
}

/* ---------- storage ---------- */

export async function loadStations() {
  const d = await storageGet(STATIONS_KEY);
  const raw = Array.isArray(d[STATIONS_KEY]) ? d[STATIONS_KEY] : [];
  _stations = raw.map(normalizeStation);
  _loaded = true;
  return _stations;
}

/** Take a list that came from elsewhere — the toolbar popup, another window,
 *  or a synced device — into memory without writing it back out again. */
export function adoptStations(list) {
  _stations = (list || []).map(normalizeStation);
  _loaded = true;
  _subs.forEach((fn) => fn(_stations));
  return _stations;
}

/* An open new tab must not keep showing a stale list after the popup adds
 * something. This fires in every context, including the one that wrote, so
 * the comparison below is what stops it from chasing its own tail. */
if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STATIONS_KEY]) return;
    const next = changes[STATIONS_KEY].newValue;
    if (!Array.isArray(next)) return;
    if (JSON.stringify(next) === JSON.stringify(_stations)) return;
    adoptStations(next);
  });
}

export function getStations() {
  return _stations;
}

export function hasStations() {
  return _loaded && _stations.length > 0;
}

export function onStationsChange(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

function nextOrder() {
  return _stations.length ? Math.max(..._stations.map((s) => s.order)) + 1 : 0;
}

async function persist() {
  await storageSet({ [STATIONS_KEY]: _stations });
  _subs.forEach((fn) => fn(_stations));
  return _stations;
}

export async function addStation(input) {
  const st = normalizeStation(input);
  if (!st.url) throw new Error("A station needs a URL.");
  st.order = nextOrder();
  _stations = [..._stations, st];
  await persist();
  return st;
}

export async function addMany(list) {
  let order = nextOrder();
  const added = [];
  for (const input of list) {
    const st = normalizeStation(input);
    if (!st.url) continue;
    if (_stations.some((x) => x.url === st.url)) continue; // don't duplicate on re-import
    if (added.some((x) => x.url === st.url)) continue;
    st.order = order++;
    added.push(st);
  }
  if (added.length) { _stations = [..._stations, ...added]; await persist(); }
  return added;
}

export async function updateStation(id, patch) {
  _stations = _stations.map((s) => (s.id === id ? normalizeStation({ ...s, ...patch, id }) : s));
  await persist();
  return _stations.find((s) => s.id === id);
}

export async function removeStation(id) {
  _stations = _stations.filter((s) => s.id !== id);
  await persist();
}

export async function replaceAll(list) {
  _stations = (list || []).map(normalizeStation);
  await persist();
}

/** Persist a new ordering (array of ids, in display order). */
export async function reorderStations(ids) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  _stations = _stations
    .map((s) => (pos.has(s.id) ? { ...s, order: pos.get(s.id) } : s))
    .sort((a, b) => a.order - b.order);
  await persist();
}

/** Bump usage counters — drives the frecency ranking in the palette. */
export async function recordOpen(id) {
  return recordOpens([id]);
}

/** Same, for opening a whole sector at once: one write, not eight. */
export async function recordOpens(ids) {
  const now = Date.now();
  let touched = false;
  for (const id of ids) {
    const st = _stations.find((s) => s.id === id);
    if (!st) continue;
    st.opens = (st.opens || 0) + 1;
    st.lastOpened = now;
    touched = true;
  }
  if (touched) await storageSet({ [STATIONS_KEY]: _stations });
}

/* ---------- sectors ---------- */

export function sectorsOf(list = _stations) {
  const map = new Map();
  for (const s of [...list].sort((a, b) => a.order - b.order)) {
    if (!map.has(s.group)) map.set(s.group, []);
    map.get(s.group).push(s);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}

export function sectorNames(list = _stations) {
  return [...new Set(list.map((s) => s.group))].sort((a, b) =>
    a === DEFAULT_SECTOR ? 1 : b === DEFAULT_SECTOR ? -1 : a.localeCompare(b));
}

export async function renameSector(from, to) {
  const name = String(to || "").trim().slice(0, 40) || DEFAULT_SECTOR;
  if (name === from) return;
  _stations = _stations.map((s) => (s.group === from ? { ...s, group: name } : s));
  await persist();
}

/* ---------- ranking ---------- */

/** Subsequence match with bonuses for prefixes and word boundaries. 0 = no match. */
function fuzzy(needle, hay) {
  if (!needle || !hay) return 0;
  const n = needle.toLowerCase();
  const h = String(hay).toLowerCase();
  const idx = h.indexOf(n);
  if (idx === 0) return 1000 - Math.min(h.length, 40);
  if (idx > 0) {
    const boundary = /[\s._\-:/]/.test(h[idx - 1]);
    return (boundary ? 820 : 620) - idx * 2 - Math.min(h.length, 40) * 0.3;
  }
  let score = 0, at = 0, streak = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, at);
    if (found < 0) return 0;
    if (found === at && at > 0) { streak++; score += 14 + streak * 5; }
    else { streak = 0; score += Math.max(3, 12 - (found - at)); }
    at = found + 1;
  }
  return Math.max(1, score - Math.min(h.length, 60) * 0.25);
}

/** How much a station has earned its place, independent of the query. */
export function frecency(st) {
  const opens = Math.log2(1 + (st.opens || 0)) * 38;
  if (!st.lastOpened) return opens;
  const age = Date.now() - st.lastOpened;
  const hour = 3600e3;
  const recency =
    age < hour ? 130 :
    age < 24 * hour ? 90 :
    age < 7 * 24 * hour ? 45 :
    age < 30 * 24 * hour ? 18 : 0;
  return opens + recency;
}

const FIELDS = [
  ["label", 1],
  ["host", 0.78],
  ["ip", 0.74],
  ["group", 0.52],
  ["tags", 0.6],
  ["note", 0.34],
];

/** Rank stations against a query. Empty query → frecency order. */
export function searchStations(query, list = _stations) {
  const q = String(query || "").trim();
  if (!q) {
    return [...list]
      .map((st) => ({ st, score: frecency(st) }))
      .sort((a, b) => b.score - a.score || a.st.label.localeCompare(b.st.label));
  }
  const isPort = /^\d{2,5}$/.test(q);
  const out = [];
  for (const st of list) {
    const p = parts(st);
    const hay = {
      label: st.label,
      host: hostLabel(st),
      ip: ipLabel(st) || st.ip,
      group: st.group,
      tags: st.tags.join(" "),
      note: st.note,
    };
    let best = 0;
    for (const [field, weight] of FIELDS) {
      const s = fuzzy(q, hay[field]) * weight;
      if (s > best) best = s;
    }
    // Typing a port number is a first-class way to find a service.
    if (isPort && p.explicitPort === Number(q)) best = Math.max(best, 1100);
    if (best <= 0) continue;
    out.push({ st, score: best + frecency(st) * 0.4 });
  }
  return out.sort((a, b) => b.score - a.score || a.st.label.localeCompare(b.st.label));
}

export function filterByTag(tag, list = _stations) {
  const t = String(tag || "").trim().toLowerCase();
  if (!t) return [...list];
  return list.filter((s) => s.tags.some((x) => x.includes(t)));
}

/* ---------- bulk input ---------- */

/** One station per line: "Label | url | ip", everything but the URL optional. */
export function parseBulk(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const cells = raw.split(/\s*[|,;\t]\s*/).map((c) => c.trim()).filter(Boolean);
    let label = "", url = "", ip = "", group = "";

    if (cells.length === 1) {
      url = cells[0];
    } else {
      // The first cell that parses as a target is the URL; cell 0 is the label.
      const urlIdx = cells.findIndex((c, i) => i > 0 && parseTarget(c));
      if (urlIdx < 0) { url = cells[0]; label = cells[1] || ""; }
      else { label = cells[0]; url = cells[urlIdx]; }
      for (let i = 1; i < cells.length; i++) {
        if (i === urlIdx) continue;
        const t = parseTarget(cells[i]);
        if (t && isIpLiteral(t.host) && !ip) ip = t.port ? `${t.host}:${t.port}` : t.host;
        else if (!group) group = cells[i];
      }
    }

    const target = parseTarget(url);
    if (!target) continue;
    if (!ip && isIpLiteral(target.host)) ip = target.host;
    out.push({
      label: label || suggestLabel(target.host, target.port),
      url: target.url,
      ip,
      group: group || suggestGroup(target.port),
    });
  }
  return out;
}

/** Walk any JSON (Heimdall, Homarr, a plain array…) and pull out link-shaped
 * objects. Deliberately tolerant: their schemas change, this shouldn't. */
export function parseForeignConfig(json) {
  const found = [];
  const seen = new Set();
  const urlKeys = ["url", "href", "link", "externalurl", "internalurl", "appurl"];
  const nameKeys = ["label", "name", "title", "appname"];
  const groupKeys = ["category", "group", "section", "area", "tab"];

  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 8) return;
    if (Array.isArray(node)) { node.forEach((n) => visit(n, depth + 1)); return; }

    const keys = new Map(Object.keys(node).map((k) => [k.toLowerCase(), k]));
    const pick = (candidates) => {
      for (const c of candidates) {
        const real = keys.get(c);
        if (real && typeof node[real] === "string" && node[real].trim()) return node[real].trim();
      }
      return "";
    };

    const url = pick(urlKeys);
    if (url) {
      const target = parseTarget(url);
      if (target && !seen.has(target.url)) {
        seen.add(target.url);
        found.push({
          label: pick(nameKeys) || suggestLabel(target.host, target.port),
          url: target.url,
          ip: isIpLiteral(target.host) ? target.host : "",
          group: pick(groupKeys) || suggestGroup(target.port),
        });
      }
    }
    for (const v of Object.values(node)) visit(v, depth + 1);
  };

  visit(json, 0);
  return found;
}

export function exportStations() {
  return { app: BRAND.ns, kind: "stations", version: 1, exported: new Date().toISOString(), stations: _stations };
}
