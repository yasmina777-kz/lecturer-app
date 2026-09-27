import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  List,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  Send,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { apiGet, request } from "../api/httpClient";
import { askQuestion } from "../api/questionsApi";
import { useAuth } from "../context/AuthContext";
import { useNarrator, type SpeechPosition } from "../hooks/useNarrator";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { AvatarPlayer } from "../components/AvatarPlayer";
import { SlideViewer, slideContent } from "../components/SlideViewer";
import { ErrorMessage, Loading, messageOf } from "../components/UI";
import { LectureManagement } from "../components/LectureManagement";
import { StudyPanel } from "./StudyPanel";
import type { Capabilities, Lecture } from "../types/lecture";
type Phase = "welcome" | "intro" | "slide" | "question" | "answer" | "complete";
export function LecturePlayerPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("outline");
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [rate, setRate] = useState(user?.speechRate || 1);
  const [recordPending, setRecordPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const narrator = useNarrator(
    rate,
    lecture?.language || "ru",
    lecture?.voiceGender || "male",
    caps?.speech || "browser",
  );
  const recorder = useAudioRecorder();
  const saved = useRef<SpeechPosition>();
  const autoResume = useRef(false);
  const requestVersion = useRef(0);
  const alive = useRef(true);
  const saveQueue = useRef(Promise.resolve());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    alive.current = true;
    apiGet<Lecture>(`/lectures/${id}`)
      .then((l) => {
        if (alive.current) {
          setLecture(l);
          setIndex(l.progress?.slideIndex ?? 0);
        }
      })
      .catch((e) => {
        if (alive.current) setLoadError(messageOf(e));
      });
    apiGet<Capabilities>("/capabilities")
      .then((c) => {
        if (alive.current) setCaps(c);
      })
      .catch((e) => {
        if (alive.current) setError(messageOf(e));
      });
    return () => {
      alive.current = false;
      requestVersion.current++;
    };
  }, [id]);
  function saveProgress(i: number, completed = false) {
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await request(`/lectures/${id}/progress`, {
          method: "PUT",
          body: JSON.stringify({ slideIndex: i, completed }),
        });
      } catch (e) {
        if (alive.current)
          setError(t("Прогресс не сохранён: {0}", messageOf(e)));
      }
    });
  }
  function finishSlide(i: number) {
    if (!lecture) return;
    if (i < lecture.slides.length - 1) playSlide(i + 1);
    else {
      setPhase("complete");
      saveProgress(i, true);
      setTab("practice");
    }
  }
  function playSlide(i: number, speak = true) {
    if (!lecture) return;
    narrator.cancel();
    setIndex(i);
    setPhase("slide");
    setError("");
    saved.current = undefined;
    saveProgress(i);
    if (speak)
      narrator.say(lecture.slides[i].narrationText, () => finishSlide(i));
  }
  function start() {
    if (!lecture) return;
    setPhase("intro");
    narrator.say(lecture.introduction, () => playSlide(index));
  }
  function togglePlay() {
    if (!lecture) return;
    if (phase === "welcome" || phase === "complete") {
      start();
      return;
    }
    if (narrator.active) saved.current = narrator.pause();
    else if (saved.current)
      narrator.resume(saved.current, () =>
        phase === "intro" ? playSlide(index) : finishSlide(index),
      );
    else if (phase === "intro")
      narrator.say(lecture.introduction, () => playSlide(index));
    else
      narrator.say(lecture.slides[index].narrationText, () =>
        finishSlide(index),
      );
  }
  function openQuestion() {
    autoResume.current = narrator.active;
    saved.current = narrator.pause();
    setPhase("question");
    setAnswer("");
    setError("");
  }
  function returnToLecture() {
    requestVersion.current++;
    narrator.cancel();
    setBusy(false);
    setPhase("slide");
    setAnswer("");
    if (autoResume.current && saved.current?.chunks.length)
      narrator.resume(saved.current, () => finishSlide(index));
  }
  async function submitQuestion(question: string | Blob) {
    if (!lecture || busy) return;
    const version = ++requestVersion.current;
    narrator.cancel();
    setBusy(true);
    setError("");
    try {
      const result = await askQuestion(id, lecture.slides[index].id, question);
      if (!alive.current || version !== requestVersion.current) return;
      setAnswer(result.answerText);
      setText("");
      setPhase("answer");
      setLecture((l) =>
        l
          ? {
              ...l,
              questions: [
                ...l.questions,
                { id: crypto.randomUUID(), ...result },
              ],
            }
          : l,
      );
      narrator.say(result.answerText, () => {
        if (alive.current && version === requestVersion.current)
          returnToLecture();
      });
    } catch (e) {
      if (alive.current && version === requestVersion.current) {
        setError(messageOf(e));
        setPhase("question");
      }
    } finally {
      if (alive.current && version === requestVersion.current) setBusy(false);
    }
  }
  async function record() {
    if (recordPending) return;
    setRecordPending(true);
    setError("");
    try {
      if (recorder.isRecording) {
        const blob = await recorder.stop();
        if (blob.size && alive.current) await submitQuestion(blob);
      } else {
        setElapsed(0);
        await recorder.start();
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      if (alive.current) setRecordPending(false);
    }
  }
  useEffect(() => {
    if (!recorder.isRecording) return;
    const timer = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [recorder.isRecording]);
  useEffect(() => {
    if (elapsed >= 60 && recorder.isRecording && !recordPending) void record();
  }, [elapsed]);
  if (loadError)
    return (
      <>
        <ErrorMessage message={loadError} />
        <Link to="/library" className="button secondary">
          {t("К библиотеке")}
        </Link>
      </>
    );
  if (!lecture) return <Loading text={t("Готовим учебное пространство…")} />;
  const slide = lecture.slides[index];
  const avatarVisible = ["welcome", "intro", "question", "answer"].includes(
    phase,
  );
  const asking = phase === "question" || phase === "answer";
  return (
    <>
      <div className="player-heading">
        <Link to="/library" className="back-link">
          <ArrowLeft size={16} />
          {t("Мои лекции")}
        </Link>
        <span className="tag">
          {lecture.isDemo ? t("Демонстрационная лекция") : t(lecture.level)}
        </span>
      </div>
      <h1 className="lecture-title">{lecture.title}</h1>
      <div className="lecture-subtitle">
        <span>{lecture.subject}</span>
        <span>·</span>
        <span>
          {lecture.slides.length} {t("слайдов")}
        </span>
        <span>·</span>
        <span>{t("AI-лектор")}</span>
        {lecture.estimatedMinutes > 0 && (
          <>
            <span>·</span>
            <span>
              {t(
                "Около {0} мин. при обычном темпе",
                Math.round(lecture.estimatedMinutes),
              )}
            </span>
          </>
        )}
      </div>
      <LectureManagement
        lecture={lecture}
        onUpdate={(title, isPublished) =>
          setLecture((l) => (l ? { ...l, title, isPublished } : l))
        }
      />
      <ErrorMessage message={error || narrator.speechError} />
      <div className="player-layout">
        <section className="player-main">
          <div className="lecture-stage">
            {avatarVisible ? (
              <div className="avatar-stage">
                <div className="stage-badge">
                  <span className="status-dot" />
                  {asking ? t("ДАВАЙТЕ РАЗБЕРЁМСЯ") : t("ЗНАКОМИМСЯ С ТЕМОЙ")}
                </div>
                <AvatarPlayer
                  state={
                    busy ? "thinking" : narrator.speaking ? "speaking" : "idle"
                  }
                  style={lecture.avatarStyle}
                  avatarId={lecture.avatarId}
                />
                <div className="stage-message">
                  <h2>
                    {asking
                      ? busy
                        ? t("Обдумываю ваш вопрос…")
                        : phase === "answer"
                          ? t("Вот как это работает")
                          : t("Что осталось непонятным?")
                      : t("Готовы разобраться вместе?")}
                  </h2>
                  <p>
                    {asking
                      ? t("Лекция на паузе. У нас есть время на любой вопрос.")
                      : t(
                          "Сначала познакомимся с темой, затем перейдём к слайдам.",
                        )}
                  </p>
                  {phase === "welcome" && (
                    <button className="button primary" onClick={start}>
                      <Play size={17} fill="currentColor" />
                      {t("Начать лекцию")}
                    </button>
                  )}
                  {phase === "intro" && (
                    <button
                      className="text-link"
                      onClick={() => playSlide(index)}
                    >
                      {t("Перейти к слайдам")}
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            ) : phase === "complete" ? (
              <div className="completion-stage">
                <span>
                  <Check size={40} />
                </span>
                <span className="eyebrow">{t("ЕЩЁ ОДИН ШАГ ВПЕРЁД")}</span>
                <h2>{t("Лекция завершена!")}</h2>
                <p>
                  {t("Теперь закрепим знания небольшим тестом.")}
                  <br />
                  {t("Конспект всегда останется под рукой.")}
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    setTab("practice");
                    document
                      .getElementById("study-panel")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <GraduationCap size={18} />
                  {t("Перейти к практике")}
                </button>
                <button className="text-link" onClick={() => playSlide(0)}>
                  {t("Послушать ещё раз")}
                </button>
              </div>
            ) : (
              <SlideViewer
                slide={slide}
                index={index}
                total={lecture.slides.length}
                subject={lecture.subject}
              />
            )}
          </div>
          <div className="player-controls">
            <div className="transport">
              <button
                className="icon-button"
                aria-label={t("Предыдущий слайд")}
                disabled={index === 0 || asking}
                onClick={() => playSlide(index - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="play-button"
                aria-label={narrator.active ? t("Пауза") : t("Продолжить")}
                disabled={asking}
                onClick={togglePlay}
              >
                {narrator.active ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </button>
              <button
                className="icon-button"
                aria-label={t("Следующий слайд")}
                disabled={asking || phase === "complete"}
                onClick={() => {
                  narrator.cancel();
                  finishSlide(index);
                }}
              >
                <ChevronRight size={20} />
              </button>
              <span className="slide-count">
                {String(index + 1).padStart(2, "0")}{" "}
                <i>/ {String(lecture.slides.length).padStart(2, "0")}</i>
              </span>
            </div>
            <div className="playback-options">
              <Volume2 size={17} />
              <select
                aria-label={t("Скорость речи")}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              >
                {[0.75, 1, 1.25, 1.5].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
              <button
                className="button primary small"
                disabled={asking || phase !== "slide"}
                onClick={openQuestion}
              >
                <Mic size={16} />
                {t("Задать вопрос")}
              </button>
            </div>
          </div>
          <div className="playback-progress">
            <span
              style={{
                width: `${phase === "complete" ? 100 : ((index + 1) / lecture.slides.length) * 100}%`,
              }}
            />
          </div>
          {asking ? (
            <div className="question-panel">
              <div className="section-heading">
                <h3>
                  {phase === "answer" ? t("Ответ лектора") : t("Ваш вопрос")}
                </h3>
                <button
                  className="icon-button"
                  aria-label={t("Вернуться к лекции")}
                  disabled={recorder.isRecording || recordPending}
                  onClick={returnToLecture}
                >
                  <X size={18} />
                </button>
              </div>
              {answer && <p className="answer-text">{answer}</p>}
              {!caps?.aiConfigured && (
                <div className="notice">
                  {t(
                    "Ответы AI и распознавание голоса появятся после подключения ключа на сервере. Лекцию можно продолжить ниже.",
                  )}
                </div>
              )}
              {phase === "question" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (text.trim()) void submitQuestion(text);
                  }}
                >
                  <textarea
                    aria-label={t("Вопрос лектору")}
                    placeholder={t(
                      "Например: объясни этот момент на другом примере…",
                    )}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    disabled={busy || recorder.isRecording}
                  />
                  <div className="question-actions">
                    <button
                      className={`button ${recorder.isRecording ? "danger" : "secondary"}`}
                      type="button"
                      disabled={busy || recordPending || !caps?.aiConfigured}
                      onClick={record}
                    >
                      {recorder.isRecording ? (
                        <>
                          <Square size={15} />
                          {t("Отправить запись ·")}
                          {elapsed} {t("с")}
                        </>
                      ) : (
                        <>
                          <Mic size={17} />
                          {t("Спросить голосом")}
                        </>
                      )}
                    </button>
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        recorder.isRecording ||
                        !text.trim() ||
                        !caps?.aiConfigured
                      }
                    >
                      {busy ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <Send size={17} />
                      )}
                      {t("Отправить")}
                    </button>
                  </div>
                </form>
              )}
              <button
                className="text-link"
                disabled={recorder.isRecording || recordPending}
                onClick={returnToLecture}
              >
                {t("Продолжить лекцию")}
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="transcript">
              <span>
                <Volume2 size={15} />
                {t("ТЕКСТ ОБЪЯСНЕНИЯ")}
              </span>
              <p>
                {phase === "intro" || phase === "welcome"
                  ? lecture.introduction
                  : slide.narrationText}
              </p>
              <small>
                {caps?.speech === "azure"
                  ? t("Озвучка Azure Speech")
                  : t("Озвучка голосом вашего устройства")}
              </small>
            </div>
          )}
        </section>
        <aside className="lesson-sidebar">
          <div className="outline-header">
            <List size={18} />
            <h3>{t("План лекции")}</h3>
            <span>{lecture.slides.length}</span>
          </div>
          {lecture.slides.map((s, i) => (
            <button
              key={s.id}
              className={`outline-item ${index === i ? "active" : ""}`}
              disabled={asking}
              onClick={() => playSlide(i)}
            >
              <span className="outline-number">
                {phase === "complete" || i < index ? (
                  <Check size={15} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span>{slideContent(s).title || slideContent(s).heading}</span>
              {index === i && <span className="tiny-wave">▂▆▃</span>}
            </button>
          ))}
          <div className="outline-tip">
            <Mic size={20} />
            <strong>{t("Вопросы — это часть обучения")}</strong>
            <p>
              {t(
                "Лектор остановится, объяснит и продолжит с текущего предложения.",
              )}
            </p>
          </div>
          {lecture.questions.length > 0 && (
            <details className="history">
              <summary>
                {t("Ваши вопросы (")}
                {lecture.questions.length})
              </summary>
              {lecture.questions.map((q) => (
                <div key={q.id}>
                  <strong>{q.questionText}</strong>
                  <p>{q.answerText}</p>
                </div>
              ))}
            </details>
          )}
        </aside>
      </div>
      <div id="study-panel" className="study-section">
        <div className="tabs">
          <button
            className={tab === "outline" ? "active" : ""}
            onClick={() => setTab("outline")}
          >
            <FileText size={16} />
            {t("Конспект и заметки")}
          </button>
          <button
            className={tab === "practice" ? "active" : ""}
            onClick={() => setTab("practice")}
          >
            <GraduationCap size={17} />
            {t("Практика")}
          </button>
        </div>
        <StudyPanel lecture={lecture} slideIndex={index} tab={tab} onSlide={(i) => { narrator.cancel(); saved.current = undefined; setIndex(i); setPhase("slide"); setTab("outline"); window.scrollTo({top:0,behavior:"smooth"}); }} />
      </div>
    </>
  );
}
