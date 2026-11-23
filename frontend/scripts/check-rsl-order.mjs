import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const load = async (f, map = {}) => {
  let js = ts.transpileModule(await readFile(new URL(f, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  for (const [k, v] of Object.entries(map)) js = js.replace(`from "${k}"`, `from "${v}"`);
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
};
const dict = await load("../src/sign/dictionary.ts");
const { rslRewrite, toRslOrder } = await load("../src/sign/rslOrder.ts");
const words = JSON.parse(await readFile(new URL("../public/research/rsl/words/catalog.json", import.meta.url), "utf8"));
const forms = JSON.parse(await readFile(new URL("../public/research/rsl/words/forms.json", import.meta.url), "utf8"));
const entries = [...dict.alphabetEntries(), ...words];
const gloss = (t) => {
  const { pieces, dropped } = toRslOrder(dict.decomposeText(rslRewrite(t), entries, forms));
  return { g: pieces.filter((p) => !p.punctuation).map((p) => p.text.toLocaleLowerCase("ru")).join(" "), dropped, pieces };
};
const cases = [
  ["Как тебя зовут?", "ты имя кто"],
  ["Меня зовут Амина.", "я имя амина"],
  ["Я завтра пойду в школу", "завтра я пойду школу"],
  ["Где ты живёшь?", "ты живёшь где"],
  ["Что это?", "это что"],
  ["Я не понимаю", "я не понимаю"],
];
for (const [t, want] of cases) { const r = gloss(t); console.log(t, "→", r.g.toUpperCase(), r.dropped); assert.equal(r.g, want, t); }
assert.ok(gloss("Я живу в Москве").dropped.includes("в"), "preposition is not shown as letter В");
assert.ok(gloss("Как тебя зовут?").pieces.find((p) => p.text === "кто")?.entry, "кто → кто? sign");
console.log("rsl order checks passed");
