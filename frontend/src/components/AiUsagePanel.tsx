import { useEffect, useState } from "react";
import { t, getLanguage } from "../i18n";
import { apiGet } from "../api/httpClient";
import { ErrorMessage, Loading, messageOf } from "./UI";
interface Summary {
  operation: string;
  requests: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  knownEstimatedUsd: number;
  unpriced: number;
  unknownTokens: number;
  failed: number;
  audioSeconds: number;
}
interface UsageRow {
  id: string;
  createdAt: string;
  operation: string;
  model: string;
  status: string;
  userName: string | null;
  lectureTitle: string | null;
  lectureId: string;
  inputTokens: number | null;
  cachedTokens: number | null;
  outputTokens: number | null;
  estimatedUsd: number | null;
  audioSeconds: number | null;
}
interface Estimate {
  minutes: number;
  slides: number;
  calls: number;
  inputTokensLow: number;
  inputTokensHigh: number;
  outputTokensLow: number;
  outputTokensHigh: number;
  costLow: number | null;
  costHigh: number | null;
  model: string;
}
interface Report {
  total: number;
  page: number;
  pageSize: number;
  summary: Summary[];
  rows: UsageRow[];
  estimates: Estimate[];
  pricingDate: string;
  pricingUrl: string;
}
const operations: Record<string, string> = {
  lecture_plan: "План и конспект",
  lecture_slides: "Текст и иллюстрации слайдов",
  question: "Ответы на вопросы",
  transcription: "Распознавание голоса",
};
const statuses: Record<string, string> = {
  success: "Готово",
  pending: "В процессе",
  provider_error: "Ошибка провайдера",
  invalid_response: "Неполный ответ",
  interrupted: "Прервано",
};
const n = (v: number | null) =>
  v === null ? "—" : v.toLocaleString(getLanguage());
const usd = (v: number | null) =>
  v === null
    ? "—"
    : new Intl.NumberFormat(getLanguage(), {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }).format(v);
export function AiUsagePanel() {
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState("");
  const [days, setDays] = useState(30),
    [operation, setOperation] = useState(""),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setReport(null);
    apiGet<Report>(
      `/admin/usage?days=${days}&page=${page}${operation ? `&operation=${operation}` : ""}`,
    )
      .then((r) => {
        if (active) setReport(r);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      });
    return () => {
      active = false;
    };
  }, [days, operation, page, refresh]);
  const total = (key: keyof Summary) =>
    report?.summary.reduce((s, r) => s + Number(r[key]), 0) ?? 0;
  return (
    <div className="usage-panel">
      <div className="panel">
        <div className="section-heading">
          <div>
            <h2>{t("Расход AI")}</h2>
            <p className="muted">
              {t(
                "Фактические токены из ответов провайдера. Стоимость — расчётная, в USD.",
              )}
            </p>
          </div>
          <button
            className="button secondary small"
            onClick={() => setRefresh((x) => x + 1)}
          >
            {t("Обновить")}
          </button>
        </div>
        <div className="usage-filters">
          <label>
            {t("Период")}
            <select
              value={days}
              onChange={(e) => {
                setDays(+e.target.value);
                setPage(1);
              }}
            >
              {[1, 7, 30, 90, 365].map((d) => (
                <option key={d} value={d}>
                  {t("Последние {0} дней", d)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Операция")}
            <select
              value={operation}
              onChange={(e) => {
                setOperation(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("Все операции")}</option>
              {Object.entries(operations).map(([k, v]) => (
                <option value={k} key={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ErrorMessage message={error} />
        {!report && !error && <Loading />}
        {report && (
          <>
            <div className="usage-stats">
              {[
                [n(total("inputTokens")), t("Входные токены")],
                [n(total("outputTokens")), t("Выходные токены")],
                [usd(total("knownEstimatedUsd")), t("Известная стоимость")],
                [n(total("requests")), t("Запросов")],
              ].map(([v, l]) => (
                <div key={l}>
                  <strong>{v}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <p className="form-hint">
              {t(
                "Без тарифа: {0} запросов. Без данных о токенах: {1}. Ошибки: {2}.",
                total("unpriced"),
                total("unknownTokens"),
                total("failed"),
              )}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Операция")}</th>
                    <th>{t("Запросов")}</th>
                    <th>{t("Вход / выход")}</th>
                    <th>{t("Кеш")}</th>
                    <th>USD ≈</th>
                  </tr>
                </thead>
                <tbody>
                  {report.summary.map((s) => (
                    <tr key={s.operation}>
                      <td>{t(operations[s.operation] || s.operation)}</td>
                      <td>{n(s.requests)}</td>
                      <td>
                        {n(
                          s.unknownTokens === s.requests ? null : s.inputTokens,
                        )}{" "}
                        /{" "}
                        {n(
                          s.unknownTokens === s.requests
                            ? null
                            : s.outputTokens,
                        )}
                      </td>
                      <td>
                        {n(
                          s.unknownTokens === s.requests
                            ? null
                            : s.cachedTokens,
                        )}
                      </td>
                      <td>
                        {usd(
                          s.unpriced === s.requests
                            ? null
                            : s.knownEstimatedUsd,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!report.total && (
              <p className="empty-inline">
                {t(
                  "Расходов за этот период пока нет. Учёт начнётся с новых AI-запросов.",
                )}
              </p>
            )}
            <p className="form-hint">
              {t(
                "Кеш входит во входные токены. Прочерк означает отсутствие данных, а не бесплатный запрос. Расход до включения учёта не восстановлен. Озвучка Azure оплачивается отдельно; голос браузера не расходует AI-токены.",
              )}
            </p>
          </>
        )}
      </div>
      {report && (
        <>
          <div className="panel">
            <h2>{t("Журнал запросов")}</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Пользователь / лекция")}</th>
                    <th>{t("Операция / модель")}</th>
                    <th>{t("Вход / выход")}</th>
                    <th>USD ≈</th>
                    <th>{t("Статус")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.userName || "—"}</strong>
                        <small>
                          {r.lectureTitle ||
                            t("Лекция не сохранена или удалена")}
                        </small>
                        <small>
                          {new Date(r.createdAt).toLocaleString(getLanguage())}
                        </small>
                      </td>
                      <td>
                        {t(operations[r.operation] || r.operation)}
                        <small>{r.model}</small>
                        {r.audioSeconds !== null && (
                          <small>
                            {t("Аудио: {0} сек.", r.audioSeconds.toFixed(1))}
                          </small>
                        )}
                      </td>
                      <td>
                        {n(r.inputTokens)} / {n(r.outputTokens)}
                      </td>
                      <td>{usd(r.estimatedUsd)}</td>
                      <td>{t(statuses[r.status] || r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="usage-pagination">
              <button
                className="button secondary small"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("Назад")}
              </button>
              <span>
                {t(
                  "Страница {0} из {1}",
                  page,
                  Math.max(1, Math.ceil(report.total / report.pageSize)),
                )}
              </span>
              <button
                className="button secondary small"
                disabled={page * report.pageSize >= report.total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("Далее")}
              </button>
            </div>
          </div>
          <div className="panel">
            <h2>{t("Сколько стоит одна лекция")}</h2>
            <p className="muted">
              {t(
                "Ориентир для темы без файла: русский текст, подробный рассказ, конспект, задания и векторные иллюстрации. Это оценка, не лимит списания.",
              )}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Длительность лекции")}</th>
                    <th>{t("Слайдов")}</th>
                    <th>{t("Входные токены")}</th>
                    <th>{t("Выходные токены")}</th>
                    <th>USD ≈</th>
                  </tr>
                </thead>
                <tbody>
                  {report.estimates.map((e) => (
                    <tr key={e.minutes}>
                      <td>{t("{0} минут", e.minutes)}</td>
                      <td>{e.slides}</td>
                      <td>
                        {n(e.inputTokensLow)}–{n(e.inputTokensHigh)}
                      </td>
                      <td>
                        {n(e.outputTokensLow)}–{n(e.outputTokensHigh)}
                      </td>
                      <td>
                        {usd(e.costLow)}–{usd(e.costHigh)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="form-hint">
              {t(
                "Модель: {0}. Файлы, дополнительные вопросы и повторные попытки увеличивают расход. Фотографии, генерация растровых картинок и облачная озвучка в расчёт не входят.",
                report.estimates[0]?.model || "—",
              )}{" "}
              <a href={report.pricingUrl} target="_blank" rel="noreferrer">
                {t("Источник тарифа")}
              </a>{" "}
              · {report.pricingDate}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
