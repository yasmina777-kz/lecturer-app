// Studio logic: subtitles, numbers, translation kinds and the clip timeline.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const cache = new Map();
async function load(rel) {
  const url = new URL(rel, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  let js = ts.transpileModule(await readFile(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  for (const [, spec] of [...js.matchAll(/from\s+"(\.\/[^"]+)"/g)]) js = js.replace(`"${spec}"`, `"${await load(new URL(spec + '.ts', url).href)}"`);
  const data = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
  cache.set(url.href, data);
  return data;
}
const json = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const S = await import(await load('../src/sign/studio.ts'));
const D = await import(await load('../src/sign/dictionary.ts'));

assert.equal(S.numberWords(5), 'пять');
assert.equal(S.numberWords(21), 'двадцать один');
assert.equal(S.numberWords(105), 'сто пять');
assert.equal(S.numberWords(1000), 'тысяча');
assert.equal(S.numberWords(2024), 'две тысячи двадцать четыре');
assert.equal(S.numberWords(5000), 'пять тысяч');
assert.equal(S.numberWords(11000), 'одиннадцать тысяч');
assert.equal(S.numberWords(21000), 'двадцать одна тысяча');

const srt = S.parseSubtitles('1\r\n00:00:01,000 --> 00:00:02,500\r\nДобрый <i>вечер</i>!\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nПогода\r\n');
assert.deepEqual(srt, [{ text: 'Добрый вечер!', start: 1, end: 2.5 }, { text: 'Погода', start: 3, end: 4 }]);
const vtt = S.parseSubtitles('WEBVTT\n\n00:01.200 --> 00:02.000 align:start\nПривет\n');
assert.deepEqual(vtt, [{ text: 'Привет', start: 1.2, end: 2 }]);
const timed = S.timeCues([{ text: 'один два' }, { text: 'три' }], 10);
assert.ok(timed[0].start === 0.3 && timed[1].end <= 9.8 && timed[0].end === timed[1].start);

const words = await json('../public/research/rsl/words/catalog.json');
const forms = await json('../public/research/rsl/words/forms.json');
const letters = D.alphabetEntries();
const kinds = (t) => S.translateCue(t, words, forms, letters).map((w) => `${w.text}:${w.kind}`).join(' ');
assert.equal(kinds('Погода в Алматы'), 'Погода:sign в:skip Алматы:spell');
assert.match(kinds('Завтра 5 человек'), /пять:sign/);
for (const t of S.TEMPLATES) {
  const tr = t.script.split('\n').map((l) => S.translateCue(l, words, forms, letters));
  const all = tr.flat().filter((w) => w.kind !== 'skip');
  const signed = all.filter((w) => w.kind === 'sign' || w.kind === 'form').length / all.length;
  assert.ok(signed >= 0.6, `template ${t.id} should be mostly signs, got ${signed}`);
  const items = S.buildSchedule(t.script.split('\n').map((text) => ({ text })), tr, () => 2);
  for (let i = 1; i < items.length; i++) assert.ok(items[i].start >= items[i - 1].end - 1e-9, 'clips never overlap');
}
const items = S.buildSchedule([{ text: 'a', start: 0, end: 1 }], [[{ text: 'a', kind: 'sign', clips: [{ src: 'x', label: 'a', letter: false }, { src: 'y', label: 'b', letter: false }] }]], () => 2);
assert.ok(Math.abs(items[1].end - 4 / (1.15 * 2)) < 1e-9, 'a long line is sped up at most 2x');
assert.equal(S.itemAt(items, -1), -1);
assert.equal(S.itemAt(items, 1.5), 1);
console.log('studio ok: subtitles, numbers, translation kinds, timeline');
