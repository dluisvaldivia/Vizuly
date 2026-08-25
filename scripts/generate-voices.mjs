/**
 * Pre-generates the spoken clips with Deepgram Aura-2.
 *
 *   npm run voices                  generate everything missing
 *   npm run voices -- --dry-run     say what it would cost, call nothing
 *   npm run voices -- --samples     one short sample per candidate voice
 *   npm run voices -- --voice=aura-2-silvia-es
 *
 * Why this runs here and not in the browser or in CI:
 *
 * The deployed site is public, and Deepgram has no per-key spending cap (only
 * expiry and scopes). Audio generated ahead of time means the public site makes
 * zero API calls no matter how many people visit, and the bill is fixed by the
 * word list in this repo rather than by traffic. The generated MP3s are
 * committed, so `npm run build` and `npm run deploy` never need the key and
 * never spend anything: deploy stays one command, as the roadmap requires.
 *
 * It is idempotent. A clip that already exists for this voice and this manifest
 * version is not requested again, so adding ten words bills ten words.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SPEAK_URL = 'https://api.deepgram.com/v1/speak';

/** Bumped only when the text sent to Deepgram changes, which invalidates clips. */
const MANIFEST_VERSION = 1;
/** Peninsular Spanish, masculine: the family is in Málaga. */
const DEFAULT_VOICE = 'aura-2-nestor-es';
/** The candidates for --samples: the two peninsular masculine voices. */
const SAMPLE_VOICES = ['aura-2-nestor-es', 'aura-2-alvaro-es'];
const SAMPLE_WORDS = ['cabeza', 'mamá', 'quiero', 'perro'];

/** $0.030 per 1000 characters, pay-as-you-go, verified 2026-08-25. */
const USD_PER_CHAR = 0.03 / 1000;
/** Deepgram rejects payloads over 2000 characters with a 413. One word is nowhere near. */
const MAX_CHARS = 2000;
/**
 * 32 kbps mono MP3. Measured against the default: 29.6 KB down to 17.5 KB for
 * the same clip, with no audible cost on a single spoken word. Four hundred
 * clips live in the repo, so the difference is megabytes.
 */
const AUDIO_PARAMS = 'encoding=mp3&bit_rate=32000';
/** Modest, so a few hundred short clips do not look like an attack. */
const CONCURRENCY = 4;

const MANIFEST_PATH = path.join(ROOT, 'src/speech/data/voices.manifest.json');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    samples: false,
    voice: DEFAULT_VOICE,
    lang: 'es',
    force: false,
    only: null,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--samples') args.samples = true;
    else if (arg === '--force') args.force = true;
    else if (arg.startsWith('--voice=')) args.voice = arg.slice('--voice='.length);
    else if (arg.startsWith('--lang=')) args.lang = arg.slice('--lang='.length);
    // A comma-separated subset, for trying a voice out before committing to the
    // whole list. The manifest still describes only what exists on disk.
    else if (arg.startsWith('--only=')) {
      args.only = arg
        .slice('--only='.length)
        .split(',')
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean);
    }
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

/**
 * The key, from the environment or from .env.
 *
 * Deliberately not import.meta.env: that is Vite's browser-side inlining, and
 * this script is Node. Never print the key, not even partially.
 */
async function readApiKey() {
  const fromEnv = process.env.VITE_DEEPGRAM_API_KEY ?? process.env.DEEPGRAM_API_KEY;
  if (fromEnv) return fromEnv.trim();

  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return '';

  const contents = await readFile(envPath, 'utf8');
  for (const line of contents.split('\n')) {
    const match = line.match(/^\s*(?:VITE_)?DEEPGRAM_API_KEY\s*=\s*(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

/** The word list, flattened, deduped, with the _comment key dropped. */
async function loadVocabulary(lang) {
  const file = path.join(ROOT, `src/speech/data/vocabulary.${lang}.json`);
  if (!existsSync(file)) return [];

  const data = JSON.parse(await readFile(file, 'utf8'));
  const words = Object.entries(data)
    .filter(([key]) => !key.startsWith('_'))
    .flatMap(([, list]) => list);

  return [...new Set(words.map((word) => word.trim().toLowerCase()))].filter(Boolean);
}

/**
 * Accents are kept in the file name on purpose.
 *
 * Stripping them would collide papá with papa and sí with si, which is exactly
 * the distinction the whole app is built to protect. Only characters that are
 * genuinely unsafe in a path are replaced, and the manifest carries the mapping
 * so the browser never has to guess a name.
 */
function clipFileName(word, mode) {
  const safe = word.replace(/[/\\:*?"<>|\s]/g, '_');
  return mode === 'syllables' ? `${safe}.sil.mp3` : `${safe}.mp3`;
}

/**
 * What Deepgram is asked to say.
 *
 * The syllable wording comes from src/aac/syllables.ts, the same module the app
 * uses, so the recorded audio and anything generated later in the browser can
 * never drift apart and say the same word two different ways.
 */
function clipText(word, mode, speechTextFor, lang) {
  return speechTextFor(word, lang, mode === 'syllables');
}

async function synthesize(text, voice, apiKey) {
  if (text.length > MAX_CHARS) throw new Error(`Text over ${MAX_CHARS} characters: ${text}`);

  const response = await fetch(`${SPEAK_URL}?model=${encodeURIComponent(voice)}&${AUDIO_PARAMS}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${apiKey}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Deepgram ${response.status}: ${detail.slice(0, 300)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Runs tasks a few at a time, in order, stopping the whole run on the first failure. */
async function runPool(tasks, size) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(size, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * The syllabifier, loaded through Vite.
 *
 * syllables.ts is TypeScript and this Node build has no type stripping, so the
 * script borrows Vite (already a dev dependency) rather than duplicating the
 * rules. Duplicating them would let the pre-generated audio and the browser
 * fallback drift apart and say different things for the same word.
 */
async function loadSyllables() {
  const { createServer } = await import('vite');
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  const syllables = await server.ssrLoadModule('/src/aac/syllables.ts');
  const speech = await server.ssrLoadModule('/src/speech/speechText.ts');
  await server.close();
  return {
    syllablesForSpeech: syllables.syllablesForSpeech,
    speechTextFor: speech.speechTextFor,
  };
}

async function generateSamples(args, apiKey) {
  const outDir = path.join(ROOT, 'voice-samples');
  await mkdir(outDir, { recursive: true });

  const { speechTextFor } = await loadSyllables();
  const jobs = [];
  for (const voice of SAMPLE_VOICES) {
    for (const word of SAMPLE_WORDS) {
      const text = clipText(word, 'syllables', speechTextFor, args.lang);
      jobs.push({ voice, word, text });
    }
  }

  const chars = jobs.reduce((sum, job) => sum + job.text.length, 0);
  console.log(`Samples: ${jobs.length} clips, ${chars} characters, about $${(chars * USD_PER_CHAR).toFixed(4)}`);
  if (args.dryRun) return;

  await runPool(
    jobs.map((job) => async () => {
      const audio = await synthesize(job.text, job.voice, apiKey);
      const file = path.join(outDir, `${job.voice}--${clipFileName(job.word, 'word')}`);
      await writeFile(file, audio);
      console.log(`  ${path.relative(ROOT, file)}`);
    }),
    CONCURRENCY,
  );

  await writeFile(path.join(outDir, 'index.html'), samplePage(), 'utf8');

  console.log(`\nCompare them:  xdg-open voice-samples/index.html`);
  console.log(`Then pick one:  npm run voices -- --voice=<modelo>`);
  console.log(`These files are gitignored and are not part of the app.`);
}

/** A throwaway page for comparing the candidate voices by ear, side by side. */
function samplePage() {
  const rows = SAMPLE_VOICES.map((voice) => {
    const players = SAMPLE_WORDS.map(
      (word) =>
        `<td><div class="w">${word}</div><audio controls preload="none" src="${voice}--${clipFileName(word, 'word')}"></audio></td>`,
    ).join('');
    return `<tr><th>${voice.replace('aura-2-', '').replace('-es', '')}</th>${players}</tr>`;
  }).join('\n');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Voces Vizuly</title>
<style>
  body { font: 16px system-ui, sans-serif; margin: 2rem; background: #fafafa; color: #1a1a1a; }
  table { border-collapse: collapse; }
  th, td { padding: 0.75rem 1rem; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { text-transform: capitalize; font-size: 1.1rem; }
  .w { color: #666; font-size: 0.85rem; margin-bottom: 0.25rem; }
  p { max-width: 40rem; color: #444; }
</style></head><body>
<h1>Elige la voz</h1>
<p>Las dos son masculinas y de español de España. Cada clip dice exactamente lo que oirá él al tocar ese pictograma.</p>
<p><strong>cabeza</strong> y <strong>mamá</strong> se separan en sílabas. <strong>quiero</strong> no: es una de las dieciséis palabras donde una sílaba suelta cambiaría de sonido, así que se dice entera y bien. <strong>perro</strong> sí se separa, porque ahí la vibrante fuerte es la correcta.</p>
<table>${rows}</table>
<p>Cuando elijas: <code>npm run voices -- --voice=aura-2-&lt;nombre&gt;-es</code></p>
</body></html>
`;
}

async function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return { version: MANIFEST_VERSION, model: '', clips: {} };
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return { version: MANIFEST_VERSION, model: '', clips: {} };
  }
}

async function generateVocabulary(args, apiKey) {
  const all = await loadVocabulary(args.lang);
  const words = args.only ? all.filter((word) => args.only.includes(word)) : all;
  if (words.length === 0) {
    console.error(`No vocabulary file for "${args.lang}". Nothing to do.`);
    return;
  }

  const outDir = path.join(ROOT, 'public/voices', args.lang);
  await mkdir(outDir, { recursive: true });
  const onDisk = new Set(await readdir(outDir).catch(() => []));

  const previous = await readManifest();
  // A different voice or a changed text format invalidates every clip, because
  // half the vocabulary in one voice and half in another is worse than either.
  const reusable =
    !args.force && previous.model === args.voice && previous.version === MANIFEST_VERSION;

  const { syllablesForSpeech, speechTextFor } = await loadSyllables();
  const clips = {};
  let unsplit = 0;
  const pending = [];

  for (const word of words) {
    const syllables = syllablesForSpeech(word, args.lang);
    if (syllables.length < 2) unsplit += 1;
    const entry = {};

    for (const mode of ['word', 'syllables']) {
      // No second clip when the word is said whole: either it is one syllable,
      // or splitting it would change how a syllable sounds. See canSplitAloud.
      if (mode === 'syllables' && syllables.length < 2) continue;

      const file = clipFileName(word, mode);
      entry[mode] = file;

      if (reusable && onDisk.has(file)) continue;
      pending.push({ word, mode, file, text: clipText(word, mode, speechTextFor, args.lang) });
    }
    clips[word] = entry;
  }

  const chars = pending.reduce((sum, job) => sum + job.text.length, 0);
  const clipCount = Object.values(clips).reduce((sum, entry) => sum + Object.keys(entry).length, 0);

  console.log(`Voice:      ${args.voice}`);
  console.log(`Vocabulary: ${words.length} words, ${clipCount} clips (${unsplit} said whole, never split)`);
  console.log(`To generate: ${pending.length} clips, ${chars} characters, about $${(chars * USD_PER_CHAR).toFixed(4)}`);

  if (pending.length === 0) {
    console.log('Everything is already generated. No API calls made.');
  } else if (args.dryRun) {
    console.log('Dry run: no API calls made.');
    return;
  } else {
    let done = 0;
    await runPool(
      pending.map((job) => async () => {
        const audio = await synthesize(job.text, args.voice, apiKey);
        await writeFile(path.join(outDir, job.file), audio);
        done += 1;
        if (done % 25 === 0 || done === pending.length) {
          console.log(`  ${done}/${pending.length}`);
        }
      }),
      CONCURRENCY,
    );
  }

  // A subset run adds to what is already there; a full run replaces it, so a
  // word removed from the list stops being announced as available. A voice
  // change drops everything, because a half-and-half vocabulary is worse than
  // either voice on its own.
  const langClips =
    args.only && reusable ? { ...(previous.clips?.[args.lang] ?? {}), ...clips } : clips;

  const manifest = {
    version: MANIFEST_VERSION,
    model: args.voice,
    generated: new Date().toISOString().slice(0, 10),
    clips: reusable ? { ...previous.clips, [args.lang]: langClips } : { [args.lang]: langClips },
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`\nManifest: ${path.relative(ROOT, MANIFEST_PATH)}`);

  // With --only, whatever is not in the subset is simply not generated yet, so
  // reporting it as an orphan would be noise.
  const orphans = args.only ? [] : [...onDisk].filter(
    (file) => file.endsWith('.mp3') && !Object.values(clips).some((entry) => Object.values(entry).includes(file)),
  );
  if (orphans.length > 0) {
    // Not deleted automatically: removing files is the kind of thing that should
    // never happen as a side effect of adding a word.
    console.log(`\n${orphans.length} clip(s) no longer in the word list, safe to delete by hand:`);
    orphans.slice(0, 10).forEach((file) => console.log(`  public/voices/${args.lang}/${file}`));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = await readApiKey();

  if (!apiKey && !args.dryRun) {
    console.error('No Deepgram key found.');
    console.error('Set VITE_DEEPGRAM_API_KEY in .env, or run with --dry-run to see the cost.');
    process.exit(1);
  }

  if (args.samples) await generateSamples(args, apiKey);
  else await generateVocabulary(args, apiKey);
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
});
