import { useCallback, useEffect, useState } from 'react';

import { useAac } from '../../aac/useAac.ts';
import { useSpeech } from '../../speech/useSpeech.ts';
import { getInitialLang, setLang } from '../../controllers/languageController.js';
import { useLongPress } from '../hooks/useLongPress.js';
import PictogramStrip from '../components/PictogramStrip.jsx';
import TextInput from '../components/TextInput.jsx';
import MicButton from '../components/MicButton.jsx';
import AdultPanel from '../components/AdultPanel.jsx';
import Attribution from '../components/Attribution.jsx';

/**
 * The app.
 *
 * Two independent input paths feed the same engine. The typed path does not
 * know the speech path exists, and nothing about it is gated on speech state:
 * if the mic is denied or Deepgram is unreachable, typing still works.
 *
 * Adult controls live behind a long press on the title. There is no visible
 * settings button, because the child would find it.
 */
export default function Home() {
  const [lang, setLangState] = useState(getInitialLang);
  const [adultOpen, setAdultOpen] = useState(false);

  const { words, isResolving, say, clear, forgetAll } = useAac(lang);

  useEffect(() => {
    setLang(lang);
  }, [lang]);

  // Speech feeds the same entry point as typing.
  const handleTranscript = useCallback((transcript) => say(transcript), [say]);
  const speech = useSpeech(lang, handleTranscript);

  const openAdult = useCallback(() => setAdultOpen(true), []);
  const longPress = useLongPress(openAdult);

  const labels = {
    es: {
      clear: 'Borrar',
      micUnavailable: 'Micrófono no disponible',
      adultHint: 'Mantén pulsado para ajustes',
    },
    en: {
      clear: 'Clear',
      micUnavailable: 'Microphone unavailable',
      adultHint: 'Long press for settings',
    },
  }[lang];

  return (
    <div className="app">
      <header className="app__header">
        {/* The adult gate.
            The heading stays a heading for document structure, and the gesture
            target is a real button inside it. A plain <h1> with a keydown
            handler is not keyboard reachable (tabIndex -1), which locked
            keyboard-only adults out of settings entirely. */}
        <h1 className="app__title-wrap">
          <button
            type="button"
            className="app__title"
            {...longPress}
            aria-haspopup="dialog"
            aria-label={`Vizuly. ${labels.adultHint}`}
            title={labels.adultHint}
          >
            Vizuly
          </button>
        </h1>
      </header>

      <main className="app__main">
        <PictogramStrip words={words} isResolving={isResolving} lang={lang} />

        <div className="app__inputs">
          {speech.isAvailable ? (
            <MicButton
              status={speech.status}
              isListening={speech.isListening}
              interim={speech.interim}
              lang={lang}
              onToggle={speech.toggle}
            />
          ) : (
            <p className="mic__status">{labels.micUnavailable}</p>
          )}

          {/* Never disabled by speech state. The two paths are independent. */}
          <TextInput onSubmit={say} lang={lang} />
        </div>

        <button className="app__clear" type="button" onClick={clear}>
          {labels.clear}
        </button>
      </main>

      <Attribution />

      <AdultPanel
        open={adultOpen}
        onClose={() => setAdultOpen(false)}
        lang={lang}
        onLangChange={setLangState}
        onForgetAll={forgetAll}
      />
    </div>
  );
}
