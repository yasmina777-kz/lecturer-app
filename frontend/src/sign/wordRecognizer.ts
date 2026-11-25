import { loadSeqModel, runSeqModel, type SeqModel } from "./seqModel";
import { ATTEMPT_GATE, modelFeatures, motionExtent, resampleFrames, type HandPoint, type PosePoint } from "./wordFeatures";
import { normalizeSignText } from "./dictionary";

/** Ensemble members (same architecture, different training seeds); the
 * browser averages their probabilities. */
export const WORD_MODEL_URLS = [
  "/models/rsl/words-v5-classifier.json",
  "/models/rsl/words-v5-seed7-classifier.json",
  "/models/rsl/words-v5-seed1234-classifier.json",
];
export type WordModel = SeqModel & { members: SeqModel[] };
let loading: Promise<WordModel> | null = null;

/** Load once per page; a failed download can be retried. Missing extra
 * ensemble members are tolerated; the first model is required. */
export function loadWordModel(): Promise<WordModel> {
  loading ??= Promise.all(
    WORD_MODEL_URLS.map((url, i) =>
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error("word model");
          return r.json();
        })
        .then((json) => {
          const m = loadSeqModel(json);
          if (!m) throw new Error("invalid word model");
          return m;
        })
        .catch((error) => {
          if (i === 0) throw error;
          return null;
        }),
    ),
  )
    .then((list) => {
      const members = list.filter((m): m is SeqModel => !!m);
      const first = members[0];
      if (members.some((m) => m.labels.join("\n") !== first.labels.join("\n")))
        throw new Error("ensemble label mismatch");
      return { ...first, members };
    })
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}

/** Kazakh sign words (ksl-words-v1): the three frozen RSL words-v5 networks,
 * each with a Kazakh output layer learned on SURDO.KZ and «Саусақтар сөйлейді»
 * clips (ml/ksl/ksl_words_probe.py). Same features, averaged like the RSL ensemble. */
export const KSL_WORD_MODEL_URLS = ["/models/ksl/ksl-words-v1.json", "/models/ksl/ksl-words-v1-m1.json", "/models/ksl/ksl-words-v1-m2.json"];
let kslLoading: Promise<WordModel> | null = null;
export function loadKslWordModel(): Promise<WordModel> {
  kslLoading ??= Promise.all(
    KSL_WORD_MODEL_URLS.map((url) =>
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error("ksl word model");
          return r.json();
        })
        .then((json) => {
          const m = loadSeqModel(json);
          if (!m) throw new Error("invalid ksl word model");
          return m;
        }),
    ),
  )
    .then((members) => ({ ...members[0], members }))
    .catch((error) => {
      kslLoading = null;
      throw error;
    });
  return kslLoading;
}

export type WordGuess = {
  label: string;
  confidence: number;
  accepted: boolean;
  top: { label: string; p: number }[];
};

/** Course mode renormalizes over the course vocabulary (171 taught signs).
 * Acceptance gate fixed before test evaluation; see ml/rsl/course_mode_eval.py. */
export const COURSE_THRESHOLD = 0.5;
export const COURSE_MARGIN = 0.2;
/** Lesson mode (a handful of choices): stricter, because chance is higher. */
export const LESSON_THRESHOLD = 0.6;
export const LESSON_MARGIN = 0.3;

/** frames: hand landmarks per sampled camera frame (any number of hands). */
export function recognizeWord(
  model: SeqModel | WordModel,
  frames: HandPoint[][][],
  width: number,
  height: number,
  courseOnly = true,
  poses?: PosePoint[][],
  faces?: (number[] | null)[],
  /** Lesson mode: rank only these signs (e.g. the 8 words of the lesson). */
  choices?: string[],
): WordGuess | null {
  const features = modelFeatures(model, frames, width, height, poses, faces);
  if (!features || features.filter((f) => f[65] || f[131]).length < 5) return null;
  if (motionExtent(features) < ATTEMPT_GATE) return null; // no real sign movement
  const window = resampleFrames(features, model.frames ?? 32);
  const members = "members" in model ? model.members : [model];
  const outputs = members.map((m) => runSeqModel(m, window));
  if (outputs.some((o) => !o)) return null;
  const p = outputs[0]!.map((_, i) => outputs.reduce((a, o) => a + o![i], 0) / outputs.length);
  let ranked = p.map((v, i) => ({ label: model.labels[i], p: v }));
  let threshold = model.threshold, margin = model.margin;
  if (courseOnly && model.courseLabels?.length) {
    const allowed = new Set(model.courseLabels);
    ranked = ranked.filter((r) => allowed.has(r.label));
    const sum = ranked.reduce((a, r) => a + r.p, 0);
    ranked = ranked.map((r) => ({ ...r, p: r.p / sum }));
    threshold = COURSE_THRESHOLD;
    margin = COURSE_MARGIN;
  }
  if (choices?.length) {
    const keep = new Set(choices.map(normalizeSignText));
    const subset = ranked.filter((r) => keep.has(normalizeSignText(r.label)));
    if (subset.length >= 2) {
      const sum = subset.reduce((a, r) => a + r.p, 0) || 1;
      ranked = subset.map((r) => ({ ...r, p: r.p / sum }));
      // Among few options the top pick is easy; ask for a clear winner.
      threshold = LESSON_THRESHOLD;
      margin = LESSON_MARGIN;
    }
  }
  ranked.sort((a, b) => b.p - a.p);
  const [first, second] = ranked;
  return {
    label: first.label,
    confidence: first.p,
    accepted: first.p >= threshold && first.p - (second?.p ?? 0) >= margin,
    top: ranked.slice(0, 5),
  };
}

/** Exercise check against a known target: top-1 among course signs = correct,
 * top-3 = close. The target is never fed to the model. */
export function judgeWord(guess: WordGuess | null, target: string, lesson = false) {
  if (!guess) return { verdict: "unclear" as const, rank: -1 };
  const key = normalizeSignText(target);
  const rank = guess.top.findIndex((t) => normalizeSignText(t.label) === key);
  // Among a lesson's few words a first place alone is not enough: it must be a confident one.
  if (rank === 0 && lesson && !guess.accepted) return { verdict: "close" as const, rank };
  if (rank === 0) return { verdict: "correct" as const, rank };
  if (rank > 0 && rank < 3) return { verdict: "close" as const, rank };
  return { verdict: "different" as const, rank };
}

export function knowsWord(model: SeqModel, label: string) {
  const key = normalizeSignText(label);
  return model.labels.some((l) => normalizeSignText(l) === key);
}

/** Splits a camera stream into single-sign clips. A clip starts when a hand
 * appears and ends after the hands rest/leave, or at a hard length limit.
 * This is a pause heuristic, not a linguistic sign-boundary detector.
 */
export class WordSegmenter {
  private frames: HandPoint[][][] = [];
  private poses: PosePoint[][] = [];
  private faces: (number[] | null)[] = [];
  /** Body poses / face rows of the clip last returned by push (same length). */
  clipPoses: PosePoint[][] = [];
  clipFaces: (number[] | null)[] = [];
  private lastMotion = 0;
  private started = 0;
  private lastSeen = 0;
  private previous: HandPoint[] = [];
  private moving = 0;
  private lastMotionIndex = 0;
  constructor(
    private pauseMs = 900,
    private goneMs = 500,
    private maxMs = 5000,
  ) {}
  reset() {
    this.frames = [];
    this.poses = [];
    this.faces = [];
    this.previous = [];
    this.moving = 0;
    this.lastMotionIndex = 0;
    this.started = 0;
  }
  get recording() {
    return this.frames.length > 0;
  }
  /** Returns a finished clip, or null while waiting/recording. */
  push(now: number, hands: HandPoint[][], pose: PosePoint[] = [], face: number[] | null = null): HandPoint[][][] | null {
    const visible = hands.filter((h) => h.length === 21);
    const wrists = visible.map((h) => h[0]);
    if (visible.length) {
      const motion = wrists.length && this.previous.length
        ? Math.max(...wrists.map((w) => Math.min(...this.previous.map((p) => Math.hypot(w.x - p.x, w.y - p.y)))))
        : 0;
      this.previous = wrists;
      this.lastSeen = now;
      if (!this.frames.length) {
        this.started = now;
        this.lastMotion = now;
      }
      this.frames.push(visible);
      this.poses.push(pose);
      this.faces.push(face);
      if (motion > 0.012) {
        this.lastMotion = now;
        this.lastMotionIndex = this.frames.length - 1;
        this.moving++;
      }
    } else if (this.frames.length) {
      this.frames.push([]);
      this.poses.push(pose);
      this.faces.push(face);
    }
    if (!this.frames.length) return null;
    const ended =
      now - this.started >= this.maxMs ||
      (!visible.length && now - this.lastSeen >= this.goneMs) ||
      (now - this.started >= 800 && now - this.lastMotion >= this.pauseMs);
    if (!ended) return null;
    const clip = this.frames.slice(0, this.lastMotionIndex + 3), moving = this.moving;
    this.clipPoses = this.poses.slice(0, clip.length);
    this.clipFaces = this.faces.slice(0, clip.length);
    this.reset();
    // A hand held still the whole time is not a sign attempt.
    return moving >= 2 ? clip : null;
  }
}
