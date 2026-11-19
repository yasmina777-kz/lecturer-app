import { useEffect, useState, useSyncExternalStore } from "react";
import type { MotionPlan } from "./motion";

/** The realistic avatar ("Алекс"): one person for every sign that has a
 * saved motion. Clips are the shared library retargeted to his own rig
 * (art/realistic-male/retarget.py). */
export const AVATAR_MODEL = "/avatars/alex/alex.glb";
type Entry = { id: string; url: string; originalUrl: string; revision: string; duration: number };
let library: Promise<Map<string, Entry>> | null = null;
export function loadAvatarLibrary() {
  library ??= fetch("/avatars/alex/catalog.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((list: Entry[]) => {
      const map = new Map<string, Entry>();
      for (const e of list) {
        map.set(e.id, e);
        if (e.originalUrl) map.set(e.originalUrl, e);
      }
      return map;
    })
    .catch(() => {
      library = null;
      return new Map<string, Entry>();
    });
  return library;
}
export function useAvatarLibrary() {
  const [lib, setLib] = useState<Map<string, Entry> | null>(null);
  useEffect(() => {
    let alive = true;
    void loadAvatarLibrary().then((l) => alive && setLib(l));
    return () => {
      alive = false;
    };
  }, []);
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
  return { ...plan, steps, missing };
}

const KEY = "rsl-player-mode-v1";
export type PlayerMode = "video" | "avatar";
let mode: PlayerMode = "avatar";
try {
  if (localStorage.getItem(KEY) === "video") mode = "video";
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
