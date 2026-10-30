import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import wasmModuleUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";
import { rankSources, splitSources, type StudySource } from "./retrieval";
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";
env.backends.onnx.wasm!.wasmPaths = {
  wasm: new URL(wasmUrl, self.location.origin).href,
  mjs: new URL(wasmModuleUrl, self.location.origin).href,
};
env.backends.onnx.wasm!.numThreads = 1;
const createExtractor = pipeline as unknown as (
  task: "feature-extraction",
  model: string,
  options: Record<string, unknown>,
) => Promise<FeatureExtractionPipeline>;
let extractor: Promise<FeatureExtractionPipeline> | undefined;
let cachedKey = "";
let sources: StudySource[] = [];
let vectors: number[][] = [];
async function embed(text: string): Promise<number[]> {
  const model = await extractor!;
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
let queue = Promise.resolve();
self.onmessage = (
  event: MessageEvent<{ id: number; question: string; sources: StudySource[] }>,
) => {
  const task = event.data;
  queue = queue.then(async () => {
    const send = (type: string, data: unknown) =>
      self.postMessage({ id: task.id, type, data });
    try {
      send("progress", { stage: "loading" });
      if (!extractor)
        extractor = createExtractor("feature-extraction", "mentor-e5", {
          device: "wasm",
          dtype: "q8",
        });
      try {
        await extractor;
      } catch (error) {
        extractor = undefined;
        throw error;
      }
      const key = JSON.stringify(task.sources);
      if (key !== cachedKey) {
        const next = splitSources(task.sources);
        const nextVectors: number[][] = [];
        if (!next.length) throw new Error("EMPTY_MATERIAL");
        for (let i = 0; i < next.length; i++) {
          send("progress", {
            stage: "indexing",
            completed: i,
            total: next.length,
          });
          nextVectors.push(
            await embed(`passage: ${next[i].title}. ${next[i].text}`),
          );
        }
        sources = next;
        vectors = nextVectors;
        cachedKey = key;
      }
      send("progress", { stage: "searching" });
      send(
        "answer",
        rankSources(await embed(`query: ${task.question}`), vectors, sources),
      );
    } catch (error) {
      send("error", error instanceof Error ? error.message : String(error));
    }
  });
};
