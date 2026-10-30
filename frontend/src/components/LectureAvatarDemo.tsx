import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { at } from "../i18n/automation";
const LiveMentorAvatar = lazy(() => import("./LiveMentorAvatar"));

export function LectureAvatarDemo() {
  const section = useRef<HTMLElement>(null);
  const male = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);
  return <section id="talking-avatars" ref={section} className="mentor-section lecture-avatar-demo"
    onPlayCapture={event => { section.current?.querySelectorAll("audio, video").forEach(media => { if (media !== event.target) (media as HTMLMediaElement).pause(); }); }}>
    <div className="mentor-section-heading">
      <span className="mentor-kicker">{at("Посмотрите и послушайте", "Watch and listen", "Көріңіз және тыңдаңыз")}</span>
      <h2>{at("Наставник в живой 3D-сцене", "A mentor in a live 3D scene", "Тірі 3D көріністегі тәлімгер")}</h2>
      <p>{at("Включите запись: движения рта рассчитываются прямо во время речи. Модель можно повернуть и рассмотреть в полный рост.", "Play the recording: mouth movements are calculated during speech. Rotate the model or view it full length.", "Жазбаны қосыңыз: ауыз қимылы сөйлеу кезінде есептеледі. Модельді бұрып, толық бойымен көруге болады.")}</p>
    </div>
    <div className="lecture-avatar-grid">
      {visible ? <Suspense fallback={<div className="lecture-avatar-card live-mentor-placeholder">{at("Загружаю 3D-просмотр…", "Loading 3D view…", "3D көрініс жүктелуде…")}</div>}><LiveMentorAvatar /></Suspense> : <div className="lecture-avatar-card live-mentor-placeholder" />}
      <article className="lecture-avatar-card">
        <video ref={male} controls playsInline preload="metadata" poster="/avatars/lecture-demo/male-portrait.png"
          src="/avatars/lecture-demo/male-demo.mp4" aria-label={at("Мужской видеопример", "Male video sample", "Ер адамның бейне үлгісі")}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setError(true)} />
        <div className="lecture-avatar-details"><h3>{at("Преподаватель", "Male teacher", "Ер оқытушы")}</h3>
          <p>{at("Прежний видеопример · без изменений", "Previous video sample · unchanged", "Бұрынғы бейне үлгі · өзгеріссіз")}</p>
          <button type="button" className="mentor-cta" onClick={async () => {
            const player = male.current; if (!player) return;
            if (!player.paused) { player.pause(); return; }
            if (player.ended) player.currentTime = 0;
            player.muted = false;
            try { await player.play(); setError(false); } catch { setError(true); }
          }}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? at("Пауза", "Pause", "Кідірту") : at("Послушать", "Listen", "Тыңдау")}</button>
          {error && <p role="alert">{at("Видео не загрузилось.", "Video could not load.", "Бейне жүктелмеді.")} <a href="/avatars/lecture-demo/male-demo.mp4">MP4</a></p>}
        </div>
      </article>
    </div>
    <p className="lecture-avatar-caption">{at("Слева — первая 3D-реконструкция лица по вашей фотографии. Волосы и тело смоделированы отдельно; ракурсы, которых нет на фото, приблизительные.", "Left: a first 3D face reconstruction from your photo. Hair and body are authored separately; unseen angles are approximations.", "Сол жақта — фотосуретіңіз бойынша жасалған алғашқы 3D бет моделі. Шаш пен дене бөлек жасалды; суретте жоқ ракурстар шамамен құрастырылды.")}</p>
  </section>;
}
