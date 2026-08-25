/**
 * A daily cap on Deepgram calls.
 *
 * Clips are recorded the first time a word is tapped, so this governs the main
 * path and not an edge case. It exists because Deepgram has no per-key spending
 * cap of its own: the only place a limit can live is here.
 *
 * The counter is per browser, and the site is public, so the real ceiling is
 * this number times however many people visit. That is why it is small rather
 * than generous: a child practising three phrases a day needs about a dozen new
 * words on his busiest day, and only ever pays for each word once.
 */

const STORAGE_KEY = 'vizuly.voiceBudget.v1';

/**
 * Roughly a busy day of new words for one child, with room to spare.
 *
 * Set with recording-on-appearance in mind: a word that shows up in the strip
 * is recorded even if he never taps it, so the budget drains per word seen
 * rather than per word tapped. Words are paid for once each, ever, so this only
 * ever binds on a day of genuinely new vocabulary.
 */
export const DAILY_LIMIT = 40;

interface Budget {
  day: string;
  calls: number;
}

/**
 * Today, in the browser's own timezone.
 *
 * Deliberately local rather than UTC: the budget should turn over when the
 * child's day does, not at one in the morning.
 */
function today(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function read(): Budget {
  const fresh = { day: today(), calls: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return fresh;

    const parsed = JSON.parse(raw) as Partial<Budget>;
    if (typeof parsed?.day !== 'string' || typeof parsed?.calls !== 'number') return fresh;
    // A different day, or a clock that moved backwards, starts over.
    return parsed.day === fresh.day ? { day: parsed.day, calls: parsed.calls } : fresh;
  } catch {
    return fresh;
  }
}

/** How many calls are still allowed today. Never negative. */
export function remainingToday(): number {
  return Math.max(0, DAILY_LIMIT - read().calls);
}

export function usedToday(): number {
  return Math.min(DAILY_LIMIT, read().calls);
}

/**
 * True when one more call is allowed.
 *
 * If storage is unavailable the answer is false: without somewhere to count,
 * there is no limit, and no limit is the one outcome this module exists to
 * prevent.
 */
export function canSpend(): boolean {
  try {
    localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
  return remainingToday() > 0;
}

/** Records a call. Called after the request goes out, whatever its outcome. */
export function spend(calls = 1): void {
  const current = read();
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: current.day, calls: current.calls + calls }),
    );
  } catch {
    // Storage unavailable. canSpend already refuses in this state.
  }
}
