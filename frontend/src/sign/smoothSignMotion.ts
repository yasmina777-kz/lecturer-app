import * as THREE from "three";

/** Zero-phase Gaussian smoothing of captured joint rotations for the main
 * avatar. Removes frame-to-frame capture jitter so movement reads as human,
 * while a per-bone cap on the correction keeps handshapes, contact poses and
 * deliberate fast movements. Timing, first/last poses and the cached source
 * clip are never changed (the filter works on a clone).
 */
const LIMITS: [RegExp, number][] = [
  [/Hand(?:Thumb|Index|Middle|Ring|Pinky)\d/, 1.5],
  [/(?:Left|Right)Hand\.quaternion$/, 2.5],
  [/(?:Left|Right)(?:Shoulder|Arm|ForeArm)\.quaternion$/, 3.5],
  [/(?:Spine\d?|Neck|Head)\.quaternion$/, 2],
];
const RADIUS = 3; // keys on each side
const SIGMA = 1.5; // keys
const WEIGHTS = Array.from({ length: 2 * RADIUS + 1 }, (_, i) =>
  Math.exp(-((i - RADIUS) ** 2) / (2 * SIGMA * SIGMA)),
);

export function smoothSignMotion(source: THREE.AnimationClip) {
  const clip = source.clone();
  const q = new THREE.Quaternion(), n = new THREE.Quaternion(), avg = new THREE.Quaternion();
  for (const track of clip.tracks) {
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
    const limit = LIMITS.find(([re]) => re.test(track.name))?.[1];
    if (!limit) continue;
    const maxCorrection = THREE.MathUtils.degToRad(limit);
    const t = track.times, original = track.values.slice(), count = t.length;
    for (let i = 2; i < count - 2; i++) {
      q.fromArray(original, i * 4).normalize();
      let x = 0, y = 0, z = 0, w = 0, total = 0;
      for (let k = -RADIUS; k <= RADIUS; k++) {
        const j = i + k;
        if (j < 0 || j >= count || Math.abs(t[j] - t[i]) > (RADIUS + 0.5) / 30) continue;
        n.fromArray(original, j * 4).normalize();
        const sign = n.dot(q) < 0 ? -1 : 1; // same hemisphere
        const wt = WEIGHTS[k + RADIUS];
        x += sign * n.x * wt; y += sign * n.y * wt; z += sign * n.z * wt; w += sign * n.w * wt;
        total += wt;
      }
      if (total <= WEIGHTS[RADIUS]) continue; // no dense neighbours: keep the key
      avg.set(x, y, z, w).normalize();
      const angle = q.angleTo(avg);
      if (angle < 1e-6) continue;
      q.slerp(avg, Math.min(1, maxCorrection / angle));
      q.toArray(track.values, i * 4);
    }
  }
  return clip;
}
