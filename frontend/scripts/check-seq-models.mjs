// Browser/Python parity for the v5 letter CNN and the v2 word CNN, plus the
// two-hand word feature extractor. Fixtures are written by the training scripts
// (ml/rsl/train_alphabet_v5.py, train_slovo_v2.py, export_word_fixtures.py).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const cache = new Map();
async function load(rel) {
  const url = new URL(rel, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  let js = ts.transpileModule(await readFile(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [, spec] of [...js.matchAll(/from\s+"(\.\/[^"]+)"/g)]) {
    const dep = await load(new URL(spec + '.ts', url).href);
    js = js.replace(`"${spec}"`, `"${dep}"`);
  }
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
  cache.set(url.href, dataUrl);
  return dataUrl;
}
const mod = async (rel) => import(await load(rel));
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

const { loadSeqModel, runSeqModel } = await mod('../src/sign/seqModel.ts');
const { recognizeSequence } = await mod('../src/sign/temporal.ts');
const { clipFeatures, resampleFrames } = await mod('../src/sign/wordFeatures.ts');
const close = (a, b, tol, what) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < tol, `${what}: ${v} vs ${b[i]} @${i}`));

// Letters v5
const letters = loadSeqModel(await json('../public/models/rsl/alphabet-v5-classifier.json'));
assert.ok(letters, 'v5 letter model must validate');
assert.equal(letters.labels.length, 34);
for (const f of await json('../public/models/rsl/alphabet-v5-fixtures.json')) {
  const r = recognizeSequence(f.frames, letters);
  assert.ok(r, 'v5 prediction');
  close(r.probabilities, f.probabilities, 2e-4, 'letter v5 parity');
}
const empty = recognizeSequence(Array.from({ length: 16 }, () => Array(66).fill(0)), letters);
assert.ok(!empty?.accepted, 'no hands must never be accepted');

// Letters v6: hand + body channels (fixtures from ml/rsl/train_alphabet_v6.py)
{
  const { existsSync } = await import('node:fs');
  const { bodyFrame } = await mod('../src/sign/temporal.ts');
  if (existsSync(new URL('../public/models/rsl/alphabet-v6-classifier.json', import.meta.url))) {
    const v6 = loadSeqModel(await json('../public/models/rsl/alphabet-v6-classifier.json'));
    assert.ok(v6 && v6.channels === 75, 'v6 letter model must validate with 75 channels');
    for (const f of await json('../public/models/rsl/alphabet-v6-fixtures.json')) {
      const r = recognizeSequence(f.frames, v6);
      assert.ok(r, 'v6 prediction');
      close(r.probabilities, f.probabilities, 2e-4, 'letter v6 parity');
    }
    for (const b of await json('../public/models/rsl/alphabet-v6-body-fixtures.json')) {
      const pose = Array.from({ length: 17 }, () => ({ x: 0, y: 0, visibility: 0 }));
      [0, 9, 10, 11, 12, 13, 14, 15, 16].forEach((k, i) => (pose[k] = { x: b.pose[i][0], y: b.pose[i][1], visibility: b.pose[i][2] }));
      close(bodyFrame(b.hand, pose, b.aspect), b.body, 1e-4, 'bodyFrame parity');
    }
  }
}

// Words v5 (hands + body): raw landmarks + poses -> features -> probabilities
const words = loadSeqModel(await json('../public/models/rsl/words-v5-classifier.json'));
assert.ok(words && words.channels === 147, 'word model must validate with 147 channels');
const pose33 = (p9) => { const out = Array.from({ length: 17 }, () => ({ x: 0, y: 0, visibility: 0 })); [0, 9, 10, 11, 12, 13, 14, 15, 16].forEach((k, i) => (out[k] = { x: p9[i][0], y: p9[i][1], visibility: p9[i][2] })); return out; };
for (const f of await json('../public/models/rsl/words-v5-feature-fixtures.json')) {
  const features = clipFeatures(f.hands.map((fr) => fr.map((h) => h.map(([x, y, z]) => ({ x, y, z })))), f.width, f.height, f.poses.map(pose33));
  assert.equal(features.length, f.features.length, 'cropped length');
  features.forEach((row, t) => close(row, f.features[t], 2e-3, `word features t=${t}`));
  close(runSeqModel(words, resampleFrames(features, 32)), f.probabilities, 5e-3, 'end-to-end word parity');
}
assert.equal(clipFeatures([[], []], 640, 480), null, 'no hands -> null');
const corrupt = await json('../public/models/rsl/words-v5-classifier.json');
assert.equal(words.labels[words.labels.length - 1], '__none__', 'v5 has a no-sign class');
corrupt.layers[0].outputs += 1;
assert.equal(loadSeqModel(corrupt), null, 'shape mismatch must be rejected');
const { appendTranslation, WordSpotter } = await mod('../src/sign/wordSpotter.ts');
let t = appendTranslation('', 'Привет!', 'word', false);
t = appendTranslation(t, 'М', 'letter', false);
t = appendTranslation(t, 'А', 'letter', true);
t = appendTranslation(t, 'книга', 'word', false);
assert.equal(t, 'Привет МА книга', 'translator transcript joins letters and spaces words');
const spot = new WordSpotter();
for (let i = 0; i < 40; i++) assert.equal(spot.push(words, i * 50, [], 640, 480), null, 'no hands -> no words');
const { composePhrase, replaceTail, PHRASES } = await mod('../src/sign/phraseComposer.ts');
const course = new Set(words.courseLabels);
for (const p of PHRASES) for (const sgn of p.signs) assert.ok(course.has(sgn), `phrase sign ${sgn} must be recognizable`);
const ph = composePhrase([{ label: 'Привет!', at: 0 }, { label: 'имя', at: 1000 }, { label: 'ты', at: 2000 }], 2000);
assert.equal(ph.text, 'Как тебя зовут?');
assert.equal(replaceTail('Привет имя ты', ph.words, ph.text), 'Привет Как тебя зовут?');
assert.equal(composePhrase([{ label: 'ты', at: 0 }, { label: 'имя', at: 9000 }], 9000), null, 'too far apart');
console.log('PASS: letters (v5, v6 + body) and v5 words (hands + body) match Python inference; word features match; invalid inputs rejected.');
