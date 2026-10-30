import { useEffect, useRef, useState } from "react";
import type { DictionaryEntry } from "../sign/dictionary";
import { at } from "../i18n/automation";
export function ReferenceVideo({ entry }: { entry: DictionaryEntry }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1),
    [loop, setLoop] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed, entry.video]);
  return (
    <div className="sign-reference-player panel">
      <div className="sign-reference-heading">
        <strong>{entry.label}</strong>
        <span>
          {at(
            "Видеообразец человека",
            "Human reference",
            "Адамның бейнеүлгісі",
          )}
        </span>
      </div>
      <video
        key={entry.video}
        ref={ref}
        src={entry.video}
        poster={entry.poster}
        controls
        playsInline
        preload="metadata"
        loop={loop}
        onError={() => setFailed(true)}
        onLoadedMetadata={() => {
          setFailed(false);
          if (ref.current) ref.current.playbackRate = speed;
        }}
      />
      {failed && (
        <p role="alert">
          {at(
            "Видео не загрузилось. Обновите страницу или откройте источник.",
            "Video could not load. Refresh or open the source.",
            "Бейне жүктелмеді. Бетті жаңартыңыз не дереккөзді ашыңыз.",
          )}
        </p>
      )}
      <div className="sign-reference-controls">
        <label>
          {at("Скорость", "Speed", "Жылдамдық")}{" "}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value=".5">0.5×</option>
            <option value=".75">0.75×</option>
            <option value="1">1×</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />
          {at("Повторять", "Loop", "Қайталау")}
        </label>
        <a href={entry.source} target="_blank" rel="noreferrer">
          {entry.dataset} ↗
        </a>
      </div>
    </div>
  );
}
