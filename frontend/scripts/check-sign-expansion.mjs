import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
async function module(p,replace={}){let src=await readFile(new URL(p,import.meta.url),'utf8');let js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;for(const [a,b]of Object.entries(replace))js=js.replace(a,b);return 'data:text/javascript;base64,'+Buffer.from(js).toString('base64');}
const recognition=await module('../src/sign/recognition.ts');const temporal=await import(await module('../src/sign/temporal.ts',{'"./recognition"':JSON.stringify(recognition)}));
const fixtures=await read('../public/models/rsl/alphabet-fixtures.json'),model=await read('../public/models/rsl/alphabet-classifier.json');
assert.equal(model.labels.length,34);
for(const f of fixtures){const features=temporal.temporalFeatures(f.frames);assert.ok(features);assert.equal(features.length,474);features.forEach((v,i)=>assert.ok(Math.abs(v-f.features[i])<1e-8));const predicted=temporal.recognizeSequence(f.frames,model);predicted.probabilities.forEach((v,i)=>assert.ok(Math.abs(v-f.probabilities[i])<1e-7));}
assert.equal(temporal.temporalFeatures([]),null);assert.equal(temporal.temporalFeatures(Array.from({length:16},()=>Array(66).fill(NaN))),null);assert.equal(temporal.recognizeSequence(Array.from({length:16},()=>Array(66).fill(0)),model).accepted,false);
const {decomposeText,alphabetEntries}=await import(await module('../src/sign/dictionary.ts'));const words=await read('../public/research/rsl/words/catalog.json'),forms=await read('../public/research/rsl/words/forms.json'),entries=[...alphabetEntries(),...words];
assert.equal(alphabetEntries().length,33);assert.equal(words.length,170);
const parsed=decomposeText('Я хочу читать книгу',entries,forms);assert.deepEqual(parsed.map(p=>p.entry?.label.toLowerCase()),['я','хотеть','читать','книга']);
const negative=decomposeText('Я не абракадабра!',entries,forms);assert.equal(negative[1].entry.label,'не');assert.equal(negative[2].entry,undefined);assert.equal(negative[2].text,'абракадабра');assert.equal(negative[3].punctuation,true);
assert.deepEqual(decomposeText('день и ночь',entries,forms).map(p=>p.entry.label),['день и ночь']);
assert.equal(decomposeText('Юлия',entries,forms,true).filter(p=>p.entry).length,4);
assert.ok(decomposeText('ЯЮЛИЯ',entries,forms,true).every(p=>p.entry?.category==='Алфавит'));
assert.equal(decomposeText('я',entries,forms)[0].entry?.category,'Общение');
assert.equal(decomposeText('A',entries,forms,true)[0].entry,undefined);
for(const e of entries){assert.ok((await readFile(new URL('../public'+e.video,import.meta.url))).length>1000);}
console.log('33-letter sequence parity, empty/invalid rejection, all media, morphology, negation, unknown tokens and fingerspelling passed.');
