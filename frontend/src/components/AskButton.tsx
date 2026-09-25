import { t } from "../i18n";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

interface AskButtonProps {
  // true, пока идёт запись, отправка на бэк или проигрывание ответа —
  // кнопка блокируется, чтобы не задать второй вопрос поверх первого
  disabled: boolean;
  onQuestionRecorded: (audioBlob: Blob) => void;
}

// Push-to-talk: одно нажатие — начало записи, повторное нажатие — конец
// записи и передача аудио наверх, в LecturePlayerPage.
export function AskButton({ disabled, onQuestionRecorded }: AskButtonProps) {
  const { isRecording, start, stop } = useAudioRecorder();

  const handleClick = async () => {
    if (disabled) return;

    if (!isRecording) {
      await start();
    } else {
      const audioBlob = await stop();
      onQuestionRecorded(audioBlob);
    }
  };

  return (
    <button
      className={`ask-button ${isRecording ? "ask-button--recording" : ""}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {isRecording ? t("Остановить и отправить") : t("Задать вопрос")}
    </button>
  );
}
