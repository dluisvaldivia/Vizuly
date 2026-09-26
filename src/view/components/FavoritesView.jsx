import { pictogramImageUrl } from '../../aac/useAac.ts';

/**
 * The saved words and phrases, as pictograms.
 *
 * Two sections because an adult scans them differently: single words are the
 * vocabulary being practised, phrases are the things the child asks for. The
 * split is counted here, not stored, so a favourite never has to be migrated.
 *
 * A tap loads the favourite into the strip and comes back to it, silently. It
 * says nothing by itself: the child then taps the pictograms in the strip to
 * hear them, exactly as for anything else they said. So a tap still takes the
 * child nowhere they cannot get back from, and nothing here can delete
 * anything: removing is an adult action, in the adult panel.
 *
 * Every tile shows pictures, never only text. The child does not read, so a
 * text-only tile would be unusable by the person the list is for.
 */
export default function FavoritesView({ favorites, rows, lang, onPick }) {
  const labels = {
    es: {
      region: 'Favoritos',
      words: 'Palabras',
      phrases: 'Frases',
      empty: 'Todavía no hay favoritos',
      emptyHint: 'Guarda una palabra o una frase con la estrella.',
      missing: 'Sin pictograma para',
      pick: 'Decir',
    },
    en: {
      region: 'Favourites',
      words: 'Words',
      phrases: 'Phrases',
      empty: 'No favourites yet',
      emptyHint: 'Save a word or a phrase with the star.',
      missing: 'No pictogram for',
      pick: 'Say',
    },
  }[lang];

  // The row index has to survive the split, because rows come back in the order
  // the favourites were given.
  const entries = favorites.map((favorite, index) => ({ favorite, row: rows[index] }));
  const isWord = ({ favorite }) => favorite.text.trim().split(/\s+/u).length === 1;
  const words = entries.filter(isWord);
  const phrases = entries.filter((entry) => !isWord(entry));

  if (favorites.length === 0) {
    return (
      <section className="favorites" aria-label={labels.region}>
        {/* The same three empty frames the strip uses: the picture is for the
            child, the sentence under it for the adult. */}
        <div className="favorites__empty">
          <svg className="favorites__empty-art" viewBox="0 0 96 32" aria-hidden="true" focusable="false">
            <rect x="2" y="2" width="28" height="28" rx="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <rect x="34" y="2" width="28" height="28" rx="6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 4" />
            <rect x="66" y="2" width="28" height="28" rx="6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 4" />
          </svg>
          <p>{labels.empty}</p>
          <p className="favorites__hint">{labels.emptyHint}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="favorites" aria-label={labels.region}>
      {words.length > 0 ? (
        <Section id="favorites-words" title={labels.words} entries={words} labels={labels} onPick={onPick} />
      ) : null}
      {phrases.length > 0 ? (
        <Section id="favorites-phrases" title={labels.phrases} entries={phrases} labels={labels} onPick={onPick} />
      ) : null}
    </section>
  );
}

function Section({ id, title, entries, labels, onPick }) {
  return (
    <section className="favorites__section" aria-labelledby={id}>
      <h2 id={id} className="favorites__heading">
        {title}
      </h2>
      <ul className="favorites__list">
        {entries.map(({ favorite, row }) => (
          <li key={`${favorite.lang}.${favorite.text}`}>
            <button
              type="button"
              className="favorites__tile"
              onClick={() => onPick(favorite.text)}
              aria-label={`${labels.pick}: ${favorite.text}`}
              title={`${labels.pick}: ${favorite.text}`}
            >
              <span className="favorites__row">
                {row === undefined ? (
                  // Still resolving. Never an empty frame that looks like a miss.
                  <span className="favorites__loading" />
                ) : row.length === 0 ? (
                  // Every word was dropped, which a saved phrase can end up as
                  // once an adult ignores a word or changes the reading tier.
                  // Neutral, never blank: a tile with no picture says nothing.
                  <Placeholder word={favorite.text} missingLabel={labels.missing} />
                ) : (
                  row.map((word, index) =>
                    word.pictogramId === null ? (
                      <Placeholder
                        key={`${word.token.lookup}-${index}`}
                        word={word.token.raw}
                        missingLabel={labels.missing}
                      />
                    ) : (
                      <img
                        key={`${word.token.lookup}-${index}`}
                        className="favorites__image"
                        src={pictogramImageUrl(word.pictogramId, 300)}
                        alt=""
                        loading="lazy"
                        draggable="false"
                      />
                    ),
                  )
                )}
              </span>
              {/* For the adult. The accessible name above already carries it. */}
              <span className="favorites__text" aria-hidden="true">
                {favorite.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The strip's placeholder, at tile size. Neutral: a miss is nobody's fault. */
function Placeholder({ word, missingLabel }) {
  return (
    <span className="favorites__placeholder" role="img" aria-label={`${missingLabel} ${word}`}>
      <span aria-hidden="true">?</span>
    </span>
  );
}
