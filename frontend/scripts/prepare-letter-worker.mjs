// MediaPipe's UMD WASM loader requires a classic worker (importScripts).
// Bundle our TypeScript + installed MediaPipe, while keeping model files local.
import { build } from "rolldown";
import { fileURLToPath } from "node:url";
await build({
  input: fileURLToPath(
    new URL("../src/sign/letterCamera.worker.ts", import.meta.url),
  ),
  output: {
    file: fileURLToPath(
      new URL("../public/models/rsl/letter-camera-worker.js", import.meta.url),
    ),
    format: "iife",
    minify: true,
  },
});
