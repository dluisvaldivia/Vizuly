import { useCallback, useEffect, useRef, useState } from 'react';

import { pictogramImageUrl, searchCandidates } from '../../aac/useAac.ts';

/**
 * Fix one word.
 *
 * Reached by a long press on a pictogram, the same deliberate gesture that
 * guards settings, because this is an adult tool: the child never needs it and
 * must not fall into it by exploring.
 *
 * It answers the three things that actually go wrong in use:
 *
 *   wrong symbol   "noah" resolves to the biblical ark. Pick the right one.
 *   no symbol      the placeholder. Search a different word and pick from that.
 *   wrong word     English "my" resolving to "mine", where Spanish strips "mi".
 *                  Ignore it and it is treated as a function word from now on.
 *
 * Plus "flag", for the case that matters most at 8am on a school morning: the
 * adult can see the symbol is wrong but has no time to fix it. Flagging changes
 * nothing the child sees and leaves a note in the adult panel.
 *
 * Every action here is undoable from the adult panel. That is what makes a
 * long-press entry point safe to put on a control the child can reach.
 */
export default function FixWordDialog({
  word,
  lang,
  correction,
  onPin,
  onIgnore,
  onFlag,
  onUndo,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const headingRef = useRef(null);

  const labels = {
    es: {
      title: 'Corregir palabra',
      current: 'Ahora muestra',
      none: 'Sin pictograma',
      searchLabel: 'Buscar otro pictograma',
      search: 'Buscar',
      searching: 'Buscando',
      results: 'Elige el pictograma correcto',
      noResults: 'Sin resultados. Prueba con otra palabra.',
      choose: 'Usar este pictograma para',
      ignore: 'Ignorar esta palabra',
      ignoreHelp: 'Se trata como palabra funcional y deja de mostrarse.',
      flag: 'Marcar para revisar',
      flagHelp: 'No cambia nada ahora. Queda anotado en los ajustes.',
      undo: 'Deshacer la corrección',
      close: 'Cerrar',
      pinned: 'Pictograma fijado por un adulto',
      ignored: 'Palabra ignorada por un adulto',
      flagged: 'Marcada para revisar',
    },
    en: {
      title: 'Fix word',
      current: 'Currently shows',
      none: 'No pictogram',
      searchLabel: 'Search for another pictogram',
      search: 'Search',
      searching: 'Searching',
      results: 'Choose the right pictogram',
      noResults: 'No results. Try another word.',
      choose: 'Use this pictogram for',
      ignore: 'Ignore this word',
      ignoreHelp: 'Treated as a function word and no longer shown.',
      flag: 'Flag for review',
      flagHelp: 'Changes nothing now. Noted in settings.',
      undo: 'Undo the correction',
      close: 'Close',
      pinned: 'Pictogram pinned by an adult',
      ignored: 'Word ignored by an adult',
      flagged: 'Flagged for review',
    },
  }[lang];

  const runSearch = useCallback(
    (term) => {
      const trimmed = term.trim();
      if (!trimmed) return undefined;

      const controller = new AbortController();
      setIsSearching(true);

      searchCandidates(trimmed, lang, controller.signal)
        .then((ids) => {
          if (controller.signal.aborted) return;
          setCandidates(ids);
          setIsSearching(false);
        })
        .catch(() => {
          // searchCandidates already swallows failures, so this is an abort.
          // Never leave the adult staring at a stuck "Searching".
          if (!controller.signal.aborted) setIsSearching(false);
        });

      return () => controller.abort();
    },
    [lang],
  );

  // Open on the word the child actually said, already searched. The common case
  // is that the right symbol is two taps away, and making the adult type the
  // word again before seeing anything would cost more than it is worth.
  useEffect(() => {
    setQuery(word.token.lookup);
    return runSearch(word.token.lookup);
  }, [word, runSearch]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const state =
    correction?.kind === 'pin'
      ? labels.pinned
      : correction?.kind === 'ignore'
        ? labels.ignored
        : correction?.kind === 'flag'
          ? labels.flagged
          : null;

  return (
    <div className="fix-word__backdrop" onClick={onClose}>
      <div
        className="fix-word"
        role="dialog"
        aria-modal="true"
        aria-label={`${labels.title}: ${word.token.raw}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="fix-word__title" tabIndex={-1} ref={headingRef}>
          {labels.title}: <strong>{word.token.raw}</strong>
        </h2>

        {/* State is never colour alone: this line says it in words. */}
        {state ? <p className="fix-word__state">{state}</p> : null}

        <div className="fix-word__current">
          <span className="fix-word__current-label">{labels.current}</span>
          {word.pictogramId === null ? (
            <span className="fix-word__none">{labels.none}</span>
          ) : (
            <img
              className="fix-word__current-image"
              src={pictogramImageUrl(word.pictogramId, 300)}
              alt=""
              draggable="false"
            />
          )}
        </div>

        <form
          className="fix-word__search"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(query);
          }}
        >
          <label className="fix-word__search-label" htmlFor="fix-word-query">
            {labels.searchLabel}
          </label>
          <div className="fix-word__search-row">
            <input
              id="fix-word-query"
              className="fix-word__field"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
            <button type="submit">{labels.search}</button>
          </div>
        </form>

        <div className="fix-word__results" aria-busy={isSearching}>
          <p className="fix-word__results-label" aria-live="polite">
            {isSearching
              ? labels.searching
              : candidates.length === 0
                ? labels.noResults
                : labels.results}
          </p>

          <ul className="fix-word__grid">
            {candidates.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className={`fix-word__candidate${
                    correction?.kind === 'pin' && correction.pictogramId === id ? ' is-pinned' : ''
                  }`}
                  onClick={() => onPin(id)}
                  aria-label={`${labels.choose} ${word.token.raw}`}
                  aria-pressed={correction?.kind === 'pin' && correction.pictogramId === id}
                >
                  <img src={pictogramImageUrl(id, 300)} alt="" draggable="false" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="fix-word__actions">
          <button type="button" onClick={onIgnore}>
            {labels.ignore}
          </button>
          <p className="fix-word__help">{labels.ignoreHelp}</p>

          <button type="button" onClick={onFlag}>
            {labels.flag}
          </button>
          <p className="fix-word__help">{labels.flagHelp}</p>

          {correction ? (
            <button type="button" onClick={onUndo}>
              {labels.undo}
            </button>
          ) : null}
        </div>

        <button type="button" className="fix-word__close" onClick={onClose}>
          {labels.close}
        </button>
      </div>
    </div>
  );
}
