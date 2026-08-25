import { useCallback } from 'react';

import { pictogramImageUrl } from '../../aac/useAac.ts';
import { useLongPress } from '../hooks/useLongPress.js';

/**
 * The pictogram sequence, left to right.
 *
 * Order is the grammar. A word with no pictogram gets a visible placeholder,
 * never a gap: dropping it would leave the child unable to tell "the app
 * ignored me" from "I said it wrong".
 *
 * Each pictogram is also the entry point to the fix dialog, behind a long
 * press. An ordinary tap does nothing, which is deliberate: the child will tap
 * these, and tapping must never take him anywhere.
 */
export default function PictogramStrip({
  words,
  isResolving,
  lang,
  onFix,
  // Game mode only. Undefined here means "no highlighting", so the ordinary
  // single-strip screen renders exactly as it always has.
  highlightIds,
  bounceIds,
}) {
  const empty = words.length === 0;

  const labels = {
    es: {
      region: 'Pictogramas',
      resolving: 'Buscando pictogramas',
      empty: 'Todavía no hay pictogramas',
      missing: 'Sin pictograma para',
      fix: 'Mantén pulsado para corregir',
    },
    en: {
      region: 'Pictograms',
      resolving: 'Finding pictograms',
      empty: 'No pictograms yet',
      missing: 'No pictogram for',
      fix: 'Long press to fix',
    },
  }[lang];

  return (
    <section
      className="pictogram-strip"
      aria-label={labels.region}
      // Announces the sequence as it changes. Polite so it does not interrupt.
      aria-live="polite"
      aria-busy={isResolving}
    >
      {empty ? (
        <p className="pictogram-strip__empty">{labels.empty}</p>
      ) : (
        <ol className="pictogram-strip__list">
          {words.map((word, index) => (
            <StripItem
              // Index is part of the key on purpose: the same word can legitimately
              // appear twice in one phrase ("more more"), and both must render.
              key={`${word.token.lookup}-${index}`}
              word={word}
              labels={labels}
              onFix={onFix}
              isEcho={word.pictogramId !== null && highlightIds?.has(word.pictogramId)}
              isBounce={word.pictogramId !== null && bounceIds?.has(word.pictogramId)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * One pictogram, and the adult gesture that opens its fix dialog.
 *
 * A separate component so each item gets its own long-press timer. Sharing one
 * would make a press on the second pictogram cancel a press on the first.
 */
function StripItem({ word, labels, onFix, isEcho, isBounce }) {
  const openFix = useCallback(() => onFix(word), [onFix, word]);
  const longPress = useLongPress(openFix);

  // Additive only: an echo/bounce class layers a ring, glow or scale effect
  // on top of the normal item, never replaces it. There is no "no match"
  // class, because a non-match must look exactly like it always has.
  const itemClass = [
    'pictogram-strip__item',
    isEcho ? 'pictogram-strip__item--echo' : '',
    isBounce ? 'pictogram-strip__item--bounce' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={itemClass}>
      <button
        type="button"
        className="pictogram-strip__button"
        {...longPress}
        aria-haspopup="dialog"
        // The child does not read, and this name is for the adult using a
        // screen reader or a keyboard. It names the word first, because that is
        // what identifies which pictogram this is.
        aria-label={`${word.token.raw}. ${labels.fix}`}
        title={labels.fix}
      >
        {word.pictogramId === null ? (
          <Placeholder word={word.token.raw} missingLabel={labels.missing} />
        ) : (
          <img
            className="pictogram-strip__image"
            src={pictogramImageUrl(word.pictogramId, 500)}
            alt={word.token.raw}
            loading="eager"
            draggable="false"
          />
        )}
      </button>
      <span className="pictogram-strip__word" aria-hidden="true">
        {word.token.raw}
      </span>
    </li>
  );
}

/**
 * Shown when a word has no pictogram.
 *
 * Neutral on purpose: a question mark, not a warning or an error colour. There
 * are no failure states in this app, and a miss is not the child's fault.
 */
function Placeholder({ word, missingLabel }) {
  return (
    <div className="pictogram-strip__placeholder" role="img" aria-label={`${missingLabel} ${word}`}>
      <span aria-hidden="true">?</span>
    </div>
  );
}
