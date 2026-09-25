import { t } from "../i18n";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Clock3,
  LoaderCircle,
  Play,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { LectureCard as LectureType } from "../types/lecture";
export function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <div className="error-msg" role="alert">
      <AlertCircle size={18} />
      {t(message)}
    </div>
  ) : null;
}
export function Loading({ text = t("Загружаем…") }: { text?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      {text}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function LectureCard({
  lecture,
  index = 0,
}: {
  lecture: LectureType;
  index?: number;
}) {
  const progress = lecture.progress?.completed
    ? 100
    : lecture.progress
      ? Math.round((lecture.progress.furthestSlide / lecture.slideCount) * 100)
      : 0;
  return (
    <Link to={`/lectures/${lecture.id}`} className="lecture-card">
      <div className={`card-art art-${index % 3}`}>
        <span className="tag">{lecture.subject}</span>
        <div className="abstract-art">
          <div />
          <div />
          <div />
          <div />
        </div>
        <span className="card-play">
          <Play size={18} fill="currentColor" />
        </span>
        {lecture.isDemo && (
          <span className="demo-label">{t("Пример лекции")}</span>
        )}
      </div>
      <div className="card-body">
        <div className="card-meta">
          {t(lecture.level)}
          <span>·</span>
          <Clock3 size={12} />
          {lecture.duration} {t("мин")}
        </div>
        <h3>{lecture.title}</h3>
        <p>{lecture.description}</p>
        <div className="card-bottom">
          <span>
            {lecture.slideCount} {t("слайдов · Практика")}
          </span>
          <ArrowUpRight size={17} />
        </div>
        {progress > 0 && (
          <div className="card-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </Link>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <BookOpen size={21} />
        <i />
      </span>
      <span>AI Mentor</span>
    </span>
  );
}
export function AiTag() {
  return (
    <span className="eyebrow">
      <Sparkles size={13} /> {t("ОБУЧЕНИЕ В ВАШЕМ РИТМЕ")}
    </span>
  );
}
export const messageOf = (error: unknown) =>
  error instanceof Error
    ? t(error.message)
    : t("Что-то пошло не так. Попробуйте снова.");
