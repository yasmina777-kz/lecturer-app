import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
async function module(path, replace={}) {
 let code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
 for(const [from,to] of Object.entries(replace)) code=code.replaceAll(JSON.stringify(from),JSON.stringify(to));
 return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const cache=await module('../src/sign/motionCache.ts');
const {cloneAvatar}=await import(await module('../src/sign/avatarModel.ts',{
 'three':new URL('../node_modules/three/build/three.module.js',import.meta.url).href,
 'three/addons/loaders/GLTFLoader.js':new URL('../node_modules/three/examples/jsm/loaders/GLTFLoader.js',import.meta.url).href,
 'three/addons/utils/SkeletonUtils.js':new URL('../node_modules/three/examples/jsm/utils/SkeletonUtils.js',import.meta.url).href,
 './motionCache':cache,
}));
const source=new THREE.Group(),bone=new THREE.Bone();
const mesh=new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:new THREE.Texture()}));
mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));source.add(mesh);
const a=cloneAvatar(source).children[0],b=cloneAvatar(source).children[0];
assert.notEqual(a.skeleton,b.skeleton);assert.notEqual(a.skeleton.bones[0],bone);
a.skeleton.bones[0].rotation.x=1;assert.equal(Math.abs(b.skeleton.bones[0].rotation.x),0);assert.equal(bone.rotation.x,0);
assert.notEqual(a.geometry,b.geometry);assert.notEqual(a.material,b.material);
assert.notEqual(a.material.map,b.material.map);assert.equal(a.material.map.userData.sharedAvatarImage,true);
a.material.color.set('red');assert.notEqual(a.material.color.getHex(),b.material.color.getHex());
console.log('Cached avatar: independent bones, geometry, material and texture ownership passed.');
