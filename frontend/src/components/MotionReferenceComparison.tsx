import { useEffect, useRef, useState } from "react";
import { at } from "../i18n/automation";
import { referenceTime, type MotionAsset } from "../sign/motion";

/** The avatar's shared clock drives the source, even after Blender retiming. */
export function MotionReferenceComparison({ motion, time }: { motion: MotionAsset; time: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const target = useRef(0);
  const [failed, setFailed] = useState(false);
  target.current = referenceTime(motion.sourceTimeline ?? [], time);
  function sync() {
    const el = video.current;
    if (el && el.readyState >= 1 && !el.seeking && Math.abs(el.currentTime - target.current) > 1 / 60) {
      el.currentTime = Math.min(target.current, el.duration);
    }
  }
  useEffect(sync, [time, motion.id]);
  useEffect(() => setFailed(false), [motion.id]);
  return <figure className="motion-reference-comparison">
    <figcaption><strong>{at("Видео → аватар", "Video → avatar", "Бейне → аватар")}</strong>
      <span>{at("Исходное движение человека", "Original human motion", "Адамның бастапқы қимылы")}</span></figcaption>
    {failed ? <p role="status">{at("Видео не загрузилось. Обновите страницу, чтобы повторить.", "Video failed to load. Refresh to retry.", "Бейне жүктелмеді. Бетті жаңартыңыз.")}</p> :
      <video key={motion.reference} ref={video} src={motion.reference} muted playsInline preload="auto"
        aria-label={at(`Видеообразец: ${motion.label}`, `Reference: ${motion.label}`, `Бейнеүлгі: ${motion.label}`)}
        onLoadedMetadata={sync} onSeeked={sync} onError={() => setFailed(true)} />}
    <p>{at("Общая пауза и ползунок — под аватаром. В начале и конце добавлен переход из спокойной позы.", "Use the shared pause and slider below. Preparation and release are added around the recorded gesture.", "Ортақ кідірту мен жүгірткі аватардың астында. Басы мен соңында тыныш қалыпқа ауысу қосылған.")}</p>
    {motion.source && <a href={motion.source} target="_blank" rel="noreferrer">{at("Источник и лицензия · Slovo", "Source and license · Slovo", "Дереккөз және лицензия · Slovo")}</a>}
  </figure>;
}
