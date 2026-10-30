import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
let code=ts.transpileModule(await readFile(new URL('../src/sign/volumeSkinning.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText.replace('"three"',JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
const {volumeShader,preserveJointVolume}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const name of ['standard','depth']){
 const original=THREE.ShaderLib[name].vertexShader;
 const output=volumeShader(original);
 assert.ok(original.includes('#include <skinbase_vertex>'));
 assert.ok(output.includes('vec4 mentorReal='));
 assert.ok(output.includes('mentorTranslation='));
 assert.ok(!output.includes('#include <skinning_vertex>'));
 assert.ok(output.indexOf('vec4 mentorReal=')<output.indexOf('mentorTranslation='));
 if(name==='standard')assert.ok(output.includes('objectNormal=(bindMatrixInverse'));
}
const surface=new THREE.MeshStandardMaterial({alphaTest:.3});
const mesh=new THREE.SkinnedMesh(new THREE.BufferGeometry(),surface);
preserveJointVolume(mesh);
assert.equal(mesh.customDepthMaterial.alphaTest,.3);
assert.equal(surface.customProgramCacheKey(),mesh.customDepthMaterial.customProgramCacheKey());
console.log('Volume skinning: surface, normal and shadow shader integration, alpha cutout and matching program keys passed. GPU compilation/appearance is checked in the browser.');
