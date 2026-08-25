/**
 * Whether a word may be sent to Deepgram to be recorded.
 *
 * On by default, because nothing is pre-generated: with this off the app has no
 * recorded voice at all and everything falls back to the browser's. Turning it
 * off is how an adult stops all spending, at the price of the plain voice.
 *
 * The daily budget it obeys lives in each browser's own storage, so on a public
 * site the cap is per visitor rather than a total. That is the reason the cap
 * is deliberately small: see DAILY_LIMIT in voiceBudget.ts.
 *
 * Each word costs one call once, ever. After that it is on the device for good.
 */

const STORAGE_KEY = "vizuly.liveVoice";
const DEFAULT_MODE = "on";
const SUPPORTED = ["on", "off"];

export function getInitialLiveVoice() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function setLiveVoice(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
