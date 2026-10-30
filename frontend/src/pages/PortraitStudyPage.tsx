import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './portrait-study.css';

const ASSETS = '/avatars/portrait-study/';

/** Isolated art review. The main lecturer and its saved preferences are unchanged. */
export default function PortraitStudyPage() {
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLAudioElement>(null);
  const resetView = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = stage.current;
    if (!host) return;
    let disposed = false, frame = 0;
    let model: THREE.Group | undefined, mixer: THREE.AnimationMixer | undefined;
    const morphs: THREE.Mesh[] = [];
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#c8cdd0');
    const camera = new THREE.PerspectiveCamera(27, 1, .01, 20);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setError('Браузер не смог открыть 3D-сцену. Попробуйте Chrome или Safari с включённым WebGL.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.setAttribute('aria-label', 'Пробный 3D-портрет преподавательницы. Потяните, чтобы повернуть.');
    renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true; orbit.enablePan = false; orbit.enableZoom = true;
    orbit.minDistance = .75; orbit.maxDistance = 1.6;
    orbit.minPolarAngle = 1.2; orbit.maxPolarAngle = 1.8;
    orbit.minAzimuthAngle = -.6; orbit.maxAzimuthAngle = .6;
    resetView.current = () => { camera.position.set(0, 1.64, 1.18); orbit.target.set(0, 1.59, 0); orbit.update(); };
    resetView.current();
    scene.add(new THREE.HemisphereLight(0xf5f5f5, 0xb2afb0, 2.1));
    const key = new THREE.DirectionalLight(0xfff3e8, 1.8); key.position.set(-1, 2.1, 3); scene.add(key);
    const fill = new THREE.DirectionalLight(0xe8f1ff, 1.4); fill.position.set(2, 1.7, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, .6); rim.position.set(.4, 2, -2); scene.add(rim);
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const disposeModel = (root: THREE.Object3D) => {
      const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      root.traverse(object => {
        const mesh = object as THREE.Mesh; if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
      });
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
      textures.forEach(texture => texture.dispose());
    };
    new GLTFLoader().load(`${ASSETS}portrait-study.glb`, gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = gltf.scene; scene.add(model);
      model.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.morphTargetInfluences) morphs.push(mesh); });
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(clip => { mixer!.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play(); });
      setReady(true);
    }, undefined, () => { if (!disposed) setError('Не удалось загрузить модель. Обновите страницу, чтобы повторить.'); });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const animate = () => {
      if (disposed) return;
      const audio = player.current;
      const active = !!audio && !audio.paused && !audio.ended && audio.readyState >= 3;
      // One clock: seeking, pausing and resuming follow actual media time.
      mixer?.setTime(Math.min(audio?.currentTime || 0, 7.9999));
      if (!active) morphs.forEach(mesh => mesh.morphTargetInfluences!.fill(0));
      if (reduced.matches) model?.getObjectByName('Portrait_head_pivot')?.rotation.set(0, 0, 0);
      const face = morphs.find(mesh => mesh.morphTargetDictionary?.jawOpen !== undefined);
      host.dataset.speaking = String(active);
      host.dataset.mouth = String(face?.morphTargetInfluences?.[face.morphTargetDictionary!.jawOpen] || 0);
      host.dataset.time = String(audio?.currentTime || 0);
      orbit.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    const lost = (event: Event) => { event.preventDefault(); player.current?.pause(); setReady(false); setError('3D-сцена остановлена браузером. Обновите страницу.'); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); orbit.dispose(); mixer?.stopAllAction();
      player.current?.pause(); renderer.domElement.removeEventListener('webglcontextlost', lost);
      if (model) disposeModel(model); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  async function togglePlayback() {
    const audio = player.current; if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    if (audio.ended) audio.currentTime = 0;
    try { await audio.play(); setError(''); }
    catch { setError('Не удалось включить звук. Нажмите воспроизведение ещё раз.'); }
  }

  return <main className="portrait-study">
    <header><a href="/">← AI Mentor</a><span>Проба аватара · 02</span></header>
    <div className="portrait-study-layout">
      <section className="portrait-study-viewer" aria-label="Просмотр аватара">
        <div ref={stage} className="portrait-study-stage" data-testid="portrait-study-stage">
          {!ready && !error && <span className="portrait-study-loading">Загружаю 3D-портрет…</span>}
          <span className="portrait-study-label">3D · можно повернуть</span>
        </div>
        <div className="portrait-study-controls">
          <button disabled={!ready} onClick={togglePlayback}>{playing ? 'Пауза' : 'Послушать · 8 секунд'}</button>
          <button className="secondary" disabled={!ready} onClick={() => resetView.current()}>Повернуть лицом</button>
          <audio ref={player} src={`${ASSETS}kim-preview.wav`} controls={ready} preload="metadata" aria-label="Запись ким — проба на 8 секунд"
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
            onError={() => setError('Не удалось загрузить аудиозапись.')} />
          {error && <p role="alert">{error}</p>}
        </div>
      </section>
      <aside>
        <p className="portrait-study-eyebrow">Лицо, голос и движение</p>
        <h1>Знакомимся<br/>с новым портретом.</h1>
        <p>Короткая проба перед переносом в лекции. Звучит ваша запись «ким»; движения губ и головы сохранены в Blender и воспроизводятся на 3D-модели.</p>
        <div className="portrait-study-reference"><img src={`${ASSETS}reference.jpg`} alt="Исходный портрет, предоставленный для аватара"/><div><strong>Ваш референс</strong><p>Сравните черты лица и выражение. Причёска пока приблизительная.</p></div></div>
        <ul><li>Мягкие переходы между формами губ</li><li>Моргание и небольшие движения головы</li><li>Пауза и продолжение синхронно со звуком</li></ul>
        <p className="portrait-study-note">Это рабочая 3D-проба, ещё не точная копия фотографии. Профиль, волосы и артикуляция требуют дальнейшей доработки.</p>
        <details><summary>Бесплатные материалы и авторы</summary><p>Основа плеч и одежды — MakeHuman Community, CC0. Волосы «elvs_hazel_hair» — Elvaerwyn, CC-BY; изменены посадка, сглаживание и цвет. <a href="https://static.makehumancommunity.org/assets/assetpacks/hair02.html" target="_blank" rel="noreferrer">Источник волос</a>. Лицо — ранее сохранённая реконструкция по вашему фото; для воспроизведения FaceBuilder не требуется.</p></details>
      </aside>
    </div>
  </main>;
}
