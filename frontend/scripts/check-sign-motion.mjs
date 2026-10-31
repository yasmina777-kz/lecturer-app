import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
async function source(p,replacements={}){let code=ts.transpileModule(await readFile(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;for(const [a,b]of Object.entries(replacements))code=code.replaceAll(a,JSON.stringify(b));return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');}
const dictionary=await source('../src/sign/dictionary.ts'),text=await source('../src/sign/textPlan.ts');
const motion=await source('../src/sign/motion.ts',{'"./dictionary"':dictionary,'"./textPlan"':text});const {planMotion,motionTimeline,transitionDuration,TRANSITION_SPEED_DEGREES}=await import(motion);const {alphabetEntries}=await import(dictionary);
const {composeMotion}=await import(await source('../src/sign/composeMotion.ts',{'"three"':new URL('../node_modules/three/build/three.module.js',import.meta.url).href,'"./motion"':motion}));
const assets=await read('../public/avatars/sign-motion/catalog.json'),words=await read('../public/research/rsl/words/catalog.json'),forms=await read('../public/research/rsl/words/forms.json'),entries=[...alphabetEntries(),...words];
const {phraseGroups}=await import(await source('../src/sign/phraseExamples.ts'));
let worstOldTransition=0;
for(const group of phraseGroups)for(const phrase of group.phrases){
 const example=planMotion(phrase,entries,forms,assets);
 assert.deepEqual(example.missing,[],phrase+' has unavailable signs');
 assert.ok(example.steps.length>0,phrase);
 assert.equal(example.spelling,false,phrase);
 for(let i=1;i<example.steps.length;i++){
  const a=example.steps[i-1].transitionPose?.end,b=example.steps[i].transitionPose?.start;
  if(!a||!b)continue;
  for(const name of Object.keys(a))if(b[name]){
   const dot=Math.abs(a[name].reduce((sum,v,j)=>sum+v*b[name][j],0));
   const angle=2*Math.acos(Math.min(1,dot))*180/Math.PI;
   worstOldTransition=Math.max(worstOldTransition,angle*1.875/.25);
   assert.ok(angle*1.875/transitionDuration(example.steps[i-1],example.steps[i])<=TRANSITION_SPEED_DEGREES+.1,phrase+' transition too fast');
  }
 }

}
console.log('Previous fixed-gap transition peak:',worstOldTransition.toFixed(1),'degrees/s');
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
 const bytes=await readFile(new URL('../public'+asset.url,import.meta.url));assert.equal(asset.revision,createHash('sha256').update(bytes).digest('hex').slice(0,12),'stale motion revision');const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.equal(json.meshes?.length??0,0);
 for(const channel of json.animations[0].channels)assert.ok(boneNames.has(json.nodes[channel.target.node].name),asset.label);
 const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const clip=loaded.animations[0];assert.ok(Math.abs(clip.duration-asset.duration)<.02,asset.label);
 for(const track of clip.tracks){if(track.name.endsWith('.scale'))assert.ok(Array.from(track.values).every(v=>Math.abs(v-1)<.001),asset.label+' DQ requires rigid bone transforms');if(/Hand(?:Index|Middle|Ring|Pinky|Thumb)[123]\.position/.test(track.name))assert.ok(Array.from(track.values).every((v,i)=>Math.abs(v-track.values[i%3])<.00001),asset.label+' sliding finger joint');assert.ok(Array.from(track.values).every(Number.isFinite));assert.ok(Array.from(track.times).every((t,i)=>i===0||t>track.times[i-1]));}
 if(['я','читать','книга','помочь'].includes(asset.label)) {
  const mixer=new AnimationMixer(loaded.scene);mixer.clipAction(clip).play();
  const point=(suffix)=>{
   const bone=loaded.scene.getObjectByName('mixamorig'+suffix);
   assert.ok(bone,suffix);return bone.getWorldPosition(new Vector3());
  };
  const sample=(t)=>{mixer.setTime(t);loaded.scene.updateMatrixWorld(true);};
  if(asset.label==='я') {
   sample(1.14);
   assert.ok(point('LeftHandIndex3').z<point('LeftHandIndex1').z-.025,'self-point must face back toward the chest');
  }
  if(['читать','помочь'].includes(asset.label)) for(const t of [asset.leadIn+.3,asset.leadIn+.6]) {
   sample(t);
   for(const side of (asset.label==='читать'?['Left']:['Left','Right'])) for(const finger of ['Index','Middle','Ring','Pinky']) {
    const a=point(side+'Hand'+finger+'1'),b=point(side+'Hand'+finger+'2'),c=point(side+'Hand'+finger+'3');
    assert.ok(b.clone().sub(a).angleTo(c.sub(b))<Math.PI/12,'reading hand must keep straight fingers');
   }
  }
  if(asset.label==='книга') {
   sample(1.7);const closed=point('LeftHand').distanceTo(point('RightHand'));
   sample(1.13);const open=point('LeftHand').distanceTo(point('RightHand'));
   assert.ok(closed<.065 && open>closed+.025,'book hands must close together then open from a shared hinge');
  }
  mixer.stopAllAction();mixer.uncacheRoot(loaded.scene);
 }
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
const flowing=composeMotion(ordered,undefined,windows.map(s=>({start:s.trimStart,end:s.trimEnd,gapAfter:s.gapAfter})));
assert.ok(Math.abs(flowing.duration-windows.at(-1).end)<.001);
assert.ok(windows.every((w,i)=>i===windows.length-1||Math.abs(windows[i+1].start-w.end-w.gapAfter)<1e-6));
for(const track of flowing.tracks){
 assert.ok(Array.from(track.times).every((x,i)=>i===0||x>track.times[i-1]));
 assert.ok(Array.from(track.values).every(Number.isFinite));
}
// Inspect real composed rotation tracks at each seam, not just the duration formula.
let measuredTransitionPeak=0;
for(let i=0;i<windows.length-1;i++){
 const begin=windows[i].end,end=windows[i+1].start;
 for(const track of flowing.tracks){
  if(!track.name.endsWith('.quaternion'))continue;
  const {QuaternionLinearInterpolant}=await import('three');
  const sample=new QuaternionLinearInterpolant(track.times,track.values,4);
  let last=Array.from(sample.evaluate(begin)),time=begin;
  for(let next=Math.min(end,time+1/120);time<end-1e-7;next=Math.min(end,time+1/120)){
   const q=Array.from(sample.evaluate(next));
   const dot=Math.abs(q.reduce((sum,v,j)=>sum+v*last[j],0))/(Math.hypot(...q)*Math.hypot(...last));
   const speed=2*Math.acos(Math.min(1,dot))*180/Math.PI/(next-time);
   measuredTransitionPeak=Math.max(measuredTransitionPeak,speed);
   assert.ok(speed<=TRANSITION_SPEED_DEGREES+1,track.name+' composed seam exceeds speed bound');
   last=q;time=next;
  }
 }
}
console.log('Measured composed phrase transition peak:',measuredTransitionPeak.toFixed(1),'degrees/s');
assert.throws(()=>composeMotion([ordered[0]],undefined,[{start:ordered[0].duration,end:0}]),/Invalid motion window/);
for(const asset of assets){
 assert.equal(asset.motionVersion,5,asset.label);
 assert.ok(asset.finalWristErrorMeters<.001,`${asset.label}: coordinated wrist target lost`);
 assert.ok(asset.maxJointStepDegrees<=8.1,`${asset.label}: rotation spike`);
 assert.ok(asset.maxHingeOffAxis<.0001,`${asset.label}: finger hinge twist`);
 assert.ok(asset.leadIn>0 && asset.leadOut>0);
}
console.log('203 animation assets: skeleton compatibility, finite transforms, timelines, full phrase matching, morphology, unknown/negation preservation and alphabet selection passed.');
