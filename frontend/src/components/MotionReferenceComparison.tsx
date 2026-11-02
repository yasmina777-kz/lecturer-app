import { useEffect, useRef, useState } from "react";
import { at } from "../i18n/automation";
import { referenceTime, type MotionAsset } from "../sign/motion";

/** The avatar's shared clock drives the source, even after Blender retiming. */
export function MotionReferenceComparison({ motion, time }: { motion: MotionAsset; time: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const target = useRef(0);
  const [failed, setFailed] = useState(false);
  const localVideo = motion.reference?.startsWith("/");
  const synchronized = !!motion.sourceTimeline?.length;
  const videoSource = motion.referenceTracking?.source ?? motion.source;
  target.current = referenceTime(motion.sourceTimeline ?? [], time);
  function sync() {
    const el = video.current;
    if (synchronized && el && el.readyState >= 1 && !el.seeking && Math.abs(el.currentTime - target.current) > 1 / 60) {
      el.currentTime = Math.min(target.current, el.duration);
    }
  }
  useEffect(sync, [time, motion.id]);
  useEffect(() => setFailed(false), [motion.id]);
  return <figure className="motion-reference-comparison">
    <figcaption><strong>{synchronized ? at("Видео → аватар", "Video → avatar", "Бейне → аватар") : at("Сравните с видео", "Compare with video", "Бейнемен салыстырыңыз")}</strong>
      <span>{at("Исходное движение человека", "Original human motion", "Адамның бастапқы қимылы")}</span></figcaption>
    {!localVideo ? <div className="motion-external-reference">
      <strong>{motion.label}</strong>
      <p>{motion.sourceRecording?.organization}</p>
      <a className="button secondary" href={motion.reference} target="_blank" rel="noreferrer">{at("Смотреть исходник на YouTube", "Watch the original on YouTube", "YouTube-та түпнұсқаны көру")}</a>
    </div> : failed ? <p role="status">{at("Видео не загрузилось. Обновите страницу, чтобы повторить.", "Video failed to load. Refresh to retry.", "Бейне жүктелмеді. Бетті жаңартыңыз.")}</p> :
      <video key={motion.reference} ref={video} src={motion.reference} muted playsInline controls={!synchronized} preload="metadata"
        aria-label={at(`Видеообразец: ${motion.label}`, `Reference: ${motion.label}`, `Бейнеүлгі: ${motion.label}`)}
        onLoadedMetadata={sync} onSeeked={sync} onError={() => setFailed(true)} />}
    <p>{localVideo ? synchronized ? at("Общая пауза и ползунок — под аватаром. В начале и конце добавлен переход из спокойной позы.", "Use the shared pause and slider below. Preparation and release are added around the recorded gesture.", "Ортақ кідірту мен жүгірткі аватардың астында. Басы мен соңында тыныш қалыпқа ауысу қосылған.") : at("Это видео для сравнения. Запустите его кнопкой на видео: этот образец пока не синхронизирован с аватаром.", "Use the video play button to compare: this reference is not synchronized with the avatar yet.", "Салыстыру үшін бейненің ойнату батырмасын басыңыз: бұл үлгі аватармен әлі синхрондалмаған.") : at("Исходник открывается отдельно с нужного места. Аватар воспроизводит сохранённую анимацию по этой записи; мимика пока не перенесена.", "The original opens separately at the reference timestamp. The avatar uses motion captured from it; facial motion is not transferred yet.", "Түпнұсқа қажетті жерден бөлек ашылады. Аватар осы жазбадағы қимылды көрсетеді; мимика әлі көшірілмеген.")}</p>
    {videoSource && <a href={videoSource} target="_blank" rel="noreferrer">{at("Источник видео и условия использования", "Video source and terms", "Бейне дереккөзі және пайдалану шарттары")}</a>}
  </figure>;
}
