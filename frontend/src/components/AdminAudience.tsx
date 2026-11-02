import { useState } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { at } from "../i18n/automation";
import { getLanguage } from "../i18n";
import { userAnalytics, type AnalyticsUser } from "../admin/analytics";
import "./admin-audience.css";
export function AdminAudience({
  users,
  updatedAt,
  refreshing,
  onRefresh,
}: {
  users: AnalyticsUser[];
  updatedAt: Date;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [days, setDays] = useState(30);
  const data = userAnalytics(users, days, updatedAt);
  const max = Math.max(1, ...data.daily.map((d) => d.count));
  const roleNames = [
    at("Студенты", "Students", "Студенттер"),
    at("Преподаватели", "Teachers", "Оқытушылар"),
    at("Администраторы", "Administrators", "Әкімшілер"),
  ];
  const colors = ["#78c5b0", "#91bce8", "#e7ba77"];
  let position = 0;
  const segments = data.roles.map((r, i) => {
    const from = position;
    position += data.total ? (r.count / data.total) * 100 : 0;
    return `${colors[i]} ${from}% ${position}%`;
  });
  const dateLabel = (date: string) =>
    new Date(date + "T00:00:00Z").toLocaleDateString(getLanguage(), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return (
    <section className="admin-audience">
      <div className="audience-heading">
        <div>
          <h2>
            {at(
              "Аудитория платформы",
              "Platform audience",
              "Платформа аудиториясы",
            )}
          </h2>
          <p>
            {at(
              "Данные зарегистрированных аккаунтов",
              "Registered account data",
              "Тіркелген аккаунттар деректері",
            )}{" "}
            ·{" "}
            {updatedAt.toLocaleTimeString(getLanguage(), {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={17} />
          {at("Обновить", "Refresh", "Жаңарту")}
        </button>
      </div>
      <div className="audience-stats">
        {[
          {
            value: data.total,
            label: at(
              "Всего пользователей",
              "Total users",
              "Барлық пайдаланушылар",
            ),
            Icon: Users,
          },
          {
            value: data.added,
            label: at(
              `Новых за ${days} дней`,
              `New in ${days} days`,
              `${days} күндегі жаңалар`,
            ),
            Icon: UserPlus,
          },
          {
            value: data.enabled,
            label: at("Доступ разрешён", "Access enabled", "Рұқсат берілген"),
            Icon: ShieldCheck,
          },
          {
            value: data.disabled,
            label: at("Заблокировано", "Disabled", "Бұғатталған"),
            Icon: LockKeyhole,
          },
        ].map(({ value, label, Icon }) => (
          <div className="panel audience-stat" key={label}>
            <Icon size={20} />
            <strong>{value.toLocaleString(getLanguage())}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="audience-charts">
        <div className="panel audience-registrations">
          <div className="audience-chart-heading">
            <div>
              <h3>
                {at(
                  "Новые регистрации",
                  "New registrations",
                  "Жаңа тіркелулер",
                )}
              </h3>
              <p>
                {at("По дням · UTC", "By day · UTC", "Күндер бойынша · UTC")}
              </p>
            </div>
            <label>
              <span className="audience-select-label">
                {at("Период", "Period", "Кезең")}
              </span>
              <select
                aria-label={at("Период", "Period", "Кезең")}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {[7, 30, 90].map((n) => (
                  <option value={n} key={n}>
                    {at(`${n} дней`, `${n} days`, `${n} күн`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!data.added && (
            <p className="audience-zero">
              {at(
                "За этот период новых регистраций нет.",
                "No new registrations in this period.",
                "Бұл кезеңде жаңа тіркелу жоқ.",
              )}
            </p>
          )}
          <div
            className="audience-bars"
            role="img"
            aria-label={at(
              `Регистрации за ${days} дней: ${data.added}. Подробные значения доступны в таблице ниже.`,
              `Registrations over ${days} days: ${data.added}. Values in the table below.`,
              `${days} күндегі тіркелулер: ${data.added}. Мәндер төмендегі кестеде.`,
            )}
          >
            <span className="audience-axis-max">{max}</span>
            {data.daily.map((d) => (
              <div
                className="audience-bar-track"
                key={d.date}
                title={`${dateLabel(d.date)}: ${d.count}`}
              >
                <div style={{ height: `${(d.count / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="audience-axis-labels">
            <span>{dateLabel(data.daily[0].date)}</span>
            <span>{dateLabel(data.daily[Math.floor(days / 2)].date)}</span>
            <span>{dateLabel(data.daily[days - 1].date)}</span>
          </div>
          <details className="audience-data">
            <summary>
              {at(
                "Посмотреть значения по дням",
                "View daily values",
                "Күндік мәндерді көру",
              )}
            </summary>
            <div className="audience-data-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{at("Дата", "Date", "Күні")}</th>
                    <th>{at("Регистрации", "Registrations", "Тіркелулер")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr key={d.date}>
                      <td>{dateLabel(d.date)}</td>
                      <td>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
        <div className="panel audience-roles">
          <h3>
            {at(
              "Кто пользуется платформой",
              "Who uses the platform",
              "Платформаны кім қолданады",
            )}
          </h3>
          <div
            className="audience-ring"
            aria-hidden="true"
            style={{
              background: data.total
                ? `conic-gradient(${segments.join(",")})`
                : "var(--line)",
            }}
          >
            <div>
              <strong>{data.total}</strong>
              <span>{at("аккаунтов", "accounts", "аккаунт")}</span>
            </div>
          </div>
          <ul>
            {data.roles.map((r, i) => (
              <li key={r.role}>
                <span style={{ background: colors[i] }} />
                <span>{roleNames[i]}</span>
                <strong>{r.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="panel audience-recent">
        <h3>
          {at(
            "Последние регистрации",
            "Latest registrations",
            "Соңғы тіркелулер",
          )}
        </h3>
        {data.recent.length ? (
          <ul>
            {data.recent.map((u) => (
              <li key={u.id}>
                <span className="audience-user-initial" aria-hidden="true">
                  {u.fullName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{u.fullName}</strong>
                  <span>
                    {roleNames[
                      ["Student", "Lecturer", "Admin"].indexOf(u.role)
                    ] || u.role}
                  </span>
                </div>
                <time dateTime={u.createdAt}>
                  {new Date(u.createdAt).toLocaleDateString(getLanguage())}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {at(
              "Пользователей пока нет.",
              "No users yet.",
              "Әзірге пайдаланушылар жоқ.",
            )}
          </p>
        )}
      </div>
      <p className="audience-note">
        {at(
          "Графики показывают регистрации и роли аккаунтов. Посетители без входа и присутствие онлайн пока не отслеживаются.",
          "Charts show account registrations and roles. Anonymous visitors and online presence are not tracked yet.",
          "Графиктер аккаунт тіркелулері мен рөлдерін көрсетеді. Кірусіз келушілер мен онлайн күйі әзірге бақыланбайды.",
        )}
      </p>
    </section>
  );
}
