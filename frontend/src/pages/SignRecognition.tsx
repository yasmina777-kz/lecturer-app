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
              "Покажите одну букву целиком. Распознавание фраз доступно только при подключённом сервисе — его статус показан ниже.",
              "Show one complete letter. Phrase recognition requires a connected service; check its status below.",
              "Бір әріпті толық көрсетіңіз. Сөйлемдерді тану тек қызмет қосылғанда қолжетімді — күйі төменде көрсетілген.",
            )}
          </p>
        </div>
      </div>
      <ContinuousSignCamera />
    </div>
  );
}
