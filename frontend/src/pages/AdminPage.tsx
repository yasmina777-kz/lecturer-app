import { lazy, Suspense } from "react";
const AutomationPanel = lazy(() => import("../components/AutomationPanel").then(m => ({default:m.AutomationPanel})));
import { at } from "../i18n/automation";
import { useNavigate } from "react-router-dom";
import { AiUsagePanel } from "../components/AiUsagePanel";
import { t, getLanguage } from "../i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { apiGet, patch, request } from "../api/httpClient";
import { useAuth } from "../context/AuthContext";
import { ErrorMessage, Loading, messageOf } from "../components/UI";
import type { LectureCard } from "../types/lecture";
import type { UserRole } from "../types/auth";
interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isDisabled: boolean;
  createdAt: string;
}
interface Overview {
  users: number;
  lectures: number;
  questions: number;
  completed: number;
  aiConfigured: boolean;
  aiModel: string;
  speech: string;
  database: string;
  recentQuestions: {
    id: string;
    questionText: string;
    lectureTitle: string;
    createdAt: string;
  }[];
}
export function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [lectures, setLectures] = useState<LectureCard[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    detail: string;
    run: () => Promise<void>;
  } | null>(null);
  async function load() {
    try {
      const [o, u, l] = await Promise.all([
        apiGet<Overview>("/admin/overview"),
        apiGet<AdminUser[]>("/admin/users"),
        apiGet<LectureCard[]>("/lectures"),
      ]);
      setOverview(o);
      setUsers(u);
      setLectures(l);
    } catch (e) {
      setError(messageOf(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function changeUser(u: AdminUser, role: UserRole, isDisabled: boolean) {
    await patch(`/admin/users/${u.id}`, { role, isDisabled });
  }
  async function perform() {
    if (!confirm) return;
    setBusy(true);
    setError("");
    try {
      await confirm.run();
      setConfirm(null);
      await load();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("УПРАВЛЕНИЕ ПЛАТФОРМОЙ")}</span>
          <h1>{t("Админ-панель")}</h1>
          <p>{t("Пользователи, учебные материалы и состояние сервисов.")}</p>
        </div>
        <span className="tag">
          <ShieldCheck size={15} />
          {t("Администратор")}
        </span>
      </div>
      <div className="tabs admin-tabs">
        {[
          ["overview", t("Обзор")],
          ["users", t("Пользователи")],
          ["lectures", t("Лекции")],
          ["system", t("Сервисы")],
          ["usage", t("Расход AI")],
          ["automation", at("Автоматизация", "Automation", "Автоматтандыру")],
        ].map(([key, title]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              setSearch("");
            }}
          >
            {title}
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
      {!overview ? (
        error ? (
          <button className="button secondary" onClick={load}>
            {t("Повторить")}
          </button>
        ) : (
          <Loading />
        )
      ) : (
        <>
          {tab === "usage" && <AiUsagePanel />}
          {tab === "automation" && <Suspense fallback={<Loading/>}><AutomationPanel /></Suspense>}
          {tab === "overview" && (
            <>
              <div className="admin-stats">
                {[
                  [overview.users, t("Пользователей"), Users],
                  [overview.lectures, t("Лекций"), BookOpen],
                  [overview.questions, t("Вопросов AI"), Activity],
                  [overview.completed, t("Завершений"), Check],
                ].map(([n, label, Icon]: any) => (
                  <div className="panel" key={label}>
                    <Icon size={21} />
                    <strong>{n}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="panel">
                <h2>{t("Последние вопросы")}</h2>
                <p className="muted">
                  {t("Помогают понять, какие темы нуждаются в пояснении.")}
                </p>
                {overview.recentQuestions.length ? (
                  overview.recentQuestions.map((q) => (
                    <div className="activity-row" key={q.id}>
                      <span className="status-dot" />
                      <div>
                        <strong>{q.questionText}</strong>
                        <p>{q.lectureTitle}</p>
                      </div>
                      <small>
                        {new Date(q.createdAt).toLocaleDateString(
                          getLanguage(),
                        )}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="empty-inline">
                    {t("Студенты ещё не задавали вопросов.")}
                  </p>
                )}
              </div>
            </>
          )}
          {tab === "users" && (
            <div className="panel">
              <div className="section-heading">
                <h2>
                  {t("Пользователи")}
                  <span className="count">{users.length}</span>
                </h2>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    placeholder={t("Имя или email")}
                    aria-label={t("Поиск пользователей")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Пользователь")}</th>
                      <th>{t("Роль")}</th>
                      <th>{t("Статус")}</th>
                      <th>{t("Регистрация")}</th>
                      <th>{t("Действие")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter((u) =>
                        `${u.fullName} ${u.email}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>
                              {u.fullName}
                              {u.id === user?.id ? t(" (вы)") : ""}
                            </strong>
                            <small>{u.email}</small>
                          </td>
                          <td>
                            <select
                              aria-label={t("Роль {0}", u.fullName)}
                              value={u.role}
                              disabled={u.id === user?.id}
                              onChange={(e) => {
                                const role = e.target.value as UserRole;
                                setConfirm({
                                  title: t("Изменить роль?"),
                                  detail: t(
                                    "{0}: {1}. Текущая сессия пользователя будет завершена.",
                                    u.fullName,
                                    role === "Admin"
                                      ? t("администратор с полным доступом")
                                      : role === "Lecturer"
                                        ? t("преподаватель")
                                        : t("студент"),
                                  ),
                                  run: () => changeUser(u, role, u.isDisabled),
                                });
                              }}
                            >
                              <option value="Student">{t("Студент")}</option>
                              <option value="Lecturer">
                                {t("Преподаватель")}
                              </option>
                              <option value="Admin">
                                {t("Администратор")}
                              </option>
                            </select>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${u.isDisabled ? "off" : ""}`}
                            >
                              {u.isDisabled ? t("Заблокирован") : t("Активен")}
                            </span>
                          </td>
                          <td>
                            {new Date(u.createdAt).toLocaleDateString(
                              getLanguage(),
                            )}
                          </td>
                          <td>
                            <button
                              className="text-link"
                              disabled={u.id === user?.id}
                              onClick={() =>
                                setConfirm({
                                  title: u.isDisabled
                                    ? t("Восстановить доступ?")
                                    : t("Заблокировать пользователя?"),
                                  detail: u.email,
                                  run: () =>
                                    changeUser(u, u.role, !u.isDisabled),
                                })
                              }
                            >
                              {u.isDisabled
                                ? t("Разблокировать")
                                : t("Заблокировать")}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "lectures" && (
            <div className="panel">
              <h2>{t("Все лекции")}</h2>
              <p className="muted">
                {t(
                  "Опубликованные лекции доступны всем зарегистрированным пользователям.",
                )}
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Лекция")}</th>
                      <th>{t("Слайдов")}</th>
                      <th>{t("Доступ")}</th>
                      <th>{t("Управление")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lectures.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <Link to={`/lectures/${l.id}`}>
                            <strong>{l.title}</strong>
                          </Link>
                          <small>{l.subject}</small>
                        </td>
                        <td>{l.slideCount}</td>
                        <td>
                          <span className="status-pill">
                            {l.isPublished
                              ? t("Общая библиотека")
                              : t("Личная")}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="icon-button"
                              title={
                                l.isPublished
                                  ? t("Снять с публикации")
                                  : t("Опубликовать")
                              }
                              aria-label={`${l.isPublished ? t("Снять с публикации") : t("Опубликовать")}: ${l.title}`}
                              onClick={() =>
                                setConfirm({
                                  title: l.isPublished
                                    ? t("Снять с публикации?")
                                    : t("Опубликовать лекцию?"),
                                  detail: l.isPublished
                                    ? t(
                                        "Лекция останется доступна владельцу и администратору.",
                                      )
                                    : t(
                                        "Откроется лекция: проверьте качество и подтвердите публикацию в разделе управления.",
                                      ),
                                  run: async () => {
                                    if (!l.isPublished) { navigate(`/lectures/${l.id}`); return; }
                                    await patch(`/lectures/${l.id}`, {
                                      title: l.title,
                                      isPublished: !l.isPublished,
                                    });
                                  },
                                })
                              }
                            >
                              {l.isPublished ? (
                                <EyeOff size={18} />
                              ) : (
                                <Eye size={18} />
                              )}
                            </button>
                            <button
                              className="icon-button danger-text"
                              aria-label={t("Удалить: {0}", l.title)}
                              onClick={() =>
                                setConfirm({
                                  title: t("Удалить лекцию?"),
                                  detail: t(
                                    "«{0}», вопросы и прогресс студентов будут удалены без возможности восстановления.",
                                    l.title,
                                  ),
                                  run: async () => {
                                    await request(`/lectures/${l.id}`, {
                                      method: "DELETE",
                                    });
                                  },
                                })
                              }
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "system" && (
            <div className="panel services-panel">
              <h2>{t("Состояние сервисов")}</h2>
              <div className="service-row">
                <div>
                  <strong>{t("Генерация лекций и ответы AI")}</strong>
                  <p>
                    {t("Модель:")}
                    {overview.aiModel}
                  </p>
                </div>
                <span
                  className={`status-pill ${overview.aiConfigured ? "" : "off"}`}
                >
                  {overview.aiConfigured
                    ? t("Ключ настроен")
                    : t("Требуется ключ")}
                </span>
              </div>
              <div className="service-row">
                <div>
                  <strong>{t("Озвучка")}</strong>
                  <p>
                    {overview.speech === "azure"
                      ? "Azure Speech · RU / EN / KK"
                      : t("Синтез речи средствами браузера")}
                  </p>
                </div>
                <span className="status-pill">
                  {overview.speech === "azure"
                    ? t("Ключ настроен")
                    : t("Встроена")}
                </span>
              </div>
              <div className="service-row">
                <div>
                  <strong>{t("Распознавание голоса")}</strong>
                  <p>{t("Через API-провайдера, после разрешения микрофона")}</p>
                </div>
                <span
                  className={`status-pill ${overview.aiConfigured ? "" : "off"}`}
                >
                  {overview.aiConfigured
                    ? t("Ключ настроен")
                    : t("Требуется ключ")}
                </span>
              </div>
              <div className="service-row">
                <div>
                  <strong>{t("База данных")}</strong>
                  <p>
                    {overview.database.includes("Sqlite")
                      ? t("SQLite · локальное хранение")
                      : "PostgreSQL"}
                  </p>
                </div>
                <span className="status-pill">{t("Подключена")}</span>
              </div>
              <div className="notice">
                {t(
                  "Облачные голоса подключаются через configure-speech.command. Нужны ключ и регион Azure Speech.",
                )}
              </div>
              <div className="notice">
                {t(
                  "Ключи задаются на сервере через OPENAI_API_KEY или AI__ApiKey. Модель — AI__Model. После изменения перезапустите сервер. Ключ не показывается в интерфейсе. Наличие ключа ещё не подтверждает доступ к API.",
                )}
              </div>
            </div>
          )}
        </>
      )}
      {confirm && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">{confirm.title}</h2>
            <p>{confirm.detail}</p>
            <ErrorMessage message={error} />
            <div className="modal-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                {t("Отмена")}
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={perform}
              >
                {busy ? t("Выполняем…") : t("Подтвердить")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
