import { useEffect, useSyncExternalStore } from "react";

/** Daily practice goal: seconds studied per day and the streak of days that met the goal. */
const KEY = "rsl-daily-goal-v1";
export const GOAL_MINUTES = 5;
type Store = { days: Record<string, number> };

const today = (d = new Date()) => d.toISOString().slice(0, 10);
function read(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { days: s?.days ?? {} };
  } catch {
    return { days: {} };
  }
}
let store = read();
const listeners = new Set<() => void>();
function add(seconds: number) {
  const day = today();
  store = { days: { ...store.days, [day]: (store.days[day] ?? 0) + seconds } };
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode: still counts for this visit */
  }
  listeners.forEach((l) => l());
}

export function goalSummary(s: Store = store) {
  const goal = GOAL_MINUTES * 60;
  const minutes = Math.floor((s.days[today()] ?? 0) / 60);
  let streak = 0;
  const d = new Date();
  // Today counts once reached; an unfinished today does not break the streak.
  if ((s.days[today(d)] ?? 0) < goal) d.setDate(d.getDate() - 1);
  while ((s.days[today(d)] ?? 0) >= goal) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { minutes: Math.min(minutes, 999), goal: GOAL_MINUTES, done: minutes >= GOAL_MINUTES, streak };
}

export function useDailyGoal() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
  );
  return goalSummary();
}

/** Counts time while a study page is open and the tab is visible. */
export function useStudyTimer(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") add(15);
    }, 15_000);
    return () => clearInterval(id);
  }, [active]);
}
