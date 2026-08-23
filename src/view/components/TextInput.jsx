import { useState } from 'react';

/**
 * Typed input. A first-class input path, not a fallback.
 *
 * This component imports nothing from the speech layer and must never be gated
 * on any speech state. If Deepgram is down, the key is missing, or the mic is
 * denied, typing still works perfectly.
 */
export default function TextInput({ onSubmit, lang, disabled = false }) {
  const [value, setValue] = useState('');

  const labels = {
    es: {
      label: 'Escribe una palabra o frase',
      placeholder: 'Escribe aquí',
      submit: 'Mostrar pictogramas',
    },
    en: {
      label: 'Type a word or phrase',
      placeholder: 'Type here',
      submit: 'Show pictograms',
    },
  }[lang];

  function handleSubmit(event) {
    event.preventDefault();

    const trimmed = value.trim();
    if (!trimmed) return;

    onSubmit(trimmed);
    setValue('');
  }

  return (
    <form className="text-input" onSubmit={handleSubmit}>
      <label className="text-input__label" htmlFor="phrase">
        {labels.label}
      </label>

      <div className="text-input__row">
        <input
          id="phrase"
          className="text-input__field"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={labels.placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="go"
          disabled={disabled}
        />

        <button
          className="text-input__submit"
          type="submit"
          disabled={disabled || value.trim().length === 0}
        >
          {labels.submit}
        </button>
      </div>
    </form>
  );
}
