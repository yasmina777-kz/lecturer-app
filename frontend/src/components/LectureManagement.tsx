import { t } from "../i18n";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Settings2, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { patch, request } from "../api/httpClient";
import type { Lecture } from "../types/lecture";
import { ErrorMessage, messageOf } from "./UI";
export function LectureManagement({
  lecture,
  onUpdate,
}: {
  lecture: Lecture;
  onUpdate: (title: string, published: boolean) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(lecture.title);
  const [published, setPublished] = useState(lecture.isPublished);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  if (user?.id !== lecture.ownerId && user?.role !== "Admin") return null;
  async function save() {
    setBusy(true);
    setError("");
    try {
      await patch(`/lectures/${lecture.id}`, { title, isPublished: published });
      onUpdate(title, published);
      setSaved(true);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await request(`/lectures/${lecture.id}`, { method: "DELETE" });
      navigate("/library");
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <details className="lecture-management">
      <summary>
        <Settings2 size={14} />
        {t("Управление лекцией")}
      </summary>
      <div className="panel">
        <label>
          {t("Название")}
          <input
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        {user?.role !== "Student" && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => {
                setPublished(e.target.checked);
                setSaved(false);
              }}
            />
            {t("Опубликовать для всех пользователей")}
          </label>
        )}
        <ErrorMessage message={error} />
        <div className="manage-actions">
          <button
            className="button secondary small"
            disabled={busy || title.trim().length < 3}
            onClick={save}
          >
            <Save size={15} />
            {saved ? t("Сохранено") : t("Сохранить")}
          </button>
          <button
            className="text-link danger-text"
            onClick={() => setDeleting(!deleting)}
          >
            <Trash2 size={14} />
            {t("Удалить лекцию")}
          </button>
        </div>
        {deleting && (
          <div className="notice">
            <div>
              <p>
                {t(
                  "Лекция, вопросы и прогресс будут удалены без возможности восстановления.",
                )}
              </p>
              <div className="manage-actions">
                <button
                  className="button danger small"
                  disabled={busy}
                  onClick={remove}
                >
                  {t("Удалить навсегда")}
                </button>
                <button
                  className="button secondary small"
                  onClick={() => setDeleting(false)}
                >
                  {t("Отмена")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
