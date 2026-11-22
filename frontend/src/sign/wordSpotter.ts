import { runSeqModel, type SeqModel } from "./seqModel";
import { clipFeatures, modelFeatures, MOTION_GATE, motionExtent, resampleFrames, type HandPoint, type PosePoint } from "./wordFeatures";

/** Continuous ("translator") word spotting without pauses between signs.
 * Every HOP_MS the latest WINDOWS_MS of hand landmarks are classified among
 * the course vocabulary; a word is emitted after VOTES consecutive confident
 * hops, only for windows where the wrists actually moved. Twin of
 * ml/rsl/spotting_eval.py + spotting_gate_eval.py + spotting_v3_eval.py
 * (held-out test signers; v3 with a trained "no sign" class).
 */
export const SPOT = {
  hopMs: 300,
  windowsMs: [800, 1200, 1600],
  threshold: 0.4,
  margin: 0.2,
  votes: 2,
  restMs: 400,
  /** Skip a window only when the model is this sure it is not a sign. The
   * v4 "no sign" class also fires on half-finished real signs, so a plain
   * argmax test throws away too many words. */
  noneMax: 0.7,
};
type Frame = { at: number; hands: HandPoint[][]; pose: PosePoint[]; face: number[] | null };
export type Spotted = { label: string; confidence: number; fingerspelling: boolean; alternatives: string[] };

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
  /** model: the fast single model scanned every hop; confirm: optional
   * ensemble members that must agree before a word is emitted. */
  push(model: SeqModel, now: number, hands: HandPoint[][], width: number, height: number, confirm: SeqModel[] = [], pose: PosePoint[] = [], face: number[] | null = null): Spotted | null {
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
    this.frames.push({ at: now, hands: visible, pose, face });
    const keep = now - Math.max(...SPOT.windowsMs) - 100;
    while (this.frames.length && this.frames[0].at < keep) this.frames.shift();
    if (now - this.lastHop < SPOT.hopMs) return null;
    this.lastHop = now;
    const recent = clipFeatures(this.frames.filter((f) => f.at > now - 1000).map((f) => f.hands), width, height);
    if (recent && motionExtent(recent) >= MOTION_GATE) this.movingUntil = now + 1000;
    const course = model.courseLabels?.length ? new Set(model.courseLabels) : null;
    let best: { label: string; p: number; margin: number; letter: boolean; window: number[][]; alts: string[] } | null = null;
    for (const ms of SPOT.windowsMs) {
      const recentFrames = this.frames.filter((f) => f.at > now - ms);
      const feats = modelFeatures(model, recentFrames.map((f) => f.hands), width, height, recentFrames.map((f) => f.pose), recentFrames.map((f) => f.face));
      if (!feats || feats.filter((f) => f[65] || f[131]).length < 5) continue;
      if (motionExtent(feats) < MOTION_GATE) continue; // hands resting, not signing
      const p = runSeqModel(model, resampleFrames(feats, model.frames ?? 32));
      if (!p) continue;
      const none = model.labels.indexOf("__none__");
      if (none >= 0 && p[none] >= SPOT.noneMax) continue; // rest, half sign or transition
      const top = p.reduce((b, v, i) => (i !== none && v > p[b] ? i : b), none === 0 ? 1 : 0);
      const letter = LETTER.test(model.labels[top]); // Slovo also contains alphabet signs
      const ranked = p
        .map((v, i) => ({ label: model.labels[i], v }))
        .filter((r) => r.label !== "__none__" && (!course || course.has(r.label)));
      const sum = ranked.reduce((a, r) => a + r.v, 0) || 1;
      ranked.sort((a, b) => b.v - a.v);
      const p1 = ranked[0].v / sum, p2 = (ranked[1]?.v ?? 0) / sum;
      if (!best || p1 > best.p) best = { label: ranked[0].label, p: p1, margin: p1 - p2, letter, window: resampleFrames(feats, model.frames ?? 32), alts: ranked.slice(1, 4).map((r) => r.label) };
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
    if (confirm.length) {
      // Ensemble check on the winning window: all members averaged must agree.
      const outs = confirm.map((m) => runSeqModel(m, best!.window)).filter((o): o is number[] => !!o);
      if (outs.length) {
        const avg = outs[0].map((_, i) => outs.reduce((a, o) => a + o[i], 0) / outs.length);
        const allowed = course ?? new Set(model.labels);
        let topLabel = "", topP = -1;
        avg.forEach((v, i) => {
          const l = model.labels[i];
          if (l !== "__none__" && allowed.has(l) && v > topP) { topP = v; topLabel = l; }
        });
        if (topLabel !== best.label) {
          this.votes = 0;
          return null;
        }
      }
    }
    this.emitted = best.label;
    return { label: best.label, confidence: best.p, fingerspelling: best.letter, alternatives: best.alts };
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

/** Replace the last occurrence of a recognized word in the transcript (the
 * user tapped one of the alternatives). */
export function replaceLastWord(text: string, from: string, to: string) {
  const clean = (w: string) => w.replace(/[!?.]$/u, "");
  const a = clean(from), b = clean(to);
  const i = text.toLocaleLowerCase("ru").lastIndexOf(a.toLocaleLowerCase("ru"));
  if (i < 0) return text;
  const next = text.slice(0, i) + b + text.slice(i + a.length);
  return next.charAt(0).toLocaleUpperCase("ru") + next.slice(1);
}
