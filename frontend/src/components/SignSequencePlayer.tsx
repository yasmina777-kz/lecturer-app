import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ScanSearch,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { at } from "../i18n/automation";
import { motionTimeline, type MotionPlan } from "../sign/motion";
import { letterPreviewTime, letterEndTime } from "../sign/letterPreview";
import { alphabet } from "../sign/exercises";
import type { GestureAngle } from "./GestureMentor3D";
import { AlphabetCardArt } from "./AlphabetCardArt";
import { alphabetIllustration } from "../sign/alphabetIllustrations";
import "../pages/gesture-preview.css";
import "../pages/sign-trainer.css";
import "../pages/sign-dictionary.css";
const Mentor = lazy(() =>
  import("./GestureMentor3D").then((m) => ({ default: m.GestureMentor3D })),
);
export function SignSequencePlayer({
  plan,
  modelUrl = "/avatars/hand-workshop/mira-rig.glb?v=denim-4",
  autoPlay = false,
  framing = "sign",
  note,
  onLetterChange,
  naturalIdle = framing === "sign",
  studio = false,
}: {
  plan: MotionPlan;
  modelUrl?: string;
  autoPlay?: boolean;
  framing?: "sign" | "body";
  note?: string;
  onLetterChange?: (letter: string) => void;
  naturalIdle?: boolean;
  studio?: boolean;
}) {
  const timeline = useMemo(() => motionTimeline(plan.steps), [plan.steps]);
  const urls = useMemo(
    () =>
      plan.steps.map((s) => (s.revision ? `${s.url}?v=${s.revision}` : s.url)),
    [plan.steps],
  );
  const trims = useMemo(
    () =>
      timeline.map((s) => ({
        start: s.trimStart,
        end: s.trimEnd,
        gapAfter: s.gapAfter,
      })),
    [timeline],
  );
  const duration = timeline[timeline.length - 1]?.end ?? 0;
  const singleLetter = plan.spelling && plan.steps.length === 1;
  const previewTime = singleLetter ? letterPreviewTime(plan.steps[0]) : 0;
  const letterEnd = singleLetter ? letterEndTime(plan.steps[0]) : duration;
  const initialPreview = singleLetter && !autoPlay;
  const [started, setStarted] = useState(autoPlay || initialPreview);
  const [time, setTime] = useState(initialPreview ? previewTime : 0),
    [playing, setPlaying] = useState(autoPlay),
    [ready, setReady] = useState(false),
    [speed, setSpeed] = useState(1),
    [loop, setLoop] = useState(false),
    [close, setClose] = useState(false),
    [inspecting, setInspecting] = useState(initialPreview),
    [angle, setAngle] = useState<GestureAngle>("front");
  const clock = useRef(initialPreview ? previewTime : 0);
  const stage = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.5),
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [plan.missing.length, plan.steps.length]);
  const blocked = plan.missing.length > 0 || !plan.steps.length;
  useEffect(() => {
    if (!playing || !ready || blocked || !visible) return;
    let frame = 0,
      last = 0;
    const tick = (now: number) => {
      if (document.hidden) {
        last = 0;
        frame = requestAnimationFrame(tick);
        return;
      }
      // Keep 1× tied to elapsed time. Capping every frame at 50 ms made
      // playback run in slow motion whenever rendering dropped below 20 fps.
      clock.current += last ? Math.max(0, (now - last) / 1000) * speed : 0;
      last = now;
      const end = singleLetter && !loop ? letterEnd : duration;
      if (clock.current >= end) {
        if (loop) clock.current %= duration;
        else {
          // Keep the letter visible after its full motion, rather than leaving
          // the learner looking at the relaxed hands in the release frames.
          clock.current = end;
          setTime(clock.current);
          setInspecting(singleLetter);
          setPlaying(false);
          return;
        }
      }
      setTime(clock.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    playing,
    ready,
    blocked,
    visible,
    speed,
    loop,
    duration,
    singleLetter,
    letterEnd,
  ]);
  const current =
    timeline.find((s) => time < s.end) ?? timeline[timeline.length - 1];
  const chartLetter =
    current?.id.startsWith("letter-") && alphabetIllustration(current.label)
      ? current.label
      : undefined;
  function seek(t: number) {
    setInspecting(false);
    setStarted(true);
    clock.current = t;
    setTime(t);
    setPlaying(false);
  }
  return (
    <section className="sign-sequence">
      <div className="sign-sequence-heading">
        <h2>
          {at("Показ аватаром", "Avatar demonstration", "Аватар көрсетілімі")}
        </h2>
        <span>
          {at("Пробная анимация", "Experimental motion", "Сынақ анимациясы")}
        </span>
      </div>
      {chartLetter && (
        <div className="sign-letter-comparison">
          <AlphabetCardArt letter={chartLetter} />
          <div>
            <strong>
              {at(
                `Буква ${chartLetter}`,
                `Letter ${chartLetter}`,
                `${chartLetter} әрпі`,
              )}
            </strong>
            <button
              className="button secondary"
              disabled={!ready || blocked}
              onClick={() => {
                seek(current.start + letterPreviewTime(current));
                setInspecting(true);
                setClose(true);
                setAngle("front");
              }}
            >
              <ScanSearch size={17} />
              {at("Крупнее", "Enlarge", "Үлкейту")}
            </button>
          </div>
        </div>
      )}
      {blocked && plan.missing.length > 0 && (
        <p className="sign-sequence-missing" role="status">
          {at(
            "Не хватает движений для:",
            "Missing motion for:",
            "Қимылдары жоқ:",
          )}{" "}
          <strong>
            {plan.missing.join(", ") ||
              at("пустого текста", "empty text", "бос мәтін")}
          </strong>
          .{" "}
          {at(
            "Показ всей фразы не запущен, чтобы не пропустить её часть.",
            "The full sequence will not play with missing words.",
            "Сөздер түсіп қалмауы үшін толық көрсетілім басталмады.",
          )}
        </p>
      )}
      {(!blocked || naturalIdle) && (
        <>
          <div className="sign-avatar-player gesture-page">
            <div className="motion-avatar-only">
              <div
                ref={stage}
                className="sign-avatar-stage sign-sequence-stage"
              >
                <Suspense
                  fallback={
                    <p role="status">
                      {at(
                        "Загружаем аватара…",
                        "Loading avatar…",
                        "Аватар жүктелуде…",
                      )}
                    </p>
                  }
                >
                  <Mentor
                    studio={studio}
                    modelUrl={modelUrl}
                    motionUrls={blocked ? [] : urls}
                    playbackState={
                      naturalIdle
                        ? blocked || !started || time >= duration
                          ? "idle"
                          : playing
                            ? "playing"
                            : "paused"
                        : undefined
                    }
                    motionTrims={trims}
                    onReadyChange={setReady}
                    time={time}
                    closeup={close}
                    angle={angle}
                    resetToken={0}
                    framing={
                      plan.spelling && plan.steps.length === 1
                        ? "letter"
                        : framing
                    }
                  />
                </Suspense>
                <span className="sign-avatar-label" aria-live="off">
                  {blocked || !started || time >= duration
                    ? at(
                        "Готова показать",
                        "Ready to demonstrate",
                        "Көрсетуге дайын",
                      )
                    : current?.text}
                </span>
                <button
                  className="sign-zoom"
                  onClick={() => setClose((v) => !v)}
                  aria-pressed={close}
                >
                  <ScanSearch size={16} />
                  {close
                    ? at("Весь аватар", "Full avatar", "Толық аватар")
                    : at("Приблизить руки", "Zoom hands", "Қолды үлкейту")}
                </button>
              </div>
            </div>
            {singleLetter && onLetterChange && (
              <nav
                className="sign-alphabet-navigation"
                aria-label={at(
                  "Выбор буквы",
                  "Choose a letter",
                  "Әріпті таңдау",
                )}
              >
                <div className="sign-letter-arrows">
                  <button
                    type="button"
                    disabled={alphabet.indexOf(plan.steps[0].label) <= 0}
                    onClick={() =>
                      onLetterChange(
                        alphabet[alphabet.indexOf(plan.steps[0].label) - 1],
                      )
                    }
                  >
                    <ChevronLeft size={18} />
                    {at("Предыдущая буква", "Previous letter", "Алдыңғы әріп")}
                  </button>
                  <strong aria-live="polite">{plan.steps[0].label}</strong>
                  <button
                    type="button"
                    disabled={
                      alphabet.indexOf(plan.steps[0].label) >=
                      alphabet.length - 1
                    }
                    onClick={() =>
                      onLetterChange(
                        alphabet[alphabet.indexOf(plan.steps[0].label) + 1],
                      )
                    }
                  >
                    {at("Следующая буква", "Next letter", "Келесі әріп")}
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="sign-alphabet-menu">
                  {alphabet.map((letter) => (
                    <button
                      type="button"
                      key={letter}
                      aria-label={at(
                        `Буква ${letter}`,
                        `Letter ${letter}`,
                        `${letter} әрпі`,
                      )}
                      aria-pressed={letter === plan.steps[0].label}
                      onClick={() => onLetterChange(letter)}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </nav>
            )}
            {blocked && (
              <p className="sign-sequence-note" role="status">
                {at(
                  "Введите букву или фразу либо выберите слово в словаре. Аватар покажет доступные движения здесь.",
                  "Enter a letter or phrase, or select a dictionary word. Your avatar will demonstrate here.",
                  "Әріп не сөйлем енгізіңіз немесе сөздіктен таңдаңыз. Аватар осы жерде көрсетеді.",
                )}
              </p>
            )}
            {!blocked && (
              <div className="sign-sequence-controls">
                <div className="sign-sequence-buttons">
                  <button
                    className="button primary"
                    disabled={!ready}
                    onClick={() => {
                      if (clock.current >= duration || inspecting) {
                        clock.current = 0;
                        setTime(0);
                      }
                      if (inspecting && !singleLetter) setClose(false);
                      setInspecting(false);
                      setStarted(true);
                      setPlaying((v) => !v);
                    }}
                  >
                    {playing && ready ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} />
                    )}{" "}
                    {!ready
                      ? at("Загрузка…", "Loading…", "Жүктелуде…")
                      : playing
                        ? at("Пауза", "Pause", "Кідірту")
                        : !inspecting && time > 0 && time < duration
                          ? at("Продолжить", "Continue", "Жалғастыру")
                          : singleLetter
                            ? at(
                                "Показать букву целиком",
                                "Play the whole letter",
                                "Әріпті толық көрсету",
                              )
                            : at("Показать всё", "Play all", "Толық көрсету")}
                  </button>
                  <button
                    className="button secondary"
                    disabled={!ready}
                    onClick={() => {
                      clock.current = 0;
                      setTime(0);
                      setInspecting(false);
                      setStarted(true);
                      setPlaying(true);
                    }}
                  >
                    <RotateCcw size={17} />
                    {at("Сначала", "Restart", "Басынан")}
                  </button>
                  <label>
                    {at("Скорость", "Speed", "Жылдамдық")}
                    <select
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    >
                      <option value=".5">0.5×</option>
                      <option value=".75">0.75×</option>
                      <option value="1">1×</option>
                      <option value="1.25">1.25×</option>
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
                </div>
                <input
                  className="sign-sequence-range"
                  aria-label={at(
                    "Позиция показа",
                    "Playback position",
                    "Көрсетілім орны",
                  )}
                  type="range"
                  min="0"
                  max={duration}
                  step=".01"
                  value={time}
                  onChange={(e) => seek(Number(e.target.value))}
                />
                <div className="sign-sequence-bottom">
                  <span>
                    {time.toFixed(1)} / {duration.toFixed(1)}{" "}
                    {at("с", "s", "с")}
                  </span>
                  <div role="group" aria-label={at("Ракурс", "View", "Ракурс")}>
                    {(["front", "three-quarter", "side"] as const).map(
                      (v, i) => (
                        <button
                          key={v}
                          aria-pressed={angle === v}
                          onClick={() => setAngle(v)}
                        >
                          {
                            [
                              at("Спереди", "Front", "Алдынан"),
                              "¾",
                              at("Сбоку", "Side", "Бүйірден"),
                            ][i]
                          }
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {!blocked && !singleLetter && (
            <div
              className="sign-sequence-words"
              aria-label={at(
                "Порядок показа",
                "Playback order",
                "Көрсету реті",
              )}
            >
              {timeline.map((s, i) => (
                <button
                  key={i}
                  aria-current={s === current ? "step" : undefined}
                  onClick={() => {
                    seek(s.start);
                    setPlaying(true);
                  }}
                >
                  <span>{i + 1}</span>
                  {s.text}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {note && <p className="sign-sequence-note">{note}</p>}
    </section>
  );
}
