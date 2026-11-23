/** Best end-of-level test scores (0..10), kept on this device. */
export const TEST_KEY = "rsl-level-tests-v1";
export function readTests(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TEST_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

/** First-visit placement test (/learn-test?placement=1): where to start the course. */
export const PLACEMENT_KEY = "rsl-placement-v1";
export type Placement = { level: "A1" | "A2" | "B1" | "B2"; scores?: Record<string, string>; at: string } | { skipped: true; at: string };
export function readPlacement(): Placement | null {
  try {
    return JSON.parse(localStorage.getItem(PLACEMENT_KEY) ?? "null");
  } catch {
    return null;
  }
}
export function savePlacement(p: Placement) {
  try {
    localStorage.setItem(PLACEMENT_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}
/** Start level from per-level results: pass a level with 3 of 4 to move on. */
export function placementLevel(ok: Record<"A1" | "A2" | "B1", number>, per = 4): "A1" | "A2" | "B1" | "B2" {
  const pass = (n: number) => n >= Math.ceil(per * 0.75);
  if (!pass(ok.A1)) return "A1";
  if (!pass(ok.A2)) return "A2";
  if (!pass(ok.B1)) return "B1";
  return "B2";
}
