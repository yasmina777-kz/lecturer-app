import type { Cue } from "../sign/studio";

export const SPEECH_MODELS = [
  { id: "onnx-community/whisper-base", label: "Быстрее", size: "≈80 МБ" },
  { id: "onnx-community/whisper-small", label: "Точнее", size: "≈250 МБ" },
];

export type SpeechProgress =
  | { stage: "decoding" }
  | { stage: "download"; percent: number }
  | { stage: "transcribing" };

/** Any audio or video file → 16 kHz mono samples. */
export async function decodeAudio(blob: Blob): Promise<{ samples: Float32Array; duration: number }> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer()).catch(() => {
      throw new Error("Не удалось прочитать звук в этом файле. Подойдут MP3, WAV, M4A, OGG, WEBM или видео MP4.");
    });
    const samples = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < ch.length; i++) samples[i] += ch[i] / audio.numberOfChannels;
    }
    return { samples, duration: audio.duration };
  } finally {
    void ctx.close();
  }
}

let worker: Worker | null = null;
let nextId = 1;
type Chunk = { text: string; timestamp: [number, number | null] };

/** One request to the speech worker: load `model` (and transcribe `audio` if given). */
function call(model: string, audio: Float32Array | null, onProgress: (p: SpeechProgress) => void): Promise<Chunk[]> {
  worker ??= new Worker(new URL("./speech.worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  const id = nextId++;
  const files = new Map<string, [number, number]>();
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<{ id: number; type: string; data: unknown }>) => {
      if (e.data.id !== id) return;
      const { type, data } = e.data;
      if (type === "download") {
        const d = data as { file: string; loaded: number; total: number };
        files.set(d.file, [d.loaded, d.total]);
        let a = 0,
          b = 0;
        files.forEach(([l, t]) => ((a += l), (b += t)));
        onProgress({ stage: "download", percent: Math.round((a / Math.max(b, 1)) * 100) });
      } else if (type === "stage") onProgress({ stage: "transcribing" });
      else {
        w.removeEventListener("message", onMessage);
        if (type === "done") resolve(data as Chunk[]);
        else reject(new Error(String(data)));
      }
    };
    w.addEventListener("message", onMessage);
    if (audio) w.postMessage({ id, audio, model }, [audio.buffer]);
    else w.postMessage({ id, audio: null, model });
  });
}

const READY_KEY = "rsl-speech-ready-v1";
/** Model already downloaded on this device once (so warming it up is cheap). */
export function speechCached(model: string): boolean {
  try {
    return localStorage.getItem(READY_KEY)?.split(",").includes(model) ?? false;
  } catch {
    return false;
  }
}
function markCached(model: string) {
  try {
    const have = new Set((localStorage.getItem(READY_KEY) ?? "").split(",").filter(Boolean));
    have.add(model);
    localStorage.setItem(READY_KEY, [...have].join(","));
  } catch {
    /* storage unavailable: no warm start next time */
  }
}

const warming = new Map<string, Promise<void>>();
const listeners = new Map<string, Set<(p: SpeechProgress) => void>>();
/** Download / load the model ahead of time (e.g. while the person is still speaking).
 * Every caller gets download progress, also when the download was started earlier. */
export function preloadSpeech(model: string, onProgress: (p: SpeechProgress) => void = () => {}): Promise<void> {
  const set = listeners.get(model) ?? new Set();
  listeners.set(model, set);
  set.add(onProgress);
  let p = warming.get(model);
  if (!p) {
    p = call(model, null, (x) => set.forEach((f) => f(x))).then(() => markCached(model));
    p.catch(() => warming.delete(model));
    warming.set(model, p);
  }
  return p.finally(() => set.delete(onProgress)).catch((e) => {
    throw friendly(e);
  });
}

/** Turn low-level failures into something a learner can act on. */
export function friendly(e: unknown): Error {
  const m = e instanceof Error ? e.message : String(e);
  if (/network|fetch|load|ERR_|timed? ?out|Failed to/i.test(m))
    return new Error(
      "Не удалось скачать модель распознавания (нужен интернет, ≈80 МБ один раз). Проверьте связь и попробуйте ещё раз — или выберите режим «Быстро (Chrome)».",
    );
  return e instanceof Error ? e : new Error(m);
}

/** Speech in a file → subtitle lines with times, computed on this device. */
export async function transcribe(blob: Blob, model: string, onProgress: (p: SpeechProgress) => void): Promise<Cue[]> {
  onProgress({ stage: "decoding" });
  const { samples, duration } = await decodeAudio(blob);
  if (!samples.length) return [];
  await preloadSpeech(model, onProgress);
  const chunks = await call(model, samples, onProgress);
  return chunks
    .map((c, i) => ({
      text: c.text.replace(/\s+/g, " ").trim(),
      start: Math.max(0, c.timestamp[0] ?? 0),
      end: c.timestamp[1] ?? chunks[i + 1]?.timestamp[0] ?? duration,
    }))
    .filter((c) => c.text && !/^[[(].*[\])]$/.test(c.text) && c.end > c.start)
    .flatMap(splitSentences);
}

/** One recognized chunk may hold several sentences: one subtitle line each,
 * with the chunk's time shared out by length. */
function splitSentences(c: Cue & { start: number; end: number }): Cue[] {
  // Sentences first; a long sentence is also cut at commas (short lines read better).
  const parts = c.text
    .split(/(?<=[.!?…])\s+/u)
    .flatMap((p) => (p.split(/\s+/).length > 6 ? p.split(/(?<=[,;:])\s+/u) : [p]))
    .filter(Boolean);
  if (parts.length < 2) return [c];
  const total = parts.reduce((a, p) => a + p.length, 0);
  let t = c.start;
  return parts.map((text) => {
    const d = ((c.end - c.start) * text.length) / total;
    const cue = { text, start: t, end: t + d };
    t += d;
    return cue;
  });
}
