/**
 * Persisted microphone sensitivity: how loud the child has to be.
 *
 * One number, in dBFS, and it means "the level at which his voice counts as
 * speech". The meter turns green here, and the auto-stop keeps its own
 * voice-activity floor a fixed margin below it.
 *
 * Set by an adult in settings, behind the deliberate gesture, because it is a
 * calibration made once against his actual voice rather than something to flip
 * back and forth. Follows the same localStorage pattern as
 * readingTierController.js.
 *
 * Lower is more sensitive. Room tone with noise suppression sits near -50 dBFS,
 * soft speech near -33, an ordinary speaking voice near -24, so the usable range
 * is narrow and the default is a starting point to be measured, not a truth.
 */

const STORAGE_KEY = "vizuly.micSensitivity";

export const DEFAULT_SENSITIVITY_DB = -30;
export const MIN_SENSITIVITY_DB = -42;
export const MAX_SENSITIVITY_DB = -20;

export function getInitialMicSensitivity() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));

    // Number(null) is 0 and Number("") is 0, so the range check is what rejects
    // a missing value as well as a corrupt one.
    if (
      Number.isFinite(stored) &&
      stored >= MIN_SENSITIVITY_DB &&
      stored <= MAX_SENSITIVITY_DB
    ) {
      return stored;
    }

    return DEFAULT_SENSITIVITY_DB;
  } catch {
    // Storage unavailable. Fall back rather than break.
    return DEFAULT_SENSITIVITY_DB;
  }
}

export function setMicSensitivity(db) {
  try {
    localStorage.setItem(STORAGE_KEY, String(db));
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
