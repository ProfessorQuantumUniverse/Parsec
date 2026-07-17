
export function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

export function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

export function storageRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

export async function cacheGet(key) {
  const wrapKey = `cache:${key}`;
  const data = await storageGet(wrapKey);
  const entry = data[wrapKey];
  if (!entry) return undefined;
  if (entry.expires && Date.now() > entry.expires) return undefined;
  return entry.value;
}

export async function cacheSet(key, value, ttlMs = 0) {
  const wrapKey = `cache:${key}`;
  await storageSet({
    [wrapKey]: { value, expires: ttlMs > 0 ? Date.now() + ttlMs : 0, stored: Date.now() },
  });
}

export async function cached(key, ttlMs, producer) {
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  await cacheSet(key, value, ttlMs);
  return value;
}
