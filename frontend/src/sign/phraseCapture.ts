/** A pause is only a capture boundary, never a word/grammar prediction. */
export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};
export type CaptureDecision =
  "waiting" | "signing" | "pause" | "limit" | "empty";
export class PhraseCapture {
  private started = 0;
  private lastMotion = 0;
  private activeFrames = 0;
  private previous: Landmark[] = [];
  private lastSample = 0;
  reset(now: number) {
    this.started = now;
    this.lastMotion = now;
    this.activeFrames = 0;
    this.previous = [];
    this.lastSample = now;
  }
  sample(
    now: number,
    hands: Landmark[][],
    pose: Landmark[] = [],
  ): CaptureDecision {
    // Compare corresponding anatomical hand slots, preserving finger movement.
    const points = hands
      .flatMap((h) =>
        h.length === 21
          ? h
          : Array.from({ length: 21 }, () => ({ x: 0, y: 0 })),
      )
      .concat(
        [11, 12, 13, 14, 15, 16].map((i) =>
          pose[i] && (pose[i].visibility ?? 0) > 0.6 ? pose[i] : { x: 0, y: 0 },
        ),
      );
    const visible = points.some((p) => p.x !== 0 || p.y !== 0);
    const validGap = now - this.lastSample < 700;
    let movement = 0;
    if (validGap && points.length === this.previous.length) {
      const distances = points
        .map((p, i) => {
          const q = this.previous[i];
          return (p.x || p.y) && (q.x || q.y)
            ? Math.hypot(p.x - q.x, p.y - q.y)
            : 0;
        })
        .sort((a, b) => b - a);
      movement = distances.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    }
    if (visible && movement > 0.009) {
      this.lastMotion = now;
      this.activeFrames++;
    }
    this.previous = points;
    this.lastSample = now;
    const age = now - this.started;
    if (age >= 12000) return this.activeFrames ? "limit" : "empty";
    if (!this.activeFrames) return "waiting";
    // Never cut a continuing phrase at a fixed four-second boundary.
    if (age >= 2400 && now - this.lastMotion >= 1300) return "pause";
    return "signing";
  }
}

/** Agreement reduces accepted coverage; it is not a correctness guarantee. */
export function agreeLetters<T extends { accepted: boolean; label: string }>(
  primary: T | null,
  verifier: T | null,
): T | null {
  return primary
    ? {
        ...primary,
        accepted: !!(
          primary.accepted &&
          verifier?.accepted &&
          primary.label === verifier.label
        ),
      }
    : null;
}
