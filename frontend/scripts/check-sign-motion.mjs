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
const bodyReport=await read('../public/avatars/sign-motion/body-clearance-report.json');
assert.equal(bodyReport.library.clips.length,207);
assert.equal(bodyReport.phrases.clips.length,32);
assert.equal(bodyReport.idleTransitions.clips.length,78);
for(const group of [bodyReport.library,bodyReport.phrases,bodyReport.idleTransitions]){
 assert.equal(group.sampleRate,60);assert.deepEqual(group.failed,[]);
 assert.ok(group.clips.every(c=>c.samples>1&&c.maxOverlapMeters<=.002));
 assert.ok(group.clips.every(c=>c.armAnatomy.upperPlaneErrorDegrees<=8&&c.armAnatomy.forearmRollDegrees<=86&&c.armAnatomy.wristSwingDegrees<=66&&c.armAnatomy.elbowPoleDeviationDegrees<=30),'invalid arm articulation');
}
for(const [path,hash]of Object.entries(bodyReport.sources)){
 assert.equal(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex'),hash,'stale clearance validation: '+path);
}
for(const checked of bodyReport.library.clips){
 const bytes=await readFile(new URL('../public/avatars/sign-motion/'+checked.id+'.glb',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),checked.sha256,'unchecked changed animation: '+checked.id);
}
let restTransitionAtFixedGap=0;
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
   restTransitionAtFixedGap=Math.max(restTransitionAtFixedGap,angle*1.875/.25);
   assert.ok(angle*1.875/transitionDuration(example.steps[i-1],example.steps[i])<=TRANSITION_SPEED_DEGREES+.1,phrase+' transition too fast');
  }
 }

}
console.log('Relaxed-boundary transition peak with 250 ms gap:',restTransitionAtFixedGap.toFixed(1),'degrees/s');
assert.equal(assets.length,206);assert.equal(new Set(assets.map(a=>a.id)).size,206);
let plan=planMotion('Я хочу читать книгу',entries,forms,assets);assert.deepEqual(plan.steps.map(s=>s.label),['я','хотеть','читать','книга']);assert.deepEqual(plan.missing,[]);
const timeline=motionTimeline(plan.steps);assert.equal(timeline.length,4);assert.ok(timeline.every(s=>s.trimStart===0&&s.trimEnd===0),'phrase must preserve coordinated lead-in/out');assert.ok(timeline.every((s,i)=>i===0||s.start>timeline[i-1].end));
plan=planMotion('Здравствуйте! Как тебя зовут? Спасибо.',entries,forms,assets);assert.equal(plan.steps.length,3);assert.deepEqual(plan.missing,[]);assert.ok(plan.steps.every(s=>s.url.startsWith('/avatars/sign-motion/') && s.revision),'prepared phrases must use rebuilt versioned clips');
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
assert.deepEqual(planMotion('Спасибо', entries, forms, assets.filter(a=>a.id!=='prepared-thanks')).missing,['Спасибо'],'missing rebuilt motion must not fall back to old rig animation');
const base=await readFile(new URL('../public/avatars/mira-blender/letter-a.glb',import.meta.url));const j=JSON.parse(base.subarray(20,20+base.readUInt32LE(12)).toString());const boneNames=new Set(j.nodes.map(n=>n.name));
const clips=[];
const loadedClips=new Map();
const sharedRest=new Map();
for(const asset of assets){
 const bytes=await readFile(new URL('../public'+asset.url,import.meta.url));assert.equal(asset.revision,createHash('sha256').update(bytes).digest('hex').slice(0,12),'stale motion revision');const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.equal(json.meshes?.length??0,0);
 for(const channel of json.animations[0].channels)assert.ok(boneNames.has(json.nodes[channel.target.node].name),asset.label);
 const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const clip=loaded.animations[0];loadedClips.set(asset.url,clip);assert.ok(Math.abs(clip.duration-asset.duration)<.02,asset.label);
 // Every possible adjacent word pair must join a shared rest pose (0.3° / 0.1 mm export tolerance).
 // Individually collision-free endpoints are insufficient (mother -> work).
 for(const track of clip.tracks){
  const size=track.getValueSize(),start=Array.from(track.values.slice(0,size)),end=Array.from(track.values.slice(-size));
  if(!sharedRest.has(track.name))sharedRest.set(track.name,start);
  const rest=sharedRest.get(track.name);
  for(const boundary of [start,end]){
   if(track.name.endsWith('.quaternion')){
    const dot=Math.abs(boundary.reduce((n,v,i)=>n+v*rest[i],0))/(Math.hypot(...boundary)*Math.hypot(...rest));
    assert.ok(2*Math.acos(Math.min(1,dot))<.3*Math.PI/180,asset.label+' inconsistent rest rotation '+track.name);
   }else assert.ok(boundary.every((v,i)=>Math.abs(v-rest[i])<.0001),asset.label+' inconsistent rest position '+track.name);
  }
 }
 for(const track of clip.tracks){if(track.name.endsWith('.scale'))assert.ok(Array.from(track.values).every(v=>Math.abs(v-1)<.001),asset.label+' DQ requires rigid bone transforms');if(/Hand(?:Index|Middle|Ring|Pinky|Thumb)[123]\.position/.test(track.name))assert.ok(Array.from(track.values).every((v,i)=>Math.abs(v-track.values[i%3])<.00001),asset.label+' sliding finger joint');assert.ok(Array.from(track.values).every(Number.isFinite));assert.ok(Array.from(track.times).every((t,i)=>i===0||t>track.times[i-1]));}
 if(['я','читать','книга','помочь','показать'].includes(asset.label)) {
  const mixer=new AnimationMixer(loaded.scene);mixer.clipAction(clip).play();
  const point=(suffix)=>{
   const bone=loaded.scene.getObjectByName('mixamorig'+suffix);
   assert.ok(bone,suffix);return bone.getWorldPosition(new Vector3());
  };
  const sample=(t,sourceTime=false)=>{if(sourceTime){const times=asset.bodyClearance.sourceFrameTimes;const f=Math.min(t*30,times.length-1),i=Math.floor(f);t=times[i]+((times[i+1]??times[i])-times[i])*(f-i);}mixer.setTime(t);loaded.scene.updateMatrixWorld(true);};
  if(asset.label==='я') {
   sample(1.14,true);
   assert.ok(point('LeftHandIndex3').z<point('LeftHandIndex1').z-.025,'self-point must face back toward the chest');
  }
  if(['читать','помочь'].includes(asset.label)) for(const t of [asset.leadIn+.3,asset.leadIn+.6]) {
   sample(t);
   for(const side of (asset.label==='читать'?['Left']:['Left','Right'])) for(const finger of ['Index','Middle','Ring','Pinky']) {
    const a=point(side+'Hand'+finger+'1'),b=point(side+'Hand'+finger+'2'),c=point(side+'Hand'+finger+'3');
    assert.ok(b.clone().sub(a).angleTo(c.sub(b))<Math.PI/12,'reading hand must keep straight fingers');
   }
  }
  if(asset.label==='показать') for(const t of [asset.leadIn+.3,asset.leadIn+.6]) {
   sample(t);
   for(const [side,fingers] of [['Left',['Index','Middle','Ring','Pinky']],['Right',['Index']]])
    for(const finger of fingers) {
     const a=point(side+'Hand'+finger+'1'),b=point(side+'Hand'+finger+'2'),c=point(side+'Hand'+finger+'3');
     assert.ok(b.clone().sub(a).angleTo(c.sub(b))<Math.PI/12,'show: straight index and supporting palm must not curl');
    }
  }
  if(asset.label==='книга') {
   sample(1.7,true);const closed=point('LeftHand').distanceTo(point('RightHand'));
   sample(1.13,true);const open=point('LeftHand').distanceTo(point('RightHand'));
   assert.ok(closed<.065 && open>closed+.025,'book hands must close together then open from a shared hinge');
  }
  mixer.stopAllAction();mixer.uncacheRoot(loaded.scene);
 }
 if(['я','хотеть','читать','книга'].includes(asset.label))clips.push(clip);
}
const combined=composeMotion(clips);assert.equal(clips.length,4);assert.ok(combined.duration>clips.reduce((n,c)=>n+c.duration,0));for(const t of combined.tracks){assert.ok(Array.from(t.times).every((x,i)=>i===0||x>t.times[i-1]));assert.ok(Array.from(t.values).every(Number.isFinite));}
// Release/preparation must survive phrase composition, including fingers and IK.
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

// Regression: every source pose in all offered phrases remains unchanged in the
// composed clip. Previously the release and preparation were cut off and replaced
// with unrelated joint-by-joint blends, despite passing the speed-only check.
let verifiedPhraseFrames=0;
for(const group of phraseGroups) for(const label of group.phrases) {
 const p=planMotion(label,entries,forms,assets), w=motionTimeline(p.steps), sourceClips=[];
 for(const step of p.steps) {
  if(!loadedClips.has(step.url)) {
   const b=await readFile(new URL('../public'+step.url,import.meta.url));
   const loader=new GLTFLoader().register(()=>({name:'test-no-textures',loadTexture:()=>Promise.resolve(null)}));
   const c=(await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).animations[0];
   loadedClips.set(step.url,c);
  }
  const c=loadedClips.get(step.url);
  assert.ok(Math.abs(c.duration-step.duration)<.002,label+' metadata duration mismatch');
  sourceClips.push(c);
 }
 const result=composeMotion(sourceClips,undefined,w.map(s=>({start:s.trimStart,end:s.trimEnd,gapAfter:s.gapAfter})));
 assert.ok(Math.abs(result.duration-w.at(-1).end)<.002,label+' composed timeline mismatch');
 for(let i=0;i<w.length;i++) {
  assert.equal(w[i].trimStart,0);assert.equal(w[i].trimEnd,0);
  for(const t of sourceClips[i].tracks) {
   const src=t.createInterpolant(), dst=result.tracks.find(r=>r.name===t.name).createInterpolant();
   for(let k=0;k<=Math.ceil(sourceClips[i].duration*60);k++) {
    const time=Math.min(k/60,sourceClips[i].duration);
    const a=Array.from(src.evaluate(time)),b=Array.from(dst.evaluate(w[i].start+time));
    if(t.name.endsWith('.quaternion')) {
     const dot=Math.abs(a.reduce((s,v,j)=>s+v*b[j],0))/(Math.hypot(...a)*Math.hypot(...b));
     assert.ok(1-dot<1e-7,label+' altered source joint '+t.name);
    } else assert.ok(a.every((v,j)=>Math.abs(v-b[j])<.0001),label+' altered source position '+t.name);
    verifiedPhraseFrames++;
   }
  }
 }
}
// Across the catalog all finger endpoints share the same relaxed shape. New
// transitions therefore cannot mix incompatible fist/open/pinch finger poses.
const referenceRest=assets[0].transitionPose.start;
for(const a of assets) {
 assert.equal(a.transitionPose.at,'rest');
 for(const pose of [a.transitionPose.start,a.transitionPose.end])
  for(const [bone,q] of Object.entries(pose)) if(/Hand(?:Thumb|Index|Middle|Ring|Pinky)[123]$/.test(bone)) {
   const r=referenceRest[bone];const dot=Math.abs(q.reduce((s,v,j)=>s+v*r[j],0))/(Math.hypot(...q)*Math.hypot(...r));
   assert.ok(2*Math.acos(Math.min(1,dot))<.005,a.label+' non-neutral finger boundary '+bone);
  }
}
console.log('32 phrases: source-pose samples preserved:',verifiedPhraseFrames,'; all 206 clips join relaxed fingers.');

assert.throws(()=>composeMotion([ordered[0]],undefined,[{start:ordered[0].duration,end:0}]),/Invalid motion window/);
for(const asset of assets){
 assert.equal(asset.motionVersion,8,asset.label);
 assert.ok(asset.bodyClearance?.afterMaxMeters<=.002,`${asset.label}: body clearance failed`);
 assert.equal(asset.handMechanics,'workshop-parameter-curves-v1',asset.label);
 if (!asset.id.startsWith('prepared-') && !asset.chartPose) assert.ok(asset.sourceWristFitErrorMeters<.001,`${asset.label}: coordinated wrist target lost`);
 assert.ok(asset.maxJointStepDegrees<=8.1,`${asset.label}: rotation spike`);
 assert.ok(asset.maxHingeOffAxis<.0001,`${asset.label}: finger hinge twist`);
 assert.ok(asset.leadIn>0 && asset.leadOut>0);
 if (asset.chartPose) {
  assert.ok(asset.chartPose.holdTime>=asset.leadIn && asset.chartPose.holdTime<asset.duration-asset.leadOut,'inspect time must be inside the authored pose');
  assert.ok(asset.maxPlaybackHingeOffAxis<=asset.restHingeOffAxis+.0001,'authored motion adds finger twist beyond shared idle');
  assert.equal(asset.chartPose.review,'experimental-unreviewed');
  assert.equal(asset.chartPose.source,'/images/rsl-alphabet/source-chart.jpg');
 }
}
console.log('206 animation assets: skeleton compatibility, finite transforms, timelines, full phrase matching, morphology, unknown/negation preservation and alphabet selection passed.');
