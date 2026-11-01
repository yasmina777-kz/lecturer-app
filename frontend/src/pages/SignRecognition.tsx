import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  Captions,
  Copy,
  Delete,
  Space,
  ArrowRight,
  Camera,
} from "lucide-react";
import {
  TemporalSignCamera,
  type SignPrediction,
} from "../components/TemporalSignCamera";
import { appendRecognizedLetter } from "../sign/captions";
import { at } from "../i18n/automation";
import "./sign-workspace.css";
import "./sign-dictionary.css";
import "./sign-trainer.css";
import "./sign-recognition.css";
export function SignRecognitionPage() {
  const [text, setText] = useState("");
  const [last, setLast] = useState<SignPrediction>(null);
  const [notice, setNotice] = useState("");
  const onPrediction = useCallback((prediction: SignPrediction) => {
    setLast(prediction);
    setText((value) => appendRecognizedLetter(value, prediction));
    setNotice("");
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(at("Текст скопирован", "Text copied", "Мәтін көшірілді"));
    } catch {
      setNotice(
        at(
          "Выделите текст и скопируйте вручную.",
          "Select and copy the text manually.",
          "Мәтінді белгілеп, қолмен көшіріңіз.",
        ),
      );
    }
  }
  return (
    <div className="sign-workspace sign-recognition">
      <div className="page-heading">
        <div>
          <span className="recognition-kicker">
            <Camera size={16} />
            {at("ЖЕСТЫ → ТЕКСТ", "SIGNS → TEXT", "ЫМДАР → МӘТІН")}
          </span>
          <h1>
            {at(
              "Ваши руки. Ваши слова.",
              "Your hands. Your words.",
              "Сіздің қолыңыз. Сіздің сөзіңіз.",
            )}
          </h1>
          <p>
            {at(
              "Показывайте буквы — собирайте текст в субтитрах рядом с камерой.",
              "Show letters and build text in captions next to the camera.",
              "Әріптерді көрсетіп, камера жанындағы субтитрге мәтін жинаңыз.",
            )}
          </p>
        </div>
      </div>
      <div className="recognition-scope">
        <span>
          {at(
            "33 буквы · эксперимент",
            "33 letters · experimental",
            "33 әріп · тәжірибе",
          )}
        </span>
        <p>
          {at(
            "Сейчас распознаются отдельные буквы дактиля. Это ещё не перевод свободной речи на РЖЯ: слова, фразы и грамматика не распознаются.",
            "Currently recognizes individual fingerspelled letters. This is not a translator for continuous RSL: words, phrases and grammar are not recognized.",
            "Қазір жеке дактиль әріптері танылады. Бұл еркін ым тілінің аудармашысы емес: сөздер, сөйлемдер және грамматика танылмайды.",
          )}
        </p>
      </div>
      <div className="recognition-layout">
        <TemporalSignCamera onPrediction={onPrediction} />
        <aside className="panel recognition-captions">
          <div className="recognition-caption-heading">
            <Captions />
            <h2>{at("Субтитры", "Captions", "Субтитрлер")}</h2>
            <span>{at("Черновик", "Draft", "Жоба")}</span>
          </div>
          <div className="recognition-last" role="status">
            {last ? (
              last.accepted ? (
                <>
                  <strong>{last.label}</strong>
                  <span>
                    {at(
                      "Последняя распознанная буква",
                      "Last recognized letter",
                      "Соңғы танылған әріп",
                    )}
                  </span>
                </>
              ) : (
                <span>
                  {at(
                    "Не уверен — повторите букву. Текст не изменён.",
                    "Not confident — repeat the letter. Text unchanged.",
                    "Сенімсіз — әріпті қайталаңыз. Мәтін өзгерген жоқ.",
                  )}
                </span>
              )
            ) : (
              <>
                <span className="recognition-empty-glyph" aria-hidden="true">
                  Аа
                </span>
                <span>
                  {at(
                    "Здесь появится результат вашего показа",
                    "Your recognized letters will appear here",
                    "Көрсеткен әріптердің нәтижесі осында шығады",
                  )}
                </span>
              </>
            )}
          </div>
          <label htmlFor="recognized-captions">
            {at(
              "Распознанный текст — можно исправить",
              "Recognized text — editable",
              "Танылған мәтін — түзетуге болады",
            )}
          </label>
          <textarea
            id="recognized-captions"
            value={text}
            maxLength={2000}
            rows={7}
            onChange={(e) => {
              setText(e.target.value);
              setNotice("");
            }}
            placeholder={at(
              "Включите камеру и покажите букву…",
              "Start the camera and show a letter…",
              "Камераны қосып, әріпті көрсетіңіз…",
            )}
          />
          <div className="recognition-edit-tools">
            <button
              className="button secondary"
              disabled={!text || text.length >= 2000}
              onClick={() => setText((v) => (v + " ").slice(0, 2000))}
            >
              <Space size={17} />
              {at("Пробел", "Space", "Бос орын")}
            </button>
            <button
              className="button secondary"
              disabled={!text}
              onClick={() =>
                setText((v) => Array.from(v).slice(0, -1).join(""))
              }
            >
              <Delete size={17} />
              {at("Удалить символ", "Delete character", "Таңбаны жою")}
            </button>
            <button className="button primary" disabled={!text} onClick={copy}>
              <Copy size={17} />
              {at("Копировать", "Copy", "Көшіру")}
            </button>
          </div>
          <p className="recognition-privacy">
            {at(
              "Буквы добавляются только после принятого ответа модели. Исправляйте ошибки; текст не сохраняется после закрытия страницы.",
              "Letters are added only after an accepted model result. Correct mistakes; text is not saved after closing the page.",
              "Әріптер модель жауапты қабылдағанда ғана қосылады. Қателерді түзетіңіз; бет жабылғанда мәтін сақталмайды.",
            )}
          </p>
          <p role="status">
            {notice ||
              (text.length >= 2000
                ? at(
                    "Достигнут лимит 2000 символов. Скопируйте текст и освободите место.",
                    "2,000 character limit reached. Copy the text and free some space.",
                    "2000 таңба шегіне жетті. Мәтінді көшіріп, орын босатыңыз.",
                  )
                : "")}
          </p>
          <Link className="recognition-reference" to="/practice">
            {at(
              "Сначала посмотреть буквы у аватара",
              "First watch the avatar demonstrate letters",
              "Алдымен аватардың әріптерін қарау",
            )}
            <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
