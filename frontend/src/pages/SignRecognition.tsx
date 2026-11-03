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
              "Покажите букву или короткую фразу. После фразы опустите руки и сделайте паузу.",
              "Start the camera and show a sign. Letters and phrases are checked together. Pause after a phrase; a result appears if the model can identify it.",
              "Камераны қосып, ымды көрсетіңіз. Әріптер мен сөйлемдер бірге тексеріледі. Сөйлемнен кейін үзіліс жасаңыз; модель анықтай алса, нәтиже шығады.",
            )}
          </p>
        </div>
      </div>
      <ContinuousSignCamera />
    </div>
  );
}
