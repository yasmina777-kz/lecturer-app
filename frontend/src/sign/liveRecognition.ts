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
export const LETTER_FAST_CONFIDENCE = 0.85;
// 16 samples plus a two-sample confirmation stride: 1.7 s at target cadence
// (a very confident first window is emitted at 1.5 s).
export const LETTER_SAMPLE_MS = 100;
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
    if (this.frames.length < 16 || this.sincePrediction < 2) return null;
    this.sincePrediction = 0;
    return this.frames.slice();
  }
  confirm(prediction: Prediction): boolean {
    if (!prediction?.accepted || !/^[А-ЯЁ]$/u.test(prediction.label)) {
      this.candidate = "";
      this.votes = 0;
      return false;
    }
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
