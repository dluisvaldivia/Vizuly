import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAac, listDecks, usePhraseCards } from '../../aac/useAac.ts';
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
import {
  getInitialMicSensitivity,
  setMicSensitivity,
} from '../../controllers/micSensitivityController.js';
import {
  getInitialMicDevice,
  setMicDevice,
} from '../../controllers/micDeviceController.js';
import { getInitialMicGain, setMicGain } from '../../controllers/micGainController.js';
import {
  getInitialLevelReadout,
  setLevelReadout,
} from '../../controllers/levelReadoutController.js';
import {
  getInitialChildren,
  setChildren,
  activeChild,
} from '../../controllers/childrenController.js';
import {
  getInitialRatings,
  setRatings,
  rateWord,
  clearChildRatings,
} from '../../controllers/ratingsController.js';
import {
  getInitialFavorites,
  setFavorites,
  favoritesFor,
  isSaved,
  toggleFavorite,
  removeFavorite,
  clearChildFavorites,
} from '../../controllers/favoritesController.js';
import { useLongPress } from '../hooks/useLongPress.js';
import PictogramStrip from '../components/PictogramStrip.jsx';
import TextInput from '../components/TextInput.jsx';
import MicButton from '../components/MicButton.jsx';
import AdultPanel from '../components/AdultPanel.jsx';
import FixWordDialog from '../components/FixWordDialog.jsx';
import Attribution from '../components/Attribution.jsx';
import GameModeToggle from '../components/GameModeToggle.jsx';
import GameMode from '../components/GameMode.jsx';
import LetterCardsToggle from '../components/LetterCardsToggle.jsx';
import LetterCards from '../components/LetterCards.jsx';
import LanguageToggle from '../components/LanguageToggle.jsx';
import VoiceNotice from '../components/VoiceNotice.jsx';
import OutputModeToggle from '../components/OutputModeToggle.jsx';
import FavoritesToggle from '../components/FavoritesToggle.jsx';
import FavoritesView from '../components/FavoritesView.jsx';
import FavoriteStar from '../components/FavoriteStar.jsx';

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
/** Stable empty score map, so an unrated child does not rebuild the deck order. */
const NO_SCORES = {};
/** Stable empty list, so a closed deck does not restart the voice's loading. */
const NO_WORDS = [];
/** Stable empty list, so a child with no favourites does not re-resolve tiles. */
const NO_FAVORITES = [];

export default function Home() {
  const [lang, setLangState] = useState(getInitialLang);
  /**
   * Child profiles. Named `profiles` rather than `children`, which is React's
   * own prop name. The active child gives game mode its name and the letter
   * cards their age band; with none saved, both fall back to the youngest band
   * and an unnamed turn.
   */
  const [profiles, setProfilesState] = useState(getInitialChildren);
  const child = activeChild(profiles);
  const childName = child?.name ?? '';
  const ageBand = child?.age ?? 3;
  const childId = child?.id ?? 'default';
  /** Swipe ratings for every child, keyed by child id. */
  const [ratings, setRatingsState] = useState(getInitialRatings);
  const scores = ratings[childId] ?? NO_SCORES;
  const onRate = useCallback(
    (word, delta) => setRatingsState((state) => rateWord(state, childId, lang, word, delta)),
    [childId, lang],
  );
  const onClearRatings = useCallback(
    () => setRatingsState((state) => clearChildRatings(state, childId)),
    [childId],
  );
  /** Saved words and phrases for every child, keyed by child id. */
  const [favorites, setFavoritesState] = useState(getInitialFavorites);
  const childFavorites = favorites[childId] ?? NO_FAVORITES;
  /**
   * Only this language's favourites reach the screen. A Spanish phrase resolved
   * in English would come back as a row of placeholders, which would read as the
   * app having lost the favourite.
   */
  const langFavorites = useMemo(
    () => favoritesFor(favorites, childId, lang),
    [favorites, childId, lang],
  );
  const onToggleFavorite = useCallback(
    (text) => setFavoritesState((state) => toggleFavorite(state, childId, lang, text)),
    [childId, lang],
  );
  const onRemoveFavorite = useCallback(
    (text, favoriteLang) => setFavoritesState((state) => removeFavorite(state, childId, favoriteLang, text)),
    [childId],
  );
  const onClearFavorites = useCallback(
    () => setFavoritesState((state) => clearChildFavorites(state, childId)),
    [childId],
  );
  const isFavorite = useCallback(
    (text) => isSaved(favorites, childId, lang, text),
    [favorites, childId, lang],
  );
  const [adultOpen, setAdultOpen] = useState(false);
  /** The word whose fix dialog is open, or null. Set by a long press. */
  const [fixTarget, setFixTarget] = useState(null);
  /**
   * Which screen is open over the strip, if any: null, 'echo', 'cards' or
   * 'favorites'. One value rather than a boolean per screen, so two can never
   * be open at once.
   */
  const [activeScreen, setActiveScreen] = useState(null);
  /** The letter card on screen, so the voice can prepare it. Cards mode only. */
  const [cardWord, setCardWord] = useState(null);
  /** The open letter deck, resolved, so the voice can ready its clips. */
  const [deckCards, setDeckCards] = useState(null);
  const hasDecks = listDecks(lang).length > 0;
  const toggleScreen = useCallback(
    (screen) => setActiveScreen((current) => (current === screen ? null : screen)),
    [],
  );
  /**
   * Telegraphic speech output, or reading output with connectors.
   *
   * Persisted, unlike game mode: this is how the child's strip should look by
   * default, not a place the child visits and leaves.
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
  /**
   * How loud the child has to be, in dBFS. Drives the meter's line and, a fixed margin
   * below it, the level at which the mic decides they have stopped talking.
   */
  const [micSensitivity, setMicSensitivityState] = useState(getInitialMicSensitivity);
  /**
   * Which microphone to open, chosen by an adult in settings. Without it Firefox
   * opens the system default after a reload, which can be a silent input.
   */
  const [micDevice, setMicDeviceState] = useState(getInitialMicDevice);
  /**
   * The name of the mic that was really opened last, for the adult panel.
   * Shown, never saved: see the note on onDevice in src/speech/types.ts.
   */
  const [openedMic, setOpenedMic] = useState('');
  const handleDeviceOpened = useCallback((deviceId, label) => {
    setOpenedMic(label);
    // Same mic by name, new id: the browser rotated its ids. Refresh the saved
    // one. Only ever for the mic the adult chose, never for whatever opened.
    setMicDeviceState((current) =>
      current.deviceId && current.label && current.label === label && current.deviceId !== deviceId
        ? { deviceId, label }
        : current,
    );
  }, []);
  /**
   * Whether the browser may turn the mic up and down by itself. Off by default:
   * with it on, the meter jumps on the first word and then settles, which makes
   * a quiet voice look loud enough.
   */
  const [micGain, setMicGainState] = useState(getInitialMicGain);
  /** Whether the adult-facing dB number shows beside the meter. */
  const [levelReadout, setLevelReadoutState] = useState(getInitialLevelReadout);

  const {
    words,
    isResolving,
    phrase,
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
    setChildren(profiles);
  }, [profiles]);

  useEffect(() => {
    setRatings(ratings);
  }, [ratings]);

  useEffect(() => {
    setFavorites(favorites);
  }, [favorites]);

  // The decks are Spanish. Switching to a language without any leaves cards
  // mode rather than showing an empty picker.
  useEffect(() => {
    if (!hasDecks) setActiveScreen((current) => (current === 'cards' ? null : current));
  }, [hasDecks]);

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

  useEffect(() => {
    setMicSensitivity(micSensitivity);
  }, [micSensitivity]);

  useEffect(() => {
    setLevelReadout(levelReadout);
  }, [levelReadout]);

  useEffect(() => {
    setMicDevice(micDevice);
  }, [micDevice]);

  useEffect(() => {
    setMicGain(micGain);
  }, [micGain]);

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
  const speech = useSpeech(lang, handleTranscript, {
    speechFloorDb: micSensitivity,
    deviceId: micDevice.deviceId,
    deviceLabel: micDevice.label,
    autoGainControl: micGain === 'on',
    onDeviceChange: handleDeviceOpened,
  });

  const voiceWords = useMemo(
    () => (activeScreen === 'cards' ? (cardWord ? [cardWord] : []) : words),
    [activeScreen, cardWord, words],
  );
  const prefetchWords = useMemo(
    () => (activeScreen === 'cards' && deckCards ? deckCards : NO_WORDS),
    [activeScreen, deckCards],
  );
  const voice = useVoice(lang, {
    syllables: syllableMode === 'on',
    live: liveVoice === 'on',
    // In cards mode the word to prepare is the card showing, not the strip,
    // and the rest of the open deck is readied behind it at no cost.
    words: voiceWords,
    prefetch: prefetchWords,
  });

  const { stop: stopSpeech } = speech;

  /**
   * A tap on a pictogram: the word, then its syllables.
   *
   * The mic goes off first. It stays off afterwards rather than resuming on its
   * own, because a mic that switches itself back on is a mic the child cannot tell the
   * state of, and the listening indicator has to mean what it says.
   */
  const handleSpeak = useCallback(
    (word, { onStart, onEnd } = {}) => {
      stopSpeech();
      speakingRef.current = true;
      voice.speak(word, {
        onStart,
        onEnd: () => {
          speakingRef.current = false;
          onEnd?.();
        },
      });
    },
    // Depends on the stable stop callback rather than the whole speech object:
    // useSpeech returns a fresh object every render, so `[speech, voice]` handed
    // every pictogram a new tap handler on every interim transcript.
    [stopSpeech, voice],
  );

  const openAdult = useCallback(() => setAdultOpen(true), []);
  const longPress = useLongPress(openAdult);

  /** Where focus goes when the favourites screen closes under it. */
  const favoritesToggleRef = useRef(null);

  /**
   * The pictograms the favourites tiles show, one row per favourite.
   *
   * Resolved only while that screen is open, and every word on it is already in
   * the cache, so opening the list costs nothing and touches no network.
   */
  const favoriteTexts = useMemo(
    () => (activeScreen === 'favorites' ? langFavorites.map((favorite) => favorite.text) : []),
    [activeScreen, langFavorites],
  );
  const { rows: favoriteRows } = usePhraseCards(favoriteTexts, lang, {
    mode: outputMode,
    tier: readingTier,
    revision: corrections,
  });

  /**
   * A favourite tapped: load it into the strip and come back to the strip.
   *
   * Silent on purpose. The tile loads the phrase and the child then taps the
   * pictograms to hear them, the same as for anything else they said, so there
   * is still only one thing a tap on a pictogram ever does. Focus is moved by
   * hand because the view it was in has just unmounted.
   */
  const onPickFavorite = useCallback(
    (text) => {
      say(text);
      setActiveScreen(null);
      favoritesToggleRef.current?.focus();
    },
    [say],
  );

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
          <GameModeToggle active={activeScreen === 'echo'} onToggle={() => toggleScreen('echo')} lang={lang} />
          {hasDecks ? (
            <LetterCardsToggle active={activeScreen === 'cards'} onToggle={() => toggleScreen('cards')} lang={lang} />
          ) : null}
          {/* Same reasoning again: a wrong tap opens a list of saved phrases and
              loses nothing, so it stays outside the gesture gate. */}
          <FavoritesToggle
            ref={favoritesToggleRef}
            active={activeScreen === 'favorites'}
            onToggle={() => toggleScreen('favorites')}
            lang={lang}
          />
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
        {activeScreen === 'cards' ? (
          // Mounted only here, like GameMode, so leaving and coming back always
          // starts again at the letter picker. Keyed on the language for the
          // same reason: a deck id like "m" exists in both, and must not carry
          // one language's filters into the other. The age band is in the key
          // too, so changing the active child starts again at the picker.
          <LetterCards
            key={`${lang}.${ageBand}`}
            lang={lang}
            age={ageBand}
            scores={scores}
            onRate={onRate}
            revision={corrections}
            onFix={setFixTarget}
            onSpeak={handleSpeak}
            onCardChange={setCardWord}
            onDeckChange={setDeckCards}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        ) : activeScreen === 'favorites' ? (
          <FavoritesView
            favorites={langFavorites}
            rows={favoriteRows}
            lang={lang}
            onPick={onPickFavorite}
          />
        ) : activeScreen === 'echo' ? (
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
            speechFloorDb={micSensitivity}
            showReadout={levelReadout === 'on'}
            onFix={setFixTarget}
            childName={childName}
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

            {/* Saves the phrase the strip was built from, whether that is one
                word or a whole sentence. Pressing it again takes it back off,
                so a mis-save needs no gesture and no settings trip. */}
            <div className="app__strip-actions">
              <FavoriteStar
                saved={isFavorite(phrase)}
                onToggle={() => onToggleFavorite(phrase)}
                disabled={words.length === 0}
                lang={lang}
              />
            </div>

            <div className="app__inputs">
              {speech.isAvailable ? (
                <MicButton
                  status={speech.status}
                  isListening={speech.isListening}
                  interim={speech.interim}
                  levelRef={speech.levelRef}
                  getLevel={speech.getLevel}
                  isActive={speech.isActive}
                  speechFloorDb={micSensitivity}
                  showReadout={levelReadout === 'on'}
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

      <Attribution lang={lang} />

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
        micSensitivity={micSensitivity}
        onMicSensitivityChange={setMicSensitivityState}
        micDevice={micDevice}
        onMicDeviceChange={setMicDeviceState}
        openedMic={openedMic}
        micGain={micGain}
        onMicGainChange={setMicGainState}
        levelReadout={levelReadout}
        onLevelReadoutChange={setLevelReadoutState}
        voiceBudget={voice.budget}
        profiles={profiles}
        onProfilesChange={setProfilesState}
        onClearRatings={onClearRatings}
        favorites={childFavorites}
        onRemoveFavorite={onRemoveFavorite}
        onClearFavorites={onClearFavorites}
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
