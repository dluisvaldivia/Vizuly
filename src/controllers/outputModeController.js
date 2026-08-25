/**
 * Persisted output mode.
 *
 * "speech" is the telegraphic default the child talks with. "reading" keeps the
 * function words that have a verified connector symbol, mirroring ARASAAC's
 * pictographed easy-reading material. See src/aac/data/connectors.es.json.
 *
 * Follows languageController.js: namespaced key, guarded access, validated read.
 * The key deliberately does NOT start with "vizuly.pictogram.v1", so clearing
 * the saved pictograms leaves the setting alone.
 */

const STORAGE_KEY = "vizuly.outputMode";
const DEFAULT_MODE = "speech";
const SUPPORTED = ["speech", "reading"];

export function getInitialOutputMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : DEFAULT_MODE;
  } catch {
    // Storage unavailable. Fall back rather than break.
    return DEFAULT_MODE;
  }
}

export function setOutputMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
