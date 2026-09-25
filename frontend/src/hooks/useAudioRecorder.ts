import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
export function useAudioRecorder() {
  const [isRecording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const r = recorderRef.current;
      if (r) {
        r.ondataavailable = null;
        r.onstop = null;
        if (r.state !== "inactive") r.stop();
        r.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);
  async function start() {
    if (pending.current || recorderRef.current?.state === "recording") return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    )
      throw new Error(
        t(
          "Запись голоса недоступна. Откройте приложение по HTTPS или задайте вопрос текстом.",
        ),
      );
    pending.current = true;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      chunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start(500);
      setRecording(true);
    } catch {
      stream?.getTracks().forEach((t) => t.stop());
      throw new Error(
        t(
          "Нет доступа к микрофону. Разрешите запись в браузере или напишите вопрос.",
        ),
      );
    } finally {
      pending.current = false;
    }
  }
  function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const r = recorderRef.current;
      if (!r || r.state === "inactive") {
        resolve(new Blob());
        return;
      }
      r.onstop = () => {
        r.stream.getTracks().forEach((t) => t.stop());
        if (alive.current) setRecording(false);
        resolve(new Blob(chunks.current, { type: r.mimeType }));
      };
      r.stop();
    });
  }
  return { isRecording, start, stop };
}
