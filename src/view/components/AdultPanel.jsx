import { useEffect, useMemo, useRef, useState } from 'react';

import { exportCorrections, pictogramImageUrl } from '../../aac/useAac.ts';
import { getInitialTheme, setTheme } from '../../controllers/themeController.js';

/**
 * Adult-only settings.
 *
 * Reached by a long press on the title, never by a visible button, so the child
 * cannot wander in. Everything here is adult-facing, so plain text is fine:
 * this is the one place in the app where reading is expected.
 */
export default function AdultPanel({
  open,
  onClose,
  lang,
  onForgetAll,
  corrections,
  onUndoCorrection,
  readingTier,
  onReadingTierChange,
  syllableMode,
  onSyllableModeChange,
  liveVoice,
  onLiveVoiceChange,
  voiceBudget,
}) {
  const closeRef = useRef(null);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  /**
   * Built when the export is opened, not on every render, so the timestamp
   * inside it does not change under the adult while they are copying it.
   */
  const exported = useMemo(
    () => (showJson ? exportCorrections() : ''),
    // exportCorrections reads storage rather than taking an argument, so the
    // linter cannot see that `corrections` is what changes its result. It is in
    // the deps so that undoing an entry while the export is open does not leave
    // stale text on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showJson, corrections],
  );

  // A fresh export has not been copied yet.
  useEffect(() => {
    setCopied(false);
  }, [exported]);

  const labels = {
    es: {
      title: 'Ajustes',
      theme: 'Tema',
      toggleTheme: 'Cambiar tema',
      readingTier: 'Palabras de enlace',
      readingTierHelp:
        'Cuántas palabras de enlace aparecen cuando el modo lectura está activado, con el botón de la cabecera. No cambia nada mientras esté desactivado.',
      tierConnectors: 'Solo enlaces (a, y, en, de, con)',
      tierArticles: 'Enlaces y artículos (el, la, un)',
      tierClitics: 'Enlaces, artículos y pronombres (me, te, se)',
      tierCliticsHelp:
        'El nivel menos preciso: "me" muestra el pictograma de YO, y "se" comparte símbolo con "le".',
      voice: 'Voz',
      voiceHelp: 'Qué se oye al tocar un pictograma.',
      syllablesOn: 'Palabra y sílabas ("cabeza, ca-be-za")',
      syllablesOff: 'Palabra sola ("cabeza")',
      liveVoice: 'Voz para palabras nuevas',
      liveVoiceOn: 'Activada',
      liveVoiceOff: 'Desactivada',
      liveVoiceHelp:
        'Las palabras de la lista ya tienen voz grabada y no cuestan nada. Activar esto graba también las palabras nuevas, usando crédito de Deepgram, con un tope diario.',
      liveVoiceUsage: (used, limit) => `Usadas hoy: ${used} de ${limit}.`,
      cache: 'Pictogramas guardados',
      forget: 'Borrar pictogramas guardados',
      forgetHelp:
        'Vuelve a buscar cada palabra. Tus correcciones se conservan.',
      corrections: 'Correcciones',
      correctionsHelp:
        'Mantén pulsado un pictograma para corregirlo. Aquí puedes deshacerlo.',
      noCorrections: 'Todavía no hay correcciones.',
      pinned: 'Pictograma fijado',
      ignored: 'Palabra ignorada',
      flagged: 'Marcada para revisar',
      undo: 'Deshacer',
      showJson: 'Exportar correcciones',
      hideJson: 'Ocultar exportación',
      jsonHelp:
        'Todo lo corregido, ignorado y marcado, en las dos lenguas. Tócalo para seleccionarlo todo y cópialo. Es la única forma de sacar esto del dispositivo.',
      copy: 'Copiar',
      copied: 'Copiado',
      close: 'Cerrar',
    },
    en: {
      title: 'Settings',
      theme: 'Theme',
      toggleTheme: 'Switch theme',
      readingTier: 'Linking words',
      readingTierHelp:
        'How many linking words appear when reading mode is on, using the header button. Changes nothing while it is off.',
      tierConnectors: 'Links only (to, and, in, of, with)',
      tierArticles: 'Links and articles (the, a, an)',
      tierClitics: 'Links, articles and possessives (my, your, his)',
      tierCliticsHelp:
        'The least precise tier: these borrow pronoun pictograms rather than having symbols of their own.',
      voice: 'Voice',
      voiceHelp: 'What a tap on a pictogram says.',
      syllablesOn: 'Word and syllables ("cabeza, ca-be-za")',
      syllablesOff: 'Word only ("cabeza")',
      liveVoice: 'Voice for new words',
      liveVoiceOn: 'On',
      liveVoiceOff: 'Off',
      liveVoiceHelp:
        'Words on the list already have a recorded voice and cost nothing. Turning this on records new words too, using Deepgram credit, with a daily cap.',
      liveVoiceUsage: (used, limit) => `Used today: ${used} of ${limit}.`,
      cache: 'Saved pictograms',
      forget: 'Clear saved pictograms',
      forgetHelp: 'Looks every word up again. Your corrections are kept.',
      corrections: 'Corrections',
      correctionsHelp: 'Long press a pictogram to fix it. Undo it here.',
      noCorrections: 'No corrections yet.',
      pinned: 'Pictogram pinned',
      ignored: 'Word ignored',
      flagged: 'Flagged for review',
      undo: 'Undo',
      showJson: 'Export corrections',
      hideJson: 'Hide export',
      jsonHelp:
        'Everything pinned, ignored and flagged, both languages. Tap it to select all, then copy. This is the only way to get any of it off the device.',
      copy: 'Copy',
      copied: 'Copied',
      close: 'Close',
    },
  }[lang];

  // Move focus into the dialog when it opens, so keyboard and screen reader
  // users land in the right place.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Escape closes, as a dialog should.
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="adult-panel__backdrop" onClick={onClose}>
      <div
        className="adult-panel"
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        // Clicks inside must not close the dialog.
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="adult-panel__title">{labels.title}</h2>

        <fieldset className="adult-panel__group">
          <legend>{labels.theme}</legend>
          <button
            type="button"
            onClick={() => setTheme(getInitialTheme() === 'light' ? 'dark' : 'light')}
          >
            {labels.toggleTheme}
          </button>
        </fieldset>

        {/* Reading tier. Lives here rather than in the header because it is a
            calibration an adult sets once, not something to flip back and
            forth. The mode itself is a header button. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.readingTier}</legend>
          <p className="adult-panel__help">{labels.readingTierHelp}</p>

          {[
            { value: 'connectors', label: labels.tierConnectors },
            { value: 'articles', label: labels.tierArticles },
            { value: 'clitics', label: labels.tierClitics },
          ].map((tier) => (
            <label key={tier.value} className="adult-panel__radio">
              <input
                type="radio"
                name="reading-tier"
                value={tier.value}
                checked={readingTier === tier.value}
                onChange={() => onReadingTierChange(tier.value)}
              />
              {/* The name carries the state, never colour alone. */}
              <span>{tier.label}</span>
            </label>
          ))}

          {readingTier === 'clitics' ? (
            <p className="adult-panel__help">{labels.tierCliticsHelp}</p>
          ) : null}
        </fieldset>

        {/* Voice. Same reasoning as the reading tier: a calibration an adult
            makes for how he is working now, not a control to flip back and
            forth, so it lives behind the gesture rather than in the header. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.voice}</legend>
          <p className="adult-panel__help">{labels.voiceHelp}</p>

          {[
            { value: 'on', label: labels.syllablesOn },
            { value: 'off', label: labels.syllablesOff },
          ].map((option) => (
            <label key={option.value} className="adult-panel__radio">
              <input
                type="radio"
                name="syllable-mode"
                value={option.value}
                checked={syllableMode === option.value}
                onChange={() => onSyllableModeChange(option.value)}
              />
              {/* The name carries the state, never colour alone. */}
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        {/* Live generation. Off by default and deliberately separate from the
            setting above: this one spends money, and it should never be
            switched on by someone who was aiming at the syllables. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.liveVoice}</legend>
          <p className="adult-panel__help">{labels.liveVoiceHelp}</p>

          {[
            { value: 'off', label: labels.liveVoiceOff },
            { value: 'on', label: labels.liveVoiceOn },
          ].map((option) => (
            <label key={option.value} className="adult-panel__radio">
              <input
                type="radio"
                name="live-voice"
                value={option.value}
                checked={liveVoice === option.value}
                onChange={() => onLiveVoiceChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}

          {liveVoice === 'on' ? (
            <p className="adult-panel__help">
              {labels.liveVoiceUsage(voiceBudget.used, voiceBudget.limit)}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="adult-panel__group">
          <legend>{labels.cache}</legend>
          <button type="button" onClick={onForgetAll}>
            {labels.forget}
          </button>
          <p className="adult-panel__help">{labels.forgetHelp}</p>
        </fieldset>

        {/* The review list. This is the only place a flag is visible, and the
            only place a correction can be taken back, which is what makes the
            long-press fix gesture safe to leave within the child's reach. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.corrections}</legend>
          <p className="adult-panel__help">{labels.correctionsHelp}</p>

          {corrections.length === 0 ? (
            <p className="adult-panel__help">{labels.noCorrections}</p>
          ) : (
            <ul className="adult-panel__corrections">
              {corrections.map((entry) => (
                <li key={`${entry.lang}.${entry.word}`} className="adult-panel__correction">
                  {entry.correction.kind === 'pin' ? (
                    <img
                      className="adult-panel__correction-image"
                      src={pictogramImageUrl(entry.correction.pictogramId, 300)}
                      alt=""
                      draggable="false"
                      loading="lazy"
                    />
                  ) : (
                    <span className="adult-panel__correction-image" aria-hidden="true" />
                  )}

                  <span className="adult-panel__correction-word">
                    {entry.word} <span lang="en">({entry.lang})</span>
                  </span>

                  {/* Kind in words, never colour or icon alone. */}
                  <span className="adult-panel__correction-kind">
                    {entry.correction.kind === 'pin'
                      ? labels.pinned
                      : entry.correction.kind === 'ignore'
                        ? labels.ignored
                        : labels.flagged}
                  </span>

                  <button
                    type="button"
                    onClick={() => onUndoCorrection(entry.word)}
                    aria-label={`${labels.undo}: ${entry.word}`}
                  >
                    {labels.undo}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" onClick={() => setShowJson((shown) => !shown)}>
            {showJson ? labels.hideJson : labels.showJson}
          </button>

          {showJson ? (
            <>
              <p className="adult-panel__help">{labels.jsonHelp}</p>
              {/* The textarea is the export, and the copy button is a
                  convenience on top of it. Never the other way round: the
                  clipboard call fails silently in enough browsers that
                  selectable text has to be the thing that always works. */}
              <textarea
                className="adult-panel__json"
                readOnly
                rows={8}
                value={exported}
                aria-label={labels.showJson}
                // Selecting a long JSON blob by dragging on a tablet is
                // miserable. One tap selects the lot.
                onFocus={(event) => event.target.select()}
                onClick={(event) => event.target.select()}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(exported)
                    .then(() => setCopied(true))
                    // Blocked, insecure context, or unsupported. The textarea
                    // above is still there and still selectable.
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? labels.copied : labels.copy}
              </button>
            </>
          ) : null}
        </fieldset>

        <button type="button" className="adult-panel__close" onClick={onClose} ref={closeRef}>
          {labels.close}
        </button>
      </div>
    </div>
  );
}
