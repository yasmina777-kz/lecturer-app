import { t } from "../i18n";
import { useState } from "react";
import { Check, Download, Save } from "lucide-react";
import { post, request } from "../api/httpClient";
import { ErrorMessage, messageOf } from "../components/UI";
import type { Exercises, Lecture } from "../types/lecture";
export function StudyPanel({
  lecture,
  slideIndex,
  tab,
}: {
  lecture: Lecture;
  slideIndex: number;
  tab: string;
}) {
  const [notes, setNotes] = useState(lecture.progress?.notes ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const exercises: Exercises = JSON.parse(lecture.exercisesJson);
  const [answers, setAnswers] = useState<number[]>(() => {
    try {
      const a = JSON.parse(lecture.progress?.answersJson || "[]");
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  });
  const [result, setResult] = useState<{
    score: number;
    results: { correct: boolean; explanation: string; correctIndex: number }[];
  } | null>(null);
  const [taskAnswers, setTaskAnswers] = useState<Record<number, string>>(() => {
    try {
      return JSON.parse(lecture.progress?.taskAnswersJson || "{}");
    } catch {
      return {};
    }
  });
  const [tasksSaved, setTasksSaved] = useState(false);
  async function saveTasks() {
    setBusy(true);
    setError("");
    try {
      await request(`/lectures/${lecture.id}/tasks`, {
        method: "PUT",
        body: JSON.stringify({ answers: taskAnswers }),
      });
      setTasksSaved(true);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const text = t(
      "{0}\n\n{1}\n\nМои заметки\n{2}",
      lecture.title,
      lecture.summary,
      notes,
    );
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = t(
      "{0} — конспект.txt",
      lecture.title.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 80),
    );
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await request(`/lectures/${lecture.id}/progress`, {
        method: "PUT",
        body: JSON.stringify({ slideIndex, completed: false, notes }),
      });
      setSaved(true);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    setBusy(true);
    setError("");
    try {
      const r = await post<NonNullable<typeof result>>(
        `/lectures/${lecture.id}/quiz`,
        { answers },
      );
      setResult(r);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ErrorMessage message={error} />
      {tab === "practice" ? (
        <div className="practice-layout">
          <div className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t("ПРОВЕРЬТЕ ПОНИМАНИЕ")}</span>
                <h2>{t("Небольшой тест")}</h2>
              </div>
              {result && <span className="score-badge">{result.score}%</span>}
            </div>
            {!result && lecture.progress?.quizScore != null && (
              <p className="form-hint">
                {t("Предыдущий результат:")}
                {lecture.progress.quizScore}
                {t("%. Можно пройти ещё раз.")}
              </p>
            )}
            {exercises.quiz.map((q, i) => (
              <fieldset
                className="quiz-question"
                key={i}
                disabled={!!result || busy}
              >
                <legend>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {q.question}
                </legend>
                {q.options.map((o, j) => (
                  <label
                    key={j}
                    className={`quiz-option ${answers[i] === j ? "selected" : ""} ${result?.results[i].correctIndex === j ? "correct" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`q-${lecture.id}-${i}`}
                      checked={answers[i] === j}
                      onChange={() =>
                        setAnswers((a) => {
                          const b = [...a];
                          b[i] = j;
                          return b;
                        })
                      }
                    />
                    {o}
                    {result?.results[i].correctIndex === j && (
                      <Check size={16} />
                    )}
                  </label>
                ))}
                {result && (
                  <p
                    className={`quiz-explanation ${result.results[i].correct ? "success" : ""}`}
                  >
                    {result.results[i].explanation}
                  </p>
                )}
              </fieldset>
            ))}
            {result ? (
              <button
                className="button secondary"
                onClick={() => {
                  setResult(null);
                  setAnswers([]);
                }}
              >
                {t("Попробовать ещё раз")}
              </button>
            ) : (
              <button
                className="button primary"
                disabled={
                  busy || exercises.quiz.some((_, i) => answers[i] == null)
                }
                onClick={check}
              >
                {busy ? t("Проверяем…") : t("Проверить ответы")}
              </button>
            )}
          </div>
          <div className="panel practical-tasks">
            <span className="eyebrow">{t("ПРИМЕНИТЕ НА ПРАКТИКЕ")}</span>
            <h2>{t("От знания к действию")}</h2>
            {exercises.tasks.map((task, i) => (
              <div className="task" key={i}>
                <span className="tag">
                  {t("Задание")} {i + 1}
                </span>
                <h3>{task.question}</h3>
                <textarea
                  placeholder={t("Ваш ответ…")}
                  maxLength={10000}
                  aria-label={t("Ответ на задание {0}", i + 1)}
                  value={taskAnswers[i] || ""}
                  onChange={(e) => {
                    setTasksSaved(false);
                    setTaskAnswers((a) => ({ ...a, [i]: e.target.value }));
                  }}
                  rows={3}
                />
                <details>
                  <summary>{t("Посмотреть пример ответа")}</summary>
                  <p>{task.answer}</p>
                </details>
              </div>
            ))}
            <button
              className="button secondary"
              disabled={busy}
              onClick={saveTasks}
            >
              {tasksSaved ? <Check size={15} /> : <Save size={15} />}
              {tasksSaved
                ? t("Ответы сохранены")
                : t("Сохранить ответы на задания")}
            </button>
            <p className="form-hint">
              {t(
                "Задания для самопроверки: сравните своё объяснение с примером. Ответы сохраняются в вашем аккаунте.",
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="notes-layout">
          <section className="panel summary">
            <div className="section-heading">
              <h2>{t("Главное из лекции")}</h2>
              <button className="button secondary small" onClick={download}>
                <Download size={15} />
                {t("Скачать")}
              </button>
            </div>
            <div className="summary-text">{lecture.summary}</div>
          </section>
          <section className="panel notes">
            <h2>{t("Мои заметки")}</h2>
            <p>{t("Ваши мысли, примеры и новые вопросы.")}</p>
            <textarea
              aria-label={t("Мои заметки")}
              rows={10}
              maxLength={20000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
              placeholder={t("Что хочется запомнить?")}
            />
            <div className="notes-save">
              <span>{notes.length} / 20 000</span>
              <button
                className="button secondary small"
                disabled={busy}
                onClick={save}
              >
                {saved ? <Check size={15} /> : <Save size={15} />}
                {saved
                  ? t("Сохранено")
                  : busy
                    ? t("Сохраняем…")
                    : t("Сохранить")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
