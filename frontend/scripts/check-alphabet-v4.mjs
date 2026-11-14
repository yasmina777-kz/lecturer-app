import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/sign/recognition.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020}}).outputText;
const {validClassifier, classifyFeatures} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const model = await json('../public/models/rsl/alphabet-v4-classifier.json');
const fixtures = await json('../public/models/rsl/alphabet-v4-fixtures.json');
const report = await json('../../docs/alphabet-v4-report.json');
assert.ok(validClassifier(model));
assert.equal(model.labels.length,34);
assert.equal(model.threshold,.9,'calibrated threshold must not silently fall');
for(const fixture of fixtures){
  const actual=classifyFeatures(fixture.features,model);
  actual.probabilities.forEach((p,i)=>assert.ok(Math.abs(p-fixture.probabilities[i])<1e-8,'browser/Python inference parity'));
}
assert.ok(report.ready && report.test.precision>=.95 && report.test.coverage>.38);
assert.equal(report.test.samples,612);
console.log('PASS: v4 export matches Python probabilities; validation-selected threshold and recorded regression gate verified (not webcam accuracy).');
