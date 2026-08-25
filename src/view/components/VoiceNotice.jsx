/**
 * A short note to the adult when the browser voice stands in for the recorded one.
 *
 * For the adult, never for the child: he does not read, and this is not a
 * failure of his. It says which word is missing, because that is what an adult
 * needs in order to add it to the list.
 *
 * It leaves on its own after a few seconds and has no dismiss button, so there
 * is nothing here for the child to discover and press.
 */
export default function VoiceNotice({ notice, lang }) {
  const labels = {
    es: {
      recording: (word) => `Grabando «${word}». La próxima vez sonará con la voz buena.`,
      noClip: (word) => `«${word}» sin voz grabada. Actívalo en ajustes, o añádelo a la lista.`,
      budget: 'Límite diario alcanzado. Voz sencilla hasta mañana.',
      region: 'Aviso de voz',
    },
    en: {
      recording: (word) => `Recording “${word}”. Next time it will use the good voice.`,
      noClip: (word) => `“${word}” has no recorded voice. Turn it on in settings, or add it to the list.`,
      budget: 'Daily limit reached. Simple voice until tomorrow.',
      region: 'Voice notice',
    },
  }[lang];

  return (
    // Always mounted so the live region exists before it has anything to say:
    // a region that appears at the same moment as its text is announced
    // unreliably.
    <div className="voice-notice" role="status" aria-live="polite" aria-label={labels.region}>
      {notice ? (
        <p className="voice-notice__message">
          {/* Shape, not colour alone: the icon carries the same meaning as the
              text for anyone who cannot separate the two. */}
          <span className="voice-notice__icon" aria-hidden="true">
            ♪
          </span>
          {notice.kind === 'budget' ? labels.budget : null}
          {notice.kind === 'recording' ? labels.recording(notice.word) : null}
          {notice.kind === 'no-clip' ? labels.noClip(notice.word) : null}
        </p>
      ) : null}
    </div>
  );
}
