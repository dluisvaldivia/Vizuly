/**
 * Persisted language choice.
 *
 * Follows the same localStorage pattern as themeController.js, so the child's
 * usual language is ready on load without an adult touching anything.
 */

const STORAGE_KEY = "vizuly.lang";
const DEFAULT_LANG = "es";
const SUPPORTED = ["es", "en"];

export function getInitialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : DEFAULT_LANG;
  } catch {
    // Storage unavailable. Fall back rather than break.
    return DEFAULT_LANG;
  }
}

export function setLang(lang) {
  // Keeps the document language honest for screen readers.
  document.documentElement.setAttribute("lang", lang === "es" ? "es-ES" : "en-US");

  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
