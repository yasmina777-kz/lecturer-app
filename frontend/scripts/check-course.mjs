// Every sign used by phrase lessons and grammar must exist in the word
// catalog with a real video, so no lesson shows an empty player.
import { readFileSync, existsSync } from "node:fs";
const cat = JSON.parse(readFileSync("public/research/rsl/words/catalog.json", "utf8"));
const byLabel = new Map(cat.map((e) => [e.label, e]));
const src = readFileSync("src/sign/course.ts", "utf8") + readFileSync("src/sign/courseUnits.ts", "utf8").replace(/words: \[/g, "signs: [");
const signs = new Set();
for (const m of src.matchAll(/(?:signs|answer): \[([^\]]*)\]/g)) for (const q of m[1].matchAll(/"([^"]+)"/g)) signs.add(q[1]);
for (const m of src.matchAll(/also: \[\[([^\]]*)\]/g)) for (const q of m[1].matchAll(/"([^"]+)"/g)) signs.add(q[1]);
const bad = [];
for (const s of signs) {
  const e = byLabel.get(s);
  const file = e && "public" + (e.displayVideo ?? e.video).split("?")[0];
  if (!e || !existsSync(file)) bad.push(s);
}
const phrases = (src.match(/\{ ru: "/g) ?? []).length;
if (bad.length) {
  console.error("missing signs:", bad);
  process.exit(1);
}
if (signs.size < 50 || phrases < 40) throw new Error(`course too small: ${signs.size} signs, ${phrases} items`);
console.log(`course ok: ${signs.size} signs, ${phrases} phrase items`);
