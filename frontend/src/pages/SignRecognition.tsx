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
              "Включите камеру один раз. Буквы и короткие фразы появятся справа — переключать режимы не нужно.",
              "Start the camera once. Letters and short phrases appear alongside it, without switching modes.",
              "Камераны бір рет қосыңыз. Әріптер мен қысқа сөйлемдер жанында шығады — режим ауыстыру қажет емес.",
            )}
          </p>
        </div>
      </div>
      <ContinuousSignCamera />
    </div>
  );
}
