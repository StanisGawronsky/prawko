/**
 * Builds public/exam-all-modules-export.en.json from the Polish export.
 * Uses google-translate-api-x with a resumable on-disk cache.
 *
 * Usage: npm run build:en-export
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import translate from 'google-translate-api-x';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'public/exam-all-modules-export.json');
const OUT = resolve(ROOT, 'public/exam-all-modules-export.en.json');
const CACHE_PATH = resolve(ROOT, 'data/translation-cache.en.json');

const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 350;

/** Curated module titles (exam topics). */
const MODULE_NAMES_EN = {
  1: 'warning signs',
  2: 'prohibition signs',
  3: 'mandatory signs',
  4: 'information, supplementary, direction and place-name signs',
  5: 'road markings',
  6: 'priority at equal junctions and merging into traffic',
  7: 'priority at priority and staggered junctions',
  8: 'priority at junctions around a traffic island',
  9: 'meaning of traffic lights and driver behaviour towards them',
  10: 'priority when changing lanes or direction',
  11: 'signals given by traffic controllers and driver behaviour towards them',
  12: 'driver behaviour towards pedestrians including public transport stops',
  13: 'driver behaviour towards cyclists',
  14: 'special caution and limited trust',
  15: 'overtaking',
  16: 'passing, meeting, reversing',
  17: 'driver behaviour at railway crossings',
  18: 'vehicle position on the road, stopping, parking, right side, right-hand traffic',
  19: 'effect of alcohol, medicines and fatigue on perception and decisions',
  20: 'procedures in emergencies (collision, accident, breakdown)',
  21: 'vehicle-related restrictions including speed limits',
  22: 'hazards related to fields of view and blind spots',
  23: 'safe distances and braking',
  24: 'hazards in different road and weather conditions',
  25: 'vehicle and driver documents, owner/holder duties',
  26: 'safe transport of people and luggage (cargo)',
  27: 'detecting common faults (tyres, fluids, etc.)',
  28: 'using the vehicle (operation)',
  29: 'safety equipment and devices (head restraints, belts, child seats, active/passive safety)',
  30: 'rules for using external lights',
  31: 'driving technique',
  32: 'first aid',
};

const STATIC_EN = {
  TAK: 'YES',
  NIE: 'NO',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function saveJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function collectStrings(data) {
  const strings = new Set();
  for (const mod of data.modules) {
    const name = mod.meta?.module?.name;
    if (name) strings.add(name);
    for (const row of mod.questions) {
      const q = row.question;
      strings.add(q.text);
      if (q.answerA) strings.add(q.answerA);
      if (q.answerB) strings.add(q.answerB);
      if (q.answerC) strings.add(q.answerC);
      for (const a of q.predefinedAnswers ?? []) strings.add(a);
      const c = q.correct?.trim();
      if (c && !['TAK', 'NIE', 'A', 'B', 'C'].includes(c.toUpperCase())) strings.add(c);
    }
  }
  return [...strings];
}

function mapString(text, cache) {
  if (!text) return text;
  if (STATIC_EN[text]) return STATIC_EN[text];
  return cache[text] ?? text;
}

function mapAnswers(answers, cache) {
  return (answers ?? []).map((a) => mapString(a, cache));
}

function mapCorrect(correct, originalAnswers, translatedAnswers, cache) {
  const raw = (correct ?? '').trim();
  if (!raw) return raw;
  const upper = raw.toUpperCase();
  if (STATIC_EN[raw]) return STATIC_EN[raw];
  if (upper === 'A' || upper === 'B' || upper === 'C') return upper;
  const idx = originalAnswers.findIndex((a) => a.trim() === raw);
  if (idx >= 0 && translatedAnswers[idx]) return translatedAnswers[idx];
  return mapString(raw, cache);
}

async function fillCache(missing, cache) {
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    process.stdout.write(`Translating ${i + 1}-${i + batch.length} / ${missing.length}\r`);
    const results = await translate(batch, { from: 'pl', to: 'en' });
    const list = Array.isArray(results) ? results : [results];
    batch.forEach((src, j) => {
      cache[src] = list[j]?.text ?? src;
    });
    saveJson(CACHE_PATH, cache);
    if (i + BATCH_SIZE < missing.length) await sleep(BATCH_DELAY_MS);
  }
  process.stdout.write('\n');
}

function buildEnglishExport(data, cache) {
  const out = structuredClone(data);
  out.meta = {
    ...out.meta,
    source: `${out.meta?.source ?? 'exam export'} (English translation)`,
    locale: 'en',
    translatedAt: new Date().toISOString(),
    translationNote:
      'Machine-translated from public/exam-all-modules-export.json via scripts/build-en-export.mjs. Media paths unchanged.',
  };

  for (const mod of out.modules) {
    const moduleId = mod.moduleId;
    const enName = MODULE_NAMES_EN[moduleId] ?? mapString(mod.meta?.module?.name ?? '', cache);
    if (mod.meta?.module) mod.meta.module.name = enName;
    for (const row of mod.questions) {
      row.module.name = enName;
      const q = row.question;
      const origPredefined = [...(q.predefinedAnswers ?? [])];
      const origAnswers = origPredefined.length
        ? origPredefined
        : [q.answerA, q.answerB, q.answerC].filter(Boolean);

      q.text = mapString(q.text, cache);
      q.answerA = mapString(q.answerA, cache);
      q.answerB = mapString(q.answerB, cache);
      q.answerC = mapString(q.answerC, cache);
      q.predefinedAnswers = mapAnswers(q.predefinedAnswers, cache);
      const translatedAnswers = q.predefinedAnswers.length
        ? q.predefinedAnswers
        : [q.answerA, q.answerB, q.answerC].filter(Boolean);
      q.correct = mapCorrect(q.correct, origAnswers, translatedAnswers, cache);

      if (row.summary) {
        row.summary.stem = q.text;
        row.summary.answers = [...translatedAnswers];
        row.summary.correct = q.correct;
      }
    }
  }

  return out;
}

async function main() {
  console.log('Reading', SRC);
  const data = loadJson(SRC, null);
  if (!data) throw new Error(`Missing source file: ${SRC}`);

  const cache = loadJson(CACHE_PATH, {});
  for (const [pl, en] of Object.entries(MODULE_NAMES_EN)) {
    const mod = data.modules.find((m) => m.moduleId === Number(pl));
    if (mod?.meta?.module?.name) cache[mod.meta.module.name] = en;
  }

  const all = collectStrings(data);
  const missing = all.filter((s) => !cache[s] && !STATIC_EN[s]);
  console.log(`Strings: ${all.length}, cached: ${all.length - missing.length}, to translate: ${missing.length}`);

  if (missing.length > 0) {
    await fillCache(missing, cache);
  }

  const enData = buildEnglishExport(data, cache);
  saveJson(OUT, enData);
  console.log('Wrote', OUT);
  console.log('Questions:', enData.meta?.totalQuestions ?? enData.modules.reduce((n, m) => n + m.questions.length, 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
