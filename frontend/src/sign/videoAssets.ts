import type { DictionaryEntry } from "./dictionary";
import type { MotionAsset } from "./motion";

/** For the real-signer video player: every dictionary entry becomes playable
 * from its dictionary video (the curated, compressed take), including words
 * that never had 3D motion. 3D-only fields are left as they are. */
export function withVideoAssets(motions: MotionAsset[], entries: DictionaryEntry[]): MotionAsset[] {
  const video = new Map(entries.filter((e) => e.video).map((e) => [e.id, e.displayVideo ?? e.video]));
  const out = motions.map((m) => (video.has(m.id) ? { ...m, reference: video.get(m.id) } : m));
  const known = new Set(motions.map((m) => m.id));
  for (const e of entries)
    if (!known.has(e.id) && e.video?.startsWith("/"))
      out.push({ id: e.id, label: e.label, url: "", duration: 2, reference: e.displayVideo ?? e.video, review: "video-only" });
  return out;
}
