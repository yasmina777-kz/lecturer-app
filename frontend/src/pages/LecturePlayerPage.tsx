import { useEffect, useState } from "react";
import { getLecture } from "../api/lecturesApi";
import { askQuestion } from "../api/questionsApi";
import { SlideViewer } from "../components/SlideViewer";
import { AskButton } from "../components/AskButton";
import { AvatarPlayer, type AvatarState } from "../components/AvatarPlayer";
import type { Lecture } from "../types/lecture";

interface LecturePlayerPageProps {
  lectureId: string;
}

// Состояние экрана: играет презентация, идёт обработка вопроса,
// или аватар сейчас отвечает голосом.
type PlaybackState = "playing" | "processingQuestion" | "answering";

export function LecturePlayerPage({ lectureId }: LecturePlayerPageProps) {
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("playing");
  const [answerAudioUrl, setAnswerAudioUrl] = useState<string | undefined>();

  // Загружаем лекцию один раз при открытии страницы
  useEffect(() => {
    getLecture(lectureId).then(setLecture);
  }, [lectureId]);

  if (!lecture) {
    return <div className="loading">Загрузка лекции…</div>;
  }

  const currentSlide = lecture.slides[currentSlideIndex];

  // Студент нажал кнопку и записал вопрос
  const handleQuestionRecorded = async (audioBlob: Blob) => {
    setPlaybackState("processingQuestion"); // презентация на паузе, показываем "думает"

    const result = await askQuestion(lecture.id, currentSlide.id, audioBlob);

    setAnswerAudioUrl(result.answerAudioUrl);
    setPlaybackState("answering"); // аватар появляется и говорит
  };

  // Аватар договорил ответ — возвращаемся к презентации
  const handleAvatarFinished = () => {
    setAnswerAudioUrl(undefined);
    setPlaybackState("playing");
  };

  const avatarState: AvatarState = playbackState === "answering" ? "speaking" : "hidden";

  return (
    <div className="lecture-player-page">
      <SlideViewer slide={currentSlide} />

      <AvatarPlayer
        state={avatarState}
        audioUrl={answerAudioUrl}
        onFinishedSpeaking={handleAvatarFinished}
      />

      {playbackState === "processingQuestion" && (
        <div className="answering-indicator">Аватар думает над ответом…</div>
      )}

      <AskButton
        disabled={playbackState !== "playing"}
        onQuestionRecorded={handleQuestionRecorded}
      />
    </div>
  );
}
