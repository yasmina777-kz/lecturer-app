import { useEffect, useMemo, useRef, useState } from "react";
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
import { phraseArt } from "../sign/phraseArt";
import { at } from "../i18n/automation";
import { Loading } from "../components/UI";
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
        <div className="activity-entry-cover">
          <img src={phraseArt("Я хочу купить хлеб")} alt="" loading="lazy" />
        </div>
        <div className="activity-entry-copy">
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
        <div className="activity-entry-cover">
          <img src={phraseArt("Покажи мне")} alt="" loading="lazy" />
        </div>
        <div className="activity-entry-copy">
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
  const plan = useMemo(
    () => planMotion(text, data.entries, data.forms, data.motions),
    [text, data],
  );
  return (
    <div className="activity-avatar">
      <SignSequencePlayer
        key={text}
        plan={plan}
        note={at(
          "Пробный показ: точность жестов ещё проверяется.",
          "Experimental motion: sign accuracy is still being reviewed.",
          "Сынақ қимылдары: ымдардың дәлдігі әлі тексерілуде.",
        )}
      />
      <small>
        {at(
          "Движения перенесены с видео. Пробный показ отдельных жестов.",
          "Motion retargeted from video. Experimental sign sequence.",
          "Қимылдар бейнеден көшірілген. Ымдардың сынақ көрсетілімі.",
        )}
      </small>
    </div>
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
                  "Выберите ситуацию → посмотрите аватара → ответьте.",
                  "Choose a situation. Watch relevant signs, reply and learn why your response works.",
                  "Жағдаят таңдаңыз. Тірек ымдарды көріп, жауап беріңіз және оның сәйкестігін біліңіз.",
                )}
              </p>
            </div>
          </div>
          <DialogueSteps />
          <p className="activity-method">
            {at(
              "Отвечайте кнопками: камера и микрофон не нужны. В каждой ситуации — три короткие реплики.",
              "Reply using buttons: no camera or microphone needed. Each situation has three short turns.",
              "Батырмамен жауап беріңіз: камера мен микрофон қажет емес. Әр жағдаятта үш қысқа реплика бар.",
            )}
          </p>
          <div className="activity-scenarios">
            {scenarios.map((s, i) => {
              const cover = phraseArt(
                [
                  "Как тебя зовут?",
                  "Я хочу читать книгу",
                  "Я хочу купить хлеб",
                ][i],
              );
              return (
                <button
                  className="panel activity-scenario"
                  key={s.id}
                  onClick={() => setParams({ scenario: s.id })}
                >
                  <div className="activity-scenario-cover">
                    {cover && <img src={cover} alt="" loading="lazy" />}
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
                "Смысл ответа зависит от ситуации: назвать имя, попросить помощи или уточнить количество. Здесь можно ошибаться и пробовать другую реплику. Аватар показывает опорные жесты, а текст описывает ситуацию.",
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
function DialogueSteps({ phase }: { phase?: "watch" | "answer" | "feedback" }) {
  const steps = [
    ["watch", at("Посмотрите жесты", "Watch the signs", "Ымдарды қараңыз")],
    ["answer", at("Выберите ответ", "Choose a reply", "Жауап таңдаңыз")],
    [
      "feedback",
      at("Разберите результат", "Review feedback", "Нәтижені талдаңыз"),
    ],
  ];
  return (
    <ol
      className="dialogue-steps"
      aria-label={at("Порядок занятия", "Activity steps", "Жаттығу реті")}
    >
      {steps.map(([id, label], i) => (
        <li key={id} aria-current={phase === id ? "step" : undefined}>
          <span>{i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
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
  const [stepId, setStepId] = useState(scenario.start);
  const [phase, setPhase] = useState<"watch" | "answer" | "feedback">("watch");
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<
    { item: string; prompt: string; reply: string }[]
  >([]);
  const [run, setRun] = useState(() => crypto.randomUUID());
  const [wordIndex, setWordIndex] = useState(-1);
  const [firstAnswers, setFirstAnswers] = useState<
    { item: string; correct: boolean; reply: string; feedback: string }[]
  >([]);
  const recorded = useRef(new Set<string>());
  const heading = useRef<HTMLHeadingElement>(null);
  const { record, error } = useActivityProgress();
  const step = scenario.steps.find((s) => s.id === stepId)!;
  const choice = step.choices.find((c) => c.id === selected);
  const signs = step.signs
    .map((label) => data.entries.find((e) => e.label === label))
    .filter((e): e is DictionaryEntry => !!e);
  useEffect(() => {
    heading.current?.focus();
  }, [phase, stepId, done]);
  function submit() {
    if (!choice || phase !== "answer") return;
    setPhase("feedback");
    if (!recorded.current.has(step.id)) {
      recorded.current.add(step.id);
      setFirstAnswers((a) => [
        ...a,
        {
          item: step.id,
          correct: choice.accepted,
          reply: choice.text,
          feedback: choice.feedback,
        },
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
    if (!choice?.accepted || phase !== "feedback") return;
    setHistory((h) => [
      ...h,
      { item: step.id, prompt: step.prompt, reply: choice.text },
    ]);
    if (choice.next) {
      setStepId(choice.next);
      setSelected(null);
      setPhase("watch");
      setWordIndex(-1);
    } else setDone(true);
  }
  function restart() {
    setRun(crypto.randomUUID());
    recorded.current.clear();
    setFirstAnswers([]);
    setHistory([]);
    setStepId(scenario.start);
    setSelected(null);
    setPhase("watch");
    setDone(false);
    setWordIndex(-1);
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
                  `Реплика ${history.length + 1} из 3`,
                  `Turn ${history.length + 1} of 3`,
                  `3 репликаның ${history.length + 1}-сі`,
                )}
          </h1>
          <p>
            {at(
              "Здесь вы выбираете ответ кнопкой. Камера и микрофон не нужны.",
              "Choose your reply using the buttons. No camera or microphone needed.",
              "Жауапты батырмамен таңдаңыз. Камера мен микрофон қажет емес.",
            )}
          </p>
        </div>
      </div>
      {!done && <DialogueSteps phase={phase} />}
      {done ? (
        <section className="panel activity-result" data-workspace-enter>
          <Check size={30} />
          <h2 ref={heading} tabIndex={-1}>
            {at("Что получилось", "Your results", "Нәтижеңіз")}
          </h2>
          <p>
            {at(
              "Подходящих ответов с первой попытки",
              "Relevant replies on the first attempt",
              "Алғашқы әрекеттегі орынды жауаптар",
            )}
            :{" "}
            <strong>
              {firstAnswers.filter((a) => a.correct).length}/
              {firstAnswers.length}
            </strong>
            .
          </p>
          <ol>
            {history.map((h, i) => {
              const first = firstAnswers.find((a) => a.item === h.item);
              return (
                <li key={h.item}>
                  <strong>
                    {i + 1}. {h.prompt}
                  </strong>
                  <p>
                    {at("Ваш ответ", "Your reply", "Жауабыңыз")}: {h.reply}
                  </p>
                  {first && !first.correct && (
                    <div className="dialogue-review">
                      <strong>
                        {at(
                          "Что стоит повторить",
                          "What to review",
                          "Нені қайталау керек",
                        )}
                      </strong>
                      <p>
                        {at("Первый выбор", "First choice", "Алғашқы таңдау")}:{" "}
                        {first.reply}
                      </p>
                      <p>{first.feedback}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="activity-actions">
            <button className="button primary" onClick={leave}>
              {at(
                "Выбрать другую ситуацию",
                "Choose another situation",
                "Басқа жағдаят таңдау",
              )}
            </button>
            <button className="button secondary" onClick={restart}>
              {at(
                "Повторить этот диалог",
                "Repeat this dialogue",
                "Осы диалогты қайталау",
              )}
            </button>
            <Link to="/understanding">
              {at(
                "Потренировать понимание видео →",
                "Practise understanding videos →",
                "Бейнені түсінуді жаттықтыру →",
              )}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="dialogue-partner">
            <span>
              {at(
                "Собеседник спрашивает",
                "Your partner asks",
                "Әңгімелесуші сұрайды",
              )}
            </span>
            <h2>{step.prompt}</h2>
            <p>{step.context}</p>
          </div>
          <section
            className="panel dialogue-stage"
            key={`${step.id}:${phase}`}
            data-workspace-enter
          >
            <h2 ref={heading} tabIndex={-1}>
              {phase === "watch"
                ? at(
                    "1. Познакомьтесь с жестами",
                    "1. Explore the signs",
                    "1. Ымдармен танысыңыз",
                  )
                : phase === "answer"
                  ? at(
                      "2. Что вы ответите?",
                      "2. How will you reply?",
                      "2. Қалай жауап бересіз?",
                    )
                  : at(
                      "3. Разберём ваш ответ",
                      "3. Review your reply",
                      "3. Жауабыңызды талдайық",
                    )}
            </h2>
            {phase === "watch" ? (
              <>
                <p className="dialogue-instruction">
                  {at(
                    "Посмотрите показ аватара, затем выберите ответ собеседнику.",
                    "Watch the avatar, then choose your reply.",
                    "«Ымды көру» батырмасын басыңыз. Сөздерді ауыстырып, жауапқа өтіңіз. Бейнелер осы жағдайға арналған жеке сөздерді көрсетеді.",
                  )}
                </p>
                <div className="dialogue-watch-layout">
                  <div className="activity-signs">
                    <div
                      className="activity-word-tabs"
                      role="group"
                      aria-label={at(
                        "Слова для этой реплики",
                        "Words for this turn",
                        "Осы репликаға арналған сөздер",
                      )}
                    >
                      <button
                        aria-pressed={wordIndex === -1}
                        onClick={() => setWordIndex(-1)}
                      >
                        {at("Все жесты", "All signs", "Барлық ымдар")}
                      </button>
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
                    <AvatarStudy
                      text={
                        wordIndex === -1
                          ? signs.map((sign) => sign.label).join(" ")
                          : signs[wordIndex]?.label || step.avatar
                      }
                      data={data}
                    />
                    {signs.length > 1 && wordIndex >= 0 && (
                      <div className="dialogue-word-navigation">
                        <span>
                          {at(
                            `Жест ${wordIndex + 1} из ${signs.length}`,
                            `Sign ${wordIndex + 1} of ${signs.length}`,
                            `${signs.length} ымның ${wordIndex + 1}-і`,
                          )}
                        </span>
                        <button
                          className="sign-link-button"
                          onClick={() =>
                            setWordIndex((i) => (i + 1) % signs.length)
                          }
                        >
                          {wordIndex === signs.length - 1
                            ? at(
                                "К первому жесту",
                                "Back to first sign",
                                "Бірінші ымға",
                              )
                            : at(
                                "Следующий жест",
                                "Next sign",
                                "Келесі ым",
                              )}{" "}
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="dialogue-task-note">
                    <h3>{at("Ваша задача", "Your task", "Тапсырмаңыз")}</h3>
                    <p>
                      {at(
                        "После показа выберите один из трёх ответов.",
                        "After watching, choose one of three replies.",
                        "Сұраққа сәйкес жауапты ойлаңыз. Келесі қадамда үш нұсқадан бірін таңдаңыз.",
                      )}
                    </p>
                    <button
                      className="button primary"
                      onClick={() => setPhase("answer")}
                    >
                      {at("Перейти к ответу", "Choose my reply", "Жауапқа өту")}{" "}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="dialogue-response-context">
                  <span>
                    {at("Отвечаем на вопрос", "Replying to", "Сұраққа жауап")}:{" "}
                    <strong>{step.prompt}</strong>
                  </span>
                  <button
                    className="sign-link-button"
                    onClick={() => setPhase("watch")}
                  >
                    {at(
                      "Посмотреть жесты ещё раз",
                      "Review the signs",
                      "Ымдарды қайта қарау",
                    )}
                  </button>
                </div>
                {phase === "answer" ? (
                  <>
                    <fieldset className="activity-options">
                      <legend>
                        {at(
                          "Выберите одну реплику",
                          "Choose one reply",
                          "Бір жауап таңдаңыз",
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
                            onChange={() => setSelected(c.id)}
                          />
                          {c.text}
                        </label>
                      ))}
                    </fieldset>
                    <button
                      className="button primary"
                      disabled={!choice}
                      onClick={submit}
                    >
                      {at(
                        "Проверить мой ответ",
                        "Check my reply",
                        "Жауабымды тексеру",
                      )}{" "}
                      <ArrowRight size={17} />
                    </button>
                    {!choice && (
                      <p className="activity-hint">
                        {at(
                          "Сначала нажмите на один из вариантов выше.",
                          "First select one of the options above.",
                          "Алдымен жоғарыдағы нұсқаның бірін таңдаңыз.",
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <div
                    className={`activity-feedback ${choice?.accepted ? "correct" : "review"}`}
                  >
                    <strong>
                      {choice?.accepted
                        ? at(
                            "Ответ подходит к ситуации",
                            "This reply fits",
                            "Жауап жағдайға сәйкес",
                          )
                        : at(
                            "Попробуем по-другому",
                            "Let’s try another reply",
                            "Басқа жауапты көрейік",
                          )}
                    </strong>
                    <p>
                      {at("Вы выбрали", "You chose", "Таңдағаныңыз")}:{" "}
                      <b>{choice?.text}</b>
                    </p>
                    <p>{choice?.feedback}</p>
                    {choice?.accepted ? (
                      <>
                        <button className="button primary" onClick={next}>
                          {choice.next
                            ? at(
                                "К следующей реплике",
                                "Next turn",
                                "Келесі репликаға",
                              )
                            : at(
                                "Посмотреть итог диалога",
                                "View dialogue results",
                                "Диалог қорытындысы",
                              )}{" "}
                          <ArrowRight size={17} />
                        </button>
                        {choice.example && (
                          <Link
                            className="sign-back"
                            to={`/text-to-sign?text=${encodeURIComponent(choice.example)}`}
                          >
                            {at(
                              "Дополнительно: посмотреть жесты ответа",
                              "Optional: explore reply vocabulary",
                              "Қосымша: жауап ымдарын қарау",
                            )}{" "}
                            <ArrowRight size={16} />
                          </Link>
                        )}
                      </>
                    ) : (
                      <button
                        className="button primary"
                        onClick={() => {
                          setSelected(null);
                          setPhase("answer");
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
              </>
            )}
          </section>
          {history.length > 0 && (
            <details className="activity-transcript">
              <summary>
                {at("Наш разговор", "Our conversation", "Біздің әңгіме")}
              </summary>
              {history.map((h) => (
                <p key={h.item}>
                  <strong>{h.prompt}</strong>
                  <br />
                  {h.reply}
                </p>
              ))}
            </details>
          )}
        </>
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
        <section className="panel activity-result" data-workspace-enter>
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
    [watched, setWatched] = useState(false),
    [playError, setPlayError] = useState(""),
    [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const correct = selected === answer.id;
  function check(skip = false) {
    if (submitted || !watched || failed || (!selected && !skip)) return;
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
            onPlaying={() => {
              setWatched(true);
              setReady(true);
              setPlayError("");
            }}
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
          ) : (
            <div className="activity-actions">
              <button
                className="button secondary"
                onClick={() => {
                  if (video.current) {
                    video.current.currentTime = 0;
                    void video.current
                      .play()
                      .catch(() =>
                        setPlayError(
                          at(
                            "Не удалось начать просмотр. Нажмите ▶ на самом видео или попробуйте снова.",
                            "Could not play. Press ▶ on the video or retry.",
                            "Бейне ойнатылмады. Бейнедегі ▶ батырмасын басыңыз.",
                          ),
                        ),
                      );
                  }
                }}
              >
                <RotateCcw size={16} />
                {watched
                  ? at("Посмотреть ещё раз", "Watch again", "Қайта қарау")
                  : at("Смотреть жест", "Watch sign", "Ымды көру")}
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
          {playError && <p role="alert">{playError}</p>}
          {!ready && !failed && (
            <p role="status">
              {at(
                "Нажмите «Смотреть жест», чтобы начать.",
                "Press Watch sign to begin.",
                "Бастау үшін «Ымды көру» батырмасын басыңыз.",
              )}
            </p>
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
                  disabled={!selected || !watched || failed}
                  onClick={() => check()}
                >
                  {at("Проверить ответ", "Check answer", "Жауапты тексеру")}
                </button>
                <button
                  className="button secondary"
                  disabled={!watched || failed}
                  onClick={() => check(true)}
                >
                  {at("Не знаю", "I do not know", "Білмеймін")}
                </button>
              </div>
              {!selected && (
                <p className="activity-hint">
                  {at(
                    "Сначала посмотрите жест, затем выберите значение.",
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
