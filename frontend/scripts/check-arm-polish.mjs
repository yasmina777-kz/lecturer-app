import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
const code = ts.transpileModule(await readFile(new URL('../src/sign/softenArmMotion.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText.replace('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const {softenArmMotion}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const rotation=(name,angles,times=[0,1/30,2/30,3/30,4/30])=>new THREE.QuaternionKeyframeTrack(name,times,angles.flatMap(a=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),THREE.MathUtils.degToRad(a)).toArray()));
const arm=rotation('mixamorigRightForeArm.quaternion',[0,2,-2,2,0]);
const finger=rotation('mixamorigRightHandIndex1.quaternion',[0,2,-2,2,0]);
const clip=new THREE.AnimationClip('trial',4/30,[arm,finger]);
const snapshot=Array.from(arm.values),result=softenArmMotion(clip);
assert.deepEqual(Array.from(arm.values),snapshot,'cached source must remain untouched');
assert.deepEqual(result.tracks[1].values,finger.values,'finger shape must not change');
assert.deepEqual(result.tracks[0].times,arm.times,'timing must not change');
assert.deepEqual(result.tracks[0].values.slice(0,4),arm.values.slice(0,4));
assert.deepEqual(result.tracks[0].values.slice(-4),arm.values.slice(-4));
let changed=false;
for(let i=0;i<5;i++){
 const old=new THREE.Quaternion().fromArray(arm.values,i*4).normalize();
 const next=new THREE.Quaternion().fromArray(result.tracks[0].values,i*4).normalize();
 assert.ok(Math.abs(next.length()-1)<1e-6);
 assert.ok(old.angleTo(next)<=THREE.MathUtils.degToRad(1.251),'bounded correction');
 changed ||= old.angleTo(next)>.001;
}
assert.ok(changed,'small oscillations must actually be smoothed');
for(const track of [rotation('mixamorigLeftArm.quaternion',[0,30,60,90,120]),rotation('mixamorigLeftArm.quaternion',[0,2,4,6,8],[0,.2,.4,.6,.8])]) {
 assert.deepEqual(softenArmMotion(new THREE.AnimationClip('preserve',1,[track])).tracks[0].values,track.values,'fast/low-rate motion must be preserved');
}
console.log('Arm polish: jitter reduced; timing, fingers, endpoints, fast movements and cached source preserved; correction <=1.25 degrees.');
const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
const bytes=await readFile(new URL('../public/avatars/woman01/word-f17a6060.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const original=gltf.animations[0],polished=softenArmMotion(original);
let adjusted=0,maxAngle=0;
for(let j=0;j<original.tracks.length;j++){
 const a=original.tracks[j],b=polished.tracks[j];
 if(!/(?:Left|Right)(?:Shoulder|Arm|ForeArm)\.quaternion$/.test(a.name)) {assert.deepEqual(b.values,a.values);continue;}
 for(let i=0;i<a.times.length;i++){
  const angle=new THREE.Quaternion().fromArray(a.values,i*4).normalize().angleTo(new THREE.Quaternion().fromArray(b.values,i*4).normalize());
  if(angle>.00001) adjusted++;
  maxAngle=Math.max(maxAngle,angle);
 }
}
assert.ok(adjusted>0,'actual greeting rig must bind to filter');
assert.ok(maxAngle<=THREE.MathUtils.degToRad(1.251));
console.log(`Actual greeting: ${adjusted} arm samples refined, max correction ${(maxAngle*180/Math.PI).toFixed(3)} degrees; all other channels unchanged.`);
