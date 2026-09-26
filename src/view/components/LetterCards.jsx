import { useEffect, useMemo, useRef, useState } from 'react';

import { listDecks, cardWords, cardLetter, orderByScore, useWordCards } from '../../aac/useAac.ts';
import LetterCard from './LetterCard.jsx';
import FavoriteStar from './FavoriteStar.jsx';

/**
 * Where a deck opens, by age band. Spanish starts at two syllables, where most
 * children start, and grows a syllable per band. English starts at one, because
 * its first words are one syllable (cat, dog, sun).
 */
const DEFAULT_SYLLABLES = { es: { 3: 2, 6: 3, 9: 4 }, en: { 3: 1, 6: 2, 9: 3 } };

/**
 * Letter cards, the family's paper cards on screen.
 *
 * Two screens. First the adult picks the letter to work on, every time the
 * mode opens. Then one big card at a time: a tap turns it over silently, and
 * only once it is turned does a button appear beside it to say the word.
 *
 * No score, no end, no wrong answer: the arrows wrap around, and the only state
 * is which card is showing and which way up it is. A swipe rates the card and
 * moves on; the rating only decides how soon the word comes round again.
 *
 * `age` is the active child's band and `scores` their ratings so far.
 */
export default function LetterCards({
  lang,
  age,
  scores,
  onRate,
  revision,
  onFix,
  onSpeak,
  onCardChange,
  onDeckChange,
  isFavorite,
  onToggleFavorite,
}) {
  const decks = listDecks(lang);
  const [deckId, setDeckId] = useState(null);
  const [syllables, setSyllables] = useState(DEFAULT_SYLLABLES[lang][age]);
  const [position, setPosition] = useState(undefined);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /** What the last swipe meant, for the live region. Cleared on the next card. */
  const [lastAction, setLastAction] = useState('');

  const deck = decks.find((d) => d.id === deckId) ?? null;
  // The words this child is old enough for. Everything below filters this,
  // never the raw deck, so a chip never leads to an empty list.
  const forAge = useMemo(() => (deck ? cardWords(deck, { age }) : []), [deck, age]);

  const labels = {
    es: {
      pick: 'Elige una letra',
      back: 'Letras',
      backName: 'Volver a elegir letra',
      prev: 'Carta anterior',
      next: 'Carta siguiente',
      say: 'Decir',
      all: 'Todas',
      syllableGroup: 'Sílabas',
      syllableCount: (n) => (n === 1 ? '1 sílaba' : `${n} sílabas`),
      positionGroup: 'Posición de la letra',
      inicial: 'Al inicio',
      media: 'En medio',
      empty: 'No hay cartas con este filtro',
      of: 'de',
      deck: 'Letra',
      known: 'La sé',
      again: 'Otra vez',
    },
    en: {
      pick: 'Choose a letter',
      back: 'Letters',
      backName: 'Back to choosing a letter',
      prev: 'Previous card',
      next: 'Next card',
      say: 'Say',
      all: 'All',
      syllableGroup: 'Syllables',
      syllableCount: (n) => (n === 1 ? '1 syllable' : `${n} syllables`),
      positionGroup: 'Letter position',
      inicial: 'At the start',
      // Not "In the middle": most English examples end in the letter (cat).
      media: 'Later in the word',
      empty: 'No cards with this filter',
      of: 'of',
      deck: 'Letter',
      known: 'Got it',
      again: 'Again',
    },
  }[lang];

  const syllableOptions = useMemo(
    () => [...new Set(forAge.map((w) => w.syllables))].sort((a, b) => a - b),
    [forAge],
  );
  // Only worth a filter when the deck has both: an English blend deck is all
  // "at the start", and one of the chips would always show an empty deck.
  const hasPositions = new Set(forAge.map((w) => w.position).filter(Boolean)).size > 1;

  // The ratings are read through a ref on purpose: the order is drawn once when
  // the deck or a filter changes and then stays put, so a swipe never reshuffles
  // the cards under the child and the arrows stay predictable.
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const entries = useMemo(
    () =>
      deck
        ? orderByScore(cardWords(deck, { syllables, position, age }), (w) => scoresRef.current[`${lang}.${w.word}`] ?? 0)
        : [],
    [deck, syllables, position, age, lang],
  );
  const { cards } = useWordCards(
    entries.map((e) => e.word),
    lang,
    revision,
  );

  const safeIndex = entries.length > 0 ? index % entries.length : 0;
  const entry = entries[safeIndex] ?? null;
  // Only trust a resolved card that belongs to this word: while a new filter
  // resolves, the previous list is still in state for a moment.
  const card = entry && cards[safeIndex]?.token.raw === entry.word ? cards[safeIndex] : null;

  // The current card is what the voice prepares, so its recording starts when
  // the card appears rather than when the button is pressed.
  useEffect(() => {
    onCardChange(card);
  }, [card, onCardChange]);
  useEffect(() => () => onCardChange(null), [onCardChange]);

  // The rest of the open deck, so the voice can ready what is already free
  // for it in the background. Only this deck, only while it is open.
  useEffect(() => {
    onDeckChange(cards);
  }, [cards, onDeckChange]);
  useEffect(() => () => onDeckChange(null), [onDeckChange]);

  function chooseDeck(id) {
    const chosen = decks.find((d) => d.id === id);
    const counts = new Set(cardWords(chosen, { age }).map((w) => w.syllables));
    const preferred = DEFAULT_SYLLABLES[lang][age];
    setDeckId(id);
    setSyllables(counts.has(preferred) ? preferred : undefined);
    setPosition(undefined);
    setIndex(0);
    setFlipped(false);
  }

  function go(step) {
    if (entries.length === 0) return;
    setIndex((safeIndex + step + entries.length) % entries.length);
    setFlipped(false);
    setLastAction('');
  }

  /** A swipe: record it for this child, say what it meant, move on. */
  function rate(delta) {
    if (!entry) return;
    onRate(entry.word, delta);
    go(1);
    setLastAction(delta > 0 ? labels.known : labels.again);
  }

  function filter(setter, value) {
    setter(value);
    setIndex(0);
    setFlipped(false);
  }

  function say() {
    if (!card) return;
    onSpeak(card, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
  }

  if (!deck) {
    return (
      <section className="letter-cards" aria-labelledby="letter-cards-pick">
        <h2 id="letter-cards-pick" className="letter-cards__heading">{labels.pick}</h2>
        <ul className="letter-cards__picker">
          {decks.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={`letter-cards__tile${tileSize(d.label)}`}
                onClick={() => chooseDeck(d.id)}
                aria-label={`${labels.deck} ${d.label}`}
              >
                {d.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const letter = entry ? cardLetter(deck, entry) : null;

  return (
    <section className="letter-cards" aria-label={`${labels.deck} ${deck.label}`}>
      <div className="letter-cards__bar">
        <button
          type="button"
          className="letter-cards__back"
          onClick={() => setDeckId(null)}
          aria-label={labels.backName}
        >
          <svg viewBox="0 0 24 24" width="1.25rem" height="1.25rem" aria-hidden="true" focusable="false">
            <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {labels.back}
        </button>
        <span className="letter-cards__deck" aria-hidden="true">{deck.label}</span>
      </div>

      {syllableOptions.length > 1 || hasPositions ? (
        <div className="letter-cards__filters">
          {syllableOptions.length > 1 ? (
            <div className="letter-cards__chips" role="group" aria-label={labels.syllableGroup}>
              {syllableOptions.map((n) => (
                <Chip key={n} pressed={syllables === n} onClick={() => filter(setSyllables, n)}>
                  {labels.syllableCount(n)}
                </Chip>
              ))}
              <Chip pressed={syllables === undefined} onClick={() => filter(setSyllables, undefined)}>
                {labels.all}
              </Chip>
            </div>
          ) : null}
          {hasPositions ? (
            <div className="letter-cards__chips" role="group" aria-label={labels.positionGroup}>
              <Chip pressed={position === undefined} onClick={() => filter(setPosition, undefined)}>
                {labels.all}
              </Chip>
              <Chip pressed={position === 'inicial'} onClick={() => filter(setPosition, 'inicial')}>
                {labels.inicial}
              </Chip>
              <Chip pressed={position === 'media'} onClick={() => filter(setPosition, 'media')}>
                {labels.media}
              </Chip>
            </div>
          ) : null}
        </div>
      ) : null}

      {entry ? (
        <>
          <div className="letter-cards__stage">
            {/* The slot holds both buttons and reserves the height of both, so
                the card never jumps when a turn makes the speak button appear.
                The matching left spacer centres it on wide screens and is
                dropped on a phone, where the card needs the room. */}
            <span className="letter-cards__side letter-cards__side--balance" aria-hidden="true" />
            <LetterCard
              card={card}
              entry={entry}
              letter={letter}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
              onFix={onFix}
              onSwipe={rate}
              lang={lang}
            />
            <span className="letter-cards__side">
              {/* Saves the card's word, from either face: the word is the same
                  whichever way up the card is. */}
              <FavoriteStar
                saved={isFavorite(entry.word)}
                onToggle={() => onToggleFavorite(entry.word)}
                name={entry.word}
                lang={lang}
                className="letter-cards__fav"
              />
              {flipped ? (
                <button
                  type="button"
                  className={`letter-cards__speak${speaking ? ' is-speaking' : ''}`}
                  onClick={say}
                  disabled={!card}
                  aria-label={`${labels.say} ${entry.word}`}
                  title={`${labels.say} ${entry.word}`}
                >
                  <svg viewBox="0 0 24 24" width="2.25rem" height="2.25rem" aria-hidden="true" focusable="false">
                    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
                    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
            </span>
          </div>

          <p className="visually-hidden" aria-live="polite">
            {[lastAction, flipped ? [letter, entry.word].filter(Boolean).join(', ') : ''].filter(Boolean).join('. ')}
          </p>

          <div className="letter-cards__nav">
            <button type="button" className="letter-cards__arrow" onClick={() => go(-1)} aria-label={labels.prev}>
              <svg viewBox="0 0 24 24" width="2.5rem" height="2.5rem" aria-hidden="true" focusable="false">
                <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="letter-cards__count">
              {safeIndex + 1} {labels.of} {entries.length}
            </span>
            <button type="button" className="letter-cards__arrow" onClick={() => go(1)} aria-label={labels.next}>
              <svg viewBox="0 0 24 24" width="2.5rem" height="2.5rem" aria-hidden="true" focusable="false">
                <path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </>
      ) : (
        <p className="letter-cards__empty">{labels.empty}</p>
      )}
    </section>
  );
}

/** Longer labels get a smaller size so a tile never wraps mid label. */
function tileSize(label) {
  if (label.length > 6) return ' letter-cards__tile--long';
  if (label.length > 5) return ' letter-cards__tile--medium';
  return '';
}

function Chip({ pressed, onClick, children }) {
  return (
    <button type="button" className={`letter-cards__chip${pressed ? ' is-active' : ''}`} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}
