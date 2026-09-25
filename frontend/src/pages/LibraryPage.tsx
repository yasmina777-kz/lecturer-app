import { t } from "../i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLectures } from "../hooks/useLectures";
import { Empty, ErrorMessage, LectureCard, Loading } from "../components/UI";
export function LibraryPage() {
  const { user } = useAuth();
  const { lectures, loading, error, reload } = useLectures();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = lectures.filter(
    (l) =>
      `${l.title} ${l.subject}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "completed"
          ? l.progress?.completed
          : filter === "active"
            ? l.progress && !l.progress.completed
            : l.ownerId === user?.id)),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("ВАША КОЛЛЕКЦИЯ ЗНАНИЙ")}</span>
          <h1>{t("Мои лекции")}</h1>
          <p>{t("Все темы, к которым хочется вернуться.")}</p>
        </div>
        <Link className="button primary" to="/create">
          <Plus size={18} />
          {t("Новая лекция")}
        </Link>
      </div>
      <div className="library-toolbar">
        <div className="tabs">
          {[
            ["all", t("Все лекции")],
            ["active", t("В процессе")],
            ["completed", t("Завершённые")],
            ["own", t("Созданные")],
          ].map(([key, label]) => (
            <button
              className={filter === key ? "active" : ""}
              key={key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label={t("Поиск лекций")}
            placeholder={t("Найти лекцию…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <ErrorMessage message={error} />
      {error && (
        <button className="button secondary" onClick={reload}>
          {t("Повторить")}
        </button>
      )}
      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <div className="lecture-grid library-grid">
          {filtered.map((l, i) => (
            <LectureCard key={l.id} lecture={l} index={i} />
          ))}
        </div>
      ) : (
        <Empty
          title={t("Здесь пока тихо")}
          text={
            search
              ? t("Попробуйте другой запрос.")
              : t("Создайте лекцию или выберите другую вкладку.")
          }
          action={
            <Link to="/create" className="button primary">
              {t("Создать лекцию")}
            </Link>
          }
        />
      )}
    </>
  );
}
