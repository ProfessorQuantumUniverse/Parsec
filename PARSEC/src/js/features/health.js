/* Reachability probes for stations — opt-in, and off by default.
 *
 * A no-cors request gives us an opaque response we cannot read, which is
 * exactly enough to answer the only question worth asking on a new tab page:
 * is this thing answering right now? Nothing is parsed, nothing is logged,
 * and no host permission is needed for it.
 *
 * The important nuance is away-detection. A dashboard full of red dots
 * because you are on a train is noise, not information, so when nothing at
 * all responds we say "not on your network" and leave the dots neutral.
 */

const CONCURRENCY = 6;
const RESULT_TTL = 45e3;

export function createHealth() {
  const status = new Map(); // id → { state, ts }
  const subs = new Set();
  let away = false;
  let running = false;
  let timer = 0;

  function emit() {
    subs.forEach((fn) => fn());
  }

  function timeoutSignal(ms) {
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) return AbortSignal.timeout(ms);
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  }

  async function probe(st, timeoutMs) {
    try {
      await fetch(st.url, {
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "follow",
        signal: timeoutSignal(timeoutMs),
      });
      return "up";
    } catch {
      return "down";
    }
  }

  /** state for one station: "up" | "down" | "unknown" | "checking" */
  function get(id) {
    return status.get(id)?.state || "unknown";
  }

  function isAway() {
    return away;
  }

  function fresh(id) {
    const hit = status.get(id);
    return hit && Date.now() - hit.ts < RESULT_TTL && hit.state !== "checking";
  }

  async function checkAll(stations, { force = false, timeoutMs = 2000 } = {}) {
    if (running) return;
    const queue = stations.filter((s) => s.health !== "off" && (force || !fresh(s.id)));
    if (!queue.length) return;

    running = true;
    away = false; // never leave a stale "you are away" up while we re-check
    queue.forEach((s) => status.set(s.id, { state: "checking", ts: Date.now() }));
    emit();

    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const st = queue[cursor++];
        const state = await probe(st, timeoutMs);
        status.set(st.id, { state, ts: Date.now() });
        emit();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

    const probed = stations.filter((s) => s.health !== "off" && status.has(s.id));
    const up = probed.filter((s) => get(s.id) === "up").length;
    away = probed.length >= 2 && up === 0;

    running = false;
    emit();
  }

  function start(getStations, intervalSec) {
    stop();
    const tick = () => checkAll(getStations(), { force: true });
    timer = setInterval(() => { if (!document.hidden) tick(); }, Math.max(15, intervalSec) * 1000);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = 0; }
  }

  function reset() {
    status.clear();
    away = false;
    emit();
  }

  return {
    get, isAway, checkAll, start, stop, reset,
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
