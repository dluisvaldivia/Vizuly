import MicWave from './MicWave.jsx';
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
  interim,
  levelRef,
  lang,
  onToggle,
  disabled,
}) {
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
      <button
        type="button"
        className={`mic__button mic__button--${status}`}
        onClick={onToggle}
        disabled={disabled}
        // The accessible name changes with state, so a screen reader user knows
        // what pressing it will do.
        aria-label={isListening ? labels.stop : labels.start}
        aria-pressed={isListening}
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
