import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
const code = ts.transpileModule(await readFile(new URL('../src/sign/motionFraming.ts',import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText.replace("'three'",JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const {fitSigningFrame}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
// Raised and widely separated hands must fit on phone and desktop in every offered view.
const bounds=new THREE.Box3(new THREE.Vector3(-.65,1.05,-.45),new THREE.Vector3(.61,1.91,.3));
for(const aspect of [.55,1,1.8]) for(const theta of [0,Math.PI*.18,Math.PI*.43]) {
 const {target,radius}=fitSigningFrame(bounds,aspect,theta);
 const camera=new THREE.PerspectiveCamera(32,aspect,.02,20);
 camera.position.copy(target).add(new THREE.Vector3(Math.sin(theta)*radius,0,Math.cos(theta)*radius));
 camera.lookAt(target);camera.updateMatrixWorld(true);
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
  const ndc=new THREE.Vector3(x,y,z).project(camera);
  assert.ok(Math.abs(ndc.x)<1 && Math.abs(ndc.y)<1,'hand bounds clipped');
 }
}
console.log('Signing frame: raised hands fit all 3 views at phone, square and desktop aspects');
