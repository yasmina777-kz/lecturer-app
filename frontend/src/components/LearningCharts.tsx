import { useState } from "react";
import { t, getLanguage } from "../i18n";
import type { KnowledgeData } from "../types/learning";
export const scoreText = (score: number | null) =>
  score == null ? t("Нет теста") : `${Math.round(score)}%`;
export const localDate = (date: string) =>
  new Date(date).toLocaleDateString(
    getLanguage() === "kk"
      ? "kk-KZ"
      : getLanguage() === "en"
        ? "en-GB"
        : "ru-RU",
  );
export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div
      className="learning-bar"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function MasteryRing({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0);
  let cursor = 0;
  const colors = ["#475d71", "#879caa", "#c1a77e", "#e6e8ea"];
  const labels = [t("Освоено"), t("Закрепить"), t("Повторить"), t("Нет теста")];
  const gradient = counts
    .map((n, i) => {
      const from = cursor;
      cursor += total ? (n / total) * 100 : 0;
      return `${colors[i]} ${from}% ${cursor}%`;
    })
    .join(",");
  return (
    <div className="mastery-visual">
      <div
        className="mastery-ring"
        aria-hidden="true"
        style={{
          background: total ? `conic-gradient(${gradient})` : "#e6e8ea",
        }}
      >
        <div>
          <strong>{counts[0]}</strong>
          <span>{t("Освоено")}</span>
        </div>
      </div>
      <ul className="mastery-legend">
        {labels.map((label, i) => (
          <li key={label}>
            <i style={{ background: colors[i] }} />
            <span>{label}</span>
            <strong>{counts[i]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function HistoryChart({
  history,
}: {
  history: KnowledgeData["history"];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!history.length)
    return (
      <div className="chart-empty">
        <span>↗</span>
        <p>{t("Пройдите тест — здесь появится история результатов.")}</p>
      </div>
    );
  const points = history.map((a, i) => ({
    x: history.length === 1 ? 300 : 40 + (i / (history.length - 1)) * 520,
    y: 160 - (a.score / 100) * 130,
    ...a,
  }));
  const active =
    points.find((a) => a.id === selected) ?? points[points.length - 1];
  return (
    <>
      <svg
        className="history-chart"
        viewBox="0 0 600 190"
        role="img"
        aria-label={t("Последние результаты тестов")}
      >
        {[0, 50, 100].map((n) => (
          <g key={n}>
            <line
              x1="40"
              x2="570"
              y1={160 - n * 1.3}
              y2={160 - n * 1.3}
              stroke="#e1e5e8"
              strokeDasharray="4 6"
            />
            <text x="4" y={164 - n * 1.3} fill="#626b73" fontSize="12">
              {n}%
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <>
            <path
              d={`M ${points[0].x},160 L ${points.map((p) => `${p.x},${p.y}`).join(" L ")} L ${points[points.length - 1].x},160 Z`}
              fill="#77889918"
            />
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#475d71"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </>
        )}
        {points.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.id === active.id ? 6 : 4}
            fill="#475d71"
            stroke="white"
            strokeWidth="2"
          >
            <title>
              {p.title}: {p.score}% · {localDate(p.createdAt)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="history-picks" aria-label={t("Выберите попытку")}>
        {points.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === active.id}
            onClick={() => setSelected(p.id)}
            aria-label={`${localDate(p.createdAt)} · ${p.title} · ${p.score}%`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="history-caption" aria-live="polite">
        <span>
          {active.title}
          <small>{localDate(active.createdAt)}</small>
        </span>
        <strong>{active.score}%</strong>
      </div>
    </>
  );
}
