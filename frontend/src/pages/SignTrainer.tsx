import { readTests } from "../sign/levelTests";
import { lazyPage } from "../lazyPage";
import { LearningHome } from "./LearningHome";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  Award,
  Eye,
  Gauge,
  Repeat,
  Camera as CameraIcon,
  BookOpen,
  Hash,
  MessageCircle,
} from "lucide-react";
import { at } from "../i18n/automation";
import { exercises, courseLevels, recognitionLetters, alphabet } from "../sign/exercises";
import { animationTime, playbackDuration } from "../sign/playback";
import { Loading } from "../components/UI";
import type { GestureAngle } from "../components/GestureMentor3D";
import "./gesture-preview.css";
import "./sign-trainer.css";
import "./sign-dictionary.css";
import { SignSequencePlayer, SHOW_HUMAN_VIDEOS } from "../components/SignSequencePlayer";
import { PhraseVideos } from "../components/HumanSequencePlayer";
import { withVideoAssets } from "../sign/videoAssets";
import { planMotion, type MotionAsset } from "../sign/motion";
import { alphabetEntries } from "../sign/dictionary";
import { alphabetIllustration } from "../sign/alphabetIllustrations";
import { AlphabetCardArt } from "../components/AlphabetCardArt";
const Mentor = lazyPage(() =>
  import("../components/GestureMentor3D").then((m) => ({
    default: m.GestureMentor3D,
  })),
);
const Camera = lazyPage(() =>
  import("../components/TemporalSignCamera").then((m) => ({
    default: m.TemporalSignCamera,
  })),
);
const KazakhStage = lazyPage(() =>
  import("./KazakhLearn").then((m) => ({ default: m.KazakhStage })),
);
import { SignActionCards } from "../components/SignActionCards";
import { LetterTile, StageTabs } from "../components/LetterTile";
import { useSignLang, wordText } from "../sign/signLanguage";
import { courseUnits, unitPhoto } from "../sign/courseUnits";
import { Check } from "lucide-react";
import "./course.css";

/** РЖЯ levels 2–3: the course units (A1 for first words, A2–B1 for
 * comprehension and communication) as picture cards. */
function RslUnits({ stage }: { stage: number }) {
  const units = stage === 2 ? courseUnits("A1") : [...courseUnits("A2"), ...courseUnits("B1")];
  let progress: Record<string, { done?: boolean }> = {};
  try {
    progress = JSON.parse(localStorage.getItem("rsl-course-v1") ?? "{}") ?? {};
  } catch {
    /* storage may be disabled */
  }
  const next = units.find((u) => !progress[u.id]?.done) ?? units[0];
  return (
    <>
      <Link className="ksl-continue card-motion" to={`/course/${next.id}`}>
        <span className="ksl-continue-icon"><Play size={20} /></span>
        <div>
          <strong>{at("Следующий урок", "Next lesson", "Келесі сабақ")}: {next.title}</strong>
          <span>
            {at("Пройдено", "Done", "Өтілді")} {units.filter((u) => progress[u.id]?.done).length} / {units.length}
          </span>
        </div>
        <ArrowRight size={18} />
      </Link>
      <div className="ksl-topic-grid">
        {units.map((u, i) => {
          const done = !!progress[u.id]?.done;
          return (
            <Link key={u.id} className={`ksl-topic-card card-motion${done ? " done" : ""}`} to={`/course/${u.id}`}>
              <span className="ksl-topic-media">
                <img src={unitPhoto(u.id)} alt="" loading="lazy" />
                <span className="ksl-topic-num">{i + 1}</span>
                {done && <span className="ksl-topic-done"><Check size={14} /> {at("Пройден", "Done", "Өтті")}</span>}
              </span>
              <span className="ksl-topic-body">
                <strong>{u.title}</strong>
                <span className="ksl-topic-words">
                  {u.words.slice(0, 3).map((w) => wordText(w, "rsl")).join(" · ")}
                  {u.words.length > 3 ? ` +${u.words.length - 3}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
import { ActivityLinks } from "./SignActivities";
export function SignCourseCatalog() {
  const [params] = useSearchParams();
  const [lang] = useSignLang();
  const stage = courseLevels().find(
    (l) => l.id === Number(params.get("stage")),
  );
  if (!stage) return <LearningHome />;
  // ҚЖЯ has its own levels (Kazakh alphabet, SURDO.KZ topics, phrases and dialogues).
  if (lang === "ksl")
    return (
      <Suspense fallback={<Loading />}>
        <KazakhStage stage={stage.id} />
      </Suspense>
    );
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
        {stage && (
          <Link className="button primary level-test-link" to={`/learn-test?level=${stage.id}`}>
            <Award size={18} />
            {(readTests()[stage.id] ?? 0) >= 8
              ? at(`Пройдено · ${readTests()[stage.id]}/10`, `Passed · ${readTests()[stage.id]}/10`, `Өтті · ${readTests()[stage.id]}/10`)
              : at("Итоговый тест", "Level test", "Қорытынды тест")}
          </Link>
        )}
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
            </Link>{" "}
            <Link className="button secondary" to="/vocab">
              {at(
                "Учить слова по темам (412 жестов)",
                "Learn words by topic (412 signs)",
                "Тақырып бойынша сөздер (412 ым)",
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
        <>
          <StageTabs levels={courseLevels()} current={stage.id} />
          {exercises().some((e) => e.level === stage.id && e.letter) && (
            <div className="letter-tiles">
              {exercises()
                .filter((e) => e.level === stage.id && e.letter)
                .map((e) => (
                  <LetterTile
                    key={e.id}
                    letter={e.letter!}
                    to={`/practice?exercise=${e.id}`}
                    caption={at("Аватар · камера", "Avatar · camera", "Аватар · камера")}
                    media={
                      alphabetIllustration(e.letter!) ? (
                        <img src={alphabetIllustration(e.letter!)} alt="" loading="lazy" />
                      ) : (
                        <b className="letter-tile-big">{e.letter}</b>
                      )
                    }
                  />
                ))}
            </div>
          )}
          {stage.id >= 2 && <RslUnits stage={stage.id} />}
        </>
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
              "Практика",
              "Practice",
              "Жаттығу",
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
      {!exercise.letter && options.filter((e) => e.level === exercise.level).length > 1 && (
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
/** Real-signer videos standing in for the authored 3D phrases. «Спасибо» has no
 * recording in the open datasets, so it is listed as missing. */
const EXERCISE_SIGNS: Record<string, string[]> = {
  hello: ["Привет!"],
  thanks: ["Спасибо"],
  name: ["ты", "имя", "кто?"],
};
export function ExercisePlayer({
  exercise,
}: {
  exercise: ReturnType<typeof exercises>[number];
}) {
  if (exercise.letter)
    return <CapturedLetterPlayer key={exercise.id} letter={exercise.letter} />;
  if (SHOW_HUMAN_VIDEOS)
    return (
      <div className="phrase-practice" data-workspace-enter>
        <section className="panel phrase-video">
          <h2>{exercise.title}</h2>
          <p>{exercise.hint}</p>
          <PhraseVideos labels={EXERCISE_SIGNS[exercise.id] ?? []} />
        </section>
        <aside className="phrase-side">
          <section className="panel phrase-steps">
            <h3>{at("Как выучить жест", "How to learn the sign", "Ымды қалай үйрену")}</h3>
            <ol>
              <li><span><Eye size={18} /></span><div><strong>{at("Посмотрите целиком", "Watch it whole", "Толық қараңыз")}</strong>{at("Где руки, куда смотрит ладонь, какое лицо.", "Where the hands are, palm direction, the face.", "Қол, алақан, бет.")}</div></li>
              <li><span><Gauge size={18} /></span><div><strong>{at("Замедлите до 0.5×", "Slow down to 0.5×", "0.5× баяулатыңыз")}</strong>{at("Разберите движение по шагам.", "Break the motion into steps.", "Қозғалысты бөліңіз.")}</div></li>
              <li><span><Repeat size={18} /></span><div><strong>{at("Повторите 3–5 раз", "Repeat 3–5 times", "3–5 рет қайталаңыз")}</strong>{at("Вместе с видео, потом без него.", "With the video, then without it.", "Бейнемен, сосын онсыз.")}</div></li>
              <li><span><CameraIcon size={18} /></span><div><strong>{at("Сравните себя", "Compare yourself", "Өзіңізді салыстырыңыз")}</strong>{at("Запишитесь рядом с образцом в «Зеркале».", "Record yourself next to the reference in the Mirror.", "Айнада жазыңыз.")}</div></li>
            </ol>
            <Link className="button primary" to="/live-practice">
              <CameraIcon size={18} /> {at("Открыть зеркало", "Open the mirror", "Айнаны ашу")}
            </Link>
          </section>
          <section className="panel phrase-more">
            <h3>{at("Дальше по теме", "Next on this topic", "Тақырып бойынша әрі қарай")}</h3>
            <Link to="/course/1"><MessageCircle size={18} /><span>{at("Урок «Знакомство»", "Lesson “Introductions”", "«Танысу» сабағы")}</span><ArrowRight size={16} /></Link>
            <Link to="/vocab"><BookOpen size={18} /><span>{at("Словарь: 900+ слов", "Dictionary: 900+ words", "Сөздік: 900+ сөз")}</span><ArrowRight size={16} /></Link>
            <Link to="/numbers"><Hash size={18} /><span>{at("Числа и время", "Numbers and time", "Сандар мен уақыт")}</span><ArrowRight size={16} /></Link>
          </section>
        </aside>
      </div>
    );
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
    () => planMotion(letter, references, {}, SHOW_HUMAN_VIDEOS ? withVideoAssets(motions, references) : motions, true),
    [letter, references, motions],
  );
  const goLetter = (next: string) => {
    const target = exercises().find((e) => e.letter === next);
    if (target)
      navigate(`/practice?exercise=${target.id}${mode === "camera" ? "#sign-camera-check" : ""}`, { preventScrollReset: true });
  };
  return (
    <div className="practice-letter-layout">
      <aside className="practice-letter-side">
        <div className="practice-side-head">
          {at("Выберите букву", "Choose a letter", "Әріпті таңдаңыз")}
          <span>{alphabet.indexOf(letter) + 1} / {alphabet.length}</span>
        </div>
        <div className="panel practice-side-card">
        <div className="letter-picker" role="group" aria-label={at("Выберите букву", "Choose a letter", "Әріпті таңдаңыз")}>
          {alphabet.map((l) => (
            <button key={l} aria-pressed={l === letter} onClick={() => goLetter(l)}>
              {l}
            </button>
          ))}
        </div>
        <div className="practice-mode" role="group" aria-label={at("Способ практики", "Practice mode", "Жаттығу тәсілі")}>
          <button aria-pressed={mode === "watch"} onClick={() => setMode("watch")}>
            <Play size={16} />
            {at("Изучить жест", "Study the sign", "Ымды үйрену")}
          </button>
          <button aria-pressed={mode === "camera"} onClick={() => setMode("camera")}>
            <ScanSearch size={16} />
            {at("Проверить себя", "Check yourself", "Өзіңізді тексеру")}
          </button>
        </div>
        <p className="practice-hint">
          {mode === "watch"
            ? at("Посмотрите видео, замедлите и повторите букву сами.", "Watch, slow down and repeat.", "Қарап, баяулатып, қайталаңыз.")
            : at("Покажите букву в камеру и держите её около 2 секунд.", "Show the letter to the camera for about 2 seconds.", "Әріпті камераға 2 секундтай көрсетіңіз.")}
        </p>
        </div>
      </aside>
      <div className="practice-letter-main" data-workspace-enter>
        {mode === "watch" ? (
          !loaded ? (
            <Loading />
          ) : (
            <SignSequencePlayer key={letter} plan={plan} onLetterChange={goLetter} />
          )
        ) : (
          <Suspense fallback={<Loading />}>
            <Camera expected={letter} />
          </Suspense>
        )}
      </div>
    </div>
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
                modelUrl="/avatars/male/artyom.glb?v=1"
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
