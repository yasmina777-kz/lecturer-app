import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { QuaternionLinearInterpolant } from "three";
const root = new URL("../public/avatars/hand-workshop/", import.meta.url);
const load = async (file) => {
  const b = await readFile(new URL(file, root));
  const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  return { b, j };
};
const base = await load("mira-rig.glb");
assert.ok(base.j.skins?.length);
assert.ok(!base.j.animations?.length);
assert.ok(
  base.j.nodes.every((n) => !n.name?.startsWith("CTRL_")),
  "Controller leaked into game asset",
);
const names = new Set(base.j.nodes.map((n) => n.name));
const old = await readFile(
  new URL("../public/avatars/mira-blender/letter-a.glb", import.meta.url),
);
const oldJson = JSON.parse(old.subarray(20, 20 + old.readUInt32LE(12)));
for (const n of oldJson.nodes.filter((n) => n.name?.startsWith("mixamorig"))) {
  const current = base.j.nodes.find((b) => b.name === n.name);
  assert.ok(current, n.name);
  for (const key of ["translation", "rotation", "scale"])
    if (n[key])
      assert.ok(
        n[key].every(
          (v, i) =>
            Math.abs(
              v -
                (current[key] ??
                  (key === "rotation"
                    ? [0, 0, 0, 1]
                    : key === "scale"
                      ? [1, 1, 1]
                      : [0, 0, 0]))[i],
            ) < 0.00001,
        ),
        "Changed bind pose " + n.name,
      );
}
for (const slug of ["fist", "point", "pinch", "wave", "grasp"]) {
  const { b, j } = await load(slug + ".glb"),
    m = JSON.parse(await readFile(new URL(slug + ".json", root), "utf8"));
  assert.equal(
    m.revision,
    createHash("sha256").update(b).digest("hex").slice(0, 12),
  );
  assert.equal(j.meshes?.length ?? 0, 0);
  for (const c of j.animations[0].channels)
    assert.ok(names.has(j.nodes[c.target.node].name));
  const {
    animations: [clip],
  } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
  assert.ok(Math.abs(clip.duration - m.duration) < 0.002);
  for (const t of clip.tracks) {
    assert.ok(Array.from(t.values).every(Number.isFinite));
    assert.ok(Array.from(t.times).every((v, i) => !i || v > t.times[i - 1]));
    if (t.name.endsWith(".scale"))
      assert.ok(t.values.every((v) => Math.abs(v - 1) < 0.001));
    if (/Hand(?:Index|Middle|Ring|Pinky|Thumb)[123]\.position/.test(t.name))
      assert.ok(
        t.values.every((v, i) => Math.abs(v - t.values[i % 3]) < 0.00001),
      );
    if (t.name.endsWith(".quaternion")) {
      const sample = new QuaternionLinearInterpolant(t.times, t.values, 4);
      let last = Array.from(sample.evaluate(0));
      for (let i = 1; i <= Math.floor(clip.duration * 60); i++) {
        const q = Array.from(sample.evaluate(i / 60));
        const dot =
          Math.abs(q.reduce((s, v, k) => s + v * last[k], 0)) /
          (Math.hypot(...q) * Math.hypot(...last));
        assert.ok(
          ((2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI) * 60 < 242,
          slug + " " + t.name + " rotation spike",
        );
        last = q;
      }
    }
  }
}
const grasp = await load("grasp-scene.glb");
assert.ok(grasp.j.nodes.some((n) => n.name?.includes("grasp sphere")));
assert.ok(grasp.j.skins?.length);
assert.ok(grasp.j.animations?.length);
const report = JSON.parse(
  await readFile(new URL("validation.json", root), "utf8"),
);
assert.equal(report.weights.crossFingerDistalAfter, 0);
assert.ok(report.weights.crossFingerDistalBefore > 0);
for (const c of Object.values(report.controls)) {
  assert.ok(c.ikTargetErrorMeters < 0.002);
  assert.ok(c.fkRotationErrorDegrees < 0.1);
}
assert.ok((report.graspSkinContact.worstPenetrationMeters ?? 0) > -0.001);
assert.ok(
  Object.values(report.graspSkinContact.hold).every((g) => g >= 0 && g < 0.002),
);
console.log(
  "Hand workshop: unchanged bind skeleton, 5 controller-free clips, smooth baked curves, fixed finger offsets, working IK/FK, isolated weights and evaluated skin contact passed.",
);
