import { useState } from 'react';
import { FaPlay } from 'react-icons/fa';
import { MdDeleteForever } from 'react-icons/md';

import OutputModeToggle from './OutputModeToggle.jsx';

/**
 * Typed input. A first-class input path, not a fallback.
 *
 * This component imports nothing from the speech layer and must never be gated
 * on any speech state. If Deepgram is down, the key is missing, or the mic is
 * denied, typing still works perfectly.
 */
export default function TextInput({
  onSubmit,
  onClear,
  clearLabel,
  lang,
  disabled = false,
  outputModeActive,
  onOutputModeToggle,
}) {
  const [value, setValue] = useState('');

  const labels = {
    es: {
      placeholder: 'Escribe una palabra o frase',
      submit: 'Mostrar',
    },
    en: {
      placeholder: 'Type a word or phrase',
      submit: 'Show',
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
      <div className="text-input__row">
        <input
          id="phrase"
          className="text-input__field"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
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
          <FaPlay aria-hidden="true" />
          {labels.submit}
        </button>

        {onOutputModeToggle ? (
          <OutputModeToggle active={outputModeActive} onToggle={onOutputModeToggle} lang={lang} />
        ) : null}

        {onClear ? (
          <button className="app__clear" type="button" onClick={onClear}>
            <MdDeleteForever aria-hidden="true" />
            {clearLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
