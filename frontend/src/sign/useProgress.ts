import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { at } from "../i18n/automation";
import { lessonIds, type LessonId } from "./catalog";
export type Progress = Partial<
  Record<LessonId, { at: string; kind: "reading" | "self-practice" }>
>;
function read(key: string): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    const safe: Progress = {};
    for (const id of lessonIds) {
      const row = value?.[id];
      if (
        row &&
        Number.isFinite(Date.parse(row.at)) &&
        row.kind === (id === "name-demo" ? "self-practice" : "reading")
      )
        safe[id] = { at: row.at, kind: row.kind };
    }
    return safe;
  } catch {
    return {};
  }
}
export function useSignProgress() {
  const { user } = useAuth();
  const key = `ai-mentor:sign-learning:v1:${user?.id || "guest"}`;
  const [state, setState] = useState(() => ({ key, value: read(key) }));
  const [error, setError] = useState("");
  useEffect(() => {
    setState({ key, value: read(key) });
    setError("");
    const update = (e: StorageEvent) => {
      if (e.key === key || e.key === null) setState({ key, value: read(key) });
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [key]);
  const progress = state.key === key ? state.value : read(key);
  function save(id: LessonId, remove = false) {
    try {
      const next = read(key);
      if (remove) delete next[id];
      else
        next[id] = {
          at: new Date().toISOString(),
          kind: id === "name-demo" ? "self-practice" : "reading",
        };
      localStorage.setItem(key, JSON.stringify(next));
      setState({ key, value: next });
      setError("");
    } catch {
      setError(
        at(
          "Браузер не разрешил сохранить отметку. Вы можете продолжить без сохранения.",
          "The browser could not save the mark. You can continue without saving.",
          "Браузер белгіні сақтай алмады. Сақтамай жалғастыра аласыз.",
        ),
      );
    }
  }
  return { progress, error, save };
}
