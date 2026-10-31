import * as THREE from "three";
import { MOTION_GAP } from "./motion";
/** One clock, palm-to-palm transitions; keep all captured source frames. */
export function composeMotion(
  clips: THREE.AnimationClip[],
  gap = MOTION_GAP,
  trims: { start: number; end: number; gapAfter?: number }[] = [],
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
    for (const [index, clip] of clips.entries()) {
      const from = trims[index]?.start ?? 0;
      const to = clip.duration - (trims[index]?.end ?? 0);
      if (from < 0 || to <= from || to > clip.duration)
        throw new Error("Invalid motion window");
      const track = clip.tracks.find((t) => t.name === name);
      if (track) {
        const interpolant =
          track instanceof THREE.QuaternionKeyframeTrack
            ? new THREE.QuaternionLinearInterpolant(
                track.times,
                track.values,
                size,
              )
            : new THREE.LinearInterpolant(track.times, track.values, size);
        const first = Array.from(interpolant.evaluate(from)) as number[];
        const transitionGap =
          index > 0 ? (trims[index - 1]?.gapAfter ?? gap) : 0;
        if (index > 0 && transitionGap > 0) {
          // Zero velocity at each end avoids a linear snap between gestures.
          const samples = Math.max(8, Math.ceil(transitionGap * 60));
          for (let k = 1; k < samples; k++) {
            const t = k / samples;
            const ease = t * t * t * (t * (t * 6 - 15) + 10);
            times.push(offset - transitionGap + t * transitionGap);
            if (track instanceof THREE.QuaternionKeyframeTrack) {
              const mixed = new THREE.Quaternion()
                .fromArray(last)
                .slerp(new THREE.Quaternion().fromArray(first), ease);
              values.push(...mixed.toArray());
            } else
              values.push(
                ...first.map((v, j) => last[j] + (v - last[j]) * ease),
              );
          }
        }
        times.push(offset);
        values.push(...first);
        for (let i = 0; i < track.times.length; i++) {
          if (track.times[i] <= from + 1e-6 || track.times[i] >= to - 1e-6)
            continue;
          times.push(offset + track.times[i] - from);
          values.push(
            ...Array.from(track.values.slice(i * size, (i + 1) * size)),
          );
        }
        last = Array.from(interpolant.evaluate(to)) as number[];
        times.push(offset + to - from);
        values.push(...last);
      } else {
        times.push(offset, offset + to - from);
        values.push(...last, ...last);
      }
      offset +=
        to -
        from +
        (index < clips.length - 1 ? (trims[index]?.gapAfter ?? gap) : 0);
    }
    const track = template.clone();
    track.times = new Float32Array(times);
    track.values = new Float32Array(values);
    tracks.push(track);
  }
  return new THREE.AnimationClip(
    "sign-sequence",
    clips.reduce(
      (sum, c, i) =>
        sum + c.duration - (trims[i]?.start ?? 0) - (trims[i]?.end ?? 0),
      0,
    ) +
      clips
        .slice(0, -1)
        .reduce((sum, _, i) => sum + (trims[i]?.gapAfter ?? gap), 0),
    tracks,
  );
}
