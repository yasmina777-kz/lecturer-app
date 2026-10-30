import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const root=new URL('../public/',import.meta.url);
const base=await readFile(new URL('avatars/mira-blender/letter-a.glb',root));
const nodes=JSON.parse(base.subarray(20,20+base.readUInt32LE(12)).toString()).nodes;
const names=new Set(nodes.map(n=>n.name));
for(const name of ['standing-idle','talking']){
 const bytes=await readFile(new URL(`avatars/mixamo-trial/${name}.glb`,root));
 const meta=JSON.parse(await readFile(new URL(`avatars/mixamo-trial/${name}.json`,root),'utf8'));
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 assert.equal(json.meshes?.length??0,0);
 for(const c of json.animations[0].channels)assert.ok(names.has(json.nodes[c.target.node].name));
 const {animations:[clip]}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 assert.ok(Math.abs(clip.duration-meta.duration)<.002);
 assert.equal(meta.matchedBones,64);
 for(const t of clip.tracks){
  assert.ok(Array.from(t.values).every(Number.isFinite));
  assert.ok(Array.from(t.times).every((v,i)=>i===0||v>t.times[i-1]));
  if(t.name.endsWith('.scale'))assert.ok(Array.from(t.values).every(v=>Math.abs(v-1)<.001),t.name);
  if(t.name.includes('Hand')&&t.name.endsWith('.position'))assert.ok(Array.from(t.values).every((v,i)=>Math.abs(v-t.values[i%3])<.0001),t.name);
 }
}
console.log('Both Mixamo trials: shared skeleton, duration, finite curves, unit bone scales and fixed finger offsets passed.');
