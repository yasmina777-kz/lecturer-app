import { lazy, Suspense, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Hand,
  Play,
  RotateCcw,
  Type,
} from "lucide-react";
import { at } from "../i18n/automation";
import { Empty, ErrorMessage, Loading } from "../components/UI";
import { lessons, reading } from "../sign/catalog";
import { useSignProgress } from "../sign/useProgress";

import "./sign-workspace.css";
import { SignDictionaryPage } from "./SignDictionary";
import { SignCourseCatalog, SignTrainingRoom } from "./SignTrainer";
const GesturePreview = lazy(() =>
  import("./GesturePreviewPage").then((m) => ({
    default: m.GesturePreviewPage,
  })),
);
const storageNote = () =>
  at(
    "Отметки сохраняются только в этом браузере для вашего аккаунта. Это история занятий, а не оценка владения РЖЯ.",
    "Marks are saved only in this browser for your account. This is a learning history, not an assessment of RSL proficiency.",
    "Белгілер осы браузерде аккаунтыңыз үшін ғана сақталады. Бұл — оқу тарихы, орыс ым тілін меңгеру бағасы емес.",
  );
function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">
          {at("РУССКИЙ ЖЕСТОВЫЙ ЯЗЫК", "RUSSIAN SIGN LANGUAGE", "ОРЫС ЫМ ТІЛІ")}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
export function SignLearningPage() {
  return <SignCourseCatalog />;
}
export function SignLessonPage() {
  const { id } = useParams();
  return <LessonContent key={id} id={id} />;
}
function LessonContent({ id }: { id?: string }) {
  const lesson = lessons().find((l) => l.id === id);
  const { progress, error, save } = useSignProgress();
  const [answer, setAnswer] = useState<number | null>(null);
  const [repeated, setRepeated] = useState(false);
  if (!lesson)
    return (
      <Empty
        title={at("Такого урока нет", "Lesson not found", "Сабақ табылмады")}
        text={at(
          "Выберите карточку в разделе обучения.",
          "Choose a card in Learning.",
          "Оқу бөлімінен карточканы таңдаңыз.",
        )}
        action={
          <Link to="/learn" className="button primary">
            {at("К урокам", "Lessons", "Сабақтарға")}
          </Link>
        }
      />
    );
  const content = reading(lesson.id);
  const prototype = lesson.kind === "prototype";
  return (
    <div className="sign-workspace">
      <Link to={`/learn?stage=${lesson.level}`} className="sign-back">
        <ArrowLeft size={16} />
        {at(
          "Все этапы и уроки",
          "All stages and lessons",
          "Барлық кезеңдер мен сабақтар",
        )}
      </Link>
      <Heading
        title={lesson.title}
        description={
          prototype
            ? at(
                "Пробный показ. Анимация ещё требует проверки носителем РЖЯ. Сверяйтесь с видеообразцом человека.",
                "Prototype demonstration. The animation still needs review by an RSL signer. Compare it with the human reference video.",
                "Сынақ көрсетілімі. Анимацияны орыс ым тілінің маманы тексеруі керек. Адамның бейнеүлгісімен салыстырыңыз.",
              )
            : lesson.description
        }
      />
      {prototype ? (
        <Suspense fallback={<Loading />}>
          <GesturePreview embedded />
        </Suspense>
      ) : (
        <div className="sign-reading-layout">
          <article className="panel sign-reading">
            {content.blocks.map(([title, text], i) => (
              <section key={title}>
                <span className="eyebrow">0{i + 1}</span>
                <h2>{title}</h2>
                <p>{text}</p>
              </section>
            ))}
            <a
              href="https://voginfo.ru/wp-content/uploads/2025/02/0102.pdf"
              target="_blank"
              rel="noreferrer"
            >
              {at(
                "Материал ВОГ о русском жестовом языке ↗",
                "VOG material on Russian Sign Language ↗",
                "Орыс ым тілі туралы ВОГ материалы ↗",
              )}
            </a>
          </article>
          <aside className="panel sign-lesson-guide">
            <BookOpen size={28} />
            <h2>{at("В этом уроке", "In this lesson", "Бұл сабақта")}</h2>
            <ol>
              <li>
                {at(
                  "Прочитайте три коротких раздела",
                  "Read three short sections",
                  "Үш қысқа бөлімді оқыңыз",
                )}
              </li>
              <li>
                {at(
                  "Ответьте на вопрос ниже",
                  "Answer the question below",
                  "Төмендегі сұраққа жауап беріңіз",
                )}
              </li>
              <li>
                {at(
                  "Сохраните отметку занятия",
                  "Save your lesson mark",
                  "Сабақ белгісін сақтаңыз",
                )}
              </li>
            </ol>
            <p>
              {at(
                "Этот вопрос проверяет прочитанное, а не исполнение жеста.",
                "This question checks the reading, not your signing performance.",
                "Бұл сұрақ ым орындауды емес, оқығаныңызды тексереді.",
              )}
            </p>
          </aside>
        </div>
      )}
      <section className="panel sign-check">
        <span className="eyebrow">
          {prototype
            ? at(
                "САМОСТОЯТЕЛЬНОЕ ПОВТОРЕНИЕ",
                "INDEPENDENT PRACTICE",
                "ӨЗ БЕТІМЕН ҚАЙТАЛАУ",
              )
            : at("КОРОТКАЯ ПРОВЕРКА", "QUICK CHECK", "ҚЫСҚА ТЕКСЕРУ")}
        </span>
        <h2>
          {prototype
            ? at("Попробуйте повторить", "Try it yourself", "Өзіңіз қайталаңыз")
            : content.question}
        </h2>
        {prototype ? (
          <>
            <p>
              {at(
                "Откройте видеообразец, затем рассмотрите аватара по шагам и попробуйте повторить. ИИ-проверка доступна для отдельных букв в тренажёре; фразы пока проверяются только сравнением с образцом.",
                "Watch the reference, inspect the avatar step by step and practise. AI checking is available for isolated letters in practice; compare phrases with the reference.",
                "Бейнеүлгіні көріп, аватарды қадам бойынша қарап, қайталаңыз. ЖИ жеке әріптерді тексереді; сөйлемдерді үлгімен салыстырыңыз.",
              )}
            </p>
            <label className="sign-check-row">
              <input
                type="checkbox"
                checked={repeated}
                onChange={(e) => setRepeated(e.target.checked)}
              />
              {at(
                "Я посмотрел(а) образец и попробовал(а) повторить",
                "I watched the reference and tried practising",
                "Үлгіні көріп, қайталап көрдім",
              )}
            </label>
          </>
        ) : (
          <fieldset className="sign-answers">
            <legend className="sr-only">{content.question}</legend>
            {content.options.map((option, i) => (
              <label key={i} className={answer === i ? "selected" : ""}>
                <input
                  type="radio"
                  name={`quiz-${lesson.id}`}
                  checked={answer === i}
                  onChange={() => setAnswer(i)}
                />
                {option}
              </label>
            ))}
            <p aria-live="polite">
              {answer !== null
                ? answer === content.correct
                  ? content.explanation
                  : at(
                      "Попробуйте ещё раз: ответ есть в тексте урока.",
                      "Try again: the answer is in the lesson text.",
                      "Қайта көріңіз: жауап сабақ мәтінінде бар.",
                    )
                : at(
                    "Выберите один ответ.",
                    "Choose one answer.",
                    "Бір жауапты таңдаңыз.",
                  )}
            </p>
          </fieldset>
        )}
        <button
          className="button primary"
          disabled={prototype ? !repeated : answer !== content.correct}
          onClick={() => save(lesson.id)}
        >
          <Check size={17} />
          {prototype
            ? at("Отметить повторение", "Mark practice", "Қайталауды белгілеу")
            : at(
                "Завершить вводный урок",
                "Complete introduction",
                "Кіріспені аяқтау",
              )}
        </button>
        <ErrorMessage message={error} />
        {progress[lesson.id] && (
          <p className="sign-done" role="status">
            <Check size={16} />
            {at("Отметка сохранена.", "Mark saved.", "Белгі сақталды.")}{" "}
            <Link to="/practice">
              {at("Моя практика →", "My practice →", "Менің жаттығуым →")}
            </Link>
          </p>
        )}
        <p className="sign-save-note">{storageNote()}</p>
      </section>
      <Link
        className="sign-back"
        to={
          lesson.id === "getting-started" ? "/learn/alphabet-intro" : "/learn"
        }
      >
        {at("Дальше", "Next", "Келесі")}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function SignTextPage() {
  return <SignDictionaryPage />;
}
export function SignPracticePage() {
  const { progress, error, save } = useSignProgress();
  const marked = lessons().filter((l) => progress[l.id]);
  return (
    <div className="sign-workspace">
      <SignTrainingRoom />
      <details className="sign-history">
        <summary>
          {at(
            "История вводных занятий",
            "Introduction history",
            "Кіріспе сабақтар тарихы",
          )}
        </summary>
        <p className="sign-info-note">{storageNote()}</p>
        <ErrorMessage message={error} />
        {marked.length ? (
          <div className="sign-practice-list">
            {marked.map((l) => (
              <article className="panel" key={l.id}>
                <div>
                  <span className="eyebrow">
                    {l.kind === "prototype"
                      ? at(
                          "САМОСТОЯТЕЛЬНАЯ ОТМЕТКА",
                          "SELF-REPORTED",
                          "ӨЗ БЕЛГІҢІЗ",
                        )
                      : at("ВВОДНЫЙ УРОК", "INTRODUCTION", "КІРІСПЕ")}
                  </span>
                  <h2>{l.title}</h2>
                  <p>
                    {l.kind === "prototype"
                      ? at(
                          "Исполнение жеста автоматически не проверялось.",
                          "Signing performance was not automatically assessed.",
                          "Ым орындау автоматты тексерілмеді.",
                        )
                      : at(
                          "Вы ответили на вопрос по тексту урока.",
                          "You answered the lesson reading question.",
                          "Сабақ мәтіні бойынша сұраққа жауап бердіңіз.",
                        )}
                  </p>
                </div>
                <div>
                  <Link to={`/learn/${l.id}`} className="button secondary">
                    <RotateCcw size={16} />
                    {at("Повторить", "Review", "Қайталау")}
                  </Link>
                  <button
                    className="sign-link-button"
                    onClick={() => save(l.id, true)}
                  >
                    {at("Убрать отметку", "Remove mark", "Белгіні алып тастау")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={at(
              "Первое занятие впереди",
              "Your first lesson awaits",
              "Алғашқы сабақ алда",
            )}
            text={at(
              "Откройте вводный урок и ответьте на вопрос. После сохранения отметка появится здесь.",
              "Open an introduction and answer the question. Your mark will appear here after saving.",
              "Кіріспені ашып, сұраққа жауап беріңіз. Сақтағаннан кейін белгі осы жерде пайда болады.",
            )}
            action={
              <Link className="button primary" to="/learn/getting-started">
                {at(
                  "Начать первый урок",
                  "Start the first lesson",
                  "Бірінші сабақты бастау",
                )}
              </Link>
            }
          />
        )}
      </details>
    </div>
  );
}
export function SignHelpPage() {
  return (
    <div className="sign-workspace">
      <Heading
        title={at(
          "Что где находится",
          "Where to find everything",
          "Қай бөлімде не бар",
        )}
        description={at(
          "Три основных раздела — каждый для своей задачи.",
          "Three main sections, each with a clear purpose.",
          "Үш негізгі бөлімнің әрқайсысы өз міндетіне арналған.",
        )}
      />
      <div className="sign-help-grid">
        {[
          [
            "/learn",
            at("Обучение", "Learning", "Оқу"),
            at(
              "Три уровня: буквы, первые слова и фразы. Карточка открывает аватара или видеообразец человека.",
              "Three levels: letters, first words and phrases. A card opens an avatar or a human video reference.",
              "Үш деңгей: әріптер, алғашқы сөздер және сөйлемдер. Карточка аватарды не адамның бейнеүлгісін ашады.",
            ),
          ],
          [
            "/text-to-sign",
            at("Текст → жесты", "Text → signs", "Мәтін → ымдар"),
            at(
              "33 буквы и 170 слов с пробными движениями аватара. Введите текст — известные жесты проиграются подряд. При неизвестном слове показ остановлен до уточнения; грамматика РЖЯ автоматически не переводится.",
              "33 letters and 170 words with experimental avatar motion. Enter text to play known signs in sequence. Unknown words block the full sequence; RSL grammar is not translated automatically.",
              "33 әріп және 170 сөздің сынақ аватар қимылдары. Мәтін енгізсеңіз, таныс ымдар ретімен көрсетіледі. Белгісіз сөз толық көрсетілімді тоқтатады; грамматика автоматты аударылмайды.",
            ),
          ],
          [
            "/practice",
            at("Моя практика", "My practice", "Менің жаттығуым"),
            at(
              "3D-показы и видео всех 33 букв. Запишите короткий жест камерой или выберите видео: экспериментальный ИИ предложит букву либо откажется от ответа.",
              "3D demonstrations and videos of all 33 letters. Record a short sign or choose a video: the experimental AI suggests a letter or declines to answer.",
              "3D көрсетілімдер және 33 әріптің бейнесі. Камерамен қысқа қимыл жазыңыз не бейне таңдаңыз: тәжірибелік ЖИ әріпті ұсынады немесе жауаптан бас тартады.",
            ),
          ],
        ].map(([url, title, text]) => (
          <Link className="panel" to={url} key={url}>
            <h2>
              {title}
              <ArrowUpRight size={20} />
            </h2>
            <p>{text}</p>
          </Link>
        ))}
      </div>
      <section className="panel sign-reading">
        <h2>
          {at(
            "Что ещё готовится",
            "What is still being prepared",
            "Әлі не әзірленуде",
          )}
        </h2>
        <p>
          {at(
            "Распознавание слов и фраз, непрерывная дактильная речь и перевод с грамматикой РЖЯ ещё не обучены. Сейчас модель обучена на 33 отдельных буквах и примерах «нет жеста». Лицо и корпус модель не оценивает.",
            "Word and phrase recognition, continuous fingerspelling and grammatical RSL translation are not trained yet. The current model covers 33 isolated letters and no-sign examples. It does not assess the face or body.",
            "Сөздер мен сөйлемдерді тану, үздіксіз дактиль және РЖЯ грамматикасымен аудару әлі үйретілмеген. Қазіргі модель 33 жеке әріпке және «ым жоқ» мысалдарына үйретілді. Бет пен денені бағаламайды.",
          )}
        </p>
        <p>
          {at(
            "RU / EN / KZ переключают язык интерфейса. Изучаемый язык остаётся РЖЯ.",
            "RU / EN / KZ switch the interface language. The target language remains RSL.",
            "RU / EN / KZ интерфейс тілін ауыстырады. Үйренілетін тіл — орыс ым тілі.",
          )}
        </p>
      </section>
    </div>
  );
}
