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
