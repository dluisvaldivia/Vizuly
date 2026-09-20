/**
 * Persisted switch for the microphone level readout.
 *
 * The readout is the calibration aid: a live dB number beside the meter that an
 * adult reads off while the child talks, so the sensitivity can be set to the
 * real voice instead of to a guess. It is on by default because the app is being
 * calibrated now, and it can be switched off once that is done: the UI rules ask
 * for very little text on the child's screen, and a number that has served its
 * purpose is exactly the kind of text to remove.
 *
 * Same localStorage pattern as syllableModeController.js.
 */

const STORAGE_KEY = "vizuly.levelReadout";
const DEFAULT_READOUT = "on";
const SUPPORTED = ["on", "off"];

export function getInitialLevelReadout() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : DEFAULT_READOUT;
  } catch {
    // Storage unavailable. Fall back rather than break.
    return DEFAULT_READOUT;
  }
}

export function setLevelReadout(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
