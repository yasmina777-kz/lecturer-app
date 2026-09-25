import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/httpClient";
import type { LectureCard } from "../types/lecture";
import { messageOf } from "../components/UI";
import { useLanguage } from "../i18n";
export function useLectures() {
  const { language } = useLanguage();
  const [lectures, setLectures] = useState<LectureCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setLectures(await apiGet<LectureCard[]>("/lectures"));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return {
    lectures: lectures.filter(
      (l) => !l.isDemo || l.language === language || l.progress,
    ),
    loading,
    error,
    reload,
  };
}
