import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Repeat, RotateCcw } from "lucide-react";
import { at } from "../i18n/automation";
import type { MotionPlan } from "../sign/motion";
import { alphabet } from "../sign/exercises";
import "./human-sequence.css";

/** Plays the real signer videos (Slovo words, Bukva letters) that the
 * recognizers were trained on, one after another, instead of the 3D avatar. */
export function HumanSequencePlayer({
  plan,
  autoPlay = false,
  onLetterChange,
}: {
  plan: MotionPlan;
  autoPlay?: boolean;
  onLetterChange?: (letter: string) => void;
}) {
  // A step may carry a chain of videos (an authored phrase shown sign by sign).
  const steps = useMemo(
    () =>
      plan.steps.flatMap((s) => {
        const seq = (s as typeof s & { sequence?: { text: string; reference: string }[] }).sequence;
        return seq?.length
          ? seq.map((q, i) => ({ ...s, id: `${s.id}-${i}`, text: q.text, reference: q.reference }))
          : s.reference?.startsWith("/") ? [s] : [];
      }),
    [plan.steps],
  );
  const noVideo = [
    ...plan.missing,
    ...plan.steps
      .filter((s) => !s.reference?.startsWith("/") && !(s as { sequence?: unknown[] }).sequence?.length)
      .map((s) => s.text),
  ];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const current = steps[index];

  useEffect(() => {
    setIndex(0);
    setPlaying(autoPlay);
  }, [steps, autoPlay]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.playbackRate = speed;
    if (playing) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, speed, index]);

  if (!steps.length)
    return (
      <div className="human-player empty" role="status">
        {noVideo.length
          ? `${at("Нет видео для", "No video for", "Бейне жоқ")}: ${noVideo.join(", ")}`
          : at("Выберите слово или букву", "Choose a word or letter", "Сөз не әріп таңдаңыз")}
      </div>
    );
  const single = plan.spelling && plan.steps.length === 1;
  const letterIndex = single ? alphabet.indexOf(plan.steps[0].label) : -1;
  const ended = () => {
    if (index + 1 < steps.length) setIndex(index + 1);
    else if (loop) {
      setIndex(0);
      if (video.current && steps.length === 1) {
        video.current.currentTime = 0;
        void video.current.play().catch(() => {});
      }
    } else setPlaying(false);
  };
  return (
    <div className="human-player">
      <div className="human-stage">
        <video
          ref={video}
          key={`${current.reference}-${index}`}
          src={current.reference}
          muted
          playsInline
          autoPlay={playing}
          onEnded={ended}
          onLoadedMetadata={(e) => (e.currentTarget.playbackRate = speed)}
          aria-label={`${at("Видео жеста", "Sign video", "Ым бейнесі")}: ${current.text}`}
        />
        <span className="human-caption">{current.text}</span>
        {single && letterIndex >= 0 && onLetterChange && (
          <>
            <button
              className="human-nav prev"
              disabled={letterIndex <= 0}
              onClick={() => onLetterChange(alphabet[letterIndex - 1])}
              aria-label={at("Предыдущая буква", "Previous letter", "Алдыңғы әріп")}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="human-nav next"
              disabled={letterIndex >= alphabet.length - 1}
              onClick={() => onLetterChange(alphabet[letterIndex + 1])}
              aria-label={at("Следующая буква", "Next letter", "Келесі әріп")}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
      <div className="human-controls">
        <button className="button primary" onClick={() => setPlaying(!playing)}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
          {playing ? at("Пауза", "Pause", "Кідірту") : at("Показать", "Play", "Көрсету")}
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setIndex(0);
            if (video.current) video.current.currentTime = 0;
            setPlaying(true);
          }}
        >
          <RotateCcw size={18} />
          {at("Сначала", "Restart", "Басынан")}
        </button>
        <div className="human-speed" role="group" aria-label={at("Скорость", "Speed", "Жылдамдық")}>
          {[0.5, 0.75, 1].map((r) => (
            <button key={r} aria-pressed={speed === r} onClick={() => setSpeed(r)}>
              {r}×
            </button>
          ))}
        </div>
        <button className="human-loop" aria-pressed={loop} onClick={() => setLoop(!loop)}>
          <Repeat size={16} />
          {at("Повтор", "Loop", "Қайталау")}
        </button>
      </div>
      {steps.length > 1 && (
        <div className="human-steps">
          {steps.map((s, i) => (
            <button
              key={s.id + i}
              aria-pressed={i === index}
              onClick={() => {
                setIndex(i);
                setPlaying(true);
              }}
            >
              <span>{i + 1}</span>
              {s.text}
            </button>
          ))}
        </div>
      )}
      {noVideo.length > 0 && (
        <p className="human-missing" role="status">
          {at("Нет видео для", "No video for", "Бейне жоқ")}: {noVideo.join(", ")}
        </p>
      )}
    </div>
  );
}

/** Real-signer videos for a fixed list of dictionary signs (e.g. a phrase
 * shown as ТЫ + ИМЯ + КТО?). Missing signs are listed, never invented. */
export function PhraseVideos({ labels, autoPlay = false }: { labels: string[]; autoPlay?: boolean }) {
  const [plan, setPlan] = useState<MotionPlan | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/avatars/sign-motion/catalog.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((assets: MotionPlan["steps"]) => {
        if (!alive) return;
        const steps: MotionPlan["steps"] = [];
        const missing: string[] = [];
        for (const label of labels) {
          const a = assets.find((x) => x.label.toLocaleLowerCase("ru") === label.toLocaleLowerCase("ru") && x.reference?.startsWith("/"));
          if (a) steps.push({ ...a, text: label });
          else missing.push(label);
        }
        setPlan({ steps, missing, spelling: false });
      })
      .catch(() => alive && setPlan({ steps: [], missing: labels, spelling: false }));
    return () => {
      alive = false;
    };
  }, [labels.join("|")]);
  return plan ? <HumanSequencePlayer plan={plan} autoPlay={autoPlay} /> : null;
}
