/**
 * Whether a tap says the word alone or the word and then its syllables.
 *
 * Persisted, like the reading tier: it is a calibration an adult makes for how
 * this child is working right now, not something to flip back and forth. Stored
 * as "on"/"off" rather than a boolean because the allowlist check below only
 * works on strings, and an unrecognised value must fall back rather than throw.
 */

const STORAGE_KEY = "vizuly.syllables";
const DEFAULT_MODE = "on";
const SUPPORTED = ["on", "off"];

export function getInitialSyllableMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : DEFAULT_MODE;
  } catch {
    // Storage unavailable. Fall back rather than break.
    return DEFAULT_MODE;
  }
}

export function setSyllableMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
