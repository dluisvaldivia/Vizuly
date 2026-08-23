import { pictogramImageUrl } from '../../aac/useAac.ts';

/**
 * The pictogram sequence, left to right.
 *
 * Order is the grammar. A word with no pictogram gets a visible placeholder,
 * never a gap: dropping it would leave the child unable to tell "the app
 * ignored me" from "I said it wrong".
 */
export default function PictogramStrip({ words, isResolving, lang }) {
  const empty = words.length === 0;

  const labels = {
    es: {
      region: 'Pictogramas',
      resolving: 'Buscando pictogramas',
      empty: 'Todavía no hay pictogramas',
      missing: 'Sin pictograma para',
    },
    en: {
      region: 'Pictograms',
      resolving: 'Finding pictograms',
      empty: 'No pictograms yet',
      missing: 'No pictogram for',
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
            <li
              // Index is part of the key on purpose: the same word can legitimately
              // appear twice in one phrase ("more more"), and both must render.
              key={`${word.token.lookup}-${index}`}
              className="pictogram-strip__item"
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
              <span className="pictogram-strip__word" aria-hidden="true">
                {word.token.raw}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
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
