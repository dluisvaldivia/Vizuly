/**
 * The header entry point into the favourites screen.
 *
 * A plain, visible tap like the game and language buttons, not behind the adult
 * gesture: opening a list of saved phrases loses nothing, and tapping one of
 * them only loads it into the strip.
 *
 * Reuses the game-mode-toggle class, as the letters button already does, so
 * every header button keeps one shared rule and they cannot drift apart.
 */
import { forwardRef } from 'react';

const FavoritesToggle = forwardRef(function FavoritesToggle({ active, onToggle, lang }, ref) {
  const labels = {
    es: { on: 'Abrir favoritos', off: 'Salir de favoritos' },
    en: { on: 'Open favourites', off: 'Close favourites' },
  }[lang];

  return (
    <button
      ref={ref}
      type="button"
      className={`game-mode-toggle${active ? ' is-active' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? labels.off : labels.on}
      title={active ? labels.off : labels.on}
    >
      <svg viewBox="0 0 24 24" width="1.5rem" height="1.5rem" aria-hidden="true" focusable="false">
        <path
          d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.8l6-.8z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="header-toggle__caption">{{ es: 'Favoritos', en: 'Favourites' }[lang]}</span>
    </button>
  );
});

export default FavoritesToggle;
