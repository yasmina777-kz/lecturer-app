// Browser twin check: kslSilhouette.ts must reproduce the Python silhouette +
// CNN probabilities stored in ksl-v1-fixtures.json.
//   node ml/ksl/check_parity.mjs
import { build } from "../../frontend/node_modules/rolldown/dist/index.mjs";
import { readFileSync } from "node:fs";
const out = await build({ input: "frontend/src/sign/kslSilhouette.ts", write: false, output: { format: "esm" } });
const code = out.output[0].code;
const mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const model = mod.unpackKslModel(JSON.parse(readFileSync("frontend/public/models/ksl/ksl-v1.json", "utf8")));
const fx = JSON.parse(readFileSync("frontend/public/models/ksl/ksl-v1-fixtures.json", "utf8"));
let worst = 0;
for (const f of fx) {
  const p = mod.classifySilhouette(model, mod.renderSilhouette(f.points));
  worst = Math.max(worst, ...p.map((v, k) => Math.abs(v - f.probs[k])));
}
console.log(`fixtures ${fx.length}, max |Δp| = ${worst.toExponential(2)}`);
process.exit(worst < 2e-3 ? 0 : 1);
