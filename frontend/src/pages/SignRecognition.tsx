import { ContinuousSignCamera } from "../components/ContinuousSignCamera";
import { at } from "../i18n/automation";
import "./sign-workspace.css";
import "./sign-dictionary.css";
import "./sign-trainer.css";
import "./sign-recognition.css";
export function SignRecognitionPage() {
  return (
    <div className="sign-workspace sign-recognition">
      <div className="page-heading">
        <div>
          <h1>{at("Жесты → текст", "Signs → text", "Ымдар → мәтін")}</h1>
          <p>
            {at(
              "Покажите жесты в камеру — ИИ переведёт их в текст. Слова и буквы распознаются автоматически, прямо в браузере.",
              "Sign to the camera — the AI turns it into text. Words and letters are recognized automatically, right in the browser.",
              "Камераға ым көрсетіңіз — ЖИ оны мәтінге аударады. Сөздер мен әріптер браузерде автоматты танылады.",
            )}
          </p>
        </div>
      </div>
      <ContinuousSignCamera />
    </div>
  );
}
