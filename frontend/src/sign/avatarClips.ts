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

