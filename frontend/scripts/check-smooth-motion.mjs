// Main-avatar smoothing: jitter reduced, bounded correction, endpoints/timing/source preserved.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
const code = ts.transpileModule(await readFile(new URL('../src/sign/smoothSignMotion.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText.replace('"three"', JSON.stringify(new URL('../node_modules/three/build/three.module.js', import.meta.url).href));
const { smoothSignMotion } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const dir = new URL('../public/avatars/sign-motion/', import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith('.glb'));
let jitterBefore = 0, jitterAfter = 0, maxDeg = 0;
const limitFor = (name) => /Hand(?:Thumb|Index|Middle|Ring|Pinky)\d/.test(name) ? 1.5 : /Hand\.quaternion$/.test(name) ? 2.5 : /(?:Shoulder|Arm|ForeArm)\.quaternion$/.test(name) ? 3.5 : /(?:Spine\d?|Neck|Head)\.quaternion$/.test(name) ? 2 : 0;
for (const f of files) {
  const bytes = await readFile(new URL(f, dir));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const src = gltf.animations[0]; if (!src) continue;
  const snapshot = src.tracks.map((t) => Array.from(t.values));
  const out = smoothSignMotion(src);
  src.tracks.forEach((t, i) => assert.deepEqual(Array.from(t.values), snapshot[i], 'source untouched'));
  out.tracks.forEach((b, k) => {
    const a = src.tracks[k];
    assert.deepEqual(b.times, a.times, 'timing');
    if (!(a instanceof THREE.QuaternionKeyframeTrack)) return assert.deepEqual(b.values, a.values);
    const lim = limitFor(a.name);
    const qa = (arr, i) => new THREE.Quaternion().fromArray(arr, i * 4).normalize();
    const n = a.times.length;
    for (let i = 0; i < n; i++) {
      const d = THREE.MathUtils.radToDeg(qa(a.values, i).angleTo(qa(b.values, i)));
      maxDeg = Math.max(maxDeg, d);
      assert.ok(d <= lim + 1e-3, `${a.name} correction ${d.toFixed(2)} > ${lim}`);
      if (i < 2 || i >= n - 2) assert.ok(d < 1e-4, 'endpoints kept');
      if (i > 0 && i < n - 1 && lim) {
        const acc = (arr) => qa(arr, i - 1).angleTo(qa(arr, i)) + qa(arr, i).angleTo(qa(arr, i + 1)) - qa(arr, i - 1).angleTo(qa(arr, i + 1));
        jitterBefore += acc(a.values); jitterAfter += acc(b.values);
      }
    }
  });
}
assert.ok(jitterAfter < jitterBefore * 0.8, `jitter must drop (${jitterBefore.toFixed(2)} -> ${jitterAfter.toFixed(2)})`);
console.log(`PASS: ${files.length} clips smoothed; zig-zag jitter ${jitterBefore.toFixed(1)} -> ${jitterAfter.toFixed(1)} rad (-${(100 * (1 - jitterAfter / jitterBefore)).toFixed(0)}%); max correction ${maxDeg.toFixed(2)} deg; timing, endpoints, source kept.`);
