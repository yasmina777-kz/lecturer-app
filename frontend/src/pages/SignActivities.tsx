import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageCircle,
  Eye,
  RotateCcw,
  Play,
} from "lucide-react";
import { at } from "../i18n/automation";
import { Loading } from "../components/UI";
import { ReferenceVideo } from "../components/SignReferenceVideo";
import { SignSequencePlayer } from "../components/SignSequencePlayer";
import { planMotion } from "../sign/motion";
import type { DictionaryEntry } from "../sign/dictionary";
import {
  dialogueScenarios,
  questionOptions,
  reviewItems,
  shuffle,
} from "../sign/activities";
import { useActivityCatalog, useActivityProgress } from "../sign/useActivities";
import "./sign-workspace.css";
import "./sign-activities.css";
type Catalog = NonNullable<ReturnType<typeof useActivityCatalog>["data"]>;
const localNote = () =>
  at(
    "История сохраняется в этом браузере для вашего аккаунта. Результат задания не оценивает владение РЖЯ.",
    "History is saved in this browser for your account. Task results do not assess RSL proficiency.",
    "Тарих осы браузерде аккаунтыңыз үшін сақталады. Нәтиже РЖЯ меңгеру деңгейін бағаламайды.",
  );
function CatalogError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="sign-workspace">
      <p role="alert">{message}</p>
      <button className="button secondary" onClick={retry}>
        {at("Загрузить снова", "Retry", "Қайта жүктеу")}
      </button>
    </div>
  );
}
export function ActivityLinks() {
  return (
    <div className="activity-entry-links">
      <Link to="/dialogues">
        <MessageCircle />
        <div>
          <strong>
            {at(
              "Диалоги в ситуациях",
              "Situational dialogues",
              "Жағдаят диалогтары",
            )}
          </strong>
          <span>
            {at(
              "Знакомство, занятие, магазин — выберите ответ и продолжите разговор.",
              "Meet someone, join a class or shop: choose a reply and continue.",
              "Танысу, сабақ, дүкен: жауап таңдап, әңгімені жалғастырыңыз.",
            )}
          </span>
        </div>
        <ArrowRight />
      </Link>
      <Link to="/understanding">
        <Eye />
        <div>
          <strong>
            {at("Понимание жестов", "Understand signs", "Ымдарды түсіну")}
          </strong>
          <span>
            {at(
              "Посмотрите видео без подписи и определите смысл. Камера не нужна.",
              "Watch an unlabelled video and identify its meaning. No camera needed.",
              "Жазусыз бейнені көріп, мағынасын анықтаңыз. Камера қажет емес.",
            )}
          </span>
        </div>
        <ArrowRight />
      </Link>
    </div>
  );
}
function AvatarStudy({ text, data }: { text: string; data: Catalog }) {
  const [open, setOpen] = useState(false);
  const plan = useMemo(
    () => planMotion(text, data.entries, data.forms, data.motions),
    [text, data],
  );
  return (
    <details
      className="activity-avatar"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        {at(
          "Посмотреть пробный показ аватара",
          "View experimental avatar",
          "Сынақ аватарын қарау",
        )}
      </summary>
      <p>
        {at(
          "Показ доступных жестов. Составленная последовательность не является переводом с грамматикой РЖЯ; анимации ещё требуют проверки.",
          "Available signs in sequence, not a grammatical RSL translation. Animations still need review.",
          "Қолжетімді ымдар тізбегі РЖЯ грамматикасымен аударма емес. Анимациялар әлі тексеруді қажет етеді.",
        )}
      </p>
      {open && <SignSequencePlayer key={text} plan={plan} />}
    </details>
  );
}
export function SignDialoguesPage() {
  const { data, error, retry } = useActivityCatalog();
  const [params, setParams] = useSearchParams();
  const scenarios = dialogueScenarios();
  const selected = scenarios.find((s) => s.id === params.get("scenario"));
  if (error) return <CatalogError message={error} retry={retry} />;
  if (!data) return <Loading />;
  return (
    <div className="sign-workspace activity-workspace">
      {selected ? (
        <DialogueSession
          key={selected.id}
          scenario={selected}
          data={data}
          leave={() => setParams({})}
        />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {at(
                  "ПРАКТИКА ОБЩЕНИЯ",
                  "COMMUNICATION PRACTICE",
                  "ҚАРЫМ-ҚАТЫНАС ЖАТТЫҒУЫ",
                )}
              </span>
              <h1>
                {at(
                  "Диалоги в ситуациях",
                  "Situational dialogues",
                  "Жағдаят диалогтары",
                )}
              </h1>
              <p>
                {at(
                  "Выберите ситуацию. Посмотрите опорные жесты, ответьте собеседнику и узнайте, почему ответ подходит.",
                  "Choose a situation. Watch relevant signs, reply and learn why your response works.",
                  "Жағдаят таңдаңыз. Тірек ымдарды көріп, жауап беріңіз және оның сәйкестігін біліңіз.",
                )}
              </p>
            </div>
          </div>
          <p className="activity-method">
            {at(
              "Пошаговые учебные сценарии с выбором ответа. Свободный ответ жестами через камеру пока не распознаётся.",
              "Guided scenarios with selectable replies. Free signing through the camera is not recognized yet.",
              "Жауап таңдауы бар қадамдық сценарийлер. Камерадағы еркін ым жауабы әзірге танылмайды.",
            )}
          </p>
          <div className="activity-scenarios">
            {scenarios.map((s, i) => {
              const cover = data.entries.find((e) => e.label === s.image);
              return (
                <button
                  className="panel activity-scenario"
                  key={s.id}
                  onClick={() => setParams({ scenario: s.id })}
                >
                  <div className="activity-scenario-cover">
                    {cover?.poster && <img src={cover.poster} alt="" />}
                    <span>0{i + 1}</span>
                  </div>
                  <div>
                    <small>
                      {at(
                        "3 реплики · разные варианты ответа",
                        "3 turns · different reply options",
                        "3 реплика · әртүрлі жауаптар",
                      )}
                    </small>
                    <h2>{s.title}</h2>
                    <p>{s.description}</p>
                    <strong>
                      {at("Начать диалог", "Start dialogue", "Диалогты бастау")}{" "}
                      <ArrowRight size={17} />
                    </strong>
                  </div>
                </button>
              );
            })}
          </div>
          <section className="activity-explanation">
            <h2>
              {at(
                "Что вы тренируете",
                "What you practise",
                "Нені жаттықтырасыз",
              )}
            </h2>
            <p>
              {at(
                "Смысл ответа зависит от ситуации: назвать имя, попросить помощи или уточнить количество. Здесь можно ошибаться и пробовать другую реплику. Видео показывают отдельные опорные жесты, а текст описывает ситуацию.",
                "A reply depends on context: give a name, ask for help or specify quantity. Try another reply after a mistake. Videos show individual vocabulary signs; text describes the situation.",
                "Жауап жағдайға байланысты: есімді айту, көмек сұрау немесе санын нақтылау. Қателессеңіз, басқа жауапты таңдаңыз. Бейнелер жеке ымдарды, мәтін жағдайды көрсетеді.",
              )}
            </p>
            <Link to="/understanding">
              {at(
                "Потренировать понимание жестов →",
                "Practise understanding signs →",
                "Ымдарды түсінуді жаттықтыру →",
              )}
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
function DialogueSession({
  scenario,
  data,
  leave,
}: {
  scenario: ReturnType<typeof dialogueScenarios>[number];
  data: Catalog;
  leave: () => void;
}) {
  const [stepId, setStepId] = useState(scenario.start),
    [selected, setSelected] = useState<string | null>(null),
    [submitted, setSubmitted] = useState(false),
    [done, setDone] = useState(false),
    [history, setHistory] = useState<{ prompt: string; reply: string }[]>([]),
    [run, setRun] = useState(() => crypto.randomUUID());
  const recorded = useRef(new Set<string>());
  const [firstAnswers, setFirstAnswers] = useState<
    { item: string; correct: boolean }[]
  >([]);
  const { record, error } = useActivityProgress();
  const step = scenario.steps.find((s) => s.id === stepId)!;
  const choice = step.choices.find((c) => c.id === selected);
  const [wordIndex, setWordIndex] = useState(0);
  const signs = step.signs
    .map((label) => data.entries.find((e) => e.label === label))
    .filter((e): e is DictionaryEntry => !!e);
  function submit() {
    if (!choice || submitted) return;
    setSubmitted(true);
    if (!recorded.current.has(step.id)) {
      recorded.current.add(step.id);
      setFirstAnswers((a) => [
        ...a,
        { item: step.id, correct: choice.accepted },
      ]);
      record({
        id: `${run}:${step.id}`,
        item: `${scenario.id}:${step.id}`,
        mode: "dialogue",
        correct: choice.accepted,
        assisted: false,
        at: new Date().toISOString(),
      });
    }
  }
  function next() {
    if (!choice?.accepted) return;
    setHistory((h) => [...h, { prompt: step.prompt, reply: choice.text }]);
    if (choice.next) {
      setStepId(choice.next);
      setSelected(null);
      setSubmitted(false);
      setWordIndex(0);
    } else setDone(true);
  }
  function restart() {
    setRun(crypto.randomUUID());
    recorded.current.clear();
    setFirstAnswers([]);
    setStepId(scenario.start);
    setSelected(null);
    setSubmitted(false);
    setDone(false);
    setHistory([]);
    setWordIndex(0);
  }
  return (
    <>
      <button className="sign-back" onClick={leave}>
        <ArrowLeft size={17} />
        {at("Все ситуации", "All situations", "Барлық жағдаяттар")}
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{scenario.title}</span>
          <h1>
            {done
              ? at(
                  "Разговор завершён",
                  "Conversation complete",
                  "Әңгіме аяқталды",
                )
              : at(
                  `Реплика ${history.length + 1}`,
                  `Turn ${history.length + 1}`,
                  `${history.length + 1}-реплика`,
                )}
          </h1>
        </div>
      </div>
      {done ? (
        <section className="panel activity-result">
          <Check size={30} />
          <h2>
            {at(
              "Вы прошли ситуацию",
              "You completed the situation",
              "Жағдаяттан өттіңіз",
            )}
          </h2>
          <p>
            {at(
              "Подходящих первых ответов",
              "Relevant first replies",
              "Орынды алғашқы жауаптар",
            )}
            : {firstAnswers.filter((a) => a.correct).length}/
            {firstAnswers.length}.{" "}
            {at(
              "Ошибки можно разобрать при повторном прохождении.",
              "Review mistakes by trying the dialogue again.",
              "Қайта өткенде қателерді талдауға болады.",
            )}
          </p>
          <ol>
            {history.map((h, i) => (
              <li key={i}>
                <strong>{h.prompt}</strong>
                <p>{h.reply}</p>
              </li>
            ))}
          </ol>
          <div className="activity-actions">
            <button className="button primary" onClick={restart}>
              {at("Пройти ещё раз", "Try again", "Қайта өту")}
            </button>
            <Link className="button secondary" to="/understanding">
              {at(
                "Проверить понимание",
                "Check understanding",
                "Түсінуді тексеру",
              )}
            </Link>
          </div>
        </section>
      ) : (
        <div className="activity-dialogue-layout">
          <section className="panel activity-turn">
            <span className="eyebrow">
              {at("СОБЕСЕДНИК", "YOUR PARTNER", "ӘҢГІМЕЛЕСУШІ")}
            </span>
            <h2>{step.prompt}</h2>
            <p>{step.context}</p>
            <fieldset className="activity-options">
              <legend>
                {at(
                  "Как вы ответите?",
                  "How will you reply?",
                  "Қалай жауап бересіз?",
                )}
              </legend>
              {step.choices.map((c) => (
                <label
                  key={c.id}
                  className={selected === c.id ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="reply"
                    value={c.id}
                    checked={selected === c.id}
                    disabled={submitted}
                    onChange={() => setSelected(c.id)}
                  />
                  {c.text}
                </label>
              ))}
            </fieldset>
            {!submitted ? (
              <>
                <button
                  className="button primary"
                  disabled={!choice}
                  onClick={submit}
                >
                  {at("Ответить", "Reply", "Жауап беру")}{" "}
                  <ArrowRight size={17} />
                </button>
                {!choice && (
                  <p className="activity-hint">
                    {at(
                      "Выберите одну реплику.",
                      "Choose one reply.",
                      "Бір жауапты таңдаңыз.",
                    )}
                  </p>
                )}
              </>
            ) : (
              <div
                className={`activity-feedback ${choice?.accepted ? "correct" : "review"}`}
                role="status"
              >
                <strong>
                  {choice?.accepted
                    ? at(
                        "Ответ подходит к ситуации",
                        "This reply fits",
                        "Жауап жағдайға сәйкес",
                      )
                    : at(
                        "Попробуйте другую реплику",
                        "Try another reply",
                        "Басқа жауапты көріңіз",
                      )}
                </strong>
                <p>{choice?.feedback}</p>
                {choice?.accepted ? (
                  <button className="button primary" onClick={next}>
                    {choice.next
                      ? at("Продолжить разговор", "Continue", "Жалғастыру")
                      : at(
                          "Завершить диалог",
                          "Finish dialogue",
                          "Диалогты аяқтау",
                        )}
                  </button>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSelected(null);
                      setSubmitted(false);
                    }}
                  >
                    {at(
                      "Выбрать другой ответ",
                      "Choose another reply",
                      "Басқа жауап таңдау",
                    )}
                  </button>
                )}
              </div>
            )}
            {history.length > 0 && (
              <details className="activity-transcript">
                <summary>
                  {at(
                    "Предыдущие реплики",
                    "Previous turns",
                    "Алдыңғы репликалар",
                  )}
                </summary>
                {history.map((h, i) => (
                  <p key={i}>
                    <strong>{h.prompt}</strong>
                    <br />
                    {h.reply}
                  </p>
                ))}
              </details>
            )}
          </section>
          <aside className="activity-signs">
            <h2>
              {at(
                "Жесты для этой ситуации",
                "Vocabulary for this situation",
                "Осы жағдайға арналған ымдар",
              )}
            </h2>
            <p>
              {at(
                "Отдельные видеообразцы, не полный перевод реплики.",
                "Individual video references, not a full translation of the prompt.",
                "Жеке бейнеүлгілер, репликаның толық аудармасы емес.",
              )}
            </p>
            <div className="activity-word-tabs">
              {signs.map((s, i) => (
                <button
                  key={s.id}
                  aria-pressed={wordIndex === i}
                  onClick={() => setWordIndex(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {signs[wordIndex] && (
              <ReferenceVideo
                key={signs[wordIndex].id}
                entry={signs[wordIndex]}
              />
            )}
            <AvatarStudy key={step.id} text={step.avatar} data={data} />
            {submitted && choice?.accepted && choice.example && (
              <Link
                className="sign-back"
                to={`/text-to-sign?text=${encodeURIComponent(choice.example)}`}
              >
                {at(
                  "Открыть слова ответа",
                  "Open reply vocabulary",
                  "Жауап сөздерін ашу",
                )}{" "}
                <ArrowRight size={16} />
              </Link>
            )}
          </aside>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="sign-save-note">{localNote()}</p>
    </>
  );
}
export function SignUnderstandingPage() {
  const { data, error, retry } = useActivityCatalog();
  const progress = useActivityProgress();
  const [category, setCategory] = useState("all");
  const [session, setSession] = useState<{
    id: string;
    items: DictionaryEntry[];
  } | null>(null);
  if (error) return <CatalogError message={error} retry={retry} />;
  if (!data) return <Loading />;
  const review = reviewItems(progress.attempts);
  const categories = [...new Set(data.entries.map((e) => e.category))];
  const pool = data.entries.filter(
    (e) => category === "all" || e.category === category,
  );
  function start(repeat = false) {
    const items = shuffle(
      pool.filter((e) => !repeat || review.has(e.id)),
    ).slice(0, 8);
    if (items.length) setSession({ id: crypto.randomUUID(), items });
  }
  return (
    <div className="sign-workspace activity-workspace">
      {session ? (
        <UnderstandingSession
          key={session.id}
          session={session}
          data={data}
          record={progress.record}
          leave={() => setSession(null)}
        />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {at(
                  "СМОТРЕТЬ И ПОНИМАТЬ",
                  "WATCH AND UNDERSTAND",
                  "ҚАРАУ ЖӘНЕ ТҮСІНУ",
                )}
              </span>
              <h1>
                {at(
                  "Что означает этот жест?",
                  "What does this sign mean?",
                  "Бұл ым нені білдіреді?",
                )}
              </h1>
              <p>
                {at(
                  "Смотрите видео человека без подписи и выбирайте значение. Здесь тренируется понимание чужих жестов — камера не нужна.",
                  "Watch an unlabelled human video and choose its meaning. Practise understanding other people, without a camera.",
                  "Адамның жазусыз бейнесін көріп, мағынасын таңдаңыз. Басқаның ымын түсінуді камерасыз жаттықтырыңыз.",
                )}
              </p>
            </div>
          </div>
          <section className="panel activity-start">
            <div>
              <h2>
                {at("Короткая тренировка", "A short practice", "Қысқа жаттығу")}
              </h2>
              <p>
                {at(
                  "До 8 заданий за занятие. Ответы появляются после проверки. Повторный просмотр разрешён.",
                  "Up to 8 questions per session. Answers are revealed after checking. Replay as often as needed.",
                  "Бір жаттығуда 8 тапсырмаға дейін. Жауап тексергеннен кейін ашылады. Қайта көруге болады.",
                )}
              </p>
              <label>
                {at("Тема", "Topic", "Тақырып")}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">
                    {at("Все темы", "All topics", "Барлық тақырыптар")}
                  </option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <p>
                {pool.length}{" "}
                {at(
                  "видеообразцов в теме",
                  "reference videos in this topic",
                  "тақырыптағы бейнеүлгі",
                )}
              </p>
            </div>
            <div className="activity-start-actions">
              <button className="button primary" onClick={() => start()}>
                <Play size={19} />
                {at("Начать тренировку", "Start practice", "Жаттығуды бастау")}
              </button>
              <button
                className="button secondary"
                disabled={!pool.some((e) => review.has(e.id))}
                onClick={() => start(true)}
              >
                <RotateCcw size={18} />
                {at(
                  "Повторить сложные",
                  "Review difficult signs",
                  "Қиын ымдарды қайталау",
                )}
              </button>
              <p>
                {review.size
                  ? at(
                      `${review.size} слов ждут повторения. В этот список попадают ошибки и ответы с подсказкой.`,
                      `${review.size} words to review: mistakes and assisted answers.`,
                      `${review.size} сөзді қайталау керек: қателер мен көмектесілген жауаптар.`,
                    )
                  : progress.attempts.some((a) => a.mode === "understanding")
                    ? at(
                        "Все отмеченные слова повторены без подсказки. Можно начать новую тренировку.",
                        "All flagged words were reviewed without hints. Start another practice.",
                        "Белгіленген сөздер көмексіз қайталанды. Жаңа жаттығуды бастауға болады.",
                      )
                    : at(
                        "После первых заданий здесь появятся слова для повторения.",
                        "Review words appear after your first attempts.",
                        "Алғашқы тапсырмалардан кейін қайталайтын сөздер пайда болады.",
                      )}
              </p>
            </div>
          </section>
          <ActivityLinks />
          <section className="activity-explanation">
            <h2>
              {at(
                "Почему это полезно",
                "Why practise this",
                "Бұл неге пайдалы",
              )}
            </h2>
            <p>
              {at(
                "Можно уметь повторять движение и при этом не узнавать его у другого человека. Эти задания отдельно тренируют связь между увиденным жестом и его значением. Проверка вариантов и список повторения работают по правилам; это не оценка исполнения жестов ИИ.",
                "Repeating a movement and recognizing it in someone else are different tasks. These exercises connect a seen sign with its meaning. Answer checking and review scheduling use rules, not AI assessment of signing.",
                "Қимылды қайталау мен оны басқа адамнан тану — бөлек тапсырмалар. Бұл жаттығулар ым мен мағынаны байланыстырады. Жауап пен қайталау ережемен тексеріледі, ЖИ ым орындауды бағаламайды.",
              )}
            </p>
          </section>
        </>
      )}
      {progress.error && <p role="alert">{progress.error}</p>}
      <p className="sign-save-note">{localNote()}</p>
    </div>
  );
}
function UnderstandingSession({
  session,
  data,
  record,
  leave,
}: {
  session: { id: string; items: DictionaryEntry[] };
  data: Catalog;
  record: ReturnType<typeof useActivityProgress>["record"];
  leave: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<
    { label: string; correct: boolean; assisted: boolean }[]
  >([]);
  const done = index >= session.items.length;
  return (
    <>
      <button className="sign-back" onClick={leave}>
        <ArrowLeft size={17} />
        {at("Выбрать тему", "Choose topic", "Тақырып таңдау")}
      </button>
      {done ? (
        <section className="panel activity-result">
          <h1>
            {at(
              "Тренировка завершена",
              "Practice complete",
              "Жаттығу аяқталды",
            )}
          </h1>
          <p className="activity-score">
            {results.filter((r) => r.correct && !r.assisted).length}/
            {results.length}
          </p>
          <p>
            {at(
              "Правильных ответов без подсказки. Это результат понимания этих видео, а не уровень владения языком.",
              "Correct answers without hints. This measures understanding of these videos, not language proficiency.",
              "Көмексіз дұрыс жауаптар. Бұл — осы бейнелерді түсіну нәтижесі, тілді меңгеру деңгейі емес.",
            )}
          </p>
          <ul>
            {results.map((r, i) => (
              <li key={i}>
                <strong>{r.label}</strong>
                <span>
                  {r.correct && !r.assisted
                    ? at("Узнали", "Recognized", "Таныдыңыз")
                    : r.assisted
                      ? at(
                          "С подсказкой · повторить",
                          "Assisted · review",
                          "Көмекпен · қайталау",
                        )
                      : at("Повторить", "Review", "Қайталау")}
                </span>
              </li>
            ))}
          </ul>
          <div className="activity-actions">
            <button className="button primary" onClick={leave}>
              {at(
                "К темам и повторению",
                "Topics and review",
                "Тақырыптар мен қайталау",
              )}
            </button>
            <Link to="/dialogues" className="button secondary">
              {at("Перейти к диалогам", "Try dialogues", "Диалогтарға өту")}
            </Link>
          </div>
        </section>
      ) : (
        <UnderstandingQuestion
          key={index}
          answer={session.items[index]}
          data={data}
          number={index + 1}
          total={session.items.length}
          record={(correct, assisted) => {
            record({
              id: `${session.id}:${index}`,
              mode: "understanding",
              item: session.items[index].id,
              correct,
              assisted,
              at: new Date().toISOString(),
            });
          }}
          next={(correct, assisted) => {
            setResults((r) => [
              ...r,
              { label: session.items[index].label, correct, assisted },
            ]);
            setIndex((i) => i + 1);
          }}
        />
      )}
    </>
  );
}
function UnderstandingQuestion({
  answer,
  data,
  number,
  total,
  record,
  next,
}: {
  answer: DictionaryEntry;
  data: Catalog;
  number: number;
  total: number;
  record: (correct: boolean, assisted: boolean) => void;
  next: (correct: boolean, assisted: boolean) => void;
}) {
  const options = useMemo(
    () => questionOptions(answer, data.entries),
    [answer, data.entries],
  );
  const [selected, setSelected] = useState<string | null>(null),
    [submitted, setSubmitted] = useState(false),
    [hint, setHint] = useState(false),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const correct = selected === answer.id;
  function check(skip = false) {
    if (submitted || !ready || failed || (!selected && !skip)) return;
    setSubmitted(true);
    record(!skip && correct, hint);
    if (skip) setSelected(null);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {at(
              `ЗАДАНИЕ ${number} ИЗ ${total}`,
              `QUESTION ${number} OF ${total}`,
              `${total} ТАПСЫРМАНЫҢ ${number}-СІ`,
            )}
          </span>
          <h1>
            {at(
              "Посмотрите и выберите смысл",
              "Watch and choose the meaning",
              "Қарап, мағынасын таңдаңыз",
            )}
          </h1>
        </div>
      </div>
      <progress
        className="activity-progress"
        value={number - 1}
        max={total}
        aria-label={at(
          "Пройдено заданий",
          "Questions completed",
          "Орындалған тапсырмалар",
        )}
      />
      <div className="activity-quiz-layout">
        <section className="panel activity-video">
          <video
            ref={video}
            src={answer.video}
            controls
            muted
            playsInline
            preload="auto"
            aria-label={at(
              "Видео жеста без подписи",
              "Unlabelled sign video",
              "Жазусыз ым бейнесі",
            )}
            onLoadedData={() => {
              setReady(true);
              setFailed(false);
            }}
            onError={() => {
              setReady(false);
              setFailed(true);
            }}
          />
          {failed ? (
            <div role="alert">
              <p>
                {at(
                  "Видео не загрузилось. Ответ не будет засчитан без образца.",
                  "Video failed to load. No answer will be graded without the reference.",
                  "Бейне жүктелмеді. Үлгісіз жауап бағаланбайды.",
                )}
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  setFailed(false);
                  video.current?.load();
                }}
              >
                {at(
                  "Загрузить видео снова",
                  "Reload video",
                  "Бейнені қайта жүктеу",
                )}
              </button>
            </div>
          ) : !ready ? (
            <p role="status">
              {at("Загружаем видео…", "Loading video…", "Бейне жүктелуде…")}
            </p>
          ) : (
            <div className="activity-actions">
              <button
                className="button secondary"
                onClick={() => {
                  if (video.current) {
                    video.current.currentTime = 0;
                    void video.current.play().catch(() => {});
                  }
                }}
              >
                <RotateCcw size={16} />
                {at("Посмотреть ещё раз", "Watch again", "Қайта қарау")}
              </button>
              <label>
                {at("Скорость", "Speed", "Жылдамдық")}
                <select
                  defaultValue="1"
                  onChange={(e) => {
                    if (video.current)
                      video.current.playbackRate = Number(e.target.value);
                  }}
                >
                  <option value="1">1×</option>
                  <option value=".75">0.75×</option>
                  <option value=".5">0.5×</option>
                </select>
              </label>
            </div>
          )}
        </section>
        <section className="panel activity-answer">
          <fieldset className="activity-options">
            <legend>
              {at(
                "Какое значение подходит?",
                "Which meaning fits?",
                "Қай мағына сәйкес?",
              )}
            </legend>
            {options.map((option) => (
              <label
                key={option.id}
                className={selected === option.id ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="meaning"
                  disabled={submitted}
                  checked={selected === option.id}
                  onChange={() => setSelected(option.id)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          {!submitted ? (
            <>
              <div className="activity-actions">
                <button
                  className="button primary"
                  disabled={!selected || !ready || failed}
                  onClick={() => check()}
                >
                  {at("Проверить ответ", "Check answer", "Жауапты тексеру")}
                </button>
                <button
                  className="button secondary"
                  disabled={!ready || failed}
                  onClick={() => check(true)}
                >
                  {at("Не знаю", "I do not know", "Білмеймін")}
                </button>
              </div>
              {!selected && (
                <p className="activity-hint">
                  {at(
                    "Выберите значение или нажмите «Не знаю».",
                    "Select a meaning or choose “I do not know”.",
                    "Мағынаны таңдаңыз не «Білмеймін» басыңыз.",
                  )}
                </p>
              )}
              <button
                className="sign-link-button"
                onClick={() => setHint(true)}
              >
                {at(
                  "Подсказка: показать тему",
                  "Hint: reveal topic",
                  "Көмек: тақырыпты көрсету",
                )}
              </button>
              {hint && (
                <p role="status">
                  {at("Тема", "Topic", "Тақырып")}: {answer.category}.{" "}
                  {at(
                    "Ответ будет отмечен как выполненный с подсказкой.",
                    "This will be marked as an assisted answer.",
                    "Жауап көмекпен орындалған деп белгіленеді.",
                  )}
                </p>
              )}
            </>
          ) : (
            <div
              className={`activity-feedback ${correct ? "correct" : "review"}`}
              role="status"
            >
              <strong>
                {correct
                  ? at("Верно", "Correct", "Дұрыс")
                  : at(
                      "Разберём ответ",
                      "Review the answer",
                      "Жауапты талдайық",
                    )}
              </strong>
              <p>
                {at(
                  "В этом видео показано",
                  "This video shows",
                  "Бейнеде көрсетілгені",
                )}
                : <b>{answer.label}</b>.{" "}
                {!correct &&
                  at(
                    "Посмотрите движение ещё раз, теперь зная значение. Слово добавлено к повторению.",
                    "Watch again now that you know the meaning. This word was added to review.",
                    "Мағынасын біліп, қайта қараңыз. Сөз қайталауға қосылды.",
                  )}
                {hint &&
                  at(
                    " Использована подсказка — слово останется в повторении.",
                    " A hint was used; this word remains in review.",
                    " Көмек қолданылды — сөз қайталауда қалады.",
                  )}
              </p>
              <a href={answer.source} target="_blank" rel="noreferrer">
                {at("Источник видео", "Video source", "Бейне дереккөзі")}:{" "}
                {answer.dataset} ↗
              </a>
              <button
                className="button primary"
                onClick={() => next(correct, hint)}
              >
                {number === total
                  ? at("Посмотреть результат", "View results", "Нәтижені көру")
                  : at(
                      "Следующее задание",
                      "Next question",
                      "Келесі тапсырма",
                    )}{" "}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
