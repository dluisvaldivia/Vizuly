import { describe, it, expect } from 'vitest';

import { hasPronunciation, pronouncedWord, speechTextFor } from './speechText';

describe('speechTextFor', () => {
  it('says the whole word, then the syllables', () => {
    expect(speechTextFor('cabeza', 'es', true)).toBe('cabeza. ca, be, za.');
  });

  it('says the word alone when syllables are switched off', () => {
    expect(speechTextFor('cabeza', 'es', false)).toBe('cabeza.');
  });

  it('says a one-syllable word once, because the split adds nothing', () => {
    expect(speechTextFor('pan', 'es', true)).toBe('pan.');
    expect(speechTextFor('sí', 'es', true)).toBe('sí.');
  });

  it('says a word once when splitting it would change a sound', () => {
    // quiero: an isolated "ro" becomes the trill. See canSplitAloud.
    expect(speechTextFor('quiero', 'es', true)).toBe('quiero.');
  });

  it('says an English word once, since English is never split', () => {
    expect(speechTextFor('banana', 'en', true)).toBe('banana.');
  });

  it('keeps accents, which the voice needs to stress the word correctly', () => {
    expect(speechTextFor('mamá', 'es', true)).toBe('mamá. ma, má.');
  });
});

describe('pronunciation overrides', () => {
  it('leaves a word alone when it has no entry', () => {
    expect(pronouncedWord('cabeza', 'es')).toBe('cabeza');
    expect(hasPronunciation('cabeza', 'es')).toBe(false);
  });

  it('never treats the comment key as a word', () => {
    expect(pronouncedWord('_comment', 'es')).toBe('_comment');
    expect(hasPronunciation('_comment', 'es')).toBe(false);
  });

  it('has no overrides for English, which has no map', () => {
    expect(pronouncedWord('read', 'en')).toBe('read');
  });
});
