/**
 * The header switch between telegraphic speech output and reading output.
 *
 * Visible and plain, like the language and game-mode toggles and unlike the
 * settings gate: a wrong tap only changes how the strip looks and loses
 * nothing, so it does not need the long-press gesture.
 *
 * How MANY function words reading mode shows is not decided here. That is the
 * tier, and it lives in the adult panel because it is a calibration rather than
 * something to flip back and forth.
 */
export default function OutputModeToggle({ active, onToggle, lang }) {
  const labels = {
    es: {
      on: 'Mostrar palabras de enlace',
      off: 'Ocultar palabras de enlace',
    },
    en: {
      on: 'Show linking words',
      off: 'Hide linking words',
    },
  }[lang];

  return (
    <button
      type="button"
      className={`output-mode-toggle${active ? ' is-active' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? labels.off : labels.on}
      title={active ? labels.off : labels.on}
    >
      {/* Two full blocks with a small one between them: the connector joining
          two content words. Decorative, the accessible name carries the
          meaning. */}
      <svg viewBox="0 0 24 24" width="1.5rem" height="1.5rem" aria-hidden="true" focusable="false">
        <rect x="1" y="7" width="7" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="10.5" y="10.5" width="3" height="3" rx="0.75" fill="currentColor" />
        <rect x="16" y="7" width="7" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  );
}
