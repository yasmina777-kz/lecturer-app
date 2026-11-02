import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { TemporalFrame } from "./temporal";

export type TrackingQuality = "ready" | "missing" | "clipped" | "distant";
/** Quality checks apply to the same largest hand used by temporalFrame. */
export function trackingQuality(result: HandLandmarkerResult): TrackingQuality {
  if (!result.landmarks.length) return "missing";
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
type Prediction = { accepted: boolean; label: string } | null;
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
  reset() {
    this.frames = [];
    this.sampledAt = -Infinity;
    this.seenAt = -Infinity;
    this.missingSince = null;
    this.sincePrediction = 0;
    this.candidate = "";
    this.votes = 0;
    this.emitted = "";
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
      this.frames = [];
      this.sincePrediction = 0;
      this.candidate = "";
      this.votes = 0;
      if (quality === "missing") {
        this.missingSince ??= now;
        if (now - this.missingSince >= 600) this.emitted = "";
      } else this.missingSince = null;
      return null;
    }
    this.missingSince = null;
    if (now - this.sampledAt < 150) return null;
    this.sampledAt = now;
    this.frames.push(frame);
    if (this.frames.length > 16) this.frames.shift();
    this.sincePrediction++;
    if (this.frames.length < 16 || this.sincePrediction < 4) return null;
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
    if (this.votes < 2 || this.emitted === prediction.label) return false;
    this.emitted = prediction.label;
    return true;
  }
  get progress() {
    return Math.min(100, Math.round((this.frames.length / 16) * 100));
  }
}
