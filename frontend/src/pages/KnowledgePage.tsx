import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, Network, Target } from "lucide-react";
import { t } from "../i18n";
import { apiGet } from "../api/httpClient";
import { ErrorMessage, Loading, messageOf } from "../components/UI";
import {
  HistoryChart,
  MasteryRing,
  ProgressBar,
  scoreText,
} from "../components/LearningCharts";
import type { KnowledgeData, KnowledgeTopic } from "../types/learning";
const stage = (p: KnowledgeTopic) =>
  p.score == null ? 3 : p.score >= 80 ? 0 : p.score >= 60 ? 1 : 2;
export function KnowledgePage() {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(-1);
  useEffect(() => {
    let active = true;
    apiGet<KnowledgeData>("/knowledge")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      });
    return () => {
      active = false;
    };
  }, []);
  const labels = [t("Освоено"), t("Закрепить"), t("Повторить"), t("Нет теста")];
  if (!data && !error) return <Loading />;
  const counts = [0, 1, 2, 3].map(
    (i) => data?.topics.filter((p) => stage(p) === i).length ?? 0,
  );
  const tested = data?.topics.filter((p) => p.score != null) ?? [];
  const average = tested.length
    ? Math.round(tested.reduce((n, p) => n + p.score!, 0) / tested.length)
    : null;
  const next =
    data?.topics
      .filter((p) => stage(p) !== 0)
      .sort(
        (a, b) =>
          (a.score ?? 101) - (b.score ?? 101) ||
          Number(b.started) - Number(a.started),
      )
      .slice(0, 3) ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("ВАШ ПУТЬ ОБУЧЕНИЯ")}</span>
          <h1>{t("Карта знаний")}</h1>
          <p>
            {t(
              "Замечайте прогресс, находите пробелы и выбирайте следующий шаг.",
            )}
          </p>
        </div>
        <Link to="/library" className="button secondary">
          <BookOpen size={17} />
          {t("Мои лекции")}
        </Link>
      </div>
      <ErrorMessage message={error} />
      {data && (
        <>
          <div className="learning-metrics">
            <article>
              <Network />
              <span>{t("Тем в карте")}</span>
              <strong>{data.topics.length}</strong>
            </article>
            <article>
              <Target />
              <span>{t("Средний результат")}</span>
              <strong>{average == null ? "—" : `${average}%`}</strong>
            </article>
            <article>
              <BookOpen />
              <span>{t("Завершено лекций")}</span>
              <strong>{data.topics.filter((p) => p.completed).length}</strong>
            </article>
          </div>
          <div className="knowledge-grid">
            <section className="panel">
              <div className="section-heading">
                <h2>{t("Баланс знаний")}</h2>
                <span className="learning-tag">{t("По тестам")}</span>
              </div>
              <MasteryRing counts={counts} />
              <p className="form-hint">
                {t(
                  "Освоено: от 80%. Закрепить: 60–79%. Повторить: ниже 60%. Это ориентир по последнему тесту, а не итоговая оценка знаний.",
                )}
              </p>
            </section>
            <section className="panel">
              <h2>{t("Динамика результатов")}</h2>
              <HistoryChart history={data.history} />
              <p className="form-hint">
                {t(
                  "Последние 12 попыток. Старые результаты сохранены в карте; история записывается с момента включения этой функции.",
                )}
              </p>
            </section>
          </div>
          <section className="panel subject-panel">
            <div className="section-heading">
              <h2>{t("Результаты по предметам")}</h2>
              <span className="learning-tag">{t("Средний балл тестов")}</span>
            </div>
            {data.subjects.length ? (
              data.subjects.map((s) => (
                <div className="subject-row" key={s.subject}>
                  <div>
                    <strong>{t(s.subject)}</strong>
                    <small>
                      {t("Проверено тем: {0} из {1}", s.tested, s.total)}
                    </small>
                  </div>
                  <ProgressBar value={s.average ?? 0} label={s.subject} />
                  <b>{scoreText(s.average)}</b>
                </div>
              ))
            ) : (
              <p className="muted">
                {t(
                  "Начните лекцию или присоединитесь к группе — темы появятся здесь.",
                )}
              </p>
            )}
          </section>
          <div className="section-heading">
            <h2>{t("Ваши темы")}</h2>
            <div className="learning-filters">
              {[t("Все"), ...labels].map((label, i) => (
                <button
                  key={label}
                  className={filter === i - 1 ? "active" : ""}
                  onClick={() => setFilter(i - 1)}
                  aria-pressed={filter === i - 1}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="knowledge-topics">
            {data.topics
              .filter((p) => filter === -1 || stage(p) === filter)
              .map((p) => (
                <Link
                  className={`topic-card topic-stage-${stage(p)}`}
                  to={`/lectures/${p.id}`}
                  key={p.id}
                >
                  <div>
                    <span>{t(p.subject)}</span>
                    <ArrowUpRight size={19} />
                  </div>
                  <h3>{p.title}</h3>
                  <ProgressBar value={p.score ?? 0} label={p.title} />
                  <footer>
                    <span>{labels[stage(p)]}</span>
                    <strong>{scoreText(p.score)}</strong>
                  </footer>
                </Link>
              ))}
          </div>
          {!data.topics.length && (
            <div className="panel learning-empty">
              <Network size={36} />
              <h2>{t("Ваша карта начинается с первой темы")}</h2>
              <p>
                {t(
                  "Посмотрите лекцию и пройдите тест. Результаты постепенно заполнят графики.",
                )}
              </p>
              <Link className="button primary" to="/library">
                {t("Выбрать лекцию")}
              </Link>
            </div>
          )}
          {data.topics.length > 0 &&
            data.topics.filter((p) => filter === -1 || stage(p) === filter)
              .length === 0 && (
              <p className="muted">{t("В этой категории пока нет тем.")}</p>
            )}
          {next.length > 0 && (
            <section className="panel next-learning">
              <h2>{t("Следующие шаги")}</h2>
              {next.map((p, i) => (
                <Link to={`/lectures/${p.id}`} key={p.id}>
                  <span className="next-number">0{i + 1}</span>
                  <div>
                    <strong>{p.title}</strong>
                    <small>
                      {p.score == null
                        ? t("Пройдите тест, чтобы проверить понимание.")
                        : t(
                            "Вернитесь к объяснению и попробуйте тест ещё раз.",
                          )}
                    </small>
                  </div>
                  <ArrowUpRight size={19} />
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
