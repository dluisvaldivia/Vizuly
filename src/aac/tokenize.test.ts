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

// Reading mode. Everything above this line uses the two-argument call and must
// keep passing untouched: that is the signal that speech output did not change.

/** Shorthand for reading mode at a given tier. */
const reading = (input: string, lang: 'es' | 'en', tier: 'connectors' | 'articles' | 'clitics') =>
  tokenize(input, lang, { mode: 'reading', tier }).map((t) => t.lookup);

describe('tokenize: reading mode', () => {
  it('speech mode is the default, and passing it explicitly changes nothing', () => {
    const implicit = tokenize('el gato de la casa', 'es');
    const explicit = tokenize('el gato de la casa', 'es', { mode: 'speech' });

    expect(explicit).toEqual(implicit);
    expect(implicit.map((t) => t.lookup)).toEqual(['gato', 'casa']);
  });

  it('a tier is ignored entirely in speech mode', () => {
    expect(tokenize('el gato de la casa', 'es', { mode: 'speech', tier: 'clitics' }).map((t) => t.lookup)).toEqual([
      'gato',
      'casa',
    ]);
  });

  it('keeps connectors but not articles at the connectors tier', () => {
    expect(reading('el niño llega a casa y dice', 'es', 'connectors')).toEqual([
      'niño',
      'llega',
      'a',
      'casa',
      'y',
      'dice',
    ]);
  });

  it('keeps articles too at the articles tier', () => {
    expect(reading('el niño llega a casa y dice', 'es', 'articles')).toEqual([
      'el',
      'niño',
      'llega',
      'a',
      'casa',
      'y',
      'dice',
    ]);
  });

  it('tiers are cumulative, so clitics still includes connectors and articles', () => {
    expect(reading('en el colegio me dicen', 'es', 'clitics')).toEqual([
      'en',
      'el',
      'colegio',
      'me',
      'dicen',
    ]);
  });

  it('does not keep clitics below the clitics tier', () => {
    expect(reading('en el colegio me dicen', 'es', 'articles')).toEqual([
      'en',
      'el',
      'colegio',
      'dicen',
    ]);
  });

  it('works in English', () => {
    expect(reading('the cat in the house', 'en', 'articles')).toEqual([
      'the',
      'cat',
      'in',
      'the',
      'house',
    ]);
  });

  it('drops a function word the table has no symbol for, rather than guessing', () => {
    // ARASAAC 404s on both of these, so they are deliberately absent from the
    // table. They must fall through exactly as speech mode would.
    expect(reading('about their house', 'en', 'clitics')).toEqual(['house']);
  });

  it('carries a fixed pictogram id on connector tokens and nothing else', () => {
    const tokens = tokenize('a casa', 'es', { mode: 'reading', tier: 'connectors' });

    expect(tokens[0]).toMatchObject({ normalized: 'a', connectorId: 7041 });
    expect(tokens[1].connectorId).toBeUndefined();
  });

  it('never lemmatises a connector: the lookup is the word itself', () => {
    const [connector] = tokenize('a casa', 'es', { mode: 'reading', tier: 'connectors' });

    expect(connector.lookup).toBe(connector.normalized);
  });
});

describe('tokenize: reading mode does not weaken the guards', () => {
  it('protected core vocabulary still resolves normally, never as a connector', () => {
    // "sí" must reach the API as a content word. If a tier ever swallowed it,
    // the child would say yes and get a pronoun symbol.
    const [word] = tokenize('sí', 'es', { mode: 'reading', tier: 'clitics' });

    expect(word.lookup).toBe('sí');
    expect(word.connectorId).toBeUndefined();
  });

  it('keeps "no" as a content word at every tier', () => {
    for (const tier of ['connectors', 'articles', 'clitics'] as const) {
      expect(reading('no quiero', 'es', tier)).toEqual(['no', 'querer']);
    }
  });
});
