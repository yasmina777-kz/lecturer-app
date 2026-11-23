import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { TemporalFrame } from "./temporal";

export type TrackingQuality = "ready" | "missing" | "clipped" | "distant";
/** Quality checks apply to the same largest hand used by temporalFrame. */
export function trackingQuality(result: HandLandmarkerResult): TrackingQuality {
  if (
    !result.landmarks.length ||
    result.landmarks.some(
      (points) =>
        points.length !== 21 ||
        points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)),
    )
  )
    return "missing";
  const bounds = result.landmarks
    .map((points) => ({
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minY: Math.min(...points.map((p) => p.y)),
      maxY: Math.max(...points.map((p) => p.y)),
    }))
    .sort(
      (a, b) =>
        (b.maxX - b.minX) * (b.maxY - b.minY) -
        (a.maxX - a.minX) * (a.maxY - a.minY),
    );
  const b = bounds[0];
  if (b.minX < 0.015 || b.maxX > 0.985 || b.minY < 0.015 || b.maxY > 0.985)
    return "clipped";
  if (Math.max(b.maxX - b.minX, b.maxY - b.minY) < 0.13) return "distant";
  return "ready";
}
type Prediction = { accepted: boolean; label: string; confidence?: number } | null;
/** A single window this confident is emitted without waiting for a second
 * one (v5 replay: <1% wrong among such emissions). */
// Held-out Bukva replay (letter_stream_eval.py, 594 clips): one window at
// ≥0.7 shows 50.7% of letters with 2.0% of shown letters wrong, vs 26.8% and
// 2.5% for two agreeing windows — so a confident single window decides.
export const LETTER_FAST_CONFIDENCE = 0.7;
// 16 samples plus a two-sample confirmation stride: 1.7 s at target cadence
// (a very confident first window is emitted at 1.5 s).
export const LETTER_SAMPLE_MS = 100;
/** Earliest window (1.0 s) and the confidence it must reach on its own. */
export const EARLY_FRAMES = 10;
// Same replay, first 1.0 s stretched: at ≥0.85, 51 of 594 letters decided, none wrong.
export const LETTER_EARLY_CONFIDENCE = 0.85;
/** Streaming windows preserve the trained 16-frame feature format.
 * Two agreeing windows are a debounce, not a calibrated accuracy estimate.
 */
export class LiveLetterStream {
  private frames: TemporalFrame[] = [];
  private sampledAt = -Infinity;
  private seenAt = -Infinity;
  private missingSince: number | null = null;
  private sincePrediction = 0;
  private candidate = "";
  private votes = 0;
  private emitted = "";
  /** Agreeing windows needed before a letter is shown (set by the model). */
  agree = 2;
  /** The last window was stretched from fewer than 16 samples. */
  private early = false;
  reset(preserveEmitted = false) {
    this.frames = [];
    this.sampledAt = -Infinity;
    this.seenAt = -Infinity;
    this.missingSince = null;
    this.sincePrediction = 0;
    this.candidate = "";
    this.votes = 0;
    if (!preserveEmitted) this.emitted = "";
  }
  sample(
    frame: TemporalFrame,
    now: number,
    quality: TrackingQuality,
  ): TemporalFrame[] | null {
    if (now - this.seenAt > 600) {
      this.frames = [];
      this.candidate = "";
      this.votes = 0;
      this.sincePrediction = 0;
    }
    this.seenAt = now;
    if (quality !== "ready" || !frame[65]) {
      this.candidate = "";
      this.votes = 0;
      if (quality === "missing") {
        this.missingSince ??= now;
        if (now - this.missingSince >= 600) this.emitted = "";
        // Training interpolates brief landmark gaps. Preserve up to 300 ms
        // of occlusion instead of restarting a moving letter on every miss.
        // Never classify or emit while the hand itself is missing.
        if (now - this.missingSince <= 300) {
          if (now - this.sampledAt >= LETTER_SAMPLE_MS) {
            this.sampledAt = now;
            this.frames.push(Array(frame.length).fill(0));
            if (this.frames.length > 16) this.frames.shift();
            this.sincePrediction++;
          }
          return null;
        }
      } else this.missingSince = null;
      this.frames = [];
      this.sincePrediction = 0;
      return null;
    }
    if (this.missingSince !== null && now - this.missingSince > 300) {
      this.frames = [];
      this.sincePrediction = 0;
    }
    this.missingSince = null;
    if (now - this.sampledAt < LETTER_SAMPLE_MS) return null;
    this.sampledAt = now;
    this.frames.push(frame);
    if (this.frames.length > 16) this.frames.shift();
    this.sincePrediction++;
    if (this.sincePrediction < 2) return null;
    // From 1 s on, try a window stretched from what we have: a held letter
    // looks the same over 1.0 s and 1.6 s. Only a very confident early
    // answer is accepted (confirm); otherwise the full window decides.
    if (this.frames.length < EARLY_FRAMES) return null;
    this.sincePrediction = 0;
    this.early = this.frames.length < 16;
    if (!this.early) return this.frames.slice();
    const n = this.frames.length;
    return Array.from({ length: 16 }, (_, i) => this.frames[Math.round((i * (n - 1)) / 15)].slice());
  }
  confirm(prediction: Prediction): boolean {
    if (!prediction?.accepted || !/^[А-ЯЁ]$/u.test(prediction.label)) {
      this.candidate = "";
      this.votes = 0;
      return false;
    }
    // A stretched early window either decides on its own or does not count.
    if (this.early && (prediction.confidence ?? 0) < LETTER_EARLY_CONFIDENCE) return false;
    if (this.candidate === prediction.label) this.votes++;
    else {
      this.candidate = prediction.label;
      this.votes = 1;
    }
    const fast = (prediction.confidence ?? 0) >= LETTER_FAST_CONFIDENCE;
    if ((this.votes < this.agree && !fast) || this.emitted === prediction.label) return false;
    this.emitted = prediction.label;
    return true;
  }
  /** Explicit capture already appended this letter; holding it is not a repeat. */
  acknowledge(label: string) {
    this.reset();
    if (/^[А-ЯЁ]$/u.test(label)) this.emitted = label;
  }
  get progress() {
    return Math.min(100, Math.round((this.frames.length / 16) * 100));
  }
}
