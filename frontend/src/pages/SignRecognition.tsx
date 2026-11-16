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
              "Включите одну камеру: распознавание букв и подключённая модель фраз работают параллельно, результат выводится в одном поле. Фразовый текст пока экспериментальный.",
              "Use one camera: letter recognition and the connected phrase model run in parallel, with results in one field. Phrase text is still experimental.",
              "Бір камераны қосыңыз: әріптер мен қосылған сөйлем моделі қатар жұмыс істеп, нәтиже бір өріске түседі. Сөйлем нәтижесі әзірге тәжірибелік.",
            )}
          </p>
        </div>
      </div>
      <ContinuousSignCamera />
    </div>
  );
}
