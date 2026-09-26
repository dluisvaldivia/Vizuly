import { VscInsert } from 'react-icons/vsc';

/**
 * The switch between telegraphic speech output and reading output.
 *
 * Visible and plain, like the language and game-mode toggles and unlike the
 * settings gate: a wrong tap only changes how the strip looks and loses
 * nothing, so it does not need the long-press gesture. Sits in the typed-input
 * row, between the submit and clear buttons, rather than the header.
 *
 * How MANY function words reading mode shows is not decided here. That is the
 * tier, and it lives in the adult panel because it is a calibration rather than
 * something to flip back and forth.
 */
export default function OutputModeToggle({ active, onToggle, lang }) {
  const labels = {
    es: {
      // The visible caption comes first, so the name contains the label
      // (WCAG 2.5.3) and the action follows.
      on: 'Lectura: mostrar palabras de enlace',
      off: 'Lectura: ocultar palabras de enlace',
      caption: 'Lectura',
    },
    en: {
      on: 'Reading: show linking words',
      off: 'Reading: hide linking words',
      caption: 'Reading',
    },
  }[lang];

  return (
    <button
      type="button"
      className={`app__clear output-mode-toggle${active ? ' is-active' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? labels.off : labels.on}
      title={active ? labels.off : labels.on}
    >
      <VscInsert aria-hidden="true" />
      {labels.caption}
    </button>
  );
}
