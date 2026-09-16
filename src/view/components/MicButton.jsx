import { useRef } from 'react';

import MicWave from './MicWave.jsx';
import MicLevelMeter from './MicLevelMeter.jsx';
import touchIcon from '../../assets/touchicon.png';

/**
 * The microphone control and its listening indicator.
 *
 * The indicator is deliberately more than a colour change: an inward sound
 * wave driven by his actual voice, plus an animated pulse ring while
 * listening. Colour alone fails WCAG 1.4.1, so the one state that needs text
 * to be understood, connecting, gets it inside the circle, and the one state
 * that is a genuine problem, no connection, gets a visible alert. Idle and
 * listening are conveyed by the wave and the ring colour alone: there is
 * nothing to read, and nothing wrong to report.
 *
 * The wave answers a question the state word cannot: not "is the mic on" but
 * "is it hearing *me*, right now". It reacts to any sound he makes, including
 * ones that never become a transcript.
 */
export default function MicButton({
  status,
  isListening,
  isActive,
  interim,
  levelRef,
  getLevel,
  speechFloorDb,
  showReadout,
  lang,
  onToggle,
  disabled,
}) {
  // What pressing the button would do, which during 'connecting' is not the same
  // as whether audio is flowing. The label and the pressed state follow the
  // action; the wave and the meter follow the audio.
  const pressed = isActive ?? isListening;

  // Filled in by the meter's animation frame, never by React. Lives out here
  // because the number is wider than the bar and needs its own line.
  const readoutRef = useRef(null);
  const labels = {
    es: {
      start: 'Hablar',
      stop: 'Parar',
      connecting: 'Conectando',
      error: 'El micrófono no funciona',
    },
    en: {
      start: 'Talk',
      stop: 'Stop',
      connecting: 'Connecting',
      error: 'Microphone not working',
    },
  }[lang];

  return (
    <div className="mic">
      {/* The meter sits to the right of the button. The empty counterweight on
          the left keeps the button itself dead centre, because it is the target
          he aims at and it must not move just because something was added
          beside it. */}
      <div className="mic__row">
        <span className="mic__row-spacer" aria-hidden="true" />

        <button
          type="button"
          className={`mic__button mic__button--${status}`}
          onClick={onToggle}
          disabled={disabled}
          // The accessible name changes with state, so a screen reader user knows
          // what pressing it will do.
          aria-label={pressed ? labels.stop : labels.start}
          aria-pressed={pressed}
        >
          {/* Behind the text, inside the button. Decorative only: every state it
              reflects is also carried by the border. */}
          <MicWave levelRef={levelRef} active={isListening} />

          {status === 'connecting' ? (
            <span className="mic__label mic__label--connecting">{labels.connecting}</span>
          ) : null}

          {status === 'idle' ? (
            <img className="mic__touch-icon" src={touchIcon} alt="" aria-hidden="true" />
          ) : null}
        </button>

        <MicLevelMeter
          getLevel={getLevel}
          active={isListening}
          speechFloorDb={speechFloorDb}
          readoutRef={showReadout ? readoutRef : null}
        />
      </div>

      {/* Adult-facing calibration number, for setting the sensitivity against
          his real voice. Switched off in settings once that is done: the child's
          screen should not carry a number forever. */}
      {showReadout && isListening ? (
        <p ref={readoutRef} className="mic__readout" aria-hidden="true" />
      ) : null}

      {/* The only state worth interrupting for. Idle and listening need no
          text: the ring colour and the wave already say everything. */}
      {status === 'error' ? (
        <p className="mic__error" role="alert">
          {labels.error}
        </p>
      ) : null}

      {interim ? (
        <p className="mic__interim" aria-hidden="true">
          {interim}
        </p>
      ) : null}
    </div>
  );
}
