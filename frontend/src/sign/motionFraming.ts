import * as THREE from 'three';

/** A fixed frame for the complete motion, so following a hand never moves the camera. */
export function signingBounds(model: THREE.Object3D, clip: THREE.AnimationClip) {
  const bounds = new THREE.Box3();
  const joints: THREE.Object3D[] = [];
  model.traverse((node) => {
    if (/Hand|Head/.test(node.name) && node instanceof THREE.Bone) joints.push(node);
  });
  if (!joints.length) return bounds;
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip).play();
  const point = new THREE.Vector3();
  // Captured assets contain a 0.7 s neutral lead-in/out. Frame the sign itself.
  const lead = Math.min(0.7, clip.duration / 4);
  const handBounds = { Left: new THREE.Box3(), Right: new THREE.Box3() };
  const wristHeights = { Left: 0, Right: 0 };
  const steps = Math.min(600, Math.max(1, Math.ceil(clip.duration * 15)));
  for (let i = 0; i <= steps; i++) {
    mixer.setTime(lead + i * (clip.duration - 2 * lead) / steps);
    model.updateMatrixWorld(true);
    const raised = { Left: false, Right: false };
    for (const joint of joints) if (/Hand$/.test(joint.name)) {
      const side = joint.name.includes('Left') ? 'Left' : 'Right';
      raised[side] = joint.getWorldPosition(point).y > 1.08;
    }
    for (const joint of joints) {
      joint.getWorldPosition(point);
      if (/Head/.test(joint.name)) bounds.expandByPoint(point);
      else {
        const side = joint.name.includes('Left') ? 'Left' : 'Right';
        if (raised[side]) handBounds[side].expandByPoint(point);
        if (/Hand$/.test(joint.name)) wristHeights[side] = Math.max(wristHeights[side], point.y);
      }
    }
  }
  for (const side of ['Left', 'Right'] as const) {
    // A resting hand at the hip should not shrink the active hand close-up.
    if (wristHeights[side] > 1.1) bounds.union(handBounds[side]);
  }
  action.stop();
  mixer.uncacheRoot(model);
  // Bone centres exclude skin thickness, fingertip ends and the crown of the head.
  return bounds.expandByScalar(0.09);
}

export function fitSigningFrame(bounds: THREE.Box3, aspect: number, theta: number) {
  const target = bounds.getCenter(new THREE.Vector3());
  const forward = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
  const right = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
  const tan = Math.tan(16 * Math.PI / 180);
  let radius = 0;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new THREE.Vector3(x, y, z).sub(target);
        radius = Math.max(radius, offset.dot(forward) + Math.max(
          Math.abs(offset.y) / tan,
          Math.abs(offset.dot(right)) / (tan * Math.max(0.1, aspect)),
        ));
      }
  return { target, radius: radius * 1.06 };
}
