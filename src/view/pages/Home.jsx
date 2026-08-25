import { useCallback, useEffect, useRef, useState } from 'react';

import { useAac } from '../../aac/useAac.ts';
import { useSpeech } from '../../speech/useSpeech.ts';
import { useVoice } from '../../speech/useVoice.ts';
import { getInitialLang, setLang } from '../../controllers/languageController.js';
import {
  getInitialOutputMode,
  setOutputMode,
} from '../../controllers/outputModeController.js';
import {
  getInitialReadingTier,
  setReadingTier,
} from '../../controllers/readingTierController.js';
import {
  getInitialSyllableMode,
  setSyllableMode,
} from '../../controllers/syllableModeController.js';
import {
  getInitialLiveVoice,
  setLiveVoice,
} from '../../controllers/liveVoiceController.js';
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
import VoiceNotice from '../components/VoiceNotice.jsx';
import OutputModeToggle from '../components/OutputModeToggle.jsx';

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
  /**
   * Telegraphic speech output, or reading output with connectors.
   *
   * Persisted, unlike game mode: this is how the child's strip should look by
   * default, not a place he visits and leaves.
   */
  const [outputMode, setOutputModeState] = useState(getInitialOutputMode);
  /** How many function words reading mode shows. Set by an adult in settings. */
  const [readingTier, setReadingTierState] = useState(getInitialReadingTier);
  /** Whether a tap says the syllables after the word. */
  const [syllableMode, setSyllableModeState] = useState(getInitialSyllableMode);
  /**
   * Whether words outside the pre-generated list may be sent to Deepgram.
   *
   * Off by default on purpose: the daily cap lives in each browser, so on a
   * public site it would be a cap per visitor rather than a cap in total.
   */
  const [liveVoice, setLiveVoiceState] = useState(getInitialLiveVoice);

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
  } = useAac(lang, { mode: outputMode, tier: readingTier });

  useEffect(() => {
    setLang(lang);
  }, [lang]);

  useEffect(() => {
    setOutputMode(outputMode);
  }, [outputMode]);

  useEffect(() => {
    setReadingTier(readingTier);
  }, [readingTier]);

  useEffect(() => {
    setSyllableMode(syllableMode);
  }, [syllableMode]);

  useEffect(() => {
    setLiveVoice(liveVoice);
  }, [liveVoice]);

  /**
   * True while the app itself is talking.
   *
   * A ref, not state: nothing renders from it, and putting it through setState
   * would re-render the whole strip in the middle of a tap.
   */
  const speakingRef = useRef(false);

  // Speech feeds the same entry point as typing, except while the app is the
  // one talking. Tapping a pictogram stops the mic first, but teardown holds
  // the socket open briefly so the child's last utterance is never lost, so a
  // transcript of the app's own voice can still arrive after that. Dropping it
  // here is what stops the app from talking to itself and rewriting the strip.
  const handleTranscript = useCallback(
    (transcript) => {
      if (speakingRef.current) return;
      say(transcript);
    },
    [say],
  );
  const speech = useSpeech(lang, handleTranscript);

  const voice = useVoice(lang, {
    syllables: syllableMode === 'on',
    live: liveVoice === 'on',
    words,
  });

  /**
   * A tap on a pictogram: the word, then its syllables.
   *
   * The mic goes off first. It stays off afterwards rather than resuming on its
   * own, because a mic that switches itself back on is a mic he cannot tell the
   * state of, and the listening indicator has to mean what it says.
   */
  const handleSpeak = useCallback(
    (word, { onStart, onEnd } = {}) => {
      speech.stop();
      speakingRef.current = true;
      voice.speak(word, {
        onStart,
        onEnd: () => {
          speakingRef.current = false;
          onEnd?.();
        },
      });
    },
    [speech, voice],
  );

  const openAdult = useCallback(() => setAdultOpen(true), []);
  const longPress = useLongPress(openAdult);

  const closeFix = useCallback(() => setFixTarget(null), []);

  /**
   * One button, both stores. The adult panel says "forget saved pictograms",
   * and the audio this device generated on its own is saved in the same sense.
   */
  const handleForgetAll = useCallback(() => {
    forgetAll();
    voice.forgetClips();
  }, [forgetAll, voice]);

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
          {/* Same reasoning: this only changes how the strip looks, so it stays
              a plain visible button rather than hiding behind the gesture. */}
          <OutputModeToggle
            active={outputMode === 'reading'}
            onToggle={() => setOutputModeState((m) => (m === 'reading' ? 'speech' : 'reading'))}
            lang={lang}
          />
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
            {/* Game mode deliberately gets no onSpeak: there the strips are
                the turn itself, and hearing the answer read out changes what
                the activity is. */}
            <PictogramStrip
              words={words}
              isResolving={isResolving}
              lang={lang}
              onFix={setFixTarget}
              onSpeak={handleSpeak}
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

      <VoiceNotice notice={voice.notice} lang={lang} />

      <Attribution />

      <AdultPanel
        open={adultOpen}
        onClose={() => setAdultOpen(false)}
        lang={lang}
        onForgetAll={handleForgetAll}
        corrections={corrections}
        onUndoCorrection={undoCorrection}
        readingTier={readingTier}
        onReadingTierChange={setReadingTierState}
        syllableMode={syllableMode}
        onSyllableModeChange={setSyllableModeState}
        liveVoice={liveVoice}
        onLiveVoiceChange={setLiveVoiceState}
        voiceBudget={voice.budget}
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
