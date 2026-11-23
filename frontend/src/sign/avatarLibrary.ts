import { useEffect, useState, useSyncExternalStore } from "react";
import type { MotionPlan } from "./motion";

/** The realistic avatar ("Алекс"): one person for every sign that has a
 * saved motion. Clips are the shared library retargeted to his own rig
 * (art/realistic-male/retarget.py). */
export const AVATAR_MODEL = "/avatars/alex/alex.glb";
export type AvatarEntry = { id: string; label?: string; url: string; originalUrl: string; revision: string; duration: number; core?: [number, number] | null; review?: string };
type Entry = AvatarEntry;
/** Signer verdicts from the avatar review page (/avatar-review), published as
 * /avatars/alex/review.json. A clip marked "wrong" is never shown to learners
 * (the real video plays instead). */
/** "variant": the avatar matches the video, but the consultant signs it
 * differently in her region — kept, with the note shown as a regional variant. */
export type AvatarVerdict = "ok" | "wrong" | "unsure" | "variant";
export type AvatarReview = { verdicts: Record<string, { verdict: AvatarVerdict; note?: string }> };
let reviewFile: Promise<AvatarReview> | null = null;
export function loadAvatarReview() {
  reviewFile ??= fetch("/avatars/alex/review.json")
    .then((r) => (r.ok ? r.json() : { verdicts: {} }))
    .catch(() => ({ verdicts: {} }));
  return reviewFile;
}
/** Automatic trust check (art/realistic-male/check_tracking.py): clips whose
 * reference video had hands missing, swapped or jittering — the solver had to
 * guess there. Hidden from learners unless the consultant marked them ok. */
export type AutoCheck = { clips: Record<string, { ok: boolean; reason?: string }> };
let autoFile: Promise<AutoCheck> | null = null;
export function loadAutoCheck() {
  autoFile ??= fetch("/avatars/alex/auto-check.json")
    .then((r) => (r.ok ? r.json() : { clips: {} }))
    .catch(() => ({ clips: {} }));
  return autoFile;
}
/** Whether learners may see this clip: a consultant's verdict wins, then the auto check. */
export function avatarTrusted(id: string, review: AvatarReview, auto: AutoCheck) {
  const v = review.verdicts[id]?.verdict;
  if (v === "wrong") return false;
  if (v === "ok" || v === "variant") return true;
  return auto.clips[id]?.ok !== false;
}
let library: Promise<Map<string, Entry>> | null = null;
let fullLibrary: Promise<Map<string, Entry>> | null = null;
export function loadAvatarCatalog() {
  return fetch("/avatars/alex/catalog.json").then((r) => (r.ok ? r.json() : [])) as Promise<Entry[]>;
}
export function loadAvatarLibrary(includeWrong = false) {
  const build = (skip: boolean) =>
    Promise.all([
      loadAvatarCatalog(),
      skip ? loadAvatarReview() : Promise.resolve({ verdicts: {} } as AvatarReview),
      skip ? loadAutoCheck() : Promise.resolve({ clips: {} } as AutoCheck),
    ])
    .then(([list, review, auto]) => {
      const map = new Map<string, Entry>();
      for (const e of list) {
        if (!avatarTrusted(e.id, review, auto)) continue;
        map.set(e.id, e);
        if (e.originalUrl) map.set(e.originalUrl, e);
      }
      return map;
    });
  if (includeWrong) {
    fullLibrary ??= build(false).catch(() => {
      fullLibrary = null;
      return new Map<string, Entry>();
    });
    return fullLibrary;
  }
  library ??= build(true).catch(() => {
    library = null;
    return new Map<string, Entry>();
  });
  return library;
}
export function useAvatarLibrary(includeWrong = false) {
  const [lib, setLib] = useState<Map<string, Entry> | null>(null);
  useEffect(() => {
    let alive = true;
    void loadAvatarLibrary(includeWrong).then((l) => alive && setLib(l));
    return () => {
      alive = false;
    };
  }, [includeWrong]);
  return lib;
}

/** The same plan with every step pointing at the avatar's clip; words
 * without a saved motion are listed in `missing`. */
export function avatarPlan(plan: MotionPlan, lib: Map<string, Entry>): MotionPlan {
  const steps: MotionPlan["steps"] = [];
  const missing = [...plan.missing];
  for (const s of plan.steps) {
    // By sign id first (covers words that only had a video), then by clip URL.
    const e = lib.get(s.id) ?? (s.url ? lib.get(s.url.split("?")[0]) : undefined);
    if (e) {
      // The shared library's transition poses belong to another rig: Alex's
      // clips start and end in the same relaxed pose, so they join directly.
      const { transitionPose: _t, sequence: _s, ...rest } = s as typeof s & { sequence?: unknown };
      steps.push({ ...rest, url: e.url, revision: e.revision, duration: e.duration, leadIn: 0, leadOut: 0 });
    }
    else missing.push(s.text);
  }
  // Inside a phrase an interpreter does not drop the hands between signs: play
  // only the sign itself (the raised-hand part measured on the video) and blend
  // straight into the next one. Letters inside a fingerspelled word are shorter
  // still: ~0.6 s from the middle of each letter.
  const isLetter = (i: number) => !!steps[i]?.id?.startsWith("letter-");
  steps.forEach((st, i) => {
    const c = lib.get(st.id)?.core;
    if (!c) return;
    const s = st as typeof st & { clipStart?: number; clipEnd?: number; joinGap?: number };
    const letterRun = isLetter(i);
    const mid = (c[0] + c[1]) / 2;
    if (i > 0) s.clipStart = Math.max(0, letterRun && isLetter(i - 1) ? mid - 0.3 : c[0] - 0.12);
    if (i < steps.length - 1) {
      s.clipEnd = Math.min(st.duration, letterRun && isLetter(i + 1) ? mid + 0.3 : c[1] + 0.12);
      s.joinGap = letterRun && isLetter(i + 1) ? 0.18 : 0.3;
    }
  });
  return { ...plan, steps, missing };
}

// v2: the real signer video is the default everywhere. Every avatar clip is an
// automatic solve from video that no signer has reviewed yet, so it can show
// a wrong handshape or place; the avatar stays an opt-in preview.
const KEY = "rsl-player-mode-v2";
export type PlayerMode = "video" | "avatar";
let mode: PlayerMode = "video";
try {
  if (localStorage.getItem(KEY) === "avatar") mode = "avatar";
} catch {
  /* default */
}
const listeners = new Set<() => void>();
export function setPlayerMode(next: PlayerMode) {
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* session only */
  }
  listeners.forEach((l) => l());
}
export function usePlayerMode() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode,
  );
}
