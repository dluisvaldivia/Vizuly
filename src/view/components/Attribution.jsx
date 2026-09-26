/**
 * ARASAAC attribution, and who made this.
 *
 * The pictogram line is required by the CC BY-NC-SA licence and must stay
 * visible. Do not move it behind an About page and do not remove it to clean up
 * the layout.
 */
export default function Attribution({ lang }) {
  const madeBy = { es: 'Hecho por Danny Valdivia', en: 'Made by Danny Valdivia' }[lang];

  return (
    <footer className="attribution">
      <small>
        Pictogramas: Sergio Palao, ARASAAC, Gobierno de Aragón.{' '}
        <a
          href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
          target="_blank"
          rel="noopener noreferrer"
        >
          CC BY-NC-SA
        </a>
      </small>
      <small>
        <a
          href="https://dluisvaldivia.github.io/DVPortfolio/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {madeBy}
        </a>
      </small>
    </footer>
  );
}
