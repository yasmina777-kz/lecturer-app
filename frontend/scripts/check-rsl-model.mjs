import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/sign/recognition.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {classifyFeatures,handFeatures}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const model=JSON.parse(await readFile(new URL('../public/models/rsl/classifier.json',import.meta.url),'utf8'));
const fixtures=JSON.parse(await readFile(new URL('../public/models/rsl/test-fixtures.json',import.meta.url),'utf8'));
for(const fixture of fixtures){const result=classifyFeatures(fixture.features,model);assert.ok(result);result.probabilities.forEach((p,i)=>assert.ok(Math.abs(p-fixture.probabilities[i])<1e-9,'Browser math must match trained Python model'));}
assert.equal(handFeatures([]),null);assert.equal(handFeatures(Array(21).fill({x:0,y:0,z:0})),null);
assert.equal(classifyFeatures([NaN],model),null);
const points=Array.from({length:21},(_,i)=>({x:Math.sin(i),y:i/10,z:Math.cos(i)}));
const first=handFeatures(points),second=handFeatures(points.map(p=>({x:p.x*3+5,y:p.y*3-2,z:p.z*3+1})));
first.forEach((v,i)=>assert.ok(Math.abs(v-second[i])<1e-9,'Features should be translation/scale invariant'));
const uncertain={labels:['А','В','Л'],mean:[0],std:[1],weights:[[0],[0],[0]],bias:[0,0,0],threshold:.8,margin:.25};
assert.equal(classifyFeatures([0],uncertain).accepted,false);
console.log('RSL checks passed: Python/JS model parity on 5 held-out fixtures; degenerate input; feature invariance; uncertainty rejection.');
