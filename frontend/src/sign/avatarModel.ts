import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { createMotionCache } from "./motionCache";

// Keep decoded source assets on the CPU. Each player owns its skeleton and GPU
// resources; disposing a previous phrase cannot break the next player's model.
const sourceModel = createMotionCache(
  (url: string) => new GLTFLoader().loadAsync(url),
  2,
);
export function cloneAvatar(source: THREE.Group) {
  const scene = clone(source) as THREE.Group;
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  function material(original: THREE.Material) {
    if (!materials.has(original)) {
      const copy = original.clone();
      for (const [key, value] of Object.entries(original)) {
        if (!(value instanceof THREE.Texture)) continue;
        if (!textures.has(value)) {
          const texture = value.clone();
          texture.userData = { ...texture.userData, sharedAvatarImage: true };
          textures.set(value, texture);
        }
        (copy as unknown as Record<string, unknown>)[key] = textures.get(value);
      }
      materials.set(original, copy);
    }
    return materials.get(original)!;
  }
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (!geometries.has(node.geometry))
      geometries.set(node.geometry, node.geometry.clone());
    node.geometry = geometries.get(node.geometry)!;
    node.material = Array.isArray(node.material)
      ? node.material.map(material)
      : material(node.material);
  });
  return scene;
}
export async function loadAvatar(url: string) {
  const source = await sourceModel(url);
  return {
    scene: cloneAvatar(source.scene),
    animations: source.animations.map((clip) => clip.clone()),
  };
}
