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
    es: { switchTo: 'Switch to English', current: 'Español' },
    en: { switchTo: 'Cambiar a español', current: 'English' },
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
    </button>
  );
}
