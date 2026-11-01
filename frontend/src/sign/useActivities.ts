import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { at } from "../i18n/automation";
import type { DictionaryEntry, DictionaryForms } from "./dictionary";
import type { MotionAsset } from "./motion";
import type { LearningAttempt } from "./activities";
export function useActivityCatalog() {
  const [data, setData] = useState<{
    entries: DictionaryEntry[];
    forms: DictionaryForms;
    motions: MotionAsset[];
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError("");
    async function read(path: string) {
      const r = await fetch(path, { signal: abort.signal });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }
    Promise.all([
      read("/research/rsl/words/catalog.json"),
      read("/research/rsl/words/forms.json"),
      read("/avatars/sign-motion/catalog.json"),
    ])
      .then(([entries, forms, motions]) => {
        if (!abort.signal.aborted) setData({ entries, forms, motions });
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            at(
              "Не удалось загрузить материалы. Проверьте подключение и попробуйте снова.",
              "Could not load materials. Check your connection and retry.",
              "Материалдар жүктелмеді. Байланысты тексеріп, қайта көріңіз.",
            ),
          );
      });
    return () => abort.abort();
  }, [retry]);
  return { data, error, retry: () => setRetry((n) => n + 1) };
}
function readAttempts(key: string): LearningAttempt[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (a): a is LearningAttempt =>
          a &&
          typeof a.id === "string" &&
          typeof a.item === "string" &&
          ["dialogue", "understanding"].includes(a.mode) &&
          typeof a.correct === "boolean" &&
          typeof a.assisted === "boolean" &&
          Number.isFinite(Date.parse(a.at)),
      )
      .slice(-300);
  } catch {
    return [];
  }
}
export function useActivityProgress() {
  const { user } = useAuth();
  const key = `ai-mentor:activities:v1:${user?.id || "guest"}`;
  const [state, setState] = useState(() => ({
    key,
    attempts: readAttempts(key),
  }));
  const [error, setError] = useState("");
  useEffect(() => {
    setState({ key, attempts: readAttempts(key) });
    setError("");
    const update = (e: StorageEvent) => {
      if (e.key === key || e.key === null)
        setState({ key, attempts: readAttempts(key) });
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [key]);
  function record(attempt: LearningAttempt) {
    const existing = readAttempts(key);
    if (existing.some((a) => a.id === attempt.id)) return;
    const next = [...existing, attempt].slice(-300);
    setState({ key, attempts: next });
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setError("");
    } catch {
      setError(
        at(
          "Попытка не сохранилась в браузере. Занятие можно продолжить.",
          "This attempt could not be saved. You can continue.",
          "Әрекет браузерде сақталмады. Жаттығуды жалғастыруға болады.",
        ),
      );
    }
  }
  return {
    attempts: state.key === key ? state.attempts : readAttempts(key),
    record,
    error,
  };
}
