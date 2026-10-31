import * as THREE from "three";

export type AvatarPlaybackState = "idle" | "playing" | "paused";

/** One skeleton, two exclusive motion sources. Mixamo never overlays a sign. */
export class AvatarPlayback {
  private readonly signs: THREE.AnimationAction[];
  private readonly idle: THREE.AnimationAction;
  private idleTime = 0;
  private blend = 0;

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    clips: THREE.AnimationClip[],
    private readonly idleClip: THREE.AnimationClip,
  ) {
    this.signs = clips.map((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      return action;
    });
    this.idle = mixer.clipAction(idleClip).play();
  }

  update(time: number, state: AvatarPlaybackState, delta: number) {
    const dt = Math.max(0, Math.min(0.05, delta));
    // 350 ms fits within the captured clips' 700 ms neutral lead-in.
    // Pausing/scrubbing always shows the exact source pose, never a mixed hand.
    // A completed sign already contains its authored release into rest.
    // Blending that pose into an unrelated idle can reverse the elbow's bend
    // plane and sweep a hand through the hip. Hold the verified final pose.
    const completed = state === "idle" && this.signs.length > 0 &&
      this.signs.every(action => time >= action.getClip().duration);
    if (completed || state === "paused" || (state === "playing" && time >= 0.45))
      this.blend = 1;
    else
      this.blend = THREE.MathUtils.clamp(
        this.blend + ((state === "playing" ? 1 : -1) * dt) / 0.35,
        0,
        1,
      );
    if (state !== "paused") this.idleTime += dt;
    const weight = this.signs.length
      ? this.blend * this.blend * (3 - 2 * this.blend)
      : 0;
    this.idle.time = this.idleTime % this.idleClip.duration;
    this.idle.setEffectiveWeight(1 - weight);
    for (const action of this.signs) {
      action.enabled = true;
      action.paused = false;
      action.time = THREE.MathUtils.clamp(time, 0, action.getClip().duration);
      action.setEffectiveWeight(weight);
    }
    // Explicit clocks make pause, seek and resume deterministic.
    this.mixer.update(0);
  }
}
