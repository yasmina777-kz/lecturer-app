import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  AvatarPlayback,
  type AvatarPlaybackState,
} from "../sign/avatarPlayback";
import { preserveJointVolume } from "../sign/volumeSkinning";
import { signingBounds, fitSigningFrame } from "../sign/motionFraming";
import { composeMotion } from "../sign/composeMotion";
import { at } from "../i18n/automation";

export type GestureAngle = "front" | "three-quarter" | "side";
export function GestureMentor3D({
  time,
  motionUrls,
  motionTrims,
  playbackState,
  onReadyChange,
  closeup,
  angle,
  resetToken,
  framing = "full",
  modelUrl = "/avatars/mira-blender/mira-signing-soft.glb",
}: {
  time: number;
  playbackState?: AvatarPlaybackState;
  motionUrls?: string[];
  motionTrims?: { start: number; end: number; gapAfter?: number }[];
  onReadyChange?: (ready: boolean) => void;
  closeup: boolean;
  angle: GestureAngle;
  resetToken: number;
  modelUrl?: string;
  framing?: "full" | "sign" | "letter" | "body";
}) {
  const readyCallback = useRef(onReadyChange);
  readyCallback.current = onReadyChange;
  const motionKey = JSON.stringify(motionUrls ?? []);
  const trimKey = JSON.stringify(motionTrims ?? []);
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({ time, closeup, angle, playbackState });
  current.current = { time, closeup, angle, playbackState };
  const naturalIdle = playbackState !== undefined;
  const api = useRef<{
    pose: (t: number) => void;
    view: (close: boolean, angle: GestureAngle) => void;
  }>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      at(
        "Объёмная наставница с анимацией кистей и пальцев",
        "3D mentor with articulated hands and fingers",
        "Қолдары мен саусақтары қозғалатын 3D тәлімгер",
      ),
    );
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff5e7, 0x657a91, 1.2));
    const key = new THREE.DirectionalLight(0xffecd5, 2.4);
    key.position.set(-2, 4, 4);
    key.target.position.set(0, 1.2, 0);
    scene.add(key, key.target);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -1.0;
    key.shadow.camera.right = 1.0;
    key.shadow.camera.top = 1.2;
    key.shadow.camera.bottom = -1.2;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 9;
    key.shadow.normalBias = 0.0008;
    key.shadow.bias = -0.00005;
    key.shadow.radius = 3;
    const fill = new THREE.DirectionalLight(0xd6e9ff, 1.1);
    fill.position.set(3, 2, 1);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe1af, 1.2);
    rim.position.set(0, 3, -3);
    scene.add(rim);
    let clipDuration = 8;
    let mixer: THREE.AnimationMixer | undefined;
    const actions: THREE.AnimationAction[] = [];
    let playback: AvatarPlayback | undefined;
    let idleFrame = 0,
      lastIdleFrame = 0;
    let model: THREE.Group | undefined;
    const disposeModel = (root: THREE.Object3D) => {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          if (o.customDepthMaterial) materials.add(o.customDepthMaterial);
          if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(
            (m) => {
              materials.add(m);
              Object.values(m).forEach((value) => {
                if (value instanceof THREE.Texture) textures.add(value);
              });
            },
          );
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => {
        t.dispose();
        if (
          typeof ImageBitmap !== "undefined" &&
          t.image instanceof ImageBitmap
        )
          t.image.close();
      });
    };
    let motionBounds = new THREE.Box3();
    let fullMotionBounds = new THREE.Box3();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 20);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enablePan = false;
    orbit.enableZoom = false;
    orbit.enableDamping = false;
    orbit.minPolarAngle = 0.5;
    orbit.maxPolarAngle = 2.15;
    let alive = true,
      visible = true;
    const render = () => {
      if (alive && visible) renderer.render(scene, camera);
    };
    // Scrubbing and pause use the same Blender-baked animation clock.
    const pose = (t: number) => {
      actions.forEach((action) => {
        action.paused = false;
        action.enabled = true;
      });
      if (playback)
        playback.update(t, current.current.playbackState ?? "paused", 0);
      else mixer?.setTime(Math.min(clipDuration, Math.max(0, t)));
      mount.dataset.poseTime = t.toFixed(2);
      render();
    };
    const view = (close: boolean, direction: GestureAngle) => {
      const theta =
        direction === "front"
          ? 0
          : direction === "side"
            ? Math.PI * 0.43
            : Math.PI * 0.18;
      const handHeight = modelUrl.includes("letter-g")
        ? 1.18
        : modelUrl.includes("letter-l")
          ? 1.1
          : modelUrl.includes("letter-u")
            ? 1.35
            : 1.43;
      const narrow = mount.clientWidth / Math.max(1, mount.clientHeight) < 0.95;
      const baseRadius = close
        ? framing === "letter"
          ? 0.76
          : 1.08
        : framing === "body"
          ? 3.6
          : framing === "full"
            ? 1.95
            : 1.62;
      let radius =
        !close && motionKey !== "[]"
          ? Math.max(
              baseRadius,
              Math.min(
                2.8,
                0.58 /
                  (Math.tan((16 * Math.PI) / 180) *
                    (mount.clientWidth / Math.max(1, mount.clientHeight))),
              ),
            )
          : baseRadius * (!close && narrow ? 1.13 : 1);
      orbit.target.set(
        close ? (framing === "letter" ? -0.23 : 0) : 0,
        close
          ? framing === "letter"
            ? handHeight
            : 1.3
          : framing === "body"
            ? 0.9
            : framing === "full"
              ? 1.3
              : 1.38,
        close ? 0.25 : 0.05,
      );
      if (close && !motionBounds.isEmpty()) {
        const fit = fitSigningFrame(motionBounds, camera.aspect, theta);
        orbit.target.copy(fit.target);
        radius = fit.radius;
      }
      if (!close && (framing === "sign" || framing === "letter") && !fullMotionBounds.isEmpty()) {
        const fit = fitSigningFrame(fullMotionBounds, camera.aspect, theta);
        orbit.target.copy(fit.target);
        radius = Math.max(radius, fit.radius);
      }
      camera.position.set(
        orbit.target.x + Math.sin(theta) * radius,
        orbit.target.y,
        orbit.target.z + Math.cos(theta) * radius,
      );
      orbit.update();
      render();
    };
    orbit.addEventListener("change", render);
    const resize = () => {
      const box = mount.getBoundingClientRect();
      renderer.setSize(box.width, box.height, false);
      camera.aspect = box.width / Math.max(1, box.height);
      camera.updateProjectionMatrix();
      view(current.current.closeup, current.current.angle);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    const visibility = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) pose(current.current.time);
    });
    visibility.observe(mount);
    const lost = (e: Event) => {
      e.preventDefault();
      setError(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    api.current = { pose, view };
    view(current.current.closeup, current.current.angle);
    resize();
    pose(current.current.time);
    setError(false);
    setLoading(true);
    readyCallback.current?.(false);
    new GLTFLoader().load(
      modelUrl,
      async (gltf) => {
        if (!alive) {
          disposeModel(gltf.scene);
          return;
        }
        model = gltf.scene;
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            if (o instanceof THREE.SkinnedMesh) preserveJointVolume(o);
            o.castShadow = true;
            o.receiveShadow = true;
            o.frustumCulled = false;
          }
        });
        scene.add(model);
        mixer = new THREE.AnimationMixer(model);
        let clips = naturalIdle ? [] : gltf.animations;
        let idleClip: THREE.AnimationClip | undefined;
        try {
          if (naturalIdle) {
            const idleResponse = await fetch("/avatars/sign-motion/ready-idle.json", { cache: "no-cache" });
            if (!idleResponse.ok) throw new Error("Missing idle motion metadata");
            const idleMetadata = await idleResponse.json();
            if (typeof idleMetadata.revision !== "string") throw new Error("Missing idle motion revision");
            const idle = await new GLTFLoader().loadAsync(
              `/avatars/sign-motion/ready-idle.glb?v=${encodeURIComponent(idleMetadata.revision)}`,
            );
            idleClip = idle.animations[0];
            disposeModel(idle.scene);
            if (!idleClip) throw new Error("Missing idle animation");
          }
          const urls: string[] = JSON.parse(motionKey);
          if (urls.length) {
            const sources = new Map<string, THREE.AnimationClip>();
            await Promise.all(
              [...new Set(urls)].map(async (url) => {
                const asset = await new GLTFLoader().loadAsync(url);
                const clip = asset.animations[0];
                if (clip) sources.set(url, clip);
                disposeModel(asset.scene);
                if (!clip) throw new Error("Empty animation");
              }),
            );
            if (!alive) return;
            clips = [
              composeMotion(
                urls.map((url) => sources.get(url)!),
                undefined,
                JSON.parse(trimKey),
              ),
            ];
          }
        } catch {
          if (alive) {
            setLoading(false);
            setError(true);
            readyCallback.current?.(false);
          }
          return;
        }
        if (!alive) return;
        clipDuration = Math.max(0, ...clips.map((clip) => clip.duration));
        if (motionKey !== "[]" && clips[0]) {
          fullMotionBounds = signingBounds(model, clips[0]);
          motionBounds = framing === "letter" ? signingBounds(model, clips[0], true) : fullMotionBounds;
          view(current.current.closeup, current.current.angle);
        }
        if (idleClip) {
          playback = new AvatarPlayback(mixer, clips, idleClip);
          const tickIdle = (now: number) => {
            const dt = lastIdleFrame
              ? Math.min(0.05, (now - lastIdleFrame) / 1000)
              : 0;
            lastIdleFrame = visible && !document.hidden ? now : 0;
            if (visible && !document.hidden) {
              playback!.update(
                current.current.time,
                current.current.playbackState ?? "paused",
                dt,
              );
              mount.dataset.playbackState =
                current.current.playbackState ?? "paused";
              if (current.current.playbackState !== "paused") render();
            }
            if (alive) idleFrame = requestAnimationFrame(tickIdle);
          };
          idleFrame = requestAnimationFrame(tickIdle);
        }
        for (const clip of idleClip ? [] : clips) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
          actions.push(action);
        }
        setLoading(false);
        readyCallback.current?.(true);
        mount.dataset.model = "blender-mira-v3-soft";
        pose(current.current.time);
      },
      undefined,
      () => {
        if (alive) {
          setLoading(false);
          setError(true);
        }
      },
    );
    return () => {
      alive = false;
      cancelAnimationFrame(idleFrame);
      api.current = undefined;
      observer.disconnect();
      visibility.disconnect();
      orbit.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      mixer?.stopAllAction();
      if (model) mixer?.uncacheRoot(model);
      disposeModel(scene);
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelUrl, framing, motionKey, trimKey, naturalIdle]);
  useEffect(() => api.current?.pose(time), [time, playbackState]);
  useEffect(
    () => api.current?.view(closeup, angle),
    [closeup, angle, resetToken],
  );
  return (
    <div className="gesture-3d" ref={host} aria-busy={loading}>
      {loading && !error && (
        <div className="gesture-3d-error" role="status">
          {at(
            "Загружаем наставницу…",
            "Loading your mentor…",
            "Тәлімгер жүктелуде…",
          )}
        </div>
      )}
      {error && (
        <div className="gesture-3d-error" role="alert">
          {at(
            "Не удалось загрузить 3D-модель. Обновите страницу и проверьте поддержку WebGL.",
            "The 3D model could not load. Refresh and check WebGL support.",
            "3D модель жүктелмеді. Бетті жаңартып, WebGL қолдауын тексеріңіз.",
          )}
        </div>
      )}
    </div>
  );
}
