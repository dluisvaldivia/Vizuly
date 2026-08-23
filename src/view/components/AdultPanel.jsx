import { useEffect, useRef } from 'react';

import { getInitialTheme, setTheme } from '../../controllers/themeController.js';

/**
 * Adult-only settings.
 *
 * Reached by a long press on the title, never by a visible button, so the child
 * cannot wander in. Everything here is adult-facing, so plain text is fine:
 * this is the one place in the app where reading is expected.
 */
export default function AdultPanel({ open, onClose, lang, onLangChange, onForgetAll }) {
  const closeRef = useRef(null);

  const labels = {
    es: {
      title: 'Ajustes',
      language: 'Idioma',
      spanish: 'Español',
      english: 'Inglés',
      theme: 'Tema',
      toggleTheme: 'Cambiar tema',
      cache: 'Pictogramas guardados',
      forget: 'Borrar pictogramas guardados',
      forgetHelp:
        'Vuelve a buscar cada palabra. Úsalo solo si un pictograma es incorrecto.',
      close: 'Cerrar',
    },
    en: {
      title: 'Settings',
      language: 'Language',
      spanish: 'Spanish',
      english: 'English',
      theme: 'Theme',
      toggleTheme: 'Switch theme',
      cache: 'Saved pictograms',
      forget: 'Clear saved pictograms',
      forgetHelp: 'Looks every word up again. Use only if a pictogram is wrong.',
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
          <legend>{labels.language}</legend>
          <div className="adult-panel__row">
            <button
              type="button"
              onClick={() => onLangChange('es')}
              aria-pressed={lang === 'es'}
              className={lang === 'es' ? 'is-active' : ''}
            >
              {labels.spanish}
            </button>
            <button
              type="button"
              onClick={() => onLangChange('en')}
              aria-pressed={lang === 'en'}
              className={lang === 'en' ? 'is-active' : ''}
            >
              {labels.english}
            </button>
          </div>
        </fieldset>

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

        <button type="button" className="adult-panel__close" onClick={onClose} ref={closeRef}>
          {labels.close}
        </button>
      </div>
    </div>
  );
}
