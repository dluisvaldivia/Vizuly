/**
 * The header entry point into game mode.
 *
 * Deliberately a plain, visible tap target, unlike the settings gate: game
 * mode is play, not a place a wrong tap can do any harm, so it does not need
 * the long-press gesture that keeps the child out of settings.
 */
export default function GameModeToggle({ active, onToggle, lang }) {
  const labels = {
    es: {
      on: 'Iniciar modo juego',
      off: 'Salir del modo juego',
    },
    en: {
      on: 'Start game mode',
      off: 'Exit game mode',
    },
  }[lang];

  return (
    <button
      type="button"
      className={`game-mode-toggle${active ? ' is-active' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? labels.off : labels.on}
      title={active ? labels.off : labels.on}
    >
      {/* Two overlapping faces: one says it, one repeats it. Decorative, the
          accessible name above carries the meaning. */}
      <svg viewBox="0 0 24 24" width="1.5rem" height="1.5rem" aria-hidden="true" focusable="false">
        <circle cx="9" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="15" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  );
}
