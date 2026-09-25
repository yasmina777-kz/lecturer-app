import { t } from "../i18n";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, GraduationCap } from "lucide-react";
import { useLectures } from "../hooks/useLectures";
import { Empty, ErrorMessage, Loading } from "../components/UI";
export function PracticePage() {
  const { lectures, loading, error } = useLectures();
  const available = lectures.filter((l) => l.progress);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("ЗНАНИЯ ОСТАЮТСЯ С ВАМИ")}</span>
          <h1>{t("Моя практика")}</h1>
          <p>
            {t(
              "Возвращайтесь к вопросам, закрепляйте главное и замечайте свой прогресс.",
            )}
          </p>
        </div>
      </div>
      <ErrorMessage message={error} />
      {loading ? (
        <Loading />
      ) : available.length ? (
        <div className="practice-list">
          {available.map((l) => (
            <Link
              className="panel practice-row"
              to={`/lectures/${l.id}`}
              key={l.id}
            >
              <span className="stat-icon purple">
                <GraduationCap />
              </span>
              <div>
                <span className="eyebrow">{l.subject}</span>
                <h3>{l.title}</h3>
                <p>
                  {l.progress?.completed
                    ? t("Лекция завершена")
                    : t("Обучение продолжается")}{" "}
                  {t("· Тест и практические задания")}
                </p>
              </div>
              <span className="practice-score">
                {l.progress?.quizScore != null
                  ? `${l.progress.quizScore}%`
                  : t("Пройти тест")}
              </span>
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title={t("Первый шаг — познакомиться с темой")}
          text={t(
            "Начните лекцию, и здесь появятся задания и результаты ваших тестов.",
          )}
          action={
            <Link to="/library" className="button primary">
              {t("Выбрать лекцию")}
            </Link>
          }
        />
      )}
    </>
  );
}
