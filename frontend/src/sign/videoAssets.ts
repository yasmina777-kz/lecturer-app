import type { DictionaryEntry } from "./dictionary";
import type { MotionAsset } from "./motion";

/** For the real-signer video player: every dictionary entry becomes playable
 * from its dictionary video (the curated, compressed take), including words
 * that never had 3D motion. 3D-only fields are left as they are. */
export type VideoStep = { text: string; reference: string };
/** Authored 3D-only phrases shown as a chain of real signer videos. Labels
 * are the actual signs on screen (e.g. «благодарность» for «Спасибо»). */
export const PHRASE_SEQUENCES: Record<string, string[]> = {
  "prepared-hello": ["Привет!"],
  "prepared-name-demo": ["ты", "имя", "кто?"],
  "prepared-thanks": ["благодарность"],
};
const EXTRA_VIDEOS: Record<string, string> = {
  благодарность: "/research/rsl/words/extra/blagodarnost.mp4",
};
export function withVideoAssets(motions: MotionAsset[], entries: DictionaryEntry[]): MotionAsset[] {
  const video = new Map(entries.filter((e) => e.video).map((e) => [e.id, e.displayVideo ?? e.video]));
  const out = motions.map((m) => (video.has(m.id) ? { ...m, reference: video.get(m.id) } : m));
  const known = new Set(motions.map((m) => m.id));
  for (const e of entries)
    if (!known.has(e.id) && e.video?.startsWith("/"))
      out.push({ id: e.id, label: e.label, url: "", duration: 2, reference: e.displayVideo ?? e.video, review: "video-only" });
  const byLabel = new Map(entries.map((e) => [e.label, e.displayVideo ?? e.video]));
  for (const [id, labels] of Object.entries(PHRASE_SEQUENCES)) {
    const sequence = labels
      .map((text) => ({ text, reference: byLabel.get(text) ?? EXTRA_VIDEOS[text] }))
      .filter((s): s is VideoStep => !!s.reference?.startsWith("/"));
    const i = out.findIndex((m) => m.id === id);
    if (i >= 0 && sequence.length)
      out[i] = { ...out[i], reference: sequence[0].reference, sequence } as MotionAsset;
  }
  return out;
}
