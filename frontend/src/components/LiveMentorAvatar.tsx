import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { at } from "../i18n/automation";

type MouthCue = { start: number; end: number; value: string };
const speechShapes: Record<string, Record<string, number>> = {
  X: {}, A: { mouthPressLeft: .35, mouthPressRight: .35 },
  B: { jawOpen: .10, mouthStretchLeft: .12, mouthStretchRight: .12 },
  C: { jawOpen: .26, mouthStretchLeft: .16, mouthStretchRight: .16 },
  D: { jawOpen: .42 }, E: { jawOpen: .21, mouthFunnel: .48 },
  F: { jawOpen: .10, mouthPucker: .52 },
  G: { jawOpen: .045, mouthRollLower: .38 }, H: { jawOpen: .18 },
};
type View = "portrait" | "body";
export default function LiveMentorAvatar({ onStart }: { onStart?: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const controls = useRef<OrbitControls>();
  const camera = useRef<THREE.PerspectiveCamera>();
  const graph = useRef<{ context: AudioContext; analyser: AnalyserNode; source: MediaElementAudioSourceNode; samples: Uint8Array<ArrayBuffer> }>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<View>("portrait");
  const [audioSource, setAudioSource] = useState("/avatars/live/kim.m4a");
  const [audioName, setAudioName] = useState("ким");
  useEffect(() => () => { if (audioSource.startsWith("blob:")) URL.revokeObjectURL(audioSource); }, [audioSource]);
  const reduced = useRef(false);
  const recordedSpeech = useRef(true);
  const [aligned, setAligned] = useState(false);
  useEffect(() => { recordedSpeech.current = !audioSource.startsWith("blob:"); }, [audioSource]);

  function frameView(next: View) {
    const c = camera.current, orbit = controls.current;
    if (!c || !orbit) return;
    c.position.set(0, next === "portrait" ? 1.64 : 1.03, next === "portrait" ? 0.78 : 3.05);
    orbit.target.set(0, next === "portrait" ? 1.60 : 0.98, 0);
    orbit.minDistance = next === "portrait" ? 0.65 : 1.4;
    orbit.maxDistance = next === "portrait" ? 2 : 4.5;
    orbit.update(); setView(next);
  }

  async function connectAudio() {
    const player = audio.current;
    if (!player) return;
    try {
      if (!graph.current) {
        const context = new AudioContext();
        const analyser = context.createAnalyser(); analyser.fftSize = 512;
        const source = context.createMediaElementSource(player);
        source.connect(analyser); analyser.connect(context.destination);
        graph.current = { context, analyser, source, samples: new Uint8Array(new ArrayBuffer(analyser.fftSize)) };
      }
      await graph.current.context.resume();
    } catch {
      player.pause(); setError(at("Не удалось включить звук. Обновите страницу и попробуйте снова.", "Audio could not start. Refresh and try again.", "Дыбыс қосылмады. Бетті жаңартып, қайталап көріңіз."));
      throw new Error("Audio context unavailable");
    }
  }

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let disposed = false, frame = 0, model: THREE.Group | undefined;
    let renderer: THREE.WebGLRenderer;
    const mouths: Array<{ mesh: THREE.Mesh; index: number }> = [];
    const eyes: Array<{ mesh: THREE.Mesh; index: number }> = [];
    const facial: Array<{ mesh: THREE.Mesh; index: number; name: string }> = [];
    let cues: MouthCue[] = [];
    const abort = new AbortController();
    fetch("/avatars/live/kim-visemes.json", { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error("Lip sync unavailable"); return response.json(); })
      .then(data => { if (!disposed && Array.isArray(data.mouthCues)) { cues = data.mouthCues; setAligned(true); } })
      .catch(() => { /* Any recording can still use the audio-reactive fallback. */ });
    let mixer: THREE.AnimationMixer | undefined;
    let idle: THREE.AnimationAction | undefined, explain: THREE.AnimationAction | undefined;
    let mouth = 0, last = performance.now(), elapsed = 0, gestureWeight = 0;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => { reduced.current = media.matches; }; updateMotion();
    media.addEventListener("change", updateMotion);
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setError(at("Для 3D-просмотра нужен WebGL. Откройте страницу в современном браузере.", "3D requires WebGL. Open this page in a modern browser.", "3D үшін WebGL қажет. Бетті заманауи браузерде ашыңыз.")); return () => media.removeEventListener("change", updateMotion); }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    renderer.domElement.setAttribute("aria-label", at("Живая 3D-модель преподавательницы", "Live 3D teacher model", "Оқытушының тірі 3D моделі"));
    renderer.domElement.setAttribute("role", "img");
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#cbd4da");
    const cam = new THREE.PerspectiveCamera(34, 1, 0.01, 50); camera.current = cam;
    const orbit = new OrbitControls(cam, renderer.domElement); controls.current = orbit;
    orbit.enablePan = false; orbit.enableDamping = true; orbit.dampingFactor = 0.09;
    orbit.minPolarAngle = 0.65; orbit.maxPolarAngle = 1.9; orbit.enableZoom = false;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x788da1, 2.5));
    const key = new THREE.DirectionalLight(0xfff4e7, 3.0); key.position.set(-2, 4, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8eaff, 1.5); fill.position.set(2, 2, -2); scene.add(fill);
    frameView("portrait");
    const resize = () => { const { width, height } = host.getBoundingClientRect(); renderer.setSize(width, height, false); cam.aspect = width / Math.max(height, 1); cam.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const disposeModel = (root: THREE.Object3D) => root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) (mesh as THREE.SkinnedMesh).skeleton.dispose();
    });
    new GLTFLoader().load("/avatars/live/reference-woman.glb", gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = gltf.scene; scene.add(model);
      model.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (/Chestnut|Deep brown/.test(material.name) && material instanceof THREE.MeshPhysicalMaterial) {
            material.anisotropy = 0; material.specularIntensity = .08; material.roughness = .85;
          }
        }
        const dict = mesh.morphTargetDictionary;
        if (dict?.jawOpen !== undefined) mouths.push({ mesh, index: dict.jawOpen });
        for (const [name, index] of Object.entries(dict || {})) {
          if (name === "eyeBlinkLeft" || name === "eyeBlinkRight") eyes.push({ mesh, index });
          else facial.push({ mesh, index, name });
        }
        if (dict?.Blink !== undefined) eyes.push({ mesh, index: dict.Blink });
      });
      mixer = new THREE.AnimationMixer(model);
      // Keep baked Talk/morph tracks disabled: the audio drives the mouth live.
      for (const clip of gltf.animations) {
        if (clip.name !== "Idle" && clip.name !== "Explain") continue;
        const body = new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.filter(track => !track.name.includes("morphTargetInfluences")));
        const action = mixer.clipAction(body).play();
        if (clip.name === "Idle") idle = action; else { explain = action; explain.setEffectiveWeight(0); }
      }
      if (!mouths.length) { setError("В модели не найдено управление ртом."); return; }
      setReady(true);
    }, undefined, () => { if (!disposed) setError(at("3D-модель не загрузилась. Обновите страницу.", "The 3D model could not load. Refresh the page.", "3D модель жүктелмеді. Бетті жаңартыңыз.")); });
    const contextLost = (event: Event) => { event.preventDefault(); audio.current?.pause(); setReady(false); setError(at("3D-просмотр остановлен браузером. Обновите страницу.", "The browser stopped the 3D view. Refresh the page.", "Браузер 3D көріністі тоқтатты. Бетті жаңартыңыз.")); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const animate = (now: number) => {
      if (disposed) return;
      const delta = Math.min((now - last) / 1000, .05); last = now; elapsed += delta;
      const player = audio.current;
      const active = !!player && !player.paused && !player.ended && player.readyState >= 3;
      let level = 0;
      const g = graph.current;
      if (active && g && g.context.state === "running") {
        g.analyser.getByteTimeDomainData(g.samples);
        let sum = 0; for (const sample of g.samples) sum += ((sample - 128) / 128) ** 2;
        level = THREE.MathUtils.clamp((Math.sqrt(sum / g.samples.length) - .007) * 13, 0, 1);
      }
      // Attack/release smoothing follows speech, not an independent looping clip.
      mouth = active ? THREE.MathUtils.damp(mouth, level, level > mouth ? 28 : 18, delta) : 0;
      gestureWeight = THREE.MathUtils.damp(gestureWeight, active && !reduced.current ? .6 : 0, 4, delta);
      idle?.setEffectiveWeight(1 - gestureWeight); explain?.setEffectiveWeight(gestureWeight);
      if (!reduced.current) mixer?.update(delta);
      const phase = elapsed % 4.8;
      const blink = phase > 4.52 ? Math.sin((phase - 4.52) / .28 * Math.PI) : 0;
      const cue = active && recordedSpeech.current ? cues.find(item => player!.currentTime >= item.start && player!.currentTime < item.end) : undefined;
      const targets = cue ? (speechShapes[cue.value] || {}) : { jawOpen: mouth * .36 };
      for (const target of facial) {
        let value = targets[target.name] || 0;
        if (active && !reduced.current && target.name === "browInnerUp") value = .035 * (1 + Math.sin(elapsed * .7));
        const current = target.mesh.morphTargetInfluences![target.index];
        target.mesh.morphTargetInfluences![target.index] = active ? THREE.MathUtils.damp(current, value, 28, delta) : 0;
      }
      for (const target of eyes) target.mesh.morphTargetInfluences![target.index] = Math.max(0, blink);
      host.dataset.mouth = (mouths[0]?.mesh.morphTargetInfluences?.[mouths[0].index] || 0).toFixed(3); host.dataset.viseme = cue?.value || "audio"; host.dataset.speaking = String(active);
      orbit.update(); renderer.render(scene, cam); frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect(); orbit.dispose(); mixer?.stopAllAction();
      audio.current?.pause(); graph.current?.source.disconnect(); graph.current?.analyser.disconnect(); void graph.current?.context.close(); graph.current = undefined;
      media.removeEventListener("change", updateMotion); renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      if (model) disposeModel(model); renderer.dispose(); renderer.domElement.remove(); controls.current = undefined; camera.current = undefined;
    };
  }, []);

  return <article className="lecture-avatar-card live-mentor-card">
    <div className="live-mentor-stage" ref={mount} data-testid="live-mentor-stage">
      {!ready && !error && <span className="live-mentor-loading">{at("Загружаю 3D-модель…", "Loading the 3D model…", "3D модель жүктелуде…")}</span>}
      <span className="live-mentor-badge">{at("Живая 3D-сцена", "Live 3D scene", "Тірі 3D көрініс")}</span>
    </div>
    <div className="lecture-avatar-details">
      <h3>{at("Преподавательница по вашему фото · 3D", "Teacher from your photo · 3D", "Фотосуретіңізден жасалған оқытушы · 3D")}</h3>
      <p>{at("Потяните за модель, чтобы повернуть её.", "Drag the model to rotate it.", "Модельді бұру үшін сүйреңіз.")}</p>
      <p>{at("Запись:", "Recording:", "Жазба:")} {audioName}</p>
      <div className="live-mentor-toolbar">
        <button type="button" onClick={() => frameView(view === "portrait" ? "body" : "portrait")} disabled={!ready}>{view === "portrait" ? at("В полный рост", "Full body", "Толық бой") : at("Крупный план", "Close-up", "Жақын көрініс")}</button>
        <button type="button" disabled={!ready} onClick={() => frameView(view)}>{at("Сбросить поворот", "Reset view", "Көріністі қалпына келтіру")}</button>
      </div>
      <audio ref={audio} controls={ready} preload="metadata" src={audioSource} aria-label={`${at("Аудиозапись", "Audio recording", "Аудиожазба")}: ${audioName}`}
        onPlay={() => { onStart?.(); setPlaying(true); void connectAudio().catch(() => {}); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => setError(at("Не удалось загрузить аудиозапись.", "Could not load the audio recording.", "Аудиожазба жүктелмеді."))} />
      <button type="button" className="mentor-cta" disabled={!ready || !!error} onClick={async () => {
        const player = audio.current; if (!player) return;
        if (!player.paused) { player.pause(); return; }
        if (player.ended) player.currentTime = 0;
        try { await connectAudio(); await player.play(); } catch { setError(at("Не удалось запустить запись. Попробуйте снова.", "Could not play the recording. Try again.", "Жазба қосылмады. Қайталап көріңіз.")); }
      }}>{playing ? at("Пауза", "Pause", "Кідірту") : at("Включить аватара", "Start avatar", "Аватарды қосу")}</button>
      {error && <p role="alert">{error}</p>}
      <label className="live-mentor-upload">{at("Попробовать другую аудиозапись", "Try another audio recording", "Басқа аудиожазбаны сынау")}<input type="file" accept="audio/*" onChange={event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 50 * 1024 * 1024) { setError(at("Выберите запись до 50 МБ.", "Choose a recording under 50 MB.", "50 МБ-тан кіші жазбаны таңдаңыз.")); return; }
        audio.current?.pause(); setPlaying(false); setError(""); setAudioName(file.name); setAudioSource(URL.createObjectURL(file));
      }} /></label>
      <p className="live-mentor-note">{aligned && !audioSource.startsWith("blob:")
        ? at("Запись «ким»: автоматическая разметка звуков и плавные переходы между формами губ. Это первая версия, артикуляция ещё требует ручной доработки.", "Kim recording: automatically aligned mouth shapes with smooth transitions. This first version still needs articulation refinement.", "«Ким» жазбасы: дыбыстар автоматты белгіленіп, ерін пішіндері бірқалыпты ауысады. Бұл алғашқы нұсқа, артикуляцияны әлі жетілдіру қажет.")
        : at("Для выбранной записи рот реагирует на громкость: отдельная разметка звуков ещё не создана.", "For this recording, the mouth follows audio level; no sound alignment has been created yet.", "Бұл жазба үшін ауыз дыбыс деңгейіне жауап береді; дыбыстар әлі белгіленбеген.")}</p>
    </div>
  </article>;
}
