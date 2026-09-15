import { useEffect, useRef } from "react";

export type AvatarState = "hidden" | "speaking";

interface AvatarPlayerProps {
  state: AvatarState;
  // URL аудио, которое аватар должен проговорить (ответ на вопрос)
  audioUrl?: string;
  // Вызывается, когда аудио доиграло до конца — по этому сигналу
  // LecturePlayerPage снимает презентацию с паузы
  onFinishedSpeaking: () => void;
}

export function AvatarPlayer({ state, audioUrl, onFinishedSpeaking }: AvatarPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (state === "speaking" && audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  }, [state, audioUrl]);

  if (state === "hidden") {
    return null;
  }

  return (
    <div className="avatar-player">
      {/* Здесь в реальном проекте — видео/спрайт аватара с анимацией речи.
          Для MVP достаточно плейсхолдера + скрытого <audio>. */}
      <div className="avatar-placeholder" aria-hidden="true" />
      <audio ref={audioRef} onEnded={onFinishedSpeaking} />
    </div>
  );
}
