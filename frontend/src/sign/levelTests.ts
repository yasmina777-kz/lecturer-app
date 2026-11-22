/** Best end-of-level test scores (0..10), kept on this device. */
export const TEST_KEY = "rsl-level-tests-v1";
export function readTests(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TEST_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
