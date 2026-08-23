/**
 * The microphone control and its listening indicator.
 *
 * The indicator is deliberately more than a colour change: an animated pulse
 * ring, a state word, and an icon swap. Colour alone fails WCAG 1.4.1 and, more
 * importantly, fails a child who needs to know the app is hearing him.
 */
export default function MicButton({ status, isListening, interim, lang, onToggle, disabled }) {
  const labels = {
    es: {
      start: 'Hablar',
      stop: 'Parar',
      idle: 'Toca para hablar',
      connecting: 'Conectando',
      listening: 'Te escucho',
      error: 'El micrófono no funciona',
    },
    en: {
      start: 'Talk',
      stop: 'Stop',
      idle: 'Tap to talk',
      connecting: 'Connecting',
      listening: 'Listening',
      error: 'Microphone not working',
    },
  }[lang];

  const stateText = labels[status] ?? labels.idle;

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
        <span className="mic__icon" aria-hidden="true">
          {isListening ? '■' : '●'}
        </span>
        <span className="mic__label">{isListening ? labels.stop : labels.start}</span>
      </button>

      {/* Colour plus text plus motion. Announced politely so it does not
          interrupt the pictogram strip's own announcements. */}
      <p className="mic__status" aria-live="polite">
        <span className={`mic__dot mic__dot--${status}`} aria-hidden="true" />
        {stateText}
      </p>

      {interim ? (
        <p className="mic__interim" aria-hidden="true">
          {interim}
        </p>
      ) : null}
    </div>
  );
}
