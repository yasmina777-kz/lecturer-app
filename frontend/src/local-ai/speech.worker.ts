import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import wasmModuleUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import { env, pipeline } from "@huggingface/transformers";

/** Speech → timed Russian text, fully in the browser. Only the model weights
 * are downloaded (once, then cached); audio never leaves the device. */
env.allowRemoteModels = true;
env.allowLocalModels = false;
env.backends.onnx.wasm!.wasmPaths = {
  wasm: new URL(wasmUrl, self.location.origin).href,
  mjs: new URL(wasmModuleUrl, self.location.origin).href,
};

type Asr = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }>;
const create = pipeline as unknown as (task: string, model: string, options: Record<string, unknown>) => Promise<Asr>;
let asr: Promise<Asr> | null = null;
let loaded = "";

self.onmessage = async (event: MessageEvent<{ id: number; audio: Float32Array | null; model: string }>) => {
  const { id, audio, model } = event.data;
  const send = (type: string, data: unknown) => self.postMessage({ id, type, data });
  try {
    if (!asr || loaded !== model) {
      loaded = model;
      const gpu = "gpu" in navigator && !!(await (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter().catch(() => null));
      asr = create("automatic-speech-recognition", model, {
        device: gpu ? "webgpu" : "wasm",
        dtype: gpu ? { encoder_model: "fp32", decoder_model_merged: "q4" } : { encoder_model: "q8", decoder_model_merged: "q8" },
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === "progress" && p.total) send("download", { file: p.file, loaded: p.loaded, total: p.total });
        },
      }).catch((e) => {
        asr = null;
        throw e;
      });
    }
    const run = await asr;
    if (!audio) {
      // Warm-up only: one tiny pass compiles the model so the first real phrase is fast.
      await run(new Float32Array(16000), { language: "russian", task: "transcribe" });
      send("done", []);
      return;
    }
    send("stage", "transcribing");
    const out = await run(audio, {
      language: "russian",
      task: "transcribe",
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    send("done", out.chunks?.length ? out.chunks : [{ text: out.text, timestamp: [0, null] }]);
  } catch (e) {
    send("error", e instanceof Error ? e.message : String(e));
  }
};
