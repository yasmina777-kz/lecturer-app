import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Plus,
  ArrowUpRight,
  Copy,
  RefreshCw,
  Trash2,
  LogOut,
  CalendarDays,
} from "lucide-react";
import { t } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { apiGet, post, request } from "../api/httpClient";
import { ErrorMessage, Loading, messageOf } from "../components/UI";
import {
  ProgressBar,
  scoreText,
  localDate,
} from "../components/LearningCharts";
import type { GroupSummary, GroupDetail } from "../types/learning";
interface LectureOption {
  id: string;
  title: string;
  ownerId: string | null;
  isPublished: boolean;
}
export function GroupsPage() {
  const { user } = useAuth();
  const teacher = user?.role !== "Student";
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [lectures, setLectures] = useState<LectureOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lecture, setLecture] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    apiGet<GroupSummary[]>("/groups")
      .then((gs) => {
        if (live) {
          setGroups(gs);
          setSelected((old) =>
            gs.some((g) => g.id === old) ? old : (gs[0]?.id ?? ""),
          );
        }
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [version]);
  useEffect(() => {
    let live = true;
    setDetail(null);
    setLecture("");
    setDue("");
    if (!selected) {
      setDetailLoading(false);
      return () => {
        live = false;
      };
    }
    setDetailLoading(true);
    apiGet<GroupDetail>(`/groups/${selected}`)
      .then((d) => {
        if (live) setDetail(d);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setDetailLoading(false);
      });
    return () => {
      live = false;
    };
  }, [selected, version]);
  useEffect(() => {
    if (!teacher) return;
    let live = true;
    apiGet<LectureOption[]>("/lectures")
      .then((ls) => {
        if (live)
          setLectures(
            ls.filter(
              (l) =>
                l.isPublished ||
                l.ownerId === user?.id ||
                user?.role === "Admin",
            ),
          );
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [teacher, user?.id, user?.role]);
  async function mutate(fn: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function enter(e: FormEvent) {
    e.preventDefault();
    await mutate(async () => {
      const g = await post<{ id: string }>(
        teacher ? "/groups" : "/groups/join",
        teacher ? { name } : { code },
      );
      setSelected(g.id);
      setName("");
      setCode("");
    });
  }
  async function assign(e: FormEvent) {
    e.preventDefault();
    await mutate(async () => {
      await post(`/groups/${selected}/assignments`, {
        lectureId: lecture,
        dueAt: due ? new Date(`${due}T23:59:59`).toISOString() : null,
      });
      setNotice(t("Лекция назначена группе."));
    });
  }
  const completion =
    detail?.canManage && detail.memberCount && detail.assignments.length
      ? Math.round(
          (detail.assignments.reduce((n, a) => n + (a.completedCount ?? 0), 0) /
            (detail.memberCount * detail.assignments.length)) *
            100,
        )
      : 0;
  const tested =
    detail?.assignments.reduce((n, a) => n + (a.testedCount ?? 0), 0) ?? 0;
  const groupScore = tested
    ? detail!.assignments.reduce(
        (n, a) => n + (a.averageScore ?? 0) * (a.testedCount ?? 0),
        0,
      ) / tested
    : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("УЧИМСЯ ВМЕСТЕ")}</span>
          <h1>{teacher ? t("Кабинет преподавателя") : t("Мои группы")}</h1>
          <p>
            {teacher
              ? t("Назначайте лекции и замечайте, где группе нужна помощь.")
              : t(
                  "Присоединитесь по коду преподавателя и начните назначенные лекции.",
                )}
          </p>
        </div>
        <Users size={34} />
      </div>
      <ErrorMessage message={error} />
      {notice && (
        <div className="success-msg" role="status">
          {notice}
        </div>
      )}
      <form className="panel group-entry" onSubmit={enter}>
        <label>
          {teacher ? t("Название новой группы") : t("Код группы")}
          <input
            value={teacher ? name : code}
            onChange={(e) =>
              teacher ? setName(e.target.value) : setCode(e.target.value)
            }
            required
            minLength={teacher ? 2 : 1}
            maxLength={teacher ? 100 : 30}
            placeholder={
              teacher ? t("Например, Биология · 10 А") : "A1B2C3D4E5F6"
            }
            autoComplete="off"
          />
        </label>
        <button className="button primary" disabled={busy}>
          <Plus size={17} />
          {teacher ? t("Создать группу") : t("Присоединиться")}
        </button>
        {!teacher && (
          <p className="form-hint">
            {t(
              "Преподаватель увидит ваше имя, завершение назначенных лекций и баллы тестов. Личные заметки останутся у вас.",
            )}
          </p>
        )}
      </form>
      {loading ? (
        <Loading />
      ) : !groups.length ? (
        <div className="panel learning-empty">
          <Users size={40} />
          <h2>{t("Здесь будут ваши группы")}</h2>
          <p>
            {teacher
              ? t(
                  "Создайте группу, передайте студентам код и назначьте первую лекцию.",
                )
              : t(
                  "Попросите код у преподавателя. Назначенные материалы появятся здесь.",
                )}
          </p>
        </div>
      ) : (
        <div className="groups-layout">
          <aside className="group-list" aria-label={t("Группы")}>
            {groups.map((g) => (
              <button
                key={g.id}
                className={selected === g.id ? "selected" : ""}
                onClick={() => {
                  setSelected(g.id);
                  setError("");
                  setNotice("");
                }}
                aria-pressed={selected === g.id}
              >
                <Users size={19} />
                <span>
                  <strong>{g.name}</strong>
                  <small>
                    {t(
                      "Участников: {0} · Лекций: {1}",
                      g.memberCount,
                      g.assignmentCount,
                    )}
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </aside>
          <div className="group-workspace">
            {detailLoading ? (
              <Loading />
            ) : (
              detail && (
                <>
                  <section className="panel group-overview">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">{t("УЧЕБНАЯ ГРУППА")}</span>
                        <h2>{detail.name}</h2>
                      </div>
                      {!detail.canManage && (
                        <button
                          className="button secondary small"
                          disabled={busy}
                          onClick={() =>
                            mutate(async () => {
                              await request(
                                `/groups/${selected}/members/${user!.id}`,
                                { method: "DELETE" },
                              );
                              setSelected("");
                            })
                          }
                        >
                          <LogOut size={15} />
                          {t("Выйти из группы")}
                        </button>
                      )}
                    </div>
                    {detail.canManage && (
                      <>
                        <div className="group-code">
                          <div>
                            <small>{t("Код приглашения")}</small>
                            <strong>{detail.joinCode}</strong>
                          </div>
                          <button
                            className="icon-button"
                            title={t("Скопировать код")}
                            aria-label={t("Скопировать код")}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  detail.joinCode!,
                                );
                                setNotice(t("Код скопирован."));
                              } catch {
                                setNotice(t("Скопируйте код вручную."));
                              }
                            }}
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            className="icon-button"
                            title={t("Обновить код")}
                            aria-label={t("Обновить код")}
                            disabled={busy}
                            onClick={() =>
                              mutate(async () => {
                                await post(`/groups/${selected}/code`);
                                setNotice(
                                  t(
                                    "Новый код готов. Старый код больше не действует.",
                                  ),
                                );
                              })
                            }
                          >
                            <RefreshCw size={17} />
                          </button>
                        </div>
                        <div className="group-mini-stats">
                          <div>
                            <strong>{detail.memberCount}</strong>
                            <span>{t("Участники")}</span>
                          </div>
                          <div>
                            <strong>{completion}%</strong>
                            <span>{t("Завершение заданных лекций")}</span>
                          </div>
                          <div>
                            <strong>{scoreText(groupScore)}</strong>
                            <span>{t("Средний результат")}</span>
                          </div>
                        </div>
                        <ProgressBar
                          value={completion}
                          label={t("Завершение заданных лекций")}
                        />
                      </>
                    )}
                  </section>
                  {detail.canManage && (
                    <form className="panel assign-form" onSubmit={assign}>
                      <h3>{t("Назначить лекцию")}</h3>
                      <div>
                        <label>
                          {t("Лекция")}
                          <select
                            value={lecture}
                            onChange={(e) => setLecture(e.target.value)}
                            required
                          >
                            <option value="">{t("Выберите лекцию")}</option>
                            {lectures.map((l) => (
                              <option value={l.id} key={l.id}>
                                {l.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {t("Срок (необязательно)")}
                          <input
                            type="date"
                            value={due}
                            onChange={(e) => setDue(e.target.value)}
                          />
                        </label>
                        <button
                          className="button primary"
                          disabled={busy || !lecture}
                        >
                          {t("Назначить")}
                        </button>
                      </div>
                      <p className="form-hint">
                        {t(
                          "Участники получат доступ к лекции. Повторное назначение обновит срок; результаты сохранятся.",
                        )}
                      </p>
                    </form>
                  )}
                  <section className="panel">
                    <div className="section-heading">
                      <h2>{t("Назначенные лекции")}</h2>
                      <span className="learning-tag">
                        {detail.assignments.length}
                      </span>
                    </div>
                    {!detail.assignments.length ? (
                      <p className="muted">{t("Лекции пока не назначены.")}</p>
                    ) : (
                      <div className="assignments-list">
                        {detail.assignments.map((a) => (
                          <article key={a.lectureId}>
                            <div className="assignment-top">
                              <Link to={`/lectures/${a.lectureId}`}>
                                <h3>{a.title}</h3>
                                <ArrowUpRight size={18} />
                              </Link>
                              {detail.canManage && (
                                <button
                                  className="icon-button"
                                  aria-label={t(
                                    "Снять назначение: {0}",
                                    a.title,
                                  )}
                                  disabled={busy}
                                  onClick={() =>
                                    mutate(async () => {
                                      await request(
                                        `/groups/${selected}/assignments/${a.lectureId}`,
                                        { method: "DELETE" },
                                      );
                                    })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            <div className="assignment-meta">
                              <span>{t(a.subject)}</span>
                              {a.dueAt && (
                                <span
                                  className={
                                    new Date(a.dueAt) < new Date()
                                      ? "due-past"
                                      : ""
                                  }
                                >
                                  <CalendarDays size={13} />
                                  {t("Срок: {0}", localDate(a.dueAt))}
                                </span>
                              )}
                            </div>
                            {detail.canManage ? (
                              <>
                                <div className="assignment-results">
                                  <span>
                                    {t(
                                      "Завершили: {0} из {1}",
                                      a.completedCount ?? 0,
                                      detail.memberCount,
                                    )}
                                  </span>
                                  <strong>{scoreText(a.averageScore)}</strong>
                                </div>
                                <ProgressBar
                                  value={
                                    detail.memberCount
                                      ? ((a.completedCount ?? 0) /
                                          detail.memberCount) *
                                        100
                                      : 0
                                  }
                                  label={a.title}
                                />
                                <small className="muted">
                                  {t("Прошли тест: {0}", a.testedCount ?? 0)}
                                </small>
                                {a.averageScore != null &&
                                  a.averageScore < 60 && (
                                    <p className="topic-attention">
                                      {t("Стоит разобрать эту тему с группой.")}
                                    </p>
                                  )}
                              </>
                            ) : (
                              <div className="assignment-results">
                                <span>
                                  {a.myCompleted
                                    ? t("Лекция завершена")
                                    : t("Ожидает прохождения")}
                                </span>
                                <strong>{scoreText(a.myScore)}</strong>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                  {detail.canManage && (
                    <section className="panel">
                      <h2>{t("Прогресс участников")}</h2>
                      <p className="form-hint">
                        {t(
                          "Только назначенные этой группе лекции. Пропущенные тесты не считаются нулём.",
                        )}
                      </p>
                      {!detail.members?.length ? (
                        <p className="muted">
                          {t(
                            "Передайте студентам код группы, чтобы они присоединились.",
                          )}
                        </p>
                      ) : (
                        <div className="learning-table-wrap">
                          <table className="learning-table">
                            <thead>
                              <tr>
                                <th>{t("Студент")}</th>
                                <th>{t("Завершено")}</th>
                                <th>{t("Тесты")}</th>
                                <th>{t("Средний балл")}</th>
                                <th>
                                  <span className="sr-only">
                                    {t("Действия")}
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.members.map((m) => (
                                <tr key={m.id}>
                                  <td>{m.fullName}</td>
                                  <td>
                                    {m.completed} / {detail.assignments.length}
                                  </td>
                                  <td>{m.tested}</td>
                                  <td>{scoreText(m.averageScore)}</td>
                                  <td>
                                    <button
                                      className="icon-button"
                                      disabled={busy}
                                      aria-label={t(
                                        "Убрать из группы: {0}",
                                        m.fullName,
                                      )}
                                      onClick={() =>
                                        mutate(async () => {
                                          await request(
                                            `/groups/${selected}/members/${m.id}`,
                                            { method: "DELETE" },
                                          );
                                        })
                                      }
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
