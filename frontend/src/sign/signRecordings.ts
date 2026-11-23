/** Sign recordings made on /record-signs: landmarks only (no video), kept in
 * this browser's IndexedDB until exported as a JSON file for training.
 * Format per take matches ml/rsl/extract_slovo_origin.py:
 *   hands [T][2][21][3] (x, y, z; null where no hand; larger hand first)
 *   pose  [T][9][3]     (nose, mouth L/R, shoulders, elbows, wrists: x, y, visibility)
 */
export type Take = {
  id: string;
  label: string;
  participant: string;
  region?: string;
  createdAt: string;
  width: number;
  height: number;
  /** Milliseconds from the take's first frame. */
  t: number[];
  hands: (number[][] | null)[][];
  pose: number[][][];
};
export const POSE_POINTS = [0, 9, 10, 11, 12, 13, 14, 15, 16];

const DB = "rsl-sign-recordings";
const STORE = "takes";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const listTakes = () => tx<Take[]>("readonly", (s) => s.getAll() as IDBRequest<Take[]>);
export const saveTake = (t: Take) => tx("readwrite", (s) => s.put(t));
export const deleteTake = (id: string) => tx("readwrite", (s) => s.delete(id));

type P = { x: number; y: number; z?: number; visibility?: number };
/** One camera frame in the stored format. */
export function frameRow(hands: P[][], pose: P[]) {
  const sorted = hands
    .filter((h) => h.length === 21)
    .map((h) => {
      const xs = h.map((p) => p.x), ys = h.map((p) => p.y);
      return { h, area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) };
    })
    .sort((a, b) => b.area - a.area)
    .slice(0, 2)
    .map(({ h }) => h.map((p) => [round(p.x), round(p.y), round(p.z ?? 0)]));
  while (sorted.length < 2) sorted.push(null as never);
  const body = pose.length >= 17
    ? POSE_POINTS.map((i) => [round(pose[i].x), round(pose[i].y), round(pose[i].visibility ?? 1)])
    : POSE_POINTS.map(() => [0, 0, 0]);
  return { hands: sorted as (number[][] | null)[], pose: body };
}
const round = (v: number) => Math.round(v * 1e5) / 1e5;
