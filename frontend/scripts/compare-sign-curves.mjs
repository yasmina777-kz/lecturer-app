import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Quaternion,QuaternionLinearInterpolant} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const root=fileURLToPath(new URL('../..',import.meta.url));
const baseline=process.argv[2]??'ff00e9f';
async function load(p,old=false){const b=old?execFileSync('git',['show',baseline+':'+p],{cwd:root,maxBuffer:1024*1024*5}):await fs.readFile(root+'/'+p);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).animations[0];}
const quantile=(a,p)=>a.sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];
function metrics(clip,lead){const accel=[],speeds=[];for(const track of clip.tracks){if(!/Hand(?:Index|Middle|Ring|Pinky|Thumb)[123]\.quaternion/.test(track.name))continue;const curve=new QuaternionLinearInterpolant(track.times,track.values,4);let prev,velocity;for(let t=lead;t<clip.duration-lead;t+=1/30){const q=new Quaternion().fromArray(curve.evaluate(t));if(prev){const v=prev.angleTo(q)*30;if(velocity!==undefined)accel.push(Math.abs(v-velocity)*30);speeds.push(v);velocity=v;}prev=q;}}return {p95FingerAngularAcceleration:quantile(accel,.95),p95FingerAngularSpeed:quantile(speeds,.95)};}
const report=[];
for(const id of ['letter-410','letter-418','word-0cca1e04','word-542b93a5','word-9fcf26f7','word-a1a428c3','word-a8989f04']){
 const path='frontend/public/avatars/sign-motion/'+id+'.glb';
 const old=await load(path,true),now=await load(path);
 report.push({id,before:metrics(old,.35),after:metrics(now,.7)});
}
console.log(JSON.stringify({baseline,units:'rad/s² acceleration, rad/s speed; p95 over finger joints in captured interval; not semantic accuracy',samples:report},null,2));
