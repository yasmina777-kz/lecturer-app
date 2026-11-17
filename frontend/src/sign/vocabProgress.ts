import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

/** Leitner-style spaced repetition for dictionary signs, stored per account
 * in this browser. Box n is reviewed after INTERVALS[n] days; a wrong answer
 * returns the word to box 0. Box >= LEARNED_BOX counts as "learned". */
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
export const LEARNED_BOX = 3;
export type WordState = { box: number; due: string; seen: number; correct: number; last: string };
export type VocabState = {
  words: Record<string, WordState>;
  lessons: Record<string, number>; // best score 0..1 per lesson key
  days: string[]; // YYYY-MM-DD with any practice, most recent last
};
const empty = (): VocabState => ({ words: {}, lessons: {}, days: [] });
export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return today(d);
};

export function parseVocab(raw: string | null): VocabState {
  try {
    const v = JSON.parse(raw || "{}");
    const state = empty();
    for (const [id, w] of Object.entries(v.words ?? {})) {
      const s = w as WordState;
      if (Number.isInteger(s.box) && s.box >= 0 && s.box < INTERVALS.length && /^\d{4}-\d{2}-\d{2}$/.test(s.due))
        state.words[id] = { box: s.box, due: s.due, seen: +s.seen || 0, correct: +s.correct || 0, last: String(s.last || "") };
    }
    for (const [k, score] of Object.entries(v.lessons ?? {}))
      if (Number.isFinite(score) && (score as number) >= 0 && (score as number) <= 1) state.lessons[k] = score as number;
    if (Array.isArray(v.days)) state.days = v.days.filter((d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-120);
    return state;
  } catch {
    return empty();
  }
}

/** Pure update used by the hook (and tests). */
export function applyAnswer(state: VocabState, id: string, correct: boolean): VocabState {
  const prev = state.words[id] ?? { box: 0, due: today(), seen: 0, correct: 0, last: "" };
  const box = correct ? Math.min(prev.box + 1, INTERVALS.length - 1) : 0;
  const day = today();
  return {
    ...state,
    words: {
      ...state.words,
      [id]: { box, due: addDays(INTERVALS[box]), seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0), last: day },
    },
    days: state.days.includes(day) ? state.days : [...state.days, day].slice(-120),
  };
}

export function streak(days: string[]) {
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  if (!set.has(today(d))) d.setDate(d.getDate() - 1); // today not practised yet keeps yesterday's streak
  while (set.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function dueIds(state: VocabState, limit = 20) {
  const now = today();
  return Object.entries(state.words)
    .filter(([, w]) => w.due <= now)
    .sort((a, b) => a[1].box - b[1].box || a[1].due.localeCompare(b[1].due))
    .slice(0, limit)
    .map(([id]) => id);
}

export function useVocabProgress() {
  const { user } = useAuth();
  const key = `ai-mentor:sign-vocab:v1:${user?.id || "guest"}`;
  const read = useCallback(() => {
    try {
      return parseVocab(localStorage.getItem(key));
    } catch {
      return empty();
    }
  }, [key]);
  const [state, setState] = useState(read);
  useEffect(() => {
    setState(read());
    const update = (e: StorageEvent) => (e.key === key || e.key === null) && setState(read());
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [key, read]);
  const write = (next: VocabState) => {
    setState(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Private mode: progress lives for this page only. */
    }
  };
  return {
    state,
    answer: (id: string, correct: boolean) => write(applyAnswer(read(), id, correct)),
    finishLesson: (lessonKey: string, score: number) => {
      const s = read();
      write({ ...s, lessons: { ...s.lessons, [lessonKey]: Math.max(score, s.lessons[lessonKey] ?? 0) } });
    },
  };
}
