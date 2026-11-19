import * as THREE from "three";
import { loadAvatar } from "./avatarModel";
import { bindFace, blinker, loadSavedMotion } from "./avatarClips";
import { preserveJointVolume } from "./volumeSkinning";

/** Off-screen render of the avatar for the Studio canvas: the Studio clock picks
 * the clip and its local time, this draws that exact pose into a 3:4 frame.
 * Between signs it plays the breathing idle. */
export class AvatarStage {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 3 / 4, 0.05, 20);
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private idle: THREE.AnimationAction | null = null;
  private faces: THREE.Mesh[] = [];
  private blink = blinker();
  private model: THREE.Object3D | null = null;
  ready: Promise<void>;

  constructor(modelUrl: string, idleUrl: string, width = 480, height = 640) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene.add(new THREE.HemisphereLight(0xfffaf5, 0x9a9691, 2.0));
    const key = new THREE.DirectionalLight(0xfff5ea, 1.8);
    key.position.set(1.2, 2.2, 2.6);
    const fill = new THREE.DirectionalLight(0xf4f5ff, 1.5);
    fill.position.set(-2, 1.4, 1.8);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(0, 2.2, -2);
    this.scene.add(key, fill, rim);
    this.ready = this.load(modelUrl, idleUrl);
  }

  private async load(modelUrl: string, idleUrl: string) {
    const gltf = await loadAvatar(modelUrl);
    const model = gltf.scene;
    this.model = model;
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        if (o instanceof THREE.SkinnedMesh) preserveJointVolume(o);
        o.frustumCulled = false;
        if (o.morphTargetDictionary && Object.keys(o.morphTargetDictionary).length) this.faces.push(o);
      }
    });
    this.scene.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    // Frame chest-up: head height from the rig.
    model.updateMatrixWorld(true);
    const head = new THREE.Vector3();
    model.getObjectByName("mixamorigHead")?.getWorldPosition(head);
    const y = (head.y || 1.62) - 0.22;
    this.camera.position.set(0, y, 2.35);
    this.camera.lookAt(0, y - 0.02, 0);
    try {
      const idle = bindFace((await loadSavedMotion(idleUrl)).clone(), this.faces);
      this.idle = this.mixer.clipAction(idle);
      this.idle.play();
    } catch {
      /* no idle: the clip end pose is used */
    }
  }

  /** Make sure these clips are loaded (call before playback / export). */
  async prepare(urls: string[]) {
    await this.ready;
    await Promise.all(
      [...new Set(urls)].filter((u) => !this.actions.has(u)).map(async (u) => {
        const clip = bindFace((await loadSavedMotion(u)).clone(), this.faces);
        const action = this.mixer!.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        action.weight = 0;
        this.actions.set(u, action);
      }),
    );
  }

  /** Render clip `url` at `local` seconds, or the idle at `t` when url is null. */
  draw(url: string | null, local: number, t: number) {
    if (!this.mixer) return this.canvas;
    const active = url ? this.actions.get(url) : undefined;
    for (const [u, a] of this.actions) {
      a.enabled = a === active;
      a.weight = a === active ? 1 : 0;
      if (a === active) a.time = Math.min(Math.max(0, local), a.getClip().duration);
    }
    if (this.idle) {
      this.idle.enabled = !active;
      this.idle.weight = active ? 0 : 1;
      this.idle.time = t % this.idle.getClip().duration;
    }
    this.mixer.update(0);
    this.blink(this.faces);
    this.renderer.render(this.scene, this.camera);
    return this.canvas;
  }

  dispose() {
    this.mixer?.stopAllAction();
    this.renderer.dispose();
  }
}
