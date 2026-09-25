import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import type { Language, VoiceGender } from "../types/auth";
export interface SpeechPosition {
  chunks: string[];
  index: number;
}
const voiceGenderNames = {
  male: /dmitry|pavel|yuri|daulet|guy|david|mark|daniel|alex\b|aaron|fred|george|male(?!fe)/i,
  female:
    /svetlana|irina|milena|katya|aigul|jenny|zira|samantha|karen|victoria|susan|moira|female/i,
};
export function useNarrator(
  rate: number,
  language: Language = "ru",
  gender: VoiceGender = "male",
  provider = "browser",
) {
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const position = useRef<SpeechPosition>({ chunks: [], index: 0 });
  const generation = useRef(0);
  const onDone = useRef<() => void>(() => {});
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const audio = useRef<HTMLAudioElement>();
  const audioUrl = useRef<string>();
  const controller = useRef<AbortController>();
  const cache = useRef(new Map<string, Blob>());
  const settings = useRef({ rate, language, gender, provider });
  settings.current = { rate, language, gender, provider };
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  function release() {
    controller.current?.abort();
    if (audio.current) {
      audio.current.pause();
      audio.current.onended = null;
      audio.current.removeAttribute("src");
      audio.current = undefined;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = undefined;
  }
  function cancel() {
    generation.current++;
    if (supported) window.speechSynthesis.cancel();
    release();
    utterance.current = null;
    setSpeaking(false);
  }
  async function run() {
    const token = generation.current;
    const speakNext = async (): Promise<void> => {
      if (token !== generation.current) return;
      const p = position.current;
      if (p.index >= p.chunks.length) {
        setSpeaking(false);
        onDone.current();
        return;
      }
      const { language, gender, provider, rate } = settings.current;
      const next = () => {
        if (token === generation.current) {
          position.current.index++;
          void speakNext();
        }
      };
      try {
        if (provider === "azure") {
          setSpeaking(true);
          release();
          const text = p.chunks[p.index];
          const key = `${language}|${gender}|${text}`;
          let blob = cache.current.get(key);
          if (!blob) {
            controller.current = new AbortController();
            const response = await fetch("/api/speech", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, language, gender }),
              signal: controller.current.signal,
            });
            if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              throw new Error(
                t(error.message || "") ||
                  t("Голосовой сервис недоступен. Попробуйте ещё раз."),
              );
            }
            blob = await response.blob();
            if (cache.current.size >= 30)
              cache.current.delete(cache.current.keys().next().value!);
            cache.current.set(key, blob);
          }
          if (token !== generation.current) return;
          audioUrl.current = URL.createObjectURL(blob);
          const player = new Audio(audioUrl.current);
          audio.current = player;
          player.playbackRate = rate;
          player.onended = next;
          player.onerror = () => {
            if (token === generation.current) {
              setSpeaking(false);
              setSpeechError(
                t(
                  "Не удалось воспроизвести голос. Нажмите «Продолжить» или читайте текст слайда.",
                ),
              );
            }
          };
          await player.play();
          return;
        }
        if (!supported)
          throw new Error(
            t(
              "Озвучка недоступна в этом браузере. Читайте текст и переключайте слайды вручную.",
            ),
          );
        let voices = window.speechSynthesis.getVoices();
        if (!voices.length) {
          await new Promise<void>((resolve) => {
            let timeout: number;
            const done = () => {
              clearTimeout(timeout);
              window.speechSynthesis.removeEventListener?.(
                "voiceschanged",
                done,
              );
              resolve();
            };
            window.speechSynthesis.addEventListener?.("voiceschanged", done);
            timeout = window.setTimeout(done, 1500);
          });
          if (token !== generation.current) return;
          voices = window.speechSynthesis.getVoices();
        }
        const matching = voices.filter((v) =>
          v.lang.toLowerCase().startsWith(language),
        );
        if (!matching.length)
          throw new Error(
            t(
              "На устройстве нет голоса для этого языка. Подключите Azure Speech или установите соответствующий голос в системе. Текст лекции доступен ниже.",
            ),
          );
        const preferred = matching.find(
          (v) =>
            voiceGenderNames[gender].test(v.name) &&
            !(gender === "male" && /female/i.test(v.name)),
        );
        const u = new SpeechSynthesisUtterance(p.chunks[p.index]);
        utterance.current = u;
        u.lang =
          language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
        u.rate = rate;
        u.voice = preferred ?? matching[0];
        if (!preferred)
          setSpeechError(
            t(
              "Пол голоса устройства не подтверждён. Для точного выбора мужского или женского голоса подключите Azure Speech.",
            ),
          );
        u.onend = next;
        u.onerror = (e) => {
          if (
            token === generation.current &&
            !["interrupted", "canceled"].includes(e.error)
          ) {
            setSpeaking(false);
            setSpeechError(
              t(
                "Не удалось воспроизвести голос. Нажмите «Продолжить» или читайте текст слайда.",
              ),
            );
          }
        };
        setSpeaking(true);
        window.speechSynthesis.speak(u);
      } catch (e) {
        if (token === generation.current) {
          setSpeaking(false);
          setSpeechError(
            e instanceof Error
              ? e.message
              : t("Голосовой сервис недоступен. Попробуйте ещё раз."),
          );
        }
      }
    };
    void speakNext();
  }
  function say(text: string, done: () => void) {
    cancel();
    setSpeechError("");
    position.current = {
      chunks: (text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [text]).flatMap(
        (part) => part.match(/[\s\S]{1,3500}/g) || [],
      ),
      index: 0,
    };
    onDone.current = done;
    void run();
  }
  function pause() {
    const saved = {
      chunks: [...position.current.chunks],
      index: position.current.index,
    };
    cancel();
    return saved;
  }
  function resume(saved?: SpeechPosition, done?: () => void) {
    cancel();
    setSpeechError("");
    if (saved)
      position.current = { chunks: [...saved.chunks], index: saved.index };
    if (done) onDone.current = done;
    void run();
  }
  useEffect(() => {
    cancel();
    return () => {
      generation.current++;
      if (supported) window.speechSynthesis.cancel();
      release();
    };
  }, [language, gender, provider]);
  return { speaking, speechError, say, pause, resume, cancel, supported };
}
