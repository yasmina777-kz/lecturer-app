import { t } from "../i18n";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  GraduationCap,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLectures } from "../hooks/useLectures";
import {
  AiTag,
  Empty,
  ErrorMessage,
  LectureCard,
  Loading,
} from "../components/UI";
import { AvatarPlayer } from "../components/AvatarPlayer";
export function DashboardPage() {
  const { user } = useAuth();
  const { lectures, loading, error, reload } = useLectures();
  const completed = lectures.filter((l) => l.progress?.completed).length;
  const active = lectures.filter((l) => l.progress && !l.progress.completed);
  const scores = lectures.filter((l) => l.progress?.quizScore != null);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("МАЛЕНЬКИЕ ШАГИ. БОЛЬШИЕ ОТКРЫТИЯ.")}
          </span>
          <h1>
            {t("Рады видеть вас,")} {user?.fullName.split(" ")[0]}{" "}
            <span className="greeting-star">✳</span>
          </h1>
          <p>{t("Чему вы хотите научиться сегодня?")}</p>
        </div>
        <span className="date-chip">
          <span className="status-dot" />
          {t("Всё начинается с вопроса")}
        </span>
      </div>
      <section className="dashboard-hero">
        <div className="hero-copy">
          <AiTag />
          <h2>
            {t("Любая тема становится")}
            <br />
            <em>{t("понятнее с диалогом.")}</em>
          </h2>
          <p>
            {t("Загрузите материал или выберите тему.")}
            <br />
            {t("Ваш AI-лектор объяснит, ответит и поможет запомнить.")}
          </p>
          <div className="hero-actions">
            <Link to="/create" className="button primary">
              <Plus size={18} />
              {t("Создать лекцию")}
            </Link>
            <Link to="/create?mode=file" className="button ghost">
              <Upload size={17} />
              {t("Загрузить материал")}
            </Link>
          </div>
          <div className="hero-proof">
            <span className="mini-wave">▂ ▆ ▃ ▇ ▃</span>
            {t("Слушайте. Спрашивайте. Разбирайтесь.")}
          </div>
        </div>
        <div className="hero-portrait">
          <div className="portrait-label">
            <span className="status-dot" />
            {t("ГОТОВ К НОВЫМ ТЕМАМ")}
          </div>
          <AvatarPlayer style={user?.avatarStyle} avatarId={user?.avatarId} />
          <div className="hero-avatar-note">
            <Sparkles size={15} />
            <span>{t("Сложное — простыми словами")}</span>
          </div>
        </div>
      </section>
      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">
            <BookOpen size={21} />
          </span>
          <div>
            <strong>{lectures.length.toString().padStart(2, "0")}</strong>
            <span>{t("Лекций в библиотеке")}</span>
          </div>
          <ArrowUpRight size={17} />
        </div>
        <div className="stat-card">
          <span className="stat-icon peach">
            <CheckCheck size={21} />
          </span>
          <div>
            <strong>{completed.toString().padStart(2, "0")}</strong>
            <span>{t("Лекций завершено")}</span>
          </div>
          <span className="stat-note">{t("Шаг за шагом")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon purple">
            <GraduationCap size={21} />
          </span>
          <div>
            <strong>
              {scores.length
                ? `${Math.round(scores.reduce((a, l) => a + l.progress!.quizScore!, 0) / scores.length)}%`
                : "—"}
            </strong>
            <span>{t("Средний результат тестов")}</span>
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>
            {active.length
              ? t("Продолжим с того же места")
              : t("Ваша следующая лекция")}
          </h2>
          <p>
            {active.length
              ? t("Прогресс сохранён. Можно двигаться дальше.")
              : t("Начните с примера или создайте что-то своё.")}
          </p>
        </div>
        <Link to="/library" className="text-link">
          {t("Все лекции")}
          <ArrowRight size={16} />
        </Link>
      </div>
      <ErrorMessage message={error} />
      {error && (
        <button className="button secondary" onClick={reload}>
          {t("Повторить")}
        </button>
      )}
      {loading ? (
        <Loading />
      ) : (
        <div className="lecture-grid">
          {(active.length ? active : lectures).slice(0, 2).map((l, i) => (
            <LectureCard key={l.id} lecture={l} index={i} />
          ))}
          <Link to="/create" className="create-card">
            <span>
              <Plus size={26} />
            </span>
            <h3>{t("Что вам интересно?")}</h3>
            <p>
              {t("Новая тема, глава из учебника")}
              <br />
              {t("или вопрос, который давно волнует.")}
            </p>
            <b>
              {t("Создать свою лекцию")}
              <ArrowUpRight size={16} />
            </b>
          </Link>
        </div>
      )}
      <div className="learning-tip">
        <span className="tip-icon">
          <Sparkles size={20} />
        </span>
        <div>
          <strong>{t("Понимание начинается с «почему?»")}</strong>
          <p>
            {t(
              "Не оставляйте вопросы на потом. Во время лекции нажмите на микрофон — лектор остановится и объяснит.",
            )}
          </p>
        </div>
        <Link to="/help">
          <ArrowUpRight size={21} />
        </Link>
      </div>
    </>
  );
}
