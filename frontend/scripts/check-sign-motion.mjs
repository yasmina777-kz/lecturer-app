import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
async function source(p,replacements={}){let code=ts.transpileModule(await readFile(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;for(const [a,b]of Object.entries(replacements))code=code.replaceAll(a,JSON.stringify(b));return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');}
const dictionary=await source('../src/sign/dictionary.ts'),text=await source('../src/sign/textPlan.ts');
const motion=await source('../src/sign/motion.ts',{'"./dictionary"':dictionary,'"./textPlan"':text});const {planMotion,motionTimeline}=await import(motion);const {alphabetEntries}=await import(dictionary);
const {composeMotion}=await import(await source('../src/sign/composeMotion.ts',{'"three"':new URL('../node_modules/three/build/three.module.js',import.meta.url).href,'"./motion"':motion}));
const assets=await read('../public/avatars/sign-motion/catalog.json'),words=await read('../public/research/rsl/words/catalog.json'),forms=await read('../public/research/rsl/words/forms.json'),entries=[...alphabetEntries(),...words];
assert.equal(assets.length,203);assert.equal(new Set(assets.map(a=>a.id)).size,203);
let plan=planMotion('Я хочу читать книгу',entries,forms,assets);assert.deepEqual(plan.steps.map(s=>s.label),['я','хотеть','читать','книга']);assert.deepEqual(plan.missing,[]);
const timeline=motionTimeline(plan.steps);assert.equal(timeline.length,4);assert.ok(timeline.every((s,i)=>i===0||s.start>timeline[i-1].end));
plan=planMotion('Здравствуйте! Как тебя зовут? Спасибо.',entries,forms,assets);assert.equal(plan.steps.length,3);assert.deepEqual(plan.missing,[]);
plan=planMotion('Я не абракадабра',entries,forms,assets);assert.deepEqual(plan.missing,['абракадабра']);assert.ok(plan.steps.some(s=>s.label==='не'));
plan=planMotion('Юлия',entries,forms,assets,true);assert.equal(plan.steps.length,4);assert.ok(plan.steps.every(s=>s.id.startsWith('letter-')));
for (const entry of alphabetEntries()) {
 const letter = planMotion(entry.label.toLowerCase(), entries, forms, assets);
 assert.equal(letter.spelling, true);
 assert.deepEqual(letter.missing, []);
 assert.equal(letter.steps.length, 1);
 assert.equal(letter.steps[0].id, entry.id);
}
assert.equal(planMotion('я хочу', entries, forms, assets).spelling, false);
const base=await readFile(new URL('../public/avatars/mira-blender/letter-a.glb',import.meta.url));const j=JSON.parse(base.subarray(20,20+base.readUInt32LE(12)).toString());const boneNames=new Set(j.nodes.map(n=>n.name));
const clips=[];
for(const asset of assets){
 const bytes=await readFile(new URL('../public'+asset.url,import.meta.url));const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.equal(json.meshes?.length??0,0);
 for(const channel of json.animations[0].channels)assert.ok(boneNames.has(json.nodes[channel.target.node].name),asset.label);
 const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const clip=loaded.animations[0];assert.ok(Math.abs(clip.duration-asset.duration)<.02,asset.label);
 for(const track of clip.tracks){if(track.name.endsWith('.scale'))assert.ok(Array.from(track.values).every(v=>Math.abs(v-1)<.001),asset.label+' DQ requires rigid bone transforms');if(/Hand(?:Index|Middle|Ring|Pinky|Thumb)[123]\.position/.test(track.name))assert.ok(Array.from(track.values).every((v,i)=>Math.abs(v-track.values[i%3])<.00001),asset.label+' sliding finger joint');assert.ok(Array.from(track.values).every(Number.isFinite));assert.ok(Array.from(track.times).every((t,i)=>i===0||t>track.times[i-1]));}
 if(['я','хотеть','читать','книга'].includes(asset.label))clips.push(clip);
}
const combined=composeMotion(clips);assert.equal(clips.length,4);assert.ok(combined.duration>clips.reduce((n,c)=>n+c.duration,0));for(const t of combined.tracks){assert.ok(Array.from(t.times).every((x,i)=>i===0||x>t.times[i-1]));assert.ok(Array.from(t.values).every(Number.isFinite));}
// Only synthetic lead/tail can be removed; source frames and UI durations agree.
const phrase=planMotion('Я хочу читать книгу',entries,forms,assets);
const windows=motionTimeline(phrase.steps);
const ordered=await Promise.all(phrase.steps.map(async step=>{
 const bytes=await readFile(new URL('../public'+step.url,import.meta.url));
 return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).animations[0];
}));
const flowing=composeMotion(ordered,undefined,windows.map(s=>({start:s.trimStart,end:s.trimEnd})));
assert.ok(Math.abs(flowing.duration-windows.at(-1).end)<.001);
assert.ok(flowing.duration<ordered.reduce((n,c)=>n+c.duration,0));
for(const track of flowing.tracks){
 assert.ok(Array.from(track.times).every((x,i)=>i===0||x>track.times[i-1]));
 assert.ok(Array.from(track.values).every(Number.isFinite));
}
assert.throws(()=>composeMotion([ordered[0]],undefined,[{start:ordered[0].duration,end:0}]),/Invalid motion window/);
for(const asset of assets){
 assert.equal(asset.motionVersion,4,asset.label);
 assert.ok(asset.maxJointStepDegrees<=8.1,`${asset.label}: rotation spike`);
 assert.ok(asset.maxHingeOffAxis<.0001,`${asset.label}: finger hinge twist`);
 assert.ok(asset.leadIn>0 && asset.leadOut>0);
}
console.log('203 animation assets: skeleton compatibility, finite transforms, timelines, full phrase matching, morphology, unknown/negation preservation and alphabet selection passed.');
