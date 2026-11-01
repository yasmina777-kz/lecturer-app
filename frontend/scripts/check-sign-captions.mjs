import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../src/sign/captions.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { appendRecognizedLetter, releaseGate } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
assert.equal(
  appendRecognizedLetter("МА", { accepted: true, label: "М" }),
  "МАМ",
);
assert.equal(
  appendRecognizedLetter("А", { accepted: true, label: "А" }),
  "АА",
  "deliberate repeated letters must remain possible",
);
for (const prediction of [
  null,
  { accepted: false, label: "А" },
  { accepted: true, label: "no_event" },
  { accepted: true, label: "hello" },
  { accepted: true, label: "AB" },
])
  assert.equal(appendRecognizedLetter("МА", prediction), "МА");
assert.equal(appendRecognizedLetter("", { accepted: true, label: "Ё" }), "Ё");
assert.equal(
  appendRecognizedLetter("А".repeat(2000), { accepted: true, label: "Б" })
    .length,
  2000,
);
let empty = 0;
for (let i = 0; i < 4; i++) {
  const next = releaseGate(empty, false);
  empty = next.emptyFrames;
  assert.equal(next.released, false);
}
assert.equal(releaseGate(empty, false).released, true);
assert.deepEqual(
  releaseGate(empty, true),
  { emptyFrames: 0, released: false },
  "a visible hand interrupts a short release",
);
console.log(
  "Captions: rejected/no-event/invalid predictions excluded; accepted and repeated Cyrillic letters preserved; capacity and release gating passed.",
);
