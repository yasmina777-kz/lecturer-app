import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const urls = new Map();
async function moduleUrl(file) {
  if (urls.has(file.href)) return urls.get(file.href);
  let js = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  for (const match of [...js.matchAll(/from (["'])(\.[^"']+)\1/g)]) {
    const dependency = await moduleUrl(new URL(match[2] + ".ts", file));
    js = js.replace(match[0], `from "${dependency}"`);
  }
  const url =
    "data:text/javascript;base64," + Buffer.from(js).toString("base64");
  urls.set(file.href, url);
  return url;
}
const load = async (path) =>
  import(await moduleUrl(new URL(path, import.meta.url)));
const { learningDictionary, matchesDictionary, normalizeSignText } = await load(
  "../src/sign/dictionary.ts",
);
const { planMotion } = await load("../src/sign/motion.ts");
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const words = await readJson("../public/research/rsl/words/catalog.json");
const motions = await readJson("../public/avatars/sign-motion/catalog.json");
const forms = await readJson("../public/research/rsl/words/forms.json");
const entries = learningDictionary(words, motions);
for (const text of ["Спасибо", "Здравствуйте", "Как тебя зовут?"]) {
  const matches = entries.filter((e) =>
    matchesDictionary(e, `  ${text.toUpperCase()}  `, forms),
  );
  assert.equal(matches.length, 1, `Lesson must be searchable: ${text}`);
  assert.equal(planMotion(text, entries, forms, motions).missing.length, 0);
}
assert.equal(normalizeSignText("  Привет!  "), "привет");
assert.equal(
  entries.find((e) => e.label === "Спасибо").video,
  "",
  "Do not invent a human reference for an authored animation",
);
assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
assert.equal(
  learningDictionary(words, []).some((e) => e.label === "Спасибо"),
  false,
  "Unavailable motion must not be advertised",
);
const incomplete = planMotion(
  "Здравствуйте, меня зовут Анна. Я хочу учиться.",
  entries,
  forms,
  motions,
);
assert.deepEqual(incomplete.missing, ["зовут", "Анна", "учиться"]);
assert.equal(planMotion("Анна", entries, forms, motions, true).steps.length, 4);
console.log(
  "PASS: real catalog includes authored lessons, normalized search, no invented video and no silently skipped words.",
);

const { classifyFeatures, validClassifier } = await load(
  "../src/sign/recognition.ts",
);
const model = () => ({
  labels: ["А", "Б"],
  mean: [0],
  std: [1],
  weights: [[1], [-1]],
  bias: [0, 0],
  threshold: 0.8,
  margin: 0.2,
});
assert.equal(classifyFeatures([4], model()).label, "А");
for (const bad of [
  null,
  {},
  { ...model(), labels: [] },
  { ...model(), labels: ["А", "А"] },
  { ...model(), std: [0] },
  { ...model(), std: [-1] },
  { ...model(), weights: [[1], [1, 2]] },
  { ...model(), bias: [NaN, 0] },
  { ...model(), threshold: -1 },
  { ...model(), margin: Infinity },
  {
    ...model(),
    layers: [{ weights: [[1, 2]], bias: [0], activation: "relu" }],
  },
]) {
  assert.equal(validClassifier(bad), false);
  assert.equal(
    classifyFeatures([4], bad),
    null,
    "Malformed models must fail closed",
  );
}
assert.equal(
  classifyFeatures([Number.MAX_VALUE], { ...model(), std: [Number.MIN_VALUE] }),
  null,
);
const { trackingQuality } = await load("../src/sign/liveRecognition.ts");
const { temporalFrame } = await load("../src/sign/temporal.ts");
for (const landmarks of [[[]], [Array(21).fill({ x: NaN, y: 0.5 })]]) {
  assert.equal(trackingQuality({ landmarks }), "missing");
  assert.deepEqual(temporalFrame({ landmarks }), Array(66).fill(0));
}
console.log(
  "PASS: malformed model dimensions, invalid thresholds, numeric overflow and corrupt landmarks cannot produce letters.",
);

