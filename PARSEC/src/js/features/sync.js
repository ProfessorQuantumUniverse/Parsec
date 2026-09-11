/* Optional sync of your station list across the browsers you are signed into.
 *
 * chrome.storage.sync is small and rate-limited, so this is deliberately
 * narrow: the list travels, the icons do not. A cached favicon is a few
 * kilobytes per host and would eat the whole 100 KB budget in a dozen
 * services — and every device can fetch its own from the same LAN anyway.
 *
 * Conflict handling is last-writer-wins on a timestamp. For a list one person
 * edits from two machines that is the honest model; anything cleverer would
 * pretend to a certainty we don't have.
 */

import { storageGet, storageSet, storageRemove } from "../util/cache.js";
import { BRAND } from "../brand.js";
import { getStations, adoptStations, normalizeStation } from "./stations.js";

const META_KEY = `${BRAND.ns}_sync_meta`;      // in sync:  { updatedAt, chunks, v }
const CHUNK_KEY = `${BRAND.ns}_sync_c`;        // in sync:  chunk 0..n of the JSON
const STATE_KEY = `${BRAND.ns}_sync_state`;    // in local: { updatedAt, hash }

const CHUNK_SIZE = 6000;   // sync allows 8 KB per item; leave room for overhead
const MAX_CHUNKS = 12;     // ~72 KB of stations, well inside the 100 KB total
const PUSH_DEBOUNCE = 4000;

/* ---------- small helpers ---------- */

function syncGet(keys) {
  return new Promise((resolve) =>
    chrome.storage.sync.get(keys, (v) => resolve(chrome.runtime.lastError ? {} : v || {}))
  );
}

function syncSet(obj) {
  return new Promise((resolve) =>
    chrome.storage.sync.set(obj, () => resolve(chrome.runtime.lastError?.message || null))
  );
}

function syncRemove(keys) {
  return new Promise((resolve) => chrome.storage.sync.remove(keys, () => resolve()));
}

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** What actually travels: everything except the locally cached icon. */
function slim(st) {
  const { icon, ...rest } = st;
  return { ...rest, iconColor: icon?.color || null };
}

/** Put a synced list back together, keeping this device's own icons. */
function rehydrate(list, local) {
  const byId = new Map(local.map((s) => [s.id, s]));
  return list.map(({ iconColor, ...rest }) => {
    const mine = byId.get(rest.id);
    return normalizeStation({
      ...rest,
      icon: mine ? mine.icon : { mode: "auto", data: null, color: iconColor || null },
    });
  });
}

function chunkify(text) {
  const out = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) out.push(text.slice(i, i + CHUNK_SIZE));
  return out;
}

/* ---------- controller ---------- */

export function createSync({ onNote, onAdopt } = {}) {
  let enabled = false;
  let busy = false;       // a push or pull of ours is in flight
  let timer = 0;
  let lastError = "";
  let unsubscribe = null;

  const available = () => typeof chrome !== "undefined" && !!chrome.storage?.sync;

  async function readState() {
    const d = await storageGet(STATE_KEY);
    return d[STATE_KEY] || { updatedAt: 0, hash: "" };
  }

  async function writeState(state) {
    await storageSet({ [STATE_KEY]: state });
  }

  /* ---- push ---- */

  async function pushNow() {
    if (!enabled || !available()) return;
    const list = getStations().map(slim);
    const text = JSON.stringify(list);
    const sig = hash(text);
    const state = await readState();
    if (sig === state.hash) return; // nothing actually changed

    const chunks = chunkify(text);
    if (chunks.length > MAX_CHUNKS) {
      lastError = "Too many stations to sync — the browser's sync storage is full.";
      onNote?.(lastError);
      return;
    }

    busy = true;
    try {
      const updatedAt = Date.now();
      const payload = { [META_KEY]: { updatedAt, chunks: chunks.length, v: 1 } };
      chunks.forEach((c, i) => (payload[`${CHUNK_KEY}${i}`] = c));
      const err = await syncSet(payload);
      if (err) {
        lastError = /quota/i.test(err)
          ? "Sync storage is full — remove a few stations or turn sync off."
          : `Sync failed: ${err}`;
        onNote?.(lastError);
        return;
      }
      // Drop chunks left behind by a previously longer list.
      const stale = [];
      for (let i = chunks.length; i < MAX_CHUNKS; i++) stale.push(`${CHUNK_KEY}${i}`);
      if (stale.length) await syncRemove(stale);

      lastError = "";
      await writeState({ updatedAt, hash: sig });
    } finally {
      busy = false;
    }
  }

  function schedulePush() {
    if (!enabled) return;
    clearTimeout(timer);
    timer = setTimeout(() => pushNow(), PUSH_DEBOUNCE);
  }

  /* ---- pull ---- */

  async function readRemote() {
    const meta = (await syncGet(META_KEY))[META_KEY];
    if (!meta || !meta.chunks) return null;
    const keys = Array.from({ length: meta.chunks }, (_, i) => `${CHUNK_KEY}${i}`);
    const parts = await syncGet(keys);
    let text = "";
    for (const k of keys) {
      if (typeof parts[k] !== "string") return null; // a chunk is missing — ignore this round
      text += parts[k];
    }
    try {
      const list = JSON.parse(text);
      return Array.isArray(list) ? { list, updatedAt: meta.updatedAt } : null;
    } catch {
      return null;
    }
  }

  async function adopt(remote) {
    const merged = rehydrate(remote.list, getStations());
    busy = true;
    try {
      adoptStations(merged);
      await storageSet({ [`${BRAND.ns}_stations`]: merged });
      await writeState({ updatedAt: remote.updatedAt, hash: hash(JSON.stringify(merged.map(slim))) });
    } finally {
      busy = false;
    }
    onAdopt?.(merged);
  }

  /** Decide once, on startup or when the switch is flipped, who is newer. */
  async function reconcile() {
    if (!enabled || !available()) return;
    const [remote, state] = await Promise.all([readRemote(), readState()]);
    if (!remote) { await pushNow(); return; }
    if (remote.updatedAt > state.updatedAt) {
      await adopt(remote);
      onNote?.(`Stations updated from sync (${remote.list.length}).`);
      return;
    }
    await pushNow();
  }

  /* ---- live updates from another device ---- */

  function onStorage(changes, area) {
    if (area !== "sync" || !enabled || busy || !changes[META_KEY]) return;
    const meta = changes[META_KEY].newValue;
    if (!meta?.updatedAt) return;
    readState().then((state) => {
      if (meta.updatedAt <= state.updatedAt) return;
      readRemote().then((remote) => {
        if (!remote) return;
        adopt(remote).then(() => onNote?.("Stations updated from another device."));
      });
    });
  }

  return {
    /** Called whenever the local list changes. */
    notifyLocalChange() {
      if (enabled && !busy) schedulePush();
    },

    async update(settings) {
      const want = settings.gcSync === true && available();
      if (want === enabled) return;
      enabled = want;
      if (enabled) {
        if (!unsubscribe) {
          chrome.storage.onChanged.addListener(onStorage);
          unsubscribe = () => chrome.storage.onChanged.removeListener(onStorage);
        }
        await reconcile();
      } else {
        clearTimeout(timer);
        unsubscribe?.();
        unsubscribe = null;
      }
    },

    /** Explicit "send mine now", for the button in the panel. */
    async pushNow() {
      if (!enabled) return false;
      await writeState({ updatedAt: 0, hash: "" }); // force a write even if unchanged
      await pushNow();
      return !lastError;
    },

    /** Explicit "take theirs now". */
    async pullNow() {
      if (!enabled) return false;
      const remote = await readRemote();
      if (!remote) return false;
      await adopt(remote);
      return true;
    },

    /** Forget everything stored in sync — the local list is untouched. */
    async clearRemote() {
      const keys = [META_KEY, ...Array.from({ length: MAX_CHUNKS }, (_, i) => `${CHUNK_KEY}${i}`)];
      await syncRemove(keys);
      await storageRemove(STATE_KEY);
    },

    async status() {
      if (!available()) return { available: false, enabled: false };
      const [remote, state] = await Promise.all([readRemote(), readState()]);
      const bytes = remote ? JSON.stringify(remote.list).length : 0;
      return {
        available: true,
        enabled,
        error: lastError,
        remoteCount: remote ? remote.list.length : 0,
        updatedAt: remote ? remote.updatedAt : 0,
        inSyncWithLocal: !!remote && state.updatedAt >= remote.updatedAt,
        bytes,
        budget: CHUNK_SIZE * MAX_CHUNKS,
      };
    },
  };
}
