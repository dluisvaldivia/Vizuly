/**
 * Persisted switch for the browser's automatic gain control on the microphone.
 *
 * With it on, the browser turns the mic up while the room is quiet and back down
 * once the child speaks. The first word therefore arrives much louder than it was said,
 * and the meter shoots up before settling to the real level, which makes a quiet
 * voice look loud enough when it is not. With it off, the meter shows the real
 * level from the first syllable and the sensitivity means the same thing every
 * time.
 *
 * Off by default because the app is being calibrated now, and calibration needs
 * a level that holds still. On is kept as a choice because the boost may be what
 * gets a very soft word through to Deepgram, and that can only be judged
 * against the actual voice. A sensitivity set with one of these is not valid for
 * the other.
 *
 * Same localStorage pattern as levelReadoutController.js.
 */

const STORAGE_KEY = "vizuly.micGain";
const DEFAULT_GAIN = "off";
const SUPPORTED = ["on", "off"];

export function getInitialMicGain() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : DEFAULT_GAIN;
  } catch {
    // Storage unavailable. Fall back rather than break.
    return DEFAULT_GAIN;
  }
}

export function setMicGain(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
