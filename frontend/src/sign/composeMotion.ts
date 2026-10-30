import * as THREE from "three";
import { MOTION_GAP } from "./motion";
/** Single animation, one clock. Quaternion tracks interpolate through neutral gaps. */
export function composeMotion(
  clips: THREE.AnimationClip[],
  gap = MOTION_GAP,
): THREE.AnimationClip {
  if (!clips.length) throw new Error("No motion clips");
  const templates = new Map<string, THREE.KeyframeTrack>();
  clips.forEach((c) =>
    c.tracks.forEach((t) => {
      if (!templates.has(t.name)) templates.set(t.name, t);
    }),
  );
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [name, template] of templates) {
    const size = template.getValueSize(),
      times: number[] = [],
      values: number[] = [];
    let offset = 0,
      last = Array.from(template.values.slice(0, size));
    for (const clip of clips) {
      const track = clip.tracks.find((t) => t.name === name);
      if (track) {
        for (let i = 0; i < track.times.length; i++) {
          times.push(offset + track.times[i]);
          values.push(
            ...Array.from(track.values.slice(i * size, (i + 1) * size)),
          );
        }
        last = Array.from(track.values.slice(-size));
      } else {
        times.push(offset, offset + clip.duration);
        values.push(...last, ...last);
      }
      offset += clip.duration + gap;
    }
    const track = template.clone();
    track.times = new Float32Array(times);
    track.values = new Float32Array(values);
    tracks.push(track);
  }
  return new THREE.AnimationClip(
    "sign-sequence",
    clips.reduce((sum, c) => sum + c.duration, 0) + gap * (clips.length - 1),
    tracks,
  );
}
