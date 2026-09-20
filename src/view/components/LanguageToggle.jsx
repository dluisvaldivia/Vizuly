import spanishFlag from '../../assets/spanish.png';
import englishFlag from '../../assets/english.png';

/**
 * Language switch, next to the game-mode toggle in the header.
 *
 * A plain visible tap target, not gated behind the adult long-press: a wrong
 * tap only changes which language pictograms resolve in, and does not lose
 * or corrupt anything, so it does not need the protection settings does.
 */
export default function LanguageToggle({ lang, onChange }) {
  const labels = {
    // The name is in the language being switched TO, on purpose: it is the
    // one the adult who needs it can read. The caption is in the current one.
    es: { switchTo: 'Idioma: switch to English', caption: 'Idioma' },
    en: { switchTo: 'Language: cambiar a español', caption: 'Language' },
  }[lang];

  const next = lang === 'es' ? 'en' : 'es';
  const icon = lang === 'es' ? spanishFlag : englishFlag;

  return (
    <button
      type="button"
      className="language-toggle"
      onClick={() => onChange(next)}
      aria-label={labels.switchTo}
      title={labels.switchTo}
    >
      <img src={icon} alt="" className="language-toggle__flag" draggable="false" />
      <span className="header-toggle__caption">{labels.caption}</span>
    </button>
  );
}
