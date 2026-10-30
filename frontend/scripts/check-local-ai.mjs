import { env, pipeline } from "@huggingface/transformers";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
async function loadTS(file) {
  const src = await readFile(new URL(file, import.meta.url), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
}
const { fractionSources } = await loadTS("../src/local-ai/fractions.ts");
const { rankSources, splitSources } = await loadTS(
  "../src/local-ai/retrieval.ts",
);
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = fileURLToPath(
  new URL("../public/models/", import.meta.url),
);
const model = await pipeline("feature-extraction", "mentor-e5", {
  dtype: "q8",
  device: "cpu",
});
const docs = splitSources(fractionSources);
const embed = async (text) =>
  Array.from((await model(text, { pooling: "mean", normalize: true })).data);
const vectors = [];
for (const d of docs)
  vectors.push(await embed("passage: " + d.title + ". " + d.text));
const cases = [
  ["Почему знаменатели не складывают?", "addition"],
  ["Как сократить дробь?", "reduce"],
  ["Что больше: треть или пятая часть?", null],
  ["Как сравнить дроби с разными знаменателями?", "compare"],
  ["Как разделить на дробь?", "divide"],
  ["Сколько сегодня стоит билет в Париж?", null],
  ["Кто победил в футбольном матче вчера?", null],
  ["Что показывает число под чертой?", "meaning"],
  ["Объясни правило умножения двух дробей", "multiply"],
  ["How do I add fractions with different denominators?", null],
];
const report = [];
for (const [question, expected] of cases) {
  const r = rankSources(await embed("query: " + question), vectors, docs);
  const result = r.source?.id.split(":")[0] ?? null;
  report.push({ question, expected, result, score: r.score });
  console.log(report.at(-1));
}
await writeFile(
  new URL("../../docs/local-ai-evaluation.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
for (const r of report) assert.equal(r.result, r.expected, r.question);
assert.equal(
  splitSources([{ id: "empty", title: "Empty", text: "  " }]).length,
  0,
);
assert.throws(
  () => splitSources([{ id: "large", title: "Long", text: "a".repeat(60000) }]),
  /MATERIAL_TOO_LARGE/,
);
console.log(
  `${report.length} real-model retrieval checks passed, plus empty/oversize input checks.`,
);
