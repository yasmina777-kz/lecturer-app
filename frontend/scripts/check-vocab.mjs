// Spaced-repetition rules and dictionary integrity for the word trainer.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
let src = await readFile(new URL('../src/sign/vocabProgress.ts', import.meta.url), 'utf8');
src = src.replace(/^import .*$/gm, '');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const v = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
let s = v.parseVocab(null);
s = v.applyAnswer(s, 'w1', true);
assert.equal(s.words.w1.box, 1);
s = v.applyAnswer(s, 'w1', true);
assert.equal(s.words.w1.box, 2);
assert.ok(s.words.w1.due > v.today(), 'correct answers push review into the future');
s = v.applyAnswer(s, 'w1', false);
assert.equal(s.words.w1.box, 0);
assert.deepEqual(v.dueIds(s), ['w1'], 'wrong answer is due again today');
assert.equal(v.streak(s.days), 1);
assert.deepEqual(v.parseVocab('{"words":{"x":{"box":99,"due":"bad"}}}').words, {}, 'corrupt rows rejected');
assert.deepEqual(v.parseVocab('not json'), { words: {}, lessons: {}, days: [] });
const catalog = JSON.parse(await readFile(new URL('../public/research/rsl/words/catalog.json', import.meta.url), 'utf8'));
const ids = new Set(catalog.map((w) => w.id));
assert.equal(ids.size, catalog.length, 'unique word ids');
const model = JSON.parse(await readFile(new URL('../public/models/rsl/words-v2-classifier.json', import.meta.url), 'utf8'));
for (const w of catalog) {
  await readFile(new URL('../public' + w.video, import.meta.url));
  assert.ok(model.courseLabels.includes(w.label), `camera check available for ${w.label}`);
}
console.log(`PASS: spaced repetition rules; ${catalog.length} dictionary words with videos and camera checks.`);
