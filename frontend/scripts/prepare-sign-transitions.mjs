/** Export captured boundary poses so UI and animation share a speed-bounded transition. */
import { readFile, writeFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { QuaternionLinearInterpolant } from "three";
const root = new URL("../public/avatars/sign-motion/", import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL("catalog.json", root), "utf8"),
);
for (const asset of catalog) {
  const bytes = await readFile(new URL(asset.id + ".glb", root));
  const clip = (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    )
  ).animations[0];
  const start = {},
    end = {};
  for (const track of clip.tracks) {
    if (!track.name.endsWith(".quaternion")) continue;
    const sample = new QuaternionLinearInterpolant(
      track.times,
      track.values,
      4,
    );
    const key=track.name.replace(/^mixamorig[:_]?/, "").replace(/\.quaternion$/, "");
    start[key] = Array.from(sample.evaluate(asset.leadIn ?? 0),v=>Number(v.toFixed(5)));
    end[key] = Array.from(
      sample.evaluate(clip.duration - (asset.leadOut ?? 0)), v=>Number(v.toFixed(5)),
    );
  }
  asset.transitionPose = { start, end };
}
await writeFile(
  new URL("catalog.json", root),
  "[\n"+catalog.map(asset=>JSON.stringify(asset)).join(",\n")+"\n]",
);
console.log(`Prepared boundary poses for ${catalog.length} motions`);
