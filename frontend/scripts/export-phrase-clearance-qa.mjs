/** Export the exact browser-composed examples for independent Blender skin checks. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
import {AnimationMixer,AnimationClip,QuaternionKeyframeTrack,VectorKeyframeTrack} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
async function source(p,replacements={}){let code=ts.transpileModule(await readFile(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;for(const[a,b]of Object.entries(replacements))code=code.replaceAll(a,JSON.stringify(b));return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');}
const dict=await source('../src/sign/dictionary.ts'),text=await source('../src/sign/textPlan.ts'),motion=await source('../src/sign/motion.ts',{'"./dictionary"':dict,'"./textPlan"':text});
const {alphabetEntries}=await import(dict),{planMotion,motionTimeline}=await import(motion),{phraseGroups}=await import(await source('../src/sign/phraseExamples.ts'));
const {composeMotion}=await import(await source('../src/sign/composeMotion.ts',{'"three"':new URL('../node_modules/three/build/three.module.js',import.meta.url).href,'"./motion"':motion}));
const assets=await read('../public/avatars/sign-motion/catalog.json'),words=await read('../public/research/rsl/words/catalog.json'),forms=await read('../public/research/rsl/words/forms.json'),cache=new Map();
// GLTFExporter omits unattached skins from animation-only scenes. Restore the
// source joint bind table so Blender imports bones instead of unrelated empties.
function restoreSkin(exported,original){
 const decode=b=>{const n=b.readUInt32LE(12);return {json:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};};
 const dst=decode(Buffer.from(exported)),src=decode(original),skin=src.json.skins[0],accessor=src.json.accessors[skin.inverseBindMatrices],view=src.json.bufferViews[accessor.bufferView];
 const begin=(view.byteOffset??0)+(accessor.byteOffset??0),ibm=src.bin.subarray(begin,begin+accessor.count*64),offset=dst.bin.length;
 dst.json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:ibm.length});
 dst.json.accessors.push({...accessor,bufferView:dst.json.bufferViews.length-1,byteOffset:0});
 const joints=skin.joints.map(i=>dst.json.nodes.findIndex(n=>n.name===src.json.nodes[i].name.replaceAll(':','')));
 if(joints.some(i=>i<0))throw new Error('Missing exported skeleton joint');
 dst.json.skins=[{name:skin.name,joints,inverseBindMatrices:dst.json.accessors.length-1}];
 const binary=Buffer.concat([dst.bin,ibm]);dst.json.buffers[0].byteLength=binary.length;
 const raw=Buffer.from(JSON.stringify(dst.json)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
 return Buffer.concat([header,json,binHeader,binary]);
}
const output=process.argv[2]??'/tmp/sign-phrase-clearance-qa';await mkdir(output,{recursive:true});let i=0;const manifest=[];
const idleQA=process.argv[3]==='--idle-transitions';
if(idleQA){
 const {AvatarPlayback}=await import(await source('../src/sign/avatarPlayback.ts',{'"three"':new URL('../node_modules/three/build/three.module.js',import.meta.url).href}));
 const idleBytes=await readFile(new URL('../public/avatars/sign-motion/ready-idle.glb',import.meta.url)),idle=(await new GLTFLoader().parseAsync(idleBytes.buffer.slice(idleBytes.byteOffset,idleBytes.byteOffset+idleBytes.byteLength),'')).animations[0];
 const selected=assets.filter(a=>['я','книга','показать','читать','помочь','красный','вода','люди','ехать','не'].includes(a.label)||a.id.startsWith('prepared-'));
 for(const asset of selected)for(const phase of [0,1.5,3])for(const end of [false,true]){
  const original=await readFile(new URL('../public'+asset.url,import.meta.url)),loaded=await new GLTFLoader().parseAsync(original.buffer.slice(original.byteOffset,original.byteOffset+original.byteLength),'');
  const scene=loaded.scene,clip=loaded.animations[0],mixer=new AnimationMixer(scene),player=new AvatarPlayback(mixer,[clip],idle);
  for(let t=0;t<phase;t+=1/60)player.update(0,'idle',1/60);
  if(end)player.update(clip.duration,'paused',0);
  const tracks=clip.tracks.map(track=>({name:track.name,property:track.name.split('.').at(-1),node:scene.getObjectByName(track.name.split('.')[0]),times:[],values:[]}));
  for(let k=0;k<=30;k++){
   player.update(end?clip.duration:k/60,end?'idle':'playing',1/60);
   for(const t of tracks){t.times.push(k/60);t.values.push(...t.node[t.property].toArray());}
  }
  const animation=new AnimationClip('idle-transition',.5,tracks.map(t=>new (t.property==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack)(t.name,t.times,t.values)));
  const bytes=await new GLTFExporter().parseAsync(scene,{binary:true,animations:[animation],onlyVisible:false}),id='phrase-'+String(++i).padStart(2,'0');
  await writeFile(output+'/'+id+'.glb',restoreSkin(bytes,original));manifest.push({id,label:asset.label,phase,end});mixer.stopAllAction();mixer.uncacheRoot(scene);
 }
}
const examples=idleQA?[]:process.argv[3]?[process.argv[3]]:phraseGroups.flatMap(group=>group.phrases);
for(const phrase of examples){
 const plan=planMotion(phrase,[...alphabetEntries(),...words],forms,assets),timeline=motionTimeline(plan.steps),clips=[];
 for(const s of plan.steps){if(!cache.has(s.url)){const b=await readFile(new URL('../public'+s.url,import.meta.url));cache.set(s.url,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}clips.push(cache.get(s.url).animations[0]);}
 const composed=composeMotion(clips,undefined,timeline.map(s=>({start:s.trimStart,end:s.trimEnd,gapAfter:s.gapAfter}))),scene=cache.get(plan.steps[0].url).scene;
 const bytes=await new GLTFExporter().parseAsync(scene,{binary:true,animations:[composed],onlyVisible:false});const id='phrase-'+String(++i).padStart(2,'0');await writeFile(output+'/'+id+'.glb',restoreSkin(bytes,await readFile(new URL('../public'+plan.steps[0].url,import.meta.url))));manifest.push({id,phrase,duration:composed.duration});
}
await writeFile(output+'/manifest.json',JSON.stringify(manifest,null,2));console.log('Exported',i,'actual browser-composed phrases to',output);
