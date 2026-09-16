import { useEffect, useMemo, useRef } from 'react';

import { toDbfs } from '../../speech/useSpeech.ts';

/**
 * A loudness meter standing beside the mic button.
 *
 * It answers two questions nothing else on screen does. For the adult: is the
 * microphone actually picking my voice up, or is the problem further down the
 * line? For the child: how loud do I have to be? The marked line is the level at
 * which his voice counts as speech, so getting the bar above it means getting
 * picked up, and the colours say how comfortably.
 *
 * Measured in RMS decibels, not peak amplitude. Peak was tried and lied: speech
 * peaks 10 to 14 dB above its own energy, so a soft word Deepgram never heard
 * still drove the bar into the blue. Decibels also spread the quiet end out
 * instead of crushing it into the bottom few percent, which is what gives the
 * bar somewhere to travel.
 *
 * Purely additive and purely visual: it replaces nothing, it is aria-hidden, and
 * it is never the only signal for anything. The mic button still carries every
 * state that matters, in text and shape as well as colour.
 *
 * Nothing here goes through React state. The bar is written to the DOM from the
 * animation frame, exactly like MicWave, because it moves every frame and
 * setState would re-render the pictogram strip along with it. `readoutRef` is
 * the same trick across a component boundary: the calibration number is far
 * wider than the bar, so MicButton renders it as its own line under the row and
 * this fills it in from the loop that is already running.
 */

/** Bottom of the bar, in dBFS. Below this is a quiet room, not a quiet voice. */
const METER_MIN_DB = -55;

/** Top of the bar. Above this there is nothing useful left to show. */
const METER_MAX_DB = -10;

/**
 * How fast the bar chases the microphone, per frame.
 *
 * Deliberately high, and only slightly slower falling than rising: the bar
 * should feel attached to his voice. Anything heavier reads as lag, and a meter
 * that lags is worse than no meter, because it stops telling him which sound of
 * his moved it. There is no hold and no floor anywhere in this file, for the
 * same reason.
 */
const RISE = 0.55;
const FALL = 0.32;

/** The readout is for reading, so it updates slowly enough to be read. */
const READOUT_INTERVAL_MS = 200;

/** How long the readout's loudest recent value stays up. */
const READOUT_PEAK_HOLD_MS = 2000;

/** Where a level sits on the bar, 0 at the bottom, 1 at the top. */
function fractionForDb(db) {
  const fraction = (db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB);
  return Math.max(0, Math.min(1, fraction));
}

/** The inverse, so the readout can report the level the bar is actually drawing. */
function dbForFraction(fraction) {
  return METER_MIN_DB + fraction * (METER_MAX_DB - METER_MIN_DB);
}

export default function MicLevelMeter({ getLevel, active, speechFloorDb, readoutRef }) {
  const shutterRef = useRef(null);

  const thresholdFraction = fractionForDb(speechFloorDb);

  /**
   * The colour scale, blended rather than banded so the bar slides through the
   * colours instead of snapping between them.
   *
   * Every stop is expressed as an offset in dB from the speech floor, so moving
   * the sensitivity moves the whole ramp with it and the green can never begin
   * anywhere other than at the line.
   */
  const scale = useMemo(() => {
    const at = (offsetDb) => (fractionForDb(speechFloorDb + offsetDb) * 100).toFixed(1);

    return [
      `var(--meter-quiet) 0%`,
      `var(--meter-quiet) ${at(-15)}%`,
      `var(--meter-low) ${at(-9)}%`,
      `var(--meter-mid) ${at(-2)}%`,
      `var(--meter-good) ${at(3)}%`,
      `var(--meter-great) ${at(14)}%`,
      `var(--meter-great) 100%`,
    ].join(', ');
  }, [speechFloorDb]);

  useEffect(() => {
    const shutter = shutterRef.current;

    if (!active) {
      // Closed, not frozen: an empty bar is the honest picture of a mic that is
      // off, and it leaves the line on screen as the target for next time.
      if (shutter) shutter.style.transform = 'scaleY(1)';
      if (readoutRef?.current) readoutRef.current.textContent = '';
      return undefined;
    }

    let raf = 0;
    let shown = 0;
    let peakDb = METER_MIN_DB;
    let peakAt = 0;
    let readoutAt = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!shutter) return;

      const db = toDbfs(getLevel?.() ?? 0);
      const target = fractionForDb(db);

      shown += (target - shown) * (target > shown ? RISE : FALL);

      // The shutter hides the top of the colour scale. Scaling a flat colour
      // keeps the gradient underneath undistorted, and a transform costs no
      // layout, which is what lets this run every frame without stuttering.
      shutter.style.transform = `scaleY(${(1 - shown).toFixed(4)})`;

      const readout = readoutRef?.current;
      if (!readout) return;

      const now = performance.now();

      if (db >= peakDb || now - peakAt > READOUT_PEAK_HOLD_MS) {
        peakDb = db;
        peakAt = now;
      }

      // Throttled hard. At frame rate the number is an unreadable blur, and the
      // whole point of it is that an adult can read it off while he talks.
      if (now - readoutAt >= READOUT_INTERVAL_MS) {
        readoutAt = now;

        // Reported from the smoothed value the bar is drawing, not from the raw
        // sample. The number is a fifth of a second stale by design, and a raw
        // reading next to a smoothed bar shows an adult "-12 dB" beside a bar
        // sitting at half height, which is exactly the confusion this is meant
        // to clear up. The peak beside it is the true recent maximum.
        readout.textContent =
          `${Math.round(dbForFraction(shown))} dB \u25b2 ${Math.round(peakDb)}`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getLevel, active, readoutRef]);

  return (
    <div className={`mic-meter${active ? ' mic-meter--active' : ''}`} aria-hidden="true">
      <div className="mic-meter__track">
        <div
          className="mic-meter__scale"
          style={{ background: `linear-gradient(to top, ${scale})` }}
        />
        <div ref={shutterRef} className="mic-meter__shutter" />
        {/* Above the shutter, so the target stays visible on an empty bar. */}
        <div
          className="mic-meter__threshold"
          style={{ bottom: `${(thresholdFraction * 100).toFixed(2)}%` }}
        />
      </div>
    </div>
  );
}
