import { t, demoId } from "../i18n";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { apiGet, post } from "../api/httpClient";
import type { Capabilities } from "../types/lecture";
import { ErrorMessage, messageOf } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import type { Language } from "../types/auth";
export function CreatePage() {
  const { user } = useAuth();
  const [teachingLanguage, setTeachingLanguage] = useState<Language>(
    user?.teachingLanguage || "ru",
  );
  const [params] = useSearchParams();
  const [mode, setMode] = useState(
    params.get("mode") === "file" ? "file" : "topic",
  );
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState("Начальный");
  const [minutes, setMinutes] = useState(10);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    apiGet<Capabilities>("/capabilities")
      .then(setCaps)
      .catch((e) => setError(messageOf(e)));
  }, []);
  function selectFile(f?: File) {
    if (!f) return;
    if (
      f.size > 10 * 1024 * 1024 ||
      !/\.(pdf|docx|pptx|txt|md)$/i.test(f.name)
    ) {
      setError(t("Выберите PDF, DOCX, PPTX, TXT или MD размером до 10 МБ."));
      return;
    }
    setFile(f);
    setError("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "file" && !file) {
      setError(t("Сначала выберите материал."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("topic", topic);
      data.append("level", level);
      data.append("language", teachingLanguage);
      data.append("durationMinutes", String(minutes));
      if (mode === "file" && file) data.append("file", file);
      const result = await post<{ id: string }>("/lectures", data);
      navigate(`/lectures/${result.id}`);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link to="/library" className="back-link">
        <ArrowLeft size={16} />
        {t("К библиотеке")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("ОТ ИНТЕРЕСА К ПОНИМАНИЮ")}</span>
          <h1>{t("Создадим вашу лекцию")}</h1>
          <p>
            {t(
              "Расскажите, что хотите изучить. Остальное подготовит AI-лектор.",
            )}
          </p>
        </div>
      </div>
      <div className="create-layout">
        <form className="panel create-form" onSubmit={submit}>
          <div className="tabs segmented">
            <button
              type="button"
              disabled={busy}
              className={mode === "topic" ? "active" : ""}
              onClick={() => setMode("topic")}
            >
              <Sparkles size={16} />
              {t("Выбрать тему")}
            </button>
            <button
              type="button"
              disabled={busy}
              className={mode === "file" ? "active" : ""}
              onClick={() => setMode("file")}
            >
              <Upload size={16} />
              {t("Загрузить материал")}
            </button>
          </div>
          <fieldset disabled={busy}>
            {mode === "file" && (
              <>
                <label>{t("Учебный материал")}</label>
                <div
                  className={`dropzone ${drag ? "drag" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    if (!busy) selectFile(e.dataTransfer.files[0]);
                  }}
                >
                  <Upload size={29} />
                  <strong>
                    {file ? file.name : t("Перетащите файл сюда")}
                  </strong>
                  <p>
                    {file
                      ? t(
                          "{0} КБ · Готов к загрузке",
                          (file.size / 1024).toFixed(0),
                        )
                      : t("или выберите его на компьютере")}
                  </p>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => input.current?.click()}
                  >
                    {file ? t("Выбрать другой") : t("Выбрать файл")}
                  </button>
                  <small>{t("PDF, DOCX, PPTX, TXT, MD · до 10 МБ")}</small>
                  <input
                    ref={input}
                    type="file"
                    aria-label={t("Учебный материал")}
                    accept=".pdf,.docx,.pptx,.txt,.md"
                    onChange={(e) => selectFile(e.target.files?.[0])}
                    hidden
                  />
                </div>
              </>
            )}
            <label>
              {mode === "topic"
                ? t("Что будем изучать?")
                : t("На чём сделать акцент? (необязательно)")}
              <textarea
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={300}
                required={mode === "topic"}
                placeholder={t(
                  "Например, как работают нейронные сети. Объясни с примерами из повседневной жизни.",
                )}
              />
            </label>
            {mode === "topic" && (
              <div className="suggestions">
                {[
                  t("Основы Python"),
                  t("Солнечная система"),
                  t("Искусство запоминания"),
                ].map((t) => (
                  <button type="button" key={t} onClick={() => setTopic(t)}>
                    {t}
                    <PlusSign />
                  </button>
                ))}
              </div>
            )}
            <label>
              {t("Язык лекции")}
              <select
                value={teachingLanguage}
                onChange={(e) =>
                  setTeachingLanguage(e.target.value as Language)
                }
              >
                <option value="ru">{t("Русский")}</option>
                <option value="en">English</option>
                <option value="kk">{t("Қазақша")}</option>
              </select>
            </label>
            <div className="form-grid">
              <label>
                {t("Уровень знаний")}
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  {["Начальный", "Средний", "Продвинутый"].map((l) => (
                    <option key={l} value={l}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Длительность лекции")}
                <select
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                >
                  {[5, 10, 15, 20, 30].map((m) => (
                    <option key={m} value={m}>
                      {t("{0} минут", m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="form-hint">
              {t(
                "Около {0} слайдов с подробным объяснением и схемами. Длительность указана при обычном темпе речи, без вопросов и пауз.",
                Math.ceil(minutes / 2),
              )}
            </p>
          </fieldset>
          <ErrorMessage message={error} />
          {caps && !caps.aiConfigured && (
            <div className="notice">
              <Sparkles size={19} />
              <div>
                <strong>{t("Генерация ждёт подключения AI")}</strong>
                <p>
                  {t(
                    "Владелец установки может добавить ключ в настройках сервера. А пока познакомьтесь с",
                  )}{" "}
                  <Link to={`/lectures/${demoId()}`}>
                    {t("демонстрационной лекцией")}
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}
          <button
            className="button primary full"
            disabled={busy || !caps?.aiConfigured}
          >
            {busy ? (
              <>
                <LoaderCircle className="spin" size={18} />
                {t("Готовим вашу лекцию…")}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {t("Создать лекцию")}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="form-hint">
            {busy
              ? t(
                  "Длинное занятие создаётся по частям и может занять несколько минут. Оставьте страницу открытой.",
                )
              : t(
                  "Для генерации текст материала отправляется AI-провайдеру. Оригинальный файл на сервере не сохраняется.",
                )}
          </p>
        </form>
        <aside className="create-aside">
          <span className="tip-icon">
            <Sparkles size={24} />
          </span>
          <h2>
            {t("Одна тема.")}
            <br />
            {t("Целое занятие.")}
          </h2>
          <p>
            {t(
              "Мы соберём всё, что помогает не просто послушать, а разобраться.",
            )}
          </p>
          {[
            [t("Презентация"), t("Структура, тезисы и наглядные слайды")],
            [t("Ваш AI-лектор"), t("Голосовое объяснение и ответы на вопросы")],
            [t("Конспект"), t("Главное из лекции в одном месте")],
            [t("Практика"), t("Тестовые вопросы и небольшие задания")],
          ].map(([a, b]) => (
            <div className="included-item" key={a}>
              <Check size={17} />
              <div>
                <strong>{a}</strong>
                <p>{b}</p>
              </div>
            </div>
          ))}
          <div className="aside-note">
            {t("Совет: чем конкретнее тема, тем полезнее будет лекция.")}
          </div>
        </aside>
      </div>
    </>
  );
}
function PlusSign() {
  return <span>+</span>;
}
