import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/sign/activities.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText.replace(/import \{ at \} from [^;]+;/,'const at=(ru)=>ru;');
const {dialogueScenarios,questionOptions,reviewItems,shuffle}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const entries=JSON.parse(await readFile(new URL('../public/research/rsl/words/catalog.json',import.meta.url),'utf8'));
const scenarios=dialogueScenarios();assert.equal(scenarios.length,3);
for(const s of scenarios){
 const ids=s.steps.map(x=>x.id);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.includes(s.start));
 const reached=new Set();function visit(id,path=[]){assert.ok(!path.includes(id),'cycle');const step=s.steps.find(x=>x.id===id);assert.ok(step);reached.add(id);assert.ok(step.choices.some(c=>c.accepted));assert.equal(new Set(step.choices.map(c=>c.id)).size,step.choices.length);for(const label of step.signs)assert.ok(entries.some(e=>e.label===label),label);for(const choice of step.choices){assert.ok(choice.feedback);if(choice.next){assert.ok(choice.accepted);visit(choice.next,[...path,id]);}else if(choice.accepted)assert.equal(path.length+1,3);}}
 visit(s.start);assert.equal(reached.size,s.steps.length);
}
for(const answer of entries){const options=questionOptions(answer,entries,()=>.37);assert.equal(options.length,4);assert.equal(new Set(options.map(x=>x.label)).size,4);assert.equal(options.filter(x=>x.id===answer.id).length,1);assert.ok(options.every(x=>x.category===answer.category));}
const attempt=(item,correct,assisted=false)=>({id:Math.random().toString(),item,correct,assisted,mode:'understanding',at:new Date().toISOString()});
assert.deepEqual([...reviewItems([attempt('a',false),attempt('b',true,true),attempt('a',true)])],['b']);
assert.equal(reviewItems([{...attempt('a',false),mode:'dialogue'}]).size,0);
assert.equal(reviewItems([attempt('a',true),attempt('a',false)]).has('a'),true);
const input=[1,2,3,4];assert.deepEqual([...shuffle(input)].sort(),input);assert.deepEqual(input,[1,2,3,4]);
console.log('Dialogue branches/media, unique same-topic choices, three-turn completion, review recovery and assisted attempts passed.');
