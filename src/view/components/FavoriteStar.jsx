/**
 * Save what is on screen, or take it back off.
 *
 * A toggle on purpose: the star is the only way in AND the only immediate way
 * out, so a mis-save is undone by pressing the same thing again rather than by a
 * gesture the child could stumble into. Everything older is removed from the
 * adult panel.
 *
 * Saved state is an outline star versus a filled one, which is a shape
 * difference, plus an accessible name that says which it is. Never colour alone.
 */
export default function FavoriteStar({ saved, onToggle, lang, name = '', className = 'favorite-star', disabled = false }) {
  const labels = {
    es: { save: 'Guardar en favoritos', remove: 'Quitar de favoritos', caption: 'Favorito' },
    en: { save: 'Save to favourites', remove: 'Remove from favourites', caption: 'Favourite' },
  }[lang];

  const action = saved ? labels.remove : labels.save;
  const label = name ? `${action}: ${name}` : action;

  return (
    <button
      type="button"
      className={`${className}${saved ? ' is-saved' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={saved}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="2rem" height="2rem" aria-hidden="true" focusable="false">
        <path
          d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.8l6-.8z"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
