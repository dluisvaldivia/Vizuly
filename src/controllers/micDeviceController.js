/**
 * Persisted microphone choice: the browser's device id and the mic's name.
 *
 * Exists because Firefox opens the system default microphone whenever the
 * permission is remembered, instead of the one the adult picked in its prompt.
 * On a machine with several inputs that default can be silent. The name is kept
 * as well because device ids can change between reloads, and the name is how a
 * stale id is found again.
 *
 * An empty id means "the system default". Same localStorage pattern as
 * micSensitivityController.js.
 */

const STORAGE_KEY = "vizuly.micDevice";

export const DEFAULT_MIC = { deviceId: "", label: "" };

export function getInitialMicDevice() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_MIC;

    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed.deviceId === "string") {
      return {
        deviceId: parsed.deviceId,
        label: typeof parsed.label === "string" ? parsed.label : "",
      };
    }
    return DEFAULT_MIC;
  } catch {
    // Storage unavailable, or not JSON. Fall back rather than break.
    return DEFAULT_MIC;
  }
}

export function setMicDevice(mic) {
  try {
    if (mic?.deviceId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mic));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
