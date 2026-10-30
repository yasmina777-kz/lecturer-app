import { useEffect, useRef, useState } from "react";
import { at } from "../i18n/automation";
import type { EngineProgress, LocalAnswer, StudySource } from "./retrieval";
export function useLocalMentor() {
  const worker = useRef<Worker>();
  const serial = useRef(0);
  const pending = useRef<{
    id: number;
    resolve: (v: LocalAnswer) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  const [progress, setProgress] = useState<EngineProgress | null>(null);
  function cancel() {
    worker.current?.terminate();
    worker.current = undefined;
    if (pending.current) {
      clearTimeout(pending.current.timer);
      pending.current.reject(new Error("CANCELLED"));
      pending.current = undefined;
    }
    setProgress(null);
  }
  useEffect(
    () => () => {
      worker.current?.terminate();
      if (pending.current) {
        clearTimeout(pending.current.timer);
        pending.current.reject(new Error("CANCELLED"));
        pending.current = undefined;
      }
    },
    [],
  );
  function ask(question: string, sources: StudySource[]): Promise<LocalAnswer> {
    if (pending.current) return Promise.reject(new Error("BUSY"));
    if (!question.trim() || question.length > 2000)
      return Promise.reject(new Error("INVALID_QUESTION"));
    setProgress({ stage: "loading" });
    if (!worker.current) {
      worker.current = new Worker(
        new URL("./mentor.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current.onmessage = ({ data }) => {
        const p = pending.current;
        if (!p || p.id !== data.id) return;
        if (data.type === "progress") {
          setProgress(data.data);
          return;
        }
        clearTimeout(p.timer);
        pending.current = undefined;
        setProgress(null);
        if (data.type === "answer") p.resolve(data.data);
        else {
          console.error("Local mentor model initialization failed:", data.data);
          p.reject(new Error(data.data));
        }
      };
      worker.current.onerror = () => {
        const p = pending.current;
        if (p) {
          clearTimeout(p.timer);
          p.reject(new Error("MODEL_LOAD_FAILED"));
          pending.current = undefined;
        }
        worker.current?.terminate();
        worker.current = undefined;
        setProgress(null);
      };
    }
    const id = ++serial.current;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cancel();
      }, 180000);
      pending.current = { id, resolve, reject, timer };
      worker.current!.postMessage({ id, question, sources });
    });
  }
  const status =
    progress?.stage === "loading"
      ? at(
          "Загружаю модель на устройство…",
          "Loading the model on your device…",
          "Модель құрылғыға жүктелуде…",
        )
      : progress?.stage === "indexing"
        ? at(
            `Изучаю материал: ${progress.completed} / ${progress.total}`,
            `Reading material: ${progress.completed} / ${progress.total}`,
            `Материалды талдау: ${progress.completed} / ${progress.total}`,
          )
        : at(
            "Ищу подходящее объяснение…",
            "Finding a relevant explanation…",
            "Тиісті түсіндірмені іздеу…",
          );
  return { ask, cancel, progress, status };
}
export function localError(error: unknown) {
  if (error instanceof Error && error.message === "MATERIAL_TOO_LARGE")
    return at(
      "Материал слишком большой. Разделите его на несколько занятий.",
      "Split this material into smaller lessons.",
      "Материалды бірнеше сабаққа бөліңіз.",
    );
  return at(
    "Не удалось запустить модель. Проверьте соединение для первой загрузки и попробуйте снова. На слабом устройстве подготовка может занять больше времени.",
    "Could not start the model. Check your connection for the first download and retry. Preparation can take longer on slower devices.",
    "Модель іске қосылмады. Алғашқы жүктеу үшін интернетті тексеріп, қайталаңыз.",
  );
}
