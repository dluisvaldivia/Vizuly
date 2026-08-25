import { describe, it, expect } from 'vitest';
import { canSplitAloud, syllabify, syllablesForSpeech } from './syllables';

/** Shorthand: the split as the child would hear it. */
const es = (word: string) => syllabify(word, 'es').join('-');

describe('syllabify, Spanish', () => {
  it('splits the plain consonant-vowel case', () => {
    expect(es('cabeza')).toBe('ca-be-za');
    expect(es('comer')).toBe('co-mer');
    expect(es('jugar')).toBe('ju-gar');
  });

  it('never splits ch, ll or rr', () => {
    expect(es('coche')).toBe('co-che');
    expect(es('perro')).toBe('pe-rro');
    expect(es('galleta')).toBe('ga-lle-ta');
  });

  it('keeps inseparable consonant clusters together', () => {
    expect(es('sombra')).toBe('som-bra');
    expect(es('instrumento')).toBe('ins-tru-men-to');
  });

  it('splits two consonants that are not a cluster', () => {
    expect(es('persona')).toBe('per-so-na');
    expect(es('cuento')).toBe('cuen-to');
  });

  it('keeps diphthongs in one syllable', () => {
    expect(es('agua')).toBe('a-gua');
    expect(es('abuela')).toBe('a-bue-la');
    expect(es('gracias')).toBe('gra-cias');
  });

  it('separates two strong vowels, which are a hiatus', () => {
    expect(es('leer')).toBe('le-er');
    expect(es('aeropuerto')).toBe('a-e-ro-puer-to');
  });

  it('separates a hiatus marked by an accent on a weak vowel', () => {
    expect(es('día')).toBe('dí-a');
  });

  it('preserves accents, because they change the split and the word', () => {
    expect(es('mamá')).toBe('ma-má');
    expect(es('papá')).toBe('pa-pá');
    expect(es('sí')).toBe('sí');
  });

  it('treats the silent u of qu and gu as part of the consonant', () => {
    expect(es('quiero')).toBe('quie-ro');
    expect(es('aquí')).toBe('a-quí');
    expect(es('juguete')).toBe('ju-gue-te');
  });

  it('keeps the pronounced u of güe and güi as a vowel', () => {
    expect(es('pingüino')).toBe('pin-güi-no');
  });

  it('treats y as a consonant inside a word and a glide at the end', () => {
    expect(es('ayuda')).toBe('a-yu-da');
    expect(es('hay')).toBe('hay');
  });

  it('returns single-syllable words whole', () => {
    expect(es('pan')).toBe('pan');
    expect(es('tren')).toBe('tren');
    expect(es('más')).toBe('más');
  });

  it('keeps capitals as written', () => {
    expect(syllabify('Cabeza', 'es')).toEqual(['Ca', 'be', 'za']);
  });
});

describe('syllabify, English', () => {
  it('never splits, because English needs a dictionary and a wrong split lies', () => {
    expect(syllabify('head', 'en')).toEqual(['head']);
    expect(syllabify('banana', 'en')).toEqual(['banana']);
    expect(syllabify('come', 'en')).toEqual(['come']);
  });
});

describe('syllabify, edge cases', () => {
  it('always returns at least one piece', () => {
    expect(syllabify('', 'es')).toEqual(['']);
    expect(syllabify('mmm', 'es')).toEqual(['mmm']);
    expect(syllabify('?', 'es')).toEqual(['?']);
  });
});

describe('canSplitAloud, the r rule', () => {
  it('refuses a word whose later syllable starts with a single r', () => {
    // Said on its own, "ro" is word-initial, and a word-initial r in Spanish is
    // always the trill: the child would hear "quie-rro".
    expect(canSplitAloud('quiero', 'es')).toBe(false);
    expect(canSplitAloud('mirar', 'es')).toBe(false);
    expect(canSplitAloud('caramelo', 'es')).toBe(false);
    expect(canSplitAloud('pájaro', 'es')).toBe(false);
  });

  it('allows rr, where the trill is the correct sound anyway', () => {
    expect(canSplitAloud('perro', 'es')).toBe(true);
    expect(canSplitAloud('carro', 'es')).toBe(true);
  });

  it('allows an r that only starts the first syllable, already word-initial', () => {
    expect(canSplitAloud('rojo', 'es')).toBe(true);
    expect(canSplitAloud('ropa', 'es')).toBe(true);
  });

  it('allows ordinary words', () => {
    expect(canSplitAloud('cabeza', 'es')).toBe(true);
    expect(canSplitAloud('galleta', 'es')).toBe(true);
  });

  it('refuses one-syllable words and English, which are never split', () => {
    expect(canSplitAloud('pan', 'es')).toBe(false);
    expect(canSplitAloud('banana', 'en')).toBe(false);
  });
});

describe('syllablesForSpeech', () => {
  it('gives the syllables when they are safe to say alone', () => {
    expect(syllablesForSpeech('cabeza', 'es')).toEqual(['ca', 'be', 'za']);
  });

  it('gives nothing when saying them alone would change the sound', () => {
    expect(syllablesForSpeech('quiero', 'es')).toEqual([]);
  });
});
