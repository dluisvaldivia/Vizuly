import { useCallback } from 'react';

import { pictogramImageUrl } from '../../aac/useAac.ts';
import { useLongPress } from '../hooks/useLongPress.js';

/**
 * One letter card: pictogram on the front, letter over word on the back.
 *
 * A tap turns it over, silently, and turns it back. A long press opens the same
 * fix dialog a pictogram in the strip opens, so a wrong symbol on a card is
 * fixed the same way as anywhere else.
 *
 * Both faces stay in the DOM so the turn can animate; the one facing away is
 * hidden from assistive technology.
 */
export default function LetterCard({ card, entry, letter, flipped, onFlip, onFix, lang }) {
  const labels = {
    es: { card: 'Carta', turn: 'Toca para girar.', fix: 'Mantén pulsado para corregir.', missing: 'Sin pictograma para' },
    en: { card: 'Card', turn: 'Tap to turn over.', fix: 'Long press to fix.', missing: 'No pictogram for' },
  }[lang];

  const openFix = useCallback(() => {
    if (card) onFix(card);
  }, [card, onFix]);
  const longPress = useLongPress(openFix, { onTap: onFlip });

  const word = entry.word;
  const shown = word.charAt(0).toUpperCase() + word.slice(1);

  return (
    <button
      type="button"
      className={`letter-card${flipped ? ' is-flipped' : ''}`}
      {...longPress}
      aria-pressed={flipped}
      aria-haspopup="dialog"
      aria-label={`${labels.card}: ${word}. ${labels.turn} ${labels.fix}`}
    >
      <span className="letter-card__inner">
        <span className="letter-card__face letter-card__face--front" aria-hidden={flipped}>
          {!card ? (
            <span className="letter-card__loading" />
          ) : card.pictogramId === null ? (
            // Neutral, never a warning: the same placeholder the strip uses.
            <span className="letter-card__placeholder" role="img" aria-label={`${labels.missing} ${word}`}>
              <span aria-hidden="true">?</span>
            </span>
          ) : (
            <img
              className="letter-card__image"
              src={pictogramImageUrl(card.pictogramId, 500)}
              alt={word}
              draggable="false"
            />
          )}
        </span>

        <span className="letter-card__face letter-card__face--back" aria-hidden={!flipped}>
          {letter ? <span className="letter-card__letter">{letter}</span> : null}
          <span className="letter-card__word">{shown}</span>
        </span>
      </span>
    </button>
  );
}
