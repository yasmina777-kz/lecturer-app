import { LearningHome } from "./LearningHome";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useSearchParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  ScanSearch,
} from "lucide-react";
import { at } from "../i18n/automation";
import { exercises, courseLevels, recognitionLetters } from "../sign/exercises";
import { animationTime, playbackDuration } from "../sign/playback";
import { Loading } from "../components/UI";
import type { GestureAngle } from "../components/GestureMentor3D";
import "./gesture-preview.css";
import "./sign-trainer.css";
import "./sign-dictionary.css";
import { SignSequencePlayer } from "../components/SignSequencePlayer";
import { planMotion, type MotionAsset } from "../sign/motion";
import { alphabetEntries } from "../sign/dictionary";
import { alphabetIllustration } from "../sign/alphabetIllustrations";
import { AlphabetCardArt } from "../components/AlphabetCardArt";
const Mentor = lazy(() =>
  import("../components/GestureMentor3D").then((m) => ({
    default: m.GestureMentor3D,
  })),
);
const Camera = lazy(() =>
  import("../components/TemporalSignCamera").then((m) => ({
    default: m.TemporalSignCamera,
  })),
);
import { SignActionCards } from "../components/SignActionCards";
import { ActivityLinks } from "./SignActivities";
export function SignCourseCatalog() {
  const [params] = useSearchParams();
  const stage = courseLevels().find(
    (l) => l.id === Number(params.get("stage")),
  );
  if (!stage) return <LearningHome />;
  return (
    <div className="sign-workspace sign-course-workspace">
      {stage && (
        <Link className="sign-back" to="/learn">
          <ArrowLeft size={18} />
          {at("Все уровни", "All levels", "Барлық деңгейлер")}
        </Link>
      )}
      <div className={`page-heading ${!stage ? "learning-welcome" : ""}`}>
        <div>
          <h1>
            {stage?.title ||
              at(
                "Учимся языку жестов",
                "Learn sign language",
                "Ым тілін үйренеміз",
              )}
          </h1>
          <p>
            {stage?.description ||
              at(
                "Изучайте жесты по уровням, узнавайте их на видео и практикуйте общение.",
                "Learn signs by level, recognize them in videos and practise communication.",
                "Ымдарды деңгеймен үйреніп, бейнеден таныңыз және қарым-қатынасты жаттықтырыңыз.",
              )}
          </p>
        </div>
      </div>
      {!stage && (
        <section className="learning-start panel">
          <div>
            <span className="eyebrow">
              {at("НАЧНИТЕ ЗДЕСЬ", "START HERE", "ОСЫНАН БАСТАҢЫЗ")}
            </span>
            <h2>
              {at(
                "Первая буква — первый шаг",
                "Your first letter",
                "Алғашқы әрпіңіз",
              )}
            </h2>
            <p>
              {at(
                "Посмотрите движение аватара и повторите. Дальше — слова и короткие диалоги.",
                "Watch and repeat. Then move on to words and short dialogues.",
                "Аватарды көріп, қайталаңыз. Одан кейін сөздер мен диалогтарға өтіңіз.",
              )}
            </p>
            <Link
              className="button primary"
              to={`/practice?exercise=${exercises()[0].id}`}
            >
              {at(
                "Начать с буквы А",
                "Start with letter А",
                "А әрпінен бастау",
              )}{" "}
              <ArrowRight size={18} />
            </Link>
          </div>
          <AlphabetCardArt letter="А" />
        </section>
      )}
      {!stage ? (
        <div className="sign-level-grid">
          {courseLevels().map((l) => (
            <Link
              className="panel sign-level-card"
              to={`/learn?stage=${l.id}`}
              key={l.id}
            >
              <div className="sign-level-cover">
                <img src={l.image} alt="" loading="lazy" />
              </div>
              <div className="sign-level-body">
                <span className="sign-level-number">
                  {at("УРОВЕНЬ", "LEVEL", "ДЕҢГЕЙ")} 0{l.id}
                </span>
                <h2>{l.title}</h2>
                <p>{l.description}</p>
                <small>{l.count}</small>
                <div className="sign-level-link">
                  {at("Выбрать урок", "Choose a lesson", "Сабақты таңдау")}
                  <ArrowRight size={18} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="sign-exercise-cards">
          {exercises()
            .filter((e) => e.level === stage.id)
            .map((e) => (
              <Link
                className="panel sign-exercise-card"
                to={`/practice?exercise=${e.id}`}
                key={e.id}
              >
                <div
                  className={`sign-exercise-thumb${e.letter && alphabetIllustration(e.letter) ? " sign-exercise-thumb--illustrated" : ""}`}
                >
                  {e.letter && alphabetIllustration(e.letter) ? (
                    <AlphabetCardArt letter={e.letter} />
                  ) : e.letter ? (
                    <b>{e.letter}</b>
                  ) : (
                    <img src="/images/avatars/mira-portrait-v3.png" alt="" />
                  )}
                  <Play size={24} />
                </div>
                <div>
                  <h2>{e.title}</h2>
                  <p>{e.hint}</p>
                  <span className="sign-level-link">
                    {at("Смотреть аватара", "Watch avatar", "Аватарды көру")}
                    <ArrowRight size={17} />
                  </span>
                </div>
              </Link>
            ))}
        </div>
      )}
      {!stage && (
        <>
          <h2 className="learning-section-title">
            {at("Попробуйте, когда освоитесь", "Explore next", "Келесі қадам")}
          </h2>
          <ActivityLinks />
        </>
      )}
      <Link
        className="button secondary sign-catalog-dictionary"
        to="/text-to-sign?tab=dictionary"
      >
        {at("Открыть словарь", "Open dictionary", "Сөздікті ашу")}
      </Link>

      <div className="sign-shortcuts">
        <Link className="panel" to="/practice">
          <Play />
          <div>
            <h3>
              {at("Открыть тренажёр", "Open practice room", "Жаттығуды ашу")}
            </h3>
            <p>
              {at(
                "Аватар и упражнения в одном окне.",
                "Avatar and exercises in one place.",
                "Аватар мен жаттығулар бір жерде.",
              )}
            </p>
          </div>
          <ArrowRight />
        </Link>
        <Link className="panel" to="/learn/alphabet-intro">
          <div>
            <h3>
              {at(
                "Для чего нужен дактиль?",
                "What is fingerspelling for?",
                "Дактиль не үшін қажет?",
              )}
            </h3>
            <p>
              {at(
                "Короткая справка — читать необязательно.",
                "Optional short introduction.",
                "Міндетті емес қысқа анықтама.",
              )}
            </p>
          </div>
          <ArrowRight />
        </Link>
      </div>
    </div>
  );
}
export function SignTrainingRoom() {
  const [params, setParams] = useSearchParams();
  const options = exercises();
  const exercise =
    options.find((e) => e.id === params.get("exercise")) || options[0];
  return (
    <div className="sign-workspace practice-workspace">
      <div className="page-heading">
        <div>
          <h1>
            {at(
              "Практика с аватаром",
              "Practice with the avatar",
              "Аватармен жаттығу",
            )}
          </h1>
          <p>
            {at(
              "Выберите букву или фразу. Сначала посмотрите показ, затем повторите.",
              "Choose a letter or phrase. Watch the demonstration, then repeat.",
              "Әріп не сөйлемді таңдаңыз. Алдымен көрсетілімді қарап, кейін қайталаңыз.",
            )}
          </p>
        </div>
      </div>
      <nav
        className="sign-training-levels"
        aria-label={at(
          "Уровни практики",
          "Practice levels",
          "Жаттығу деңгейлері",
        )}
      >
        {courseLevels().map((l) => (
          <button
            key={l.id}
            aria-pressed={exercise.level === l.id}
            onClick={() =>
              setParams({ exercise: options.find((e) => e.level === l.id)!.id })
            }
          >
            <span>0{l.id}</span>
            {l.title}
          </button>
        ))}
      </nav>
      {!exercise.letter && (
        <div
          className="sign-exercise-picker"
          role="group"
          aria-label={at("Упражнение", "Exercise", "Жаттығу")}
        >
          {options
            .filter((e) => e.level === exercise.level)
            .map((e) => (
              <button
                key={e.id}
                aria-pressed={e.id === exercise.id}
                onClick={() => setParams({ exercise: e.id })}
              >
                {e.letter || e.title}
              </button>
            ))}
        </div>
      )}
      <ExercisePlayer key={exercise.id} exercise={exercise} />
    </div>
  );
}
export function ExercisePlayer({
  exercise,
}: {
  exercise: ReturnType<typeof exercises>[number];
}) {
  if (exercise.letter)
    return <CapturedLetterPlayer key={exercise.id} letter={exercise.letter} />;
  return <AnimatedExercisePlayer key={exercise.id} exercise={exercise} />;
}
function CapturedLetterPlayer({ letter }: { letter: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("watch");
  useEffect(() => {
    if (location.hash === "#sign-camera-check") setMode("camera");
  }, [location.hash]);
  const [motions, setMotions] = useState<MotionAsset[]>([]),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/avatars/sign-motion/catalog.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((m) => setMotions(m))
      .catch(() => {})
      .finally(() => {
        if (!abort.signal.aborted) setLoaded(true);
      });
    return () => abort.abort();
  }, []);
  const references = useMemo(() => alphabetEntries(), []);
  const plan = useMemo(
    () => planMotion(letter, references, {}, motions, true),
    [letter, references, motions],
  );
  return (
    <>
      <SignActionCards
        label={at("Способ практики", "Practice mode", "Жаттығу тәсілі")}
        value={mode}
        onChange={setMode}
        items={[
          {
            id: "watch",
            title: at("Изучить жест", "Study the sign", "Ымды үйрену"),
            description: at(
              "Смотрите, замедляйте и повторяйте",
              "Watch, slow down and repeat",
              "Қараңыз, баяулатыңыз, қайталаңыз",
            ),
            tag: at(`Буква ${letter}`, `Letter ${letter}`, `${letter} әрпі`),
          },
          {
            id: "camera",
            title: at("Проверить себя", "Check yourself", "Өзіңізді тексеру"),
            description: at(
              "Покажите букву камере → ответ ИИ",
              "Show a letter to the camera → AI feedback",
              "Камераға әріпті көрсетіңіз → ЖИ жауабы",
            ),
            tag: at("Камера", "Camera", "Камера"),
          },
        ]}
      />
      {mode === "watch" ? (
        <div data-workspace-enter>
          {!loaded ? (
            <Loading />
          ) : (
            <SignSequencePlayer
              key={letter}
              plan={plan}
              onLetterChange={(next) => {
                const target = exercises().find((e) => e.letter === next);
                if (target)
                  navigate(`/practice?exercise=${target.id}`, {
                    preventScrollReset: true,
                  });
              }}
            />
          )}
          <button
            className="button primary sign-next-practice"
            onClick={() => setMode("camera")}
          >
            <ScanSearch size={18} />
            {at(
              "Теперь попробовать с камерой",
              "Now try with the camera",
              "Енді камерамен көріңіз",
            )}
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <div data-workspace-enter>
          <Suspense fallback={<Loading />}>
            <Camera expected={letter} />
          </Suspense>
        </div>
      )}
    </>
  );
}

function AnimatedExercisePlayer({
  exercise,
}: {
  exercise: ReturnType<typeof exercises>[number];
}) {
  const isLetter = !!exercise.letter;
  const canRecognize =
    !!exercise.letter && recognitionLetters.includes(exercise.letter);
  const duration = playbackDuration(isLetter);
  const keyTime = isLetter ? 1.8 : 3.2;
  const [time, setTime] = useState(keyTime),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [closeup, setCloseup] = useState(false),
    [angle, setAngle] = useState<GestureAngle>("front"),
    [reset, setReset] = useState(0);
  const clock = useRef(keyTime);
  const started = useRef(false);
  const [loop, setLoop] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      last = 0;
    const tick = (now: number) => {
      if (document.hidden) {
        last = 0;
        frame = requestAnimationFrame(tick);
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) * speed : 0;
      last = now;
      clock.current += dt;
      if (clock.current >= duration) {
        if (loop) clock.current %= duration;
        else {
          clock.current = duration;
          setTime(duration);
          setPlaying(false);
          return;
        }
      }
      setTime(clock.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, loop, duration]);
  function seek(n: number) {
    started.current = true;
    clock.current = n;
    setTime(n);
    setPlaying(false);
  }
  return (
    <>
      <div className="sign-trainer-layout">
        <div className="sign-avatar-player gesture-page">
          <div className="sign-avatar-stage">
            <Suspense fallback={<Loading />}>
              <Mentor
                modelUrl="/avatars/hand-workshop/mira-rig.glb?v=denim-4"
                motionUrls={[`/avatars/mira-blender/${exercise.model}`]}
                time={animationTime(time, isLetter)}
                framing={isLetter ? "letter" : "sign"}
                closeup={closeup}
                angle={angle}
                resetToken={reset}
              />
            </Suspense>
            <span className="sign-avatar-label">{exercise.title}</span>
            <button
              className="sign-zoom"
              onClick={() => setCloseup((v) => !v)}
              aria-pressed={closeup}
            >
              <ScanSearch size={18} />
              {closeup
                ? at("Весь аватар", "Full avatar", "Толық аватар")
                : at("Приблизить руки", "Zoom hands", "Қолды үлкейту")}
            </button>
          </div>
          <div
            className="sign-motion-steps"
            role="group"
            aria-label={at(
              "Разбор по этапам",
              "Movement breakdown",
              "Қимылды талдау",
            )}
          >
            {[
              {
                t: isLetter ? 0.9 : 1.8,
                label: at("Подготовка", "Prepare", "Дайындық"),
              },
              {
                t: keyTime,
                label: isLetter
                  ? at("Положение кисти", "Hand shape", "Қол қалпы")
                  : at("Движение", "Movement", "Қимыл"),
              },
              {
                t: isLetter ? 3.2 : 4.2,
                label: at("Завершение", "Finish", "Аяқтау"),
              },
            ].map((step, i) => (
              <button
                key={i}
                onClick={() => seek(step.t)}
                aria-pressed={!playing && Math.abs(time - step.t) < 0.02}
              >
                <span>0{i + 1}</span>
                {step.label}
              </button>
            ))}
          </div>
          <div className="sign-player-controls">
            <button
              className="button primary"
              onClick={() => {
                if (!playing && (!started.current || time >= duration)) {
                  clock.current = 0;
                  setTime(0);
                }
                started.current = true;
                setPlaying((v) => !v);
              }}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}{" "}
              {playing
                ? at("Пауза", "Pause", "Кідіріс")
                : at("Смотреть движение", "Play movement", "Қимылды көру")}
            </button>
            <button className="button secondary" onClick={() => seek(keyTime)}>
              <RotateCcw size={16} />
              {at("Основная поза", "Key pose", "Негізгі қалып")}
            </button>
            <label>
              {at("Скорость", "Speed", "Жылдамдық")}
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value="0.25">0.25×</option>
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.5×</option>
              </select>
            </label>
            <label className="sign-repeat-control">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
              />
              {at("Повторять", "Loop", "Қайталау")}
            </label>
            <input
              type="range"
              min="0"
              max={duration}
              step=".01"
              value={time}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label={at(
                "Кадр движения",
                "Movement position",
                "Қимыл кадры",
              )}
            />
            <div
              className="sign-view-buttons"
              role="group"
              aria-label={at("Ракурс", "View", "Ракурс")}
            >
              {(["front", "three-quarter", "side"] as GestureAngle[]).map(
                (v, i) => (
                  <button
                    key={v}
                    aria-pressed={angle === v}
                    onClick={() => {
                      setAngle(v);
                      setReset((n) => n + 1);
                    }}
                  >
                    {
                      [
                        at("Спереди", "Front", "Алдынан"),
                        "¾",
                        at("Сбоку", "Side", "Жанынан"),
                      ][i]
                    }
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
        <aside className="panel sign-exercise-instructions">
          <span className="sign-status-label">
            {at("УРОВЕНЬ", "LEVEL", "ДЕҢГЕЙ")} {exercise.level}
          </span>
          <h2>{exercise.title}</h2>
          <ol>
            <li>
              <b>{at("Посмотрите", "Watch", "Қараңыз")}</b>
              <p>{exercise.hint}</p>
            </li>
            <li>
              <b>{at("Повторите", "Repeat", "Қайталаңыз")}</b>
              <p>
                {at(
                  "Поставьте на паузу, выберите удобный ракурс и повторите положение рук.",
                  "Pause, choose a useful angle and repeat the hand position.",
                  "Кідіртіп, ыңғайлы ракурсты таңдап, қол қалпын қайталаңыз.",
                )}
              </p>
            </li>
            <li>
              <b>
                {canRecognize
                  ? at(
                      "Попробуйте ИИ-проверку",
                      "Try the AI check",
                      "ЖИ тексеруін қолданыңыз",
                    )
                  : at(
                      "Сравните с образцом",
                      "Compare with the reference",
                      "Үлгімен салыстырыңыз",
                    )}
              </b>
              <p>
                {canRecognize
                  ? at(
                      "Ниже запишите короткий жест или выберите видео.",
                      "Record a short sign below or choose a video.",
                      "Төменде қысқа қимылды жазыңыз немесе бейне таңдаңыз.",
                    )
                  : at(
                      "Для этого упражнения ИИ-проверки пока нет. Сравните форму и движение с видео человека.",
                      "AI checking is not available for this exercise. Compare the shape and movement with the human video.",
                      "Бұл жаттығуда ЖИ тексеруі әзірге жоқ. Қалып пен қимылды адамның бейнесімен салыстырыңыз.",
                    )}
              </p>
            </li>
          </ol>
          <Link
            className="button primary sign-catalog-dictionary"
            to="/text-to-sign?tab=dictionary"
          >
            {at("Открыть словарь", "Open dictionary", "Сөздікті ашу")}
          </Link>
          <p className="sign-catalog-note">
            {at(
              "Анимация — пробный образец, пока без проверки специалистом РЖЯ.",
              "Trial animation, not yet reviewed by an RSL specialist.",
              "Сынақ анимациясы, ым тілі маманы әлі тексермеген.",
            )}
          </p>
          {exercise.letter ? (
            <a
              href="https://github.com/ai-forever/bukva"
              target="_blank"
              rel="noreferrer"
            >
              {at(
                "Источник примеров букв: Bukva ↗",
                "Letter references: Bukva ↗",
                "Әріп үлгілері: Bukva ↗",
              )}
            </a>
          ) : (
            <a
              href={
                exercise.id === "name"
                  ? "https://www.youtube.com/watch?v=XhfuzmNWmGA&t=17s"
                  : exercise.id === "thanks"
                    ? "https://www.youtube.com/watch?v=x78RQeWwwvQ&t=195s"
                    : "https://www.youtube.com/watch?v=x78RQeWwwvQ&t=174s"
              }
              target="_blank"
              rel="noreferrer"
            >
              {at(
                "Видеообразец человека ↗",
                "Human video reference ↗",
                "Адамның бейнеүлгісі ↗",
              )}
            </a>
          )}
        </aside>
      </div>
      {canRecognize && exercise.letter && (
        <Suspense fallback={<Loading />}>
          <Camera key={exercise.id} expected={exercise.letter} />
        </Suspense>
      )}
    </>
  );
}
