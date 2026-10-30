import { lazy, Suspense, useState, type FormEvent } from "react";
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
import {
  planText,
  supportedPhrase,
  preparedSigns,
  type TextPlan,
} from "../sign/textPlan";
import "./sign-workspace.css";
import { exercises } from "../sign/exercises";
import {
  SignCourseCatalog,
  SignTrainingRoom,
  ExercisePlayer,
} from "./SignTrainer";
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
                "Откройте видеообразец, затем рассмотрите аватара по шагам и попробуйте повторить. Камера и автоматическая оценка пока не подключены.",
                "Watch the reference video, inspect the avatar step by step and try it yourself. Camera input and automatic assessment are not connected yet.",
                "Бейнеүлгіні көріп, аватарды қадам бойынша қарап, қайталаңыз. Камера және автоматты бағалау әлі қосылмаған.",
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
  const [text, setText] = useState("");
  const [result, setResult] = useState<TextPlan | null>(null);
  const [version, setVersion] = useState(0);
  const update = (v: string) => {
    setText(v);
    setResult(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setResult(planText(text));
    setVersion((v) => v + 1);
  };
  return (
    <div className="sign-workspace">
      <Heading
        title={at("Текст → жесты", "Text → signs", "Мәтін → ымдар")}
        description={at(
          "Введите фразу и проверьте, есть ли для неё подготовленный показ аватара.",
          "Enter a phrase to check whether a prepared avatar demonstration exists.",
          "Сөйлемді енгізіп, аватардың дайын көрсетілімі бар-жоғын тексеріңіз.",
        )}
      />
      <div className="sign-text-layout">
        <form className="panel sign-text-form" onSubmit={submit}>
          <span className="sign-status-label">
            {at(
              "7 букв · 2 слова · 1 фраза",
              "7 letters · 2 words · 1 phrase",
              "7 әріп · 2 сөз · 1 сөйлем",
            )}
          </span>
          <label htmlFor="sign-text">
            {at("Текст на русском", "Text in Russian", "Орыс тіліндегі мәтін")}
          </label>
          <textarea
            id="sign-text"
            maxLength={500}
            rows={5}
            value={text}
            onChange={(e) => update(e.target.value)}
            placeholder={supportedPhrase}
            aria-describedby="sign-text-hint"
          />
          <div className="sign-text-meta">
            <span id="sign-text-hint">
              {at(
                "Текст обрабатывается на устройстве.",
                "Text is processed on your device.",
                "Мәтін құрылғыңызда өңделеді.",
              )}
            </span>
            <span>{text.length}/500</span>
          </div>
          <button className="button primary" type="submit">
            <Play size={17} />
            {at(
              "Подготовить показ",
              "Prepare demonstration",
              "Көрсетілімді дайындау",
            )}
          </button>
          <div className="sign-examples">
            <span>
              {at("Готовый словарь:", "Prepared vocabulary:", "Дайын сөздік:")}
            </span>
            {preparedSigns.map((sign) => (
              <button
                key={sign.animation}
                type="button"
                onClick={() => update(sign.phrase)}
              >
                {sign.phrase}
              </button>
            ))}
          </div>
        </form>
        <aside className="panel sign-lesson-guide">
          <Type size={28} />
          <h2>
            {at(
              "Как это работает сейчас",
              "How it works now",
              "Қазір қалай жұмыс істейді",
            )}
          </h2>
          <p>
            {at(
              "Система ищет точное совпадение с подготовленной фразой. Это пока не AI-переводчик произвольного текста.",
              "The system looks for an exact match with a prepared phrase. This is not yet an AI translator for arbitrary text.",
              "Жүйе дайын сөйлеммен дәл сәйкестікті іздейді. Бұл әзірге кез келген мәтінге арналған AI аудармашы емес.",
            )}
          </p>
          <p>
            {at(
              "Неподдерживаемый текст не заменяется случайными жестами. Новые переводы и анимации нужно подготовить и проверить.",
              "Unsupported text is not replaced with unrelated signs. New translations and animations need preparation and review.",
              "Қолдауы жоқ мәтін кездейсоқ ымдармен алмастырылмайды. Жаңа аудармалар мен анимациялар әзірленіп, тексерілуі керек.",
            )}
          </p>
        </aside>
      </div>
      {result && !result.ok && (
        <section className="panel sign-text-result" role="status">
          <h2>
            {result.reason === "empty"
              ? at(
                  "Сначала введите фразу",
                  "Enter a phrase first",
                  "Алдымен сөйлем енгізіңіз",
                )
              : at(
                  "Для этого текста пока нет показа",
                  "No demonstration for this text yet",
                  "Бұл мәтінге көрсетілім әлі жоқ",
                )}
          </h2>
          <p>
            {result.reason === "too-long"
              ? at(
                  "Можно ввести не больше 500 символов.",
                  "Enter no more than 500 characters.",
                  "500 таңбадан артық енгізбеңіз.",
                )
              : at(
                  "Выберите одну букву, слово или фразу из готового словаря выше. Сочетания слов и произвольные предложения пока не переводятся.",
                  "Choose one letter, word or phrase from the prepared vocabulary above. Word combinations and arbitrary sentences are not translated yet.",
                  "Жоғарыдағы дайын сөздіктен бір әріп, сөз не сөйлемді таңдаңыз. Сөз тіркестері мен еркін сөйлемдер әзірге аударылмайды.",
                )}
          </p>
          <button
            className="button secondary"
            onClick={() => update(supportedPhrase)}
          >
            {at(
              "Вставить доступный пример",
              "Insert available example",
              "Қолжетімді мысалды қою",
            )}
          </button>
        </section>
      )}
      {result?.ok && (
        <section className="sign-text-result">
          <div className="sign-section-heading">
            <div>
              <span className="eyebrow">
                {at(
                  "ПОДГОТОВЛЕННЫЙ ПОКАЗ",
                  "PREPARED DEMONSTRATION",
                  "ДАЙЫН КӨРСЕТІЛІМ",
                )}
              </span>
              <h2>{result.phrase}</h2>
              <p>
                {at(
                  "3D-проба, не проверенная носителем РЖЯ. Нажмите «Смотреть» в плеере.",
                  "A 3D prototype, not reviewed by an RSL signer. Press Play in the viewer.",
                  "Орыс ым тілі маманы тексермеген 3D сынағы. Ойнатқышта «Көру» түймесін басыңыз.",
                )}
              </p>
            </div>
          </div>
          <Suspense fallback={<Loading />}>
            <ExercisePlayer
              key={version}
              exercise={exercises().find(
                (e) =>
                  e.id ===
                  (result.animation === "name-demo"
                    ? "name"
                    : result.animation),
              )!}
            />
          </Suspense>
        </section>
      )}
      {!result && (
        <div className="sign-text-empty">
          <Hand size={34} />
          <h2>
            {at(
              "Здесь появится аватар",
              "Your avatar will appear here",
              "Аватар осы жерде пайда болады",
            )}
          </h2>
          <p>
            {at(
              "Вставьте пример и нажмите «Подготовить показ».",
              "Insert the example and select Prepare demonstration.",
              "Мысалды қойып, «Көрсетілімді дайындау» түймесін басыңыз.",
            )}
          </p>
        </div>
      )}
    </div>
  );
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
              "Три уровня: буквы, первые слова и фразы. Откройте карточку — она ведёт прямо к аватару.",
              "Three levels: letters, first words and phrases. Open a card to go directly to the avatar.",
              "Үш деңгей: әріптер, алғашқы сөздер және сөйлемдер. Карточка арқылы аватарға өтіңіз.",
            ),
          ],
          [
            "/text-to-sign",
            at("Текст → жесты", "Text → signs", "Мәтін → ымдар"),
            at(
              "Отдельное поле ввода текста. Пока доступен показ одной подготовленной фразы, другие тексты получают понятный отказ.",
              "A separate text input. One prepared phrase can be shown; other text receives an explicit unsupported response.",
              "Мәтін енгізуге арналған бөлек өріс. Әзірге бір дайын сөйлем көрсетіледі; басқа мәтінге қолдау жоқ екені айтылады.",
            ),
          ],
          [
            "/practice",
            at("Моя практика", "My practice", "Менің жаттығуым"),
            at(
              "Аватар показывает буквы и фразы. Для А, В, Л можно проверить фото или камеру. История вводных занятий находится внизу.",
              "The avatar demonstrates letters and phrases. Check photos or camera input for А, В, Л. Introduction history is at the bottom.",
              "Аватар әріптер мен сөйлемдерді көрсетеді. А, В, Л үшін фото не камераны тексеріңіз. Кіріспе тарихы төменде.",
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
            "Остальные буквы, дополнительные слова и диалоги, распознавание фраз и перевод произвольного текста. Сейчас ИИ различает только три буквы: А, В, Л.",
            "More letters, words and dialogues, phrase recognition and arbitrary-text translation are still in preparation. The AI currently distinguishes only А, В, Л.",
            "Қалған әріптер, сөздер мен диалогтар, сөйлемдерді тану және еркін мәтін аудармасы әзірленуде. ЖИ әзірге тек А, В, Л әріптерін ажыратады.",
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
