// Compare a candidate against its previous exported GLB, not against itself.
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Quaternion} from 'three';
const [before,after,report]=process.argv.slice(2);
if(!before||!after)throw Error('Usage: node check-release-polish.mjs BEFORE AFTER [REPORT]');
async function load(path){const b=await readFile(path);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).animations[0];}
const results=[];
for(const file of (await readdir(after)).filter(f=>f.endsWith('.json'))){
 const meta=JSON.parse(await readFile(after+'/'+file));if(!meta.releasePolish)continue;
 const id=meta.id,src=await load(before+'/'+id+'.glb'),dst=await load(after+'/'+id+'.glb'),cut=meta.releasePolish.unchangedThroughSeconds;
 let maxDegrees=0,maxPosition=0;
 for(const t of src.tracks){
  const other=dst.tracks.find(v=>v.name===t.name);assert.ok(other,t.name);
  const a=t.createInterpolant(),b=other.createInterpolant();
  for(let i=0;i<=Math.round(cut*60);i++){
   const x=a.evaluate(i/60),y=b.evaluate(i/60);
   if(t.name.endsWith('.quaternion'))maxDegrees=Math.max(maxDegrees,new Quaternion().fromArray(x).normalize().angleTo(new Quaternion().fromArray(y).normalize())*180/Math.PI);
   else for(let k=0;k<x.length;k++)maxPosition=Math.max(maxPosition,Math.abs(x[k]-y[k]));
  }
 }
 assert.ok(maxDegrees<.02,id+' changed recorded rotation '+maxDegrees);
 assert.ok(maxPosition<.00001,id+' changed recorded position '+maxPosition);
 results.push({id,label:meta.label,before:src.duration,after:dst.duration,unchangedThroughSeconds:cut,maxDegrees,maxPosition});
}
assert.ok(results.length);
if(report)await writeFile(report,JSON.stringify(results,null,2));
console.log('Preserved recorded sign poses at 60 Hz for',results.length,'shortened releases.');
