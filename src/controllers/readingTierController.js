/**
 * Persisted reading tier: how many function words reading mode shows.
 *
 * Cumulative, each tier includes the one before it:
 *
 *   connectors  prepositions and conjunctions (a, y, en, de, con)
 *   articles    + el, la, los, las, un, una
 *   clitics     + me, te, se, mi, tu, su. Least precise, opt-in on purpose
 *
 * Set once by an adult in settings, behind the deliberate gesture, because it is
 * a calibration rather than something to flip back and forth. The mode itself
 * lives in the header. See src/aac/data/connectors.es.json.
 */

const STORAGE_KEY = "vizuly.readingTier";
const DEFAULT_TIER = "connectors";
const SUPPORTED = ["connectors", "articles", "clitics"];

export function getInitialReadingTier() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : DEFAULT_TIER;
  } catch {
    // Storage unavailable. Fall back rather than break.
    return DEFAULT_TIER;
  }
}

export function setReadingTier(tier) {
  try {
    localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    // Storage unavailable. The choice still applies for this session.
  }
}
