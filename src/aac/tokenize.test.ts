import { describe, it, expect } from 'vitest';
import { tokenize, normalize } from './tokenize';

/** Shorthand: the lookup forms tokenize produced, which is what hits ARASAAC. */
const lookups = (input: string, lang: 'es' | 'en') =>
  tokenize(input, lang).map((t) => t.lookup);

describe('normalize', () => {
  it('lowercases', () => {
    expect(normalize('AGUA')).toBe('agua');
  });

  it('strips edge punctuation including Spanish opening marks', () => {
    expect(normalize('¡agua!')).toBe('agua');
    expect(normalize('¿gato?')).toBe('gato');
    expect(normalize('agua...')).toBe('agua');
  });

  it('preserves accents, because sí and si are different words', () => {
    expect(normalize('SÍ')).toBe('sí');
    expect(normalize('Papá')).toBe('papá');
  });

  it('preserves internal apostrophes and hyphens', () => {
    expect(normalize("don't")).toBe("don't");
    expect(normalize('abre-latas')).toBe('abre-latas');
  });

  it('returns empty string for pure punctuation', () => {
    expect(normalize('!!!')).toBe('');
  });
});

describe('tokenize: empty and malformed input', () => {
  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['punctuation only', '!!! ... ¿?'],
  ])('returns [] for %s', (_label, input) => {
    expect(tokenize(input, 'es')).toEqual([]);
  });

  it('collapses irregular whitespace', () => {
    expect(lookups('  quiero    agua  ', 'es')).toEqual(['querer', 'agua']);
  });

  it('never throws on odd input', () => {
    expect(() => tokenize('!!!???...', 'es')).not.toThrow();
    expect(() => tokenize('\n\t', 'en')).not.toThrow();
  });
});

describe('tokenize: stripping function words', () => {
  it('strips Spanish articles and prepositions', () => {
    expect(lookups('el gato de la casa', 'es')).toEqual(['gato', 'casa']);
  });

  it('strips English articles and prepositions', () => {
    expect(lookups('the cat in the house', 'en')).toEqual(['cat', 'house']);
  });

  it('produces telegraphic output for a full sentence', () => {
    expect(lookups('yo quiero el agua', 'es')).toEqual(['yo', 'querer', 'agua']);
  });

  it('preserves word order, because order is the grammar', () => {
    expect(lookups('mamá papá', 'es')).toEqual(['mamá', 'papá']);
    expect(lookups('papá mamá', 'es')).toEqual(['papá', 'mamá']);
  });
});

describe('tokenize: lemmatisation closes the ARASAAC conjugation gap', () => {
  // bestsearch/quiero returns 404 while bestsearch/querer returns 200.
  // This is the entire reason the lemma map exists.
  it.each([
    ['quiero', 'querer'],
    ['juega', 'jugar'],
    ['duermo', 'dormir'],
    ['tengo', 'tener'],
  ])('maps Spanish %s -> %s', (input, expected) => {
    expect(lookups(input, 'es')).toEqual([expected]);
  });

  it.each([
    ['playing', 'play'],
    ['ate', 'eat'],
    ['went', 'go'],
  ])('maps English %s -> %s', (input, expected) => {
    expect(lookups(input, 'en')).toEqual([expected]);
  });

  it('leaves unmapped words untouched', () => {
    expect(lookups('agua', 'es')).toEqual(['agua']);
  });

  it('keeps the original word alongside the lookup form, for debugging', () => {
    const [token] = tokenize('Quiero', 'es');
    expect(token).toMatchObject({
      raw: 'Quiero',
      normalized: 'quiero',
      lookup: 'querer',
    });
  });
});

describe('tokenize: core AAC vocabulary is never dropped', () => {
  // Rule 4: never silently skip a word. These words are frequently the entire
  // message, and several look like function words to anyone skimming a list.
  it.each(['sí', 'no', 'más', 'yo'])('keeps Spanish %s', (word) => {
    expect(lookups(word, 'es')).toEqual([word]);
  });

  it.each(['yes', 'no', 'more', 'i'])('keeps English %s', (word) => {
    expect(lookups(word, 'en')).toEqual([word]);
  });

  it('keeps sí (yes) while stripping si (if)', () => {
    expect(lookups('sí', 'es')).toEqual(['sí']);
    expect(lookups('si', 'es')).toEqual([]);
  });

  it('does not invert meaning by dropping the negation', () => {
    expect(lookups('no quiero', 'es')).toEqual(['no', 'querer']);
    expect(lookups('no more', 'en')).toEqual(['no', 'more']);
  });

  it('keeps a request that is only core vocabulary', () => {
    expect(lookups('más', 'es')).toEqual(['más']);
  });
});

describe('tokenize: language independence', () => {
  it('applies the correct language lexicon', () => {
    // "no" is core vocabulary in both, "the" is a stopword only in English.
    expect(lookups('the', 'en')).toEqual([]);
    expect(lookups('the', 'es')).toEqual(['the']);
  });
});

describe('possessives are function words in both languages', () => {
  // Spanish already stripped "mi", English did not, so "my name is Noah" put a
  // "mine" pictogram in front of the child while "mi nombre es Noah" did not.
  // Anything this list still gets wrong is fixable in the app: long press the
  // pictogram and choose "ignore this word".
  it('strips English possessive determiners, as Spanish does', () => {
    expect(lookups('my name is noah', 'en')).toEqual(['name', 'noah']);
    expect(lookups('mi nombre es noah', 'es')).toEqual(['nombre', 'noah']);
  });

  // "mine" is protected core vocabulary and must survive.
  it('keeps the standalone possessive pronoun', () => {
    expect(lookups('mine', 'en')).toEqual(['mine']);
  });
});

describe('llamarse, the phrase a child uses to say his own name', () => {
  it('lemmatises the unambiguous forms', () => {
    expect(lookups('me llamo noah', 'es')).toEqual(['llamar', 'noah']);
  });

  // "llama" and "llamas" are also the animal. A child asking for the llama
  // pictogram must still get it.
  it('leaves the animal alone', () => {
    expect(lookups('llama', 'es')).toEqual(['llama']);
    expect(lookups('llamas', 'es')).toEqual(['llamas']);
  });
});
