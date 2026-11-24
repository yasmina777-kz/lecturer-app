import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createMotionCache } from "./motionCache";

// Animation-only GLBs contain no character meshes. Each playback gets a clone
// so its mixer cannot alter the saved clip used by another word or component.
export const loadSavedMotion = createMotionCache(async (url: string) => {
  const [asset, face] = await Promise.all([new GLTFLoader().loadAsync(url), loadFaceTracks(url)]);
  const clip = asset.animations[0];
  if (!clip) throw new Error("Empty animation");
  clip.tracks.push(...face);
  return clip;
});

/** Facial expression and mouth curves solved from the same video as the body
 * (art/realistic-male/face_curves.py). Tracks use a placeholder node that is
 * bound to every head mesh with that ARKit shape once the model is loaded. */
const FACE = "__face__";
async function loadFaceTracks(url: string): Promise<THREE.KeyframeTrack[]> {
  if (!url.includes("/avatars/alex/")) return [];
  try {
    const r = await fetch(url.split("?")[0].replace(/\.glb$/, ".face.json"));
    if (!r.ok) return [];
    const d: { fps: number; frames: number; curves: Record<string, number[]> } = await r.json();
    const times = Float32Array.from({ length: d.frames }, (_, i) => i / d.fps);
    return Object.entries(d.curves).map(
      ([unit, values]) => new THREE.NumberKeyframeTrack(`${FACE}.morphTargetInfluences[${unit}]`, times, values),
    );
  } catch {
    return [];
  }
}
export function bindFace(clip: THREE.AnimationClip, meshes: THREE.Mesh[]) {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const t of clip.tracks) {
    const m = t.name.startsWith(FACE + ".") ? /\[(.+)\]$/.exec(t.name) : null;
    if (!m) {
      tracks.push(t);
      continue;
    }
    for (const mesh of meshes)
      if (mesh.morphTargetDictionary?.[m[1]] !== undefined) {
        const c = t.clone();
        c.name = `${mesh.uuid}.morphTargetInfluences[${m[1]}]`;
        tracks.push(c);
      }
  }
  clip.tracks = tracks;
  return clip;
}

/** A natural blink every few seconds, on top of whatever the clip does. */
export function blinker() {
  let next = performance.now() + 1500 + Math.random() * 2500;
  const added = new Map<THREE.Mesh, number[]>();
  return (meshes: THREE.Mesh[]) => {
    const now = performance.now();
    if (now > next + 170) next = now + 2600 + Math.random() * 3200;
    const x = (now - next) / 170;
    const blink = x >= 0 && x <= 1 ? Math.sin(Math.PI * x) : 0;
    for (const mesh of meshes) {
      const dict = mesh.morphTargetDictionary, inf = mesh.morphTargetInfluences;
      if (!dict || !inf) continue;
      const prev = added.get(mesh) ?? [0, 0];
      ["eyeBlinkLeft", "eyeBlinkRight"].forEach((name, k) => {
        const i = dict[name];
        if (i === undefined) return;
        inf[i] = Math.max(0, inf[i] - prev[k]);
        prev[k] = Math.max(0, blink - inf[i]);
        inf[i] += prev[k];
      });
      added.set(mesh, prev);
    }
  };
}


/** Small signs of life on top of the clips: a soft resting smile and the eyes
 * moving a little every few seconds (a fixed stare looks like a mannequin).
 * Additive like the blinker, so recorded face curves still play. */
export function faceLife() {
  let gazeAt = performance.now() + 1200;
  let from = [0, 0], to = [0, 0];
  const added = new Map<THREE.Mesh, Record<string, number>>();
  return (meshes: THREE.Mesh[], talking = false) => {
    const now = performance.now();
    if (now > gazeAt + 220) {
      from = to;
      // Mostly back to the viewer, sometimes a glance aside or down at the hands.
      to = Math.random() < 0.55 ? [0, 0] : [(Math.random() - 0.5) * 0.5, Math.random() * 0.35];
      gazeAt = now + 1800 + Math.random() * 2600;
    }
    const k = Math.min(1, Math.max(0, (now - gazeAt) / 220));
    const e = k * k * (3 - 2 * k);
    const gx = from[0] + (to[0] - from[0]) * e, gy = from[1] + (to[1] - from[1]) * e;
    const smile = talking ? 0.05 : 0.14;
    const want: Record<string, number> = {
      mouthSmileLeft: smile, mouthSmileRight: smile,
      eyeLookOutLeft: Math.max(0, -gx) * 0.6, eyeLookInRight: Math.max(0, -gx) * 0.6,
      eyeLookInLeft: Math.max(0, gx) * 0.6, eyeLookOutRight: Math.max(0, gx) * 0.6,
      eyeLookDownLeft: gy * 0.6, eyeLookDownRight: gy * 0.6,
    };
    for (const mesh of meshes) {
      const dict = mesh.morphTargetDictionary, inf = mesh.morphTargetInfluences;
      if (!dict || !inf) continue;
      const prev = added.get(mesh) ?? {};
      for (const [name, v] of Object.entries(want)) {
        const i = dict[name];
        if (i === undefined) continue;
        const base = Math.max(0, inf[i] - (prev[name] ?? 0));
        const add = Math.max(0, Math.min(1, base + v) - base);
        inf[i] = base + add;
        prev[name] = add;
      }
      added.set(mesh, prev);
    }
  };
}
