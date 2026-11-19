import { lazy, type ComponentType } from "react";

/** After a new deploy the old page chunks no longer exist. A tab opened before
 * the deploy then fails to open a section. Reload once to pick up the new
 * version instead of showing a broken page. */
const KEY = "ai-mentor-chunk-reload";
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false; // already tried: avoid loops
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked: still reload once */
  }
  window.location.reload();
  return true;
}
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((e) => {
      if (reloadForNewVersion()) return new Promise<{ default: T }>(() => {});
      throw e;
    }),
  );
}
