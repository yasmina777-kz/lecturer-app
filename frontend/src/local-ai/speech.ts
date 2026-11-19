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
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
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

/** Speech in a file → subtitle lines with times, computed on this device. */
export async function transcribe(blob: Blob, model: string, onProgress: (p: SpeechProgress) => void): Promise<Cue[]> {
  onProgress({ stage: "decoding" });
  const { samples, duration } = await decodeAudio(blob);
  if (!samples.length) return [];
  worker ??= new Worker(new URL("./speech.worker.ts", import.meta.url), { type: "module" });
  const id = nextId++;
  const files = new Map<string, [number, number]>();
  const chunks = await new Promise<{ text: string; timestamp: [number, number | null] }[]>((resolve, reject) => {
    const w = worker!;
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
        if (type === "done") resolve(data as never);
        else reject(new Error(String(data)));
      }
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, audio: samples, model }, [samples.buffer]);
  });
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
