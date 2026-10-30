import {
  mkdir,
  access,
  copyFile,
  readFile,
  writeFile,
  rename,
  readdir,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const revision = "761b726dd34fb83930e26aab4e9ac3899aa1fa78";
const base = `https://huggingface.co/Xenova/multilingual-e5-small/resolve/${revision}/`;
const folder = path.join(root, "public/models/mentor-e5");
for (const file of [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx",
]) {
  const target = path.join(folder, file);
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await access(target);
    continue;
  } catch {}
  console.log("Downloading", file);
  const response = await fetch(base + file);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(target + ".part"),
  );
  await rename(target + ".part", target);
}
await copyFile(
  path.join(root, "scripts/LOCAL_MODEL_LICENSE.txt"),
  path.join(folder, "LICENSE.txt"),
);
await writeFile(
  path.join(folder, "SOURCE.txt"),
  `Model: Xenova/multilingual-e5-small\nRevision: ${revision}\nOriginal: intfloat/multilingual-e5-small (MIT)\nPretrained sentence embeddings, not trained by AI Mentor.\n`,
);
console.log(
  "Local AI model ready; Vite bundles the WASM runtime. No inference API required.",
);
