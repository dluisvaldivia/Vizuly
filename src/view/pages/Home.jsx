import { useCallback, useEffect, useState } from 'react';

import { useAac } from '../../aac/useAac.ts';
import { useSpeech } from '../../speech/useSpeech.ts';
import { getInitialLang, setLang } from '../../controllers/languageController.js';
import { useLongPress } from '../hooks/useLongPress.js';
import PictogramStrip from '../components/PictogramStrip.jsx';
import TextInput from '../components/TextInput.jsx';
import MicButton from '../components/MicButton.jsx';
import AdultPanel from '../components/AdultPanel.jsx';
import FixWordDialog from '../components/FixWordDialog.jsx';
import Attribution from '../components/Attribution.jsx';
import GameModeToggle from '../components/GameModeToggle.jsx';
import GameMode from '../components/GameMode.jsx';
import LanguageToggle from '../components/LanguageToggle.jsx';

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
  /** The word whose fix dialog is open, or null. Set by a long press. */
  const [fixTarget, setFixTarget] = useState(null);
  const [gameModeOn, setGameModeOn] = useState(false);

  const {
    words,
    isResolving,
    say,
    clear,
    forgetAll,
    correct,
    ignoreWord,
    flagWord,
    undoCorrection,
    correctionFor,
    corrections,
  } = useAac(lang);

  useEffect(() => {
    setLang(lang);
  }, [lang]);

  // Speech feeds the same entry point as typing.
  const handleTranscript = useCallback((transcript) => say(transcript), [say]);
  const speech = useSpeech(lang, handleTranscript);

  const openAdult = useCallback(() => setAdultOpen(true), []);
  const longPress = useLongPress(openAdult);

  const closeFix = useCallback(() => setFixTarget(null), []);

  /**
   * A pin is keyed on the lookup form and an ignore on the normalized form,
   * because that is where each one takes effect: resolution sees the lookup,
   * tokenize sees the normalized word. Undo clears both, so the adult never has
   * to know the difference.
   */
  const undoBoth = useCallback(
    (token) => {
      undoCorrection(token.normalized);
      if (token.lookup !== token.normalized) undoCorrection(token.lookup);
    },
    [undoCorrection],
  );

  const activeCorrection = fixTarget
    ? (correctionFor(fixTarget.token.lookup) ?? correctionFor(fixTarget.token.normalized))
    : null;

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

        <div className="app__header-controls">
          {/* Plain tap, not gated behind the long-press gesture: unlike
              settings, a wrong tap into game mode does no harm. */}
          <GameModeToggle active={gameModeOn} onToggle={() => setGameModeOn((v) => !v)} lang={lang} />
          <LanguageToggle lang={lang} onChange={setLangState} />
        </div>
      </header>

      <main className="app__main">
        {gameModeOn ? (
          // GameMode is only ever mounted here, so toggling off and back on
          // unmounts and remounts it, resetting its held/turn state fresh
          // every time without any extra bookkeeping.
          <GameMode
            words={words}
            isResolving={isResolving}
            say={say}
            clear={clear}
            lang={lang}
            speech={speech}
            onFix={setFixTarget}
          />
        ) : (
          <>
            <PictogramStrip
              words={words}
              isResolving={isResolving}
              lang={lang}
              onFix={setFixTarget}
            />

            <div className="app__inputs">
              {speech.isAvailable ? (
                <MicButton
                  status={speech.status}
                  isListening={speech.isListening}
                  interim={speech.interim}
                  levelRef={speech.levelRef}
                  lang={lang}
                  onToggle={speech.toggle}
                />
              ) : (
                <p className="mic__status">{labels.micUnavailable}</p>
              )}

              {/* Never disabled by speech state. The two paths are independent. */}
              <TextInput onSubmit={say} onClear={clear} clearLabel={labels.clear} lang={lang} />
            </div>
          </>
        )}
      </main>

      <Attribution />

      <AdultPanel
        open={adultOpen}
        onClose={() => setAdultOpen(false)}
        lang={lang}
        onForgetAll={forgetAll}
        corrections={corrections}
        onUndoCorrection={undoCorrection}
      />

      {/* Adult-only, reached by a long press on a pictogram. Mounted only while
          open so its search state starts clean for each word. */}
      {fixTarget ? (
        <FixWordDialog
          word={fixTarget}
          lang={lang}
          correction={activeCorrection}
          onPin={(id) => {
            correct(fixTarget.token.lookup, id);
            closeFix();
          }}
          onIgnore={() => {
            ignoreWord(fixTarget.token.normalized);
            closeFix();
          }}
          onFlag={() => {
            flagWord(fixTarget.token.normalized);
            closeFix();
          }}
          onUndo={() => {
            undoBoth(fixTarget.token);
            closeFix();
          }}
          onClose={closeFix}
        />
      ) : null}
    </div>
  );
}
