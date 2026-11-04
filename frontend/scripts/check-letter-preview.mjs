import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { AnimationMixer, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const read = async (p) =>
  JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
async function source(p, replacements = {}) {
  let code = ts.transpileModule(
    await readFile(new URL(p, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  for (const [a, b] of Object.entries(replacements))
    code = code.replaceAll(a, JSON.stringify(b));
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const dictionary = await source("../src/sign/dictionary.ts"),
  text = await source("../src/sign/textPlan.ts");
const motion = await source("../src/sign/motion.ts", {
  '"./dictionary"': dictionary,
  '"./textPlan"': text,
});
const {
  planMotion,
  motionTimeline,
  transitionDuration,
  TRANSITION_SPEED_DEGREES,
  referenceTime,
} = await import(motion);
const { alphabetEntries } = await import(dictionary);

const { letterPreviewTime, letterEndTime } = await import(
  await source("../src/sign/letterPreview.ts")
);
const assets = await read("../public/avatars/sign-motion/catalog.json");
const letters = alphabetEntries();
assert.equal(letters.length, 33);
for (const entry of letters) {
  const plan = planMotion(entry.label, letters, {}, assets);
  assert.deepEqual(plan.missing, []);
  assert.equal(plan.steps.length, 1);
  const asset = plan.steps[0],
    preview = letterPreviewTime(asset);
  assert.ok(
    preview > (asset.leadIn ?? 0) &&
      preview < asset.duration - (asset.leadOut ?? 0),
    asset.label + " preview must show the sign, not rest",
  );
  const bytes = await readFile(
    new URL("../public" + asset.url, import.meta.url),
  );
  const loaded = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const clip = loaded.animations[0];
  assert.ok(
    Math.abs(clip.duration - asset.duration) < 0.02,
    asset.label + " timing mismatch",
  );
  const mixer = new AnimationMixer(loaded.scene);
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  const hands = ["Right", "Left"].map((side) =>
    loaded.scene.getObjectByName("mixamorig" + side + "Hand"),
  );
  assert.ok(hands.every(Boolean), asset.label + " missing hand bones");
  const rest = hands.map((hand) => hand.getWorldPosition(new Vector3()));
  mixer.setTime(preview);
  assert.ok(
    hands.some(
      (hand, i) =>
        hand.getWorldPosition(new Vector3()).distanceTo(rest[i]) > 0.08,
    ),
    asset.label + " preview has no visible hand movement",
  );
  const end = letterEndTime(asset);
  assert.ok(
    end >= preview && end < asset.duration,
    asset.label + " should stop before the neutral release",
  );
  mixer.setTime(end);
  assert.ok(
    hands.some(
      (hand, i) =>
        hand.getWorldPosition(new Vector3()).distanceTo(rest[i]) > 0.08,
    ),
    asset.label + " completion drops the hand instead of holding the sign",
  );
  mixer.stopAllAction();
  mixer.uncacheRoot(loaded.scene);
}
console.log(
  "PASS: all 33 letters resolve to playable clips with visible hand poses inside their active motion, including Б Е Ж И Й К. This checks playback, not linguistic correctness.",
);
