import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { at } from "../i18n/automation";

export type GestureAngle = "front" | "three-quarter" | "side";
export function GestureMentor3D({
  time,
  closeup,
  angle,
  resetToken,
  framing = "full",
  modelUrl = "/avatars/mira-blender/mira-signing-soft.glb",
}: {
  time: number;
  closeup: boolean;
  angle: GestureAngle;
  resetToken: number;
  modelUrl?: string;
  framing?: "full" | "sign" | "letter";
}) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({ time, closeup, angle });
  current.current = { time, closeup, angle };
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    scene.add(new THREE.HemisphereLight(0xfff5e7, 0x657a91, 1.8));
    const key = new THREE.DirectionalLight(0xffecd5, 2.8);
    key.position.set(-2, 4, 4);
    key.target.position.set(0, 1.2, 0);
    scene.add(key, key.target);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.5;
    key.shadow.camera.right = 1.5;
    key.shadow.camera.top = 1.5;
    key.shadow.camera.bottom = -1.5;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 9;
    key.shadow.normalBias = 0.004;
    key.shadow.bias = -0.0003;
    const fill = new THREE.DirectionalLight(0xd6e9ff, 1.5);
    fill.position.set(3, 2, 1);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe1af, 2);
    rim.position.set(0, 3, -3);
    scene.add(rim);
    let mixer: THREE.AnimationMixer | undefined;
    const actions: THREE.AnimationAction[] = [];
    let model: THREE.Group | undefined;
    const disposeModel = (root: THREE.Object3D) => {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
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
      mixer?.setTime(Math.min(8, Math.max(0, t)));
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
        : framing === "full"
          ? 1.95
          : 1.62;
      const radius = baseRadius * (!close && narrow ? 1.13 : 1);
      orbit.target.set(
        close ? (framing === "letter" ? -0.23 : 0) : 0,
        close
          ? framing === "letter"
            ? handHeight
            : 1.3
          : framing === "full"
            ? 1.3
            : 1.38,
        close ? 0.25 : 0.05,
      );
      camera.position.set(
        orbit.target.x + Math.sin(theta) * radius,
        orbit.target.y + 0.04,
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
      render();
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
    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (!alive) {
          disposeModel(gltf.scene);
          return;
        }
        model = gltf.scene;
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            o.frustumCulled = false;
          }
        });
        scene.add(model);
        mixer = new THREE.AnimationMixer(model);
        for (const clip of gltf.animations) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
          actions.push(action);
        }
        setLoading(false);
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
  }, [modelUrl, framing]);
  useEffect(() => api.current?.pose(time), [time]);
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
