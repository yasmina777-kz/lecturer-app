import * as THREE from "three";

/** Symmetric, bounded filtering of dense capture jitter, with no playback lag.
 * Hands, fingers, head, positions, endpoints and deliberate large turns stay intact.
 * Operates on a clone so the comparison player and cached source never change.
 */
export function softenArmMotion(source: THREE.AnimationClip) {
  const clip = source.clone();
  const maxCorrection = THREE.MathUtils.degToRad(1.25);
  const maxNeighbourTurn = THREE.MathUtils.degToRad(8);
  for (const track of clip.tracks) {
    if (!(track instanceof THREE.QuaternionKeyframeTrack) ||
      !/(?:Left|Right)(?:Shoulder|Arm|ForeArm)\.quaternion$/.test(track.name)) continue;
    const original = track.values.slice();
    for (let i = 1; i < track.times.length - 1; i++) {
      const before = track.times[i] - track.times[i - 1];
      const after = track.times[i + 1] - track.times[i];
      if (before <= 0 || after <= 0 || Math.max(before, after) > 0.05) continue;
      const q = new THREE.Quaternion().fromArray(original, i * 4).normalize();
      const prev = new THREE.Quaternion().fromArray(original, (i - 1) * 4).normalize();
      const next = new THREE.Quaternion().fromArray(original, (i + 1) * 4).normalize();
      if (q.angleTo(prev) > maxNeighbourTurn || q.angleTo(next) > maxNeighbourTurn) continue;
      // Time-aware midpoint also leaves constant angular velocity unchanged.
      const neighbours = prev.slerp(next, before / (before + after));
      const amount = q.angleTo(neighbours);
      q.slerp(neighbours, Math.min(0.4, maxCorrection / Math.max(amount, 1e-9)));
      q.toArray(track.values, i * 4);
    }
  }
  return clip;
}
