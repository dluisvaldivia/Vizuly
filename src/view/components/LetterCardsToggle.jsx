/**
 * The header entry point into letter cards.
 *
 * A plain, visible tap target, for the same reason as GameModeToggle: this is
 * play, and a wrong tap into it loses nothing.
 */
export default function LetterCardsToggle({ active, onToggle, lang }) {
  const labels = {
    es: {
      on: 'Iniciar cartas de letras',
      off: 'Salir de las cartas de letras',
    },
    en: {
      on: 'Start letter cards',
      off: 'Exit letter cards',
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
      {/* A card with a letter on it. Decorative, the name above carries it. */}
      <svg viewBox="0 0 24 24" width="1.5rem" height="1.5rem" aria-hidden="true" focusable="false">
        <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8.5 17 12 7l3.5 10M9.8 13.5h4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="header-toggle__caption">{{ es: 'Letras', en: 'Letters' }[lang]}</span>
    </button>
  );
}
