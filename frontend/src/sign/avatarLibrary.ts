import { useEffect, useState, useSyncExternalStore } from "react";
import type { MotionPlan } from "./motion";

/** The realistic avatar ("Алекс"): one person for every sign that has a
 * saved motion. Clips are the shared library retargeted to his own rig
 * (art/realistic-male/retarget.py). */
export const AVATAR_MODEL = "/avatars/alex/alex.glb";
type Entry = { url: string; originalUrl: string; revision: string };
let library: Promise<Map<string, Entry>> | null = null;
export function loadAvatarLibrary() {
  library ??= fetch("/avatars/alex/catalog.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((list: Entry[]) => new Map(list.map((e) => [e.originalUrl, e])))
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
    const e = s.url ? lib.get(s.url.split("?")[0]) : undefined;
    if (e) steps.push({ ...s, url: e.url, revision: e.revision });
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
