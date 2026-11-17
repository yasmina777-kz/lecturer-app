import { runSeqModel, type SeqModel } from "./seqModel";
import { clipFeatures, MOTION_GATE, motionExtent, resampleFrames, type HandPoint } from "./wordFeatures";

/** Continuous ("translator") word spotting without pauses between signs.
 * Every HOP_MS the latest WINDOWS_MS of hand landmarks are classified among
 * the course vocabulary; a word is emitted after VOTES consecutive confident
 * hops, only for windows where the wrists actually moved. Twin of
 * ml/rsl/spotting_eval.py + spotting_gate_eval.py (held-out test signers).
 */
export const SPOT = {
  hopMs: 300,
  windowsMs: [800, 1200, 1600],
  threshold: 0.4,
  margin: 0.2,
  votes: 2,
  restMs: 400,
};
type Frame = { at: number; hands: HandPoint[][] };
export type Spotted = { label: string; confidence: number; fingerspelling: boolean };

const LETTER = /^[А-ЯЁ]$/u;

export class WordSpotter {
  private frames: Frame[] = [];
  private lastHop = -Infinity;
  private lastSeen = -Infinity;
  private candidate = "";
  private votes = 0;
  private emitted = "";
  private movingUntil = -Infinity;
  /** Wrists moved like a word sign within the last second (letters are static). */
  moving(now: number) {
    return now < this.movingUntil;
  }
  /** True while a word candidate is being confirmed (used to mute letters). */
  get busy() {
    return this.votes > 0;
  }
  reset() {
    this.frames = [];
    this.candidate = "";
    this.votes = 0;
    this.emitted = "";
    this.lastHop = -Infinity;
  }
  push(model: SeqModel, now: number, hands: HandPoint[][], width: number, height: number): Spotted | null {
    const visible = hands.filter((h) => h.length === 21);
    if (visible.length) this.lastSeen = now;
    else if (now - this.lastSeen >= SPOT.restMs) {
      // Hands at rest: the same word may be signed again afterwards.
      this.frames = [];
      this.candidate = "";
      this.votes = 0;
      this.emitted = "";
      return null;
    }
    this.frames.push({ at: now, hands: visible });
    const keep = now - Math.max(...SPOT.windowsMs) - 100;
    while (this.frames.length && this.frames[0].at < keep) this.frames.shift();
    if (now - this.lastHop < SPOT.hopMs) return null;
    this.lastHop = now;
    const recent = clipFeatures(this.frames.filter((f) => f.at > now - 1000).map((f) => f.hands), width, height);
    if (recent && motionExtent(recent) >= MOTION_GATE) this.movingUntil = now + 1000;
    const course = model.courseLabels?.length ? new Set(model.courseLabels) : null;
    let best: { label: string; p: number; margin: number; letter: boolean } | null = null;
    for (const ms of SPOT.windowsMs) {
      const win = this.frames.filter((f) => f.at > now - ms).map((f) => f.hands);
      const feats = clipFeatures(win, width, height);
      if (!feats || feats.filter((f) => f[65] || f[131]).length < 5) continue;
      if (motionExtent(feats) < MOTION_GATE) continue; // hands resting, not signing
      const p = runSeqModel(model, resampleFrames(feats, model.frames ?? 32));
      if (!p) continue;
      const top = p.indexOf(Math.max(...p));
      const letter = LETTER.test(model.labels[top]); // Slovo also contains alphabet signs
      const ranked = p
        .map((v, i) => ({ label: model.labels[i], v }))
        .filter((r) => !course || course.has(r.label));
      const sum = ranked.reduce((a, r) => a + r.v, 0) || 1;
      ranked.sort((a, b) => b.v - a.v);
      const p1 = ranked[0].v / sum, p2 = (ranked[1]?.v ?? 0) / sum;
      if (!best || p1 > best.p) best = { label: ranked[0].label, p: p1, margin: p1 - p2, letter };
    }
    // The full 1,000-sign model thinks this is an alphabet sign: leave it to
    // the letter recognizer instead of forcing a course word.
    if (!best || best.letter || best.p < SPOT.threshold || best.margin < SPOT.margin) {
      this.candidate = "";
      this.votes = 0;
      return null;
    }
    this.votes = best.label === this.candidate ? this.votes + 1 : 1;
    this.candidate = best.label;
    if (this.votes < SPOT.votes || best.label === this.emitted) return null;
    this.emitted = best.label;
    return { label: best.label, confidence: best.p, fingerspelling: best.letter };
  }
}

/** Translator-style transcript: words separated by spaces, fingerspelled
 * letters joined into one word, first letter capitalized. */
export function appendTranslation(text: string, token: string, kind: "word" | "letter", joinLetter: boolean) {
  let next: string;
  if (kind === "letter" && joinLetter && text && !text.endsWith(" ")) next = text + token;
  else next = (text ? text.replace(/\s+$/u, "") + " " : "") + (kind === "word" ? token.replace(/[!?.]$/u, "") : token);
  next = next.charAt(0).toLocaleUpperCase("ru") + next.slice(1);
  return next.slice(-4000);
}
