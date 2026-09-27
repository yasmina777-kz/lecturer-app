import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const key = "ai-mentor-theme";
let theme: Theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
const listeners = new Set<() => void>();
function apply(next: Theme) {
  theme = next;
  document.documentElement.dataset.theme = next;
  listeners.forEach((listener) => listener());
}
window.addEventListener("storage", (event) => {
  if (event.key === key && (event.newValue === "light" || event.newValue === "dark")) apply(event.newValue);
});
export function useTheme() {
  const current = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => theme);
  return {
    theme: current,
    toggleTheme() {
      const next = theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(key, next); } catch { /* In-memory selection still works. */ }
      apply(next);
    },
  };
}
