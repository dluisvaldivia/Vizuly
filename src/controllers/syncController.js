/**
 * Cross-device profile sync, against the Cloudflare Worker in worker/.
 *
 * What syncs is what an adult would hate to set up twice: child profiles,
 * favourites, swipe ratings and pinned corrections. NOT the word to pictogram
 * cache, which is derivable and whose whole job is to be local (rule 3).
 *
 * The snapshot is the raw localStorage strings, never a parsed shape, so adding
 * a field to a profile or a favourite needs no change here or in the Worker.
 *
 * Every call fails silently and nothing here is load-bearing. The child's app
 * works with no network, so a dead Worker costs the sync and nothing else.
 *
 * Same localStorage pattern as languageController.js.
 */

const ACCOUNT_KEY = 'vizuly.sync.account.v1';
const AT_KEY = 'vizuly.sync.at.v1';

/** Whole-value keys that make up a profile. */
const KEYS = ['vizuly.children.v1', 'vizuly.favorites.v1', 'vizuly.ratings.v1'];

/** Corrections are one key per word, so they are collected by prefix. */
const CORRECTION_PREFIX = 'vizuly.correction.v1';

const API = (import.meta.env?.VITE_SYNC_URL ?? '').replace(/\/$/, '');

/** No URL configured means no sync and no sync UI. */
export function syncAvailable() {
  return API !== '';
}

export function getAccount() {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function remember(account, at) {
  try {
    if (account) localStorage.setItem(ACCOUNT_KEY, account);
    if (at != null) localStorage.setItem(AT_KEY, String(at));
  } catch {
    // Storage unavailable. Sync is off for this session, nothing else breaks.
  }
}

/** Stops syncing on this device. The stored profile is left untouched. */
export function forgetAccount() {
  try {
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(AT_KEY);
  } catch {
    // Nothing to do.
  }
}

function localAt() {
  try {
    return Number(localStorage.getItem(AT_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Every synced key and its raw stored string. */
export function snapshot() {
  const keys = new Set(KEYS);
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(CORRECTION_PREFIX)) keys.add(key);
  }
  const entries = {};
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value != null) entries[key] = value;
  }
  return { at: Date.now(), entries };
}

/**
 * Write a pulled snapshot into storage. The caller reloads afterwards, because
 * every controller reads storage once on init.
 *
 * ponytail: last write wins on the whole snapshot. Two devices changing
 * different children between syncs, and the older push loses. Merge per key
 * with a per-key timestamp if that ever bites in practice.
 */
export function applySnapshot(remote) {
  if (!remote || typeof remote.entries !== 'object' || remote.entries === null) return false;
  try {
    for (const [key, value] of Object.entries(remote.entries)) {
      if (typeof value === 'string') localStorage.setItem(key, value);
    }
  } catch {
    return false;
  }
  remember(null, remote.at);
  return true;
}

/** A code for the other device to type. Creates the account on first use. */
export async function createPairCode() {
  const response = await fetch(`${API}/pair/${getAccount() ?? ''}`, { method: 'POST' });
  if (!response.ok) throw new Error('pair_failed');
  const result = await response.json();
  remember(result.account, null);
  // Push first, so the joining device finds a profile rather than nothing.
  await push();
  return result.code;
}

/**
 * Join the account behind a code. Returns the pulled snapshot for the caller to
 * apply, or null when the code is wrong or expired.
 */
export async function redeemPairCode(code) {
  const response = await fetch(`${API}/claim/${String(code).trim()}`, { method: 'POST' });
  if (!response.ok) return null;
  const { account } = await response.json();
  remember(account, null);
  // A fresh device has an empty local snapshot, so take whatever is stored.
  return fetch(`${API}/state/${account}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

/** Fire and forget: the adult never waits on this and never sees it fail. */
export function push() {
  const account = getAccount();
  if (!account || !syncAvailable()) return Promise.resolve(false);
  const body = snapshot();
  return fetch(`${API}/state/${account}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then((response) => {
      if (response.ok) remember(account, body.at);
      return response.ok;
    })
    .catch(() => false);
}

/** The stored snapshot when it is newer than this device's, otherwise null. */
export async function pull() {
  const account = getAccount();
  if (!account || !syncAvailable()) return null;
  const remote = await fetch(`${API}/state/${account}`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  if (!remote || typeof remote.at !== 'number' || remote.at <= localAt()) return null;
  return remote;
}
