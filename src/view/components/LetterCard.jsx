import { useCallback, useRef, useState } from 'react';

import { pictogramImageUrl } from '../../aac/useAac.ts';
import { useLongPress } from '../hooks/useLongPress.js';

/** How far, as a share of the card's width, a drag has to go to count. */
const SWIPE_SHARE = 0.35;

/**
 * One letter card: pictogram on the front, letter over word on the back.
 *
 * A tap turns it over, silently, and turns it back. A long press opens the same
 * fix dialog a pictogram in the strip opens, so a wrong symbol on a card is
 * fixed the same way as anywhere else.
 *
 * A swipe rates it: right means "I know this one", left means "again". Either
 * one moves on to the next card. The card follows the finger and shows a
 * neutral hint on the side it is heading for, never a cross and never red:
 * there is no wrong answer here, only a word that comes round sooner. The
 * arrow keys do the same for a keyboard, since a swipe is a path gesture.
 *
 * Both faces stay in the DOM so the turn can animate; the one facing away is
 * hidden from assistive technology.
 */
export default function LetterCard({ card, entry, letter, flipped, onFlip, onFix, onSwipe, lang }) {
  const labels = {
    es: {
      card: 'Carta',
      turn: 'Toca para girar.',
      swipe: 'Desliza o flecha derecha: la sé. Flecha izquierda: otra vez.',
      fix: 'Mantén pulsado para corregir.',
      missing: 'Sin pictograma para',
    },
    en: {
      card: 'Card',
      turn: 'Tap to turn over.',
      swipe: 'Swipe or right arrow: got it. Left arrow: again.',
      fix: 'Long press to fix.',
      missing: 'No pictogram for',
    },
  }[lang];

  const openFix = useCallback(() => {
    if (card) onFix(card);
  }, [card, onFix]);
  const longPress = useLongPress(openFix, { onTap: onFlip });

  // The drag. dx is state because the card renders from it; the rest are refs
  // because nothing renders from them.
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const width = useRef(1);

  const onPointerDown = (event) => {
    longPress.onPointerDown(event);
    startX.current = event.clientX;
    width.current = event.currentTarget.offsetWidth || 1;
    // Capture, so the drag keeps reporting even once the finger leaves the card.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event) => {
    longPress.onPointerMove(event);
    if (dragging) setDx(event.clientX - startX.current);
  };
  const settle = (event) => {
    longPress.onPointerUp(event);
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dx) > SWIPE_SHARE * width.current) onSwipe(dx > 0 ? 1 : -1);
    setDx(0);
  };
  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      onSwipe(event.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    longPress.onKeyDown(event);
  };

  const word = entry.word;
  const shown = word.charAt(0).toUpperCase() + word.slice(1);
  const progress = Math.min(1, Math.abs(dx) / (SWIPE_SHARE * width.current));

  return (
    <button
      type="button"
      className={`letter-card${flipped ? ' is-flipped' : ''}${dragging ? ' is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={settle}
      onPointerCancel={settle}
      onClick={longPress.onClick}
      onKeyDown={onKeyDown}
      style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)` }}
      aria-pressed={flipped}
      aria-haspopup="dialog"
      aria-label={`${labels.card}: ${word}. ${labels.turn} ${labels.swipe} ${labels.fix}`}
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

      {/* The swipe hints. Only the side the card is heading for fades in. */}
      <span
        className="letter-card__hint letter-card__hint--known"
        aria-hidden="true"
        style={{ opacity: dx > 0 ? progress : 0 }}
      >
        <svg viewBox="0 0 24 24" width="2.5rem" height="2.5rem" focusable="false">
          <path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span
        className="letter-card__hint letter-card__hint--again"
        aria-hidden="true"
        style={{ opacity: dx < 0 ? progress : 0 }}
      >
        <svg viewBox="0 0 24 24" width="2.5rem" height="2.5rem" focusable="false">
          <path d="M20 12a8 8 0 1 1-2.3-5.6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
