import { useEffect, useState } from 'react';

import PictogramStrip from './PictogramStrip.jsx';
import MicButton from './MicButton.jsx';
import TextInput from './TextInput.jsx';
import { pictogramIdSet, isFullSetMatch, intersectingIds } from '../util/matchSet.js';

/**
 * Echo/repeat-after-me game.
 *
 * Reuses the single useAac/useSpeech instance from Home.jsx rather than
 * creating a second one: `words` always means "whoever is currently
 * speaking", and this component's only new state is a frozen snapshot of
 * what the parent said, taken the moment they tap Hold.
 *
 * There is no scoring and no "wrong" state. A miss is never highlighted, a
 * non-matching attempt just looks like an ordinary strip, and the only thing
 * this component ever adds to the screen is in response to something going
 * right.
 */
export default function GameMode({
  words,
  isResolving,
  say,
  clear,
  lang,
  speech,
  onFix,
}) {
  const [turn, setTurn] = useState('parent');
  const [held, setHeld] = useState(null); // null | { words }
  const [celebrating, setCelebrating] = useState(false);

  const labels = {
    es: {
      parentHint: 'Tu turno',
      noahHint: 'Turno de Noah',
      hold: 'Guardar: turno de Noah',
      reset: 'Nueva frase',
      heldRegion: 'Frase guardada',
      liveRegionParent: 'Tu turno, pictogramas',
      liveRegionNoah: 'Turno de Noah, pictogramas',
      celebrationAnnounce: 'Coinciden',
    },
    en: {
      parentHint: 'Your turn',
      noahHint: "Noah's turn",
      hold: "Hold: Noah's turn",
      reset: 'New phrase',
      heldRegion: 'Held phrase',
      liveRegionParent: 'Your turn, pictograms',
      liveRegionNoah: "Noah's turn, pictograms",
      celebrationAnnounce: 'They match',
    },
  }[lang];

  const heldIds = held ? pictogramIdSet(held.words) : new Set();
  const liveIds = pictogramIdSet(words);
  const sharedIds = turn === 'noah' ? intersectingIds(heldIds, liveIds) : new Set();

  // Watches for a full match while Noah is attempting a held phrase. Fires
  // once per newly-completed match, not on every render: the effect only
  // acts when `words` itself changes.
  useEffect(() => {
    if (turn !== 'noah' || !held) return;
    if (isFullSetMatch(heldIds, liveIds)) {
      setCelebrating(true);
      vibrateCelebrate();
    }
    // heldIds/liveIds are derived fresh from held/words each render; words is
    // the actual thing that changes over time and is what should re-trigger
    // this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, turn, held]);

  function handleHold() {
    setHeld({ words });
    clear();
    setTurn('noah');
  }

  function handleReset() {
    setHeld(null);
    setTurn('parent');
    clear();
  }

  const canHold = turn === 'parent' && words.length > 0 && !isResolving;

  return (
    <div className="game-mode">
      {held ? (
        <section className="game-mode__held" aria-label={labels.heldRegion}>
          <PictogramStrip words={held.words} isResolving={false} lang={lang} onFix={onFix} />
        </section>
      ) : null}

      <p className="game-mode__hint">{turn === 'parent' ? labels.parentHint : labels.noahHint}</p>

      <PictogramStrip
        words={words}
        isResolving={isResolving}
        lang={lang}
        onFix={onFix}
        highlightIds={sharedIds}
        bounceIds={celebrating ? sharedIds : undefined}
      />

      <div className="game-mode__controls">
        {speech.isAvailable ? (
          <MicButton
            status={speech.status}
            isListening={speech.isListening}
            interim={speech.interim}
            levelRef={speech.levelRef}
            lang={lang}
            onToggle={speech.toggle}
          />
        ) : null}

        <TextInput onSubmit={say} lang={lang} />

        {canHold ? (
          <button type="button" className="game-mode__hold-btn" onClick={handleHold}>
            {labels.hold}
          </button>
        ) : null}

        {held ? (
          <button type="button" className="game-mode__reset-btn" onClick={handleReset}>
            {labels.reset}
          </button>
        ) : null}
      </div>

      {/* Visually hidden, always present, so a screen reader announces the
          match through the same live-region mechanism as the pictograms
          themselves rather than through the decorative overlay below. */}
      <p className="visually-hidden" aria-live="polite">
        {celebrating ? labels.celebrationAnnounce : ''}
      </p>

      {celebrating ? (
        <div
          className="game-mode__celebration"
          aria-hidden="true"
          onAnimationEnd={() => setCelebrating(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * A short celebratory buzz. Fires regardless of prefers-reduced-motion: it is
 * haptic, not visual motion. Feature-detected and wrapped, since some
 * browsers throw on an unsupported or insecure context rather than simply
 * lacking the method.
 */
function vibrateCelebrate() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([80, 40, 80]);
    }
  } catch {
    // Never let a vibration failure interrupt the celebration UI.
  }
}
