import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, BookOpen, Play, ArrowRight } from "lucide-react";
import { at } from "../i18n/automation";
import {
  alphabetEntries,
  decomposeText,
  type DictionaryEntry,
  type DictionaryForms,
} from "../sign/dictionary";
import { planText } from "../sign/textPlan";
import { exercises } from "../sign/exercises";
import { ExercisePlayer } from "./SignTrainer";
import "./sign-dictionary.css";
import { ReferenceVideo } from "../components/SignReferenceVideo";
const categoryTranslations: Record<string, [string, string]> = {
  Алфавит: ["Alphabet", "Әліпби"],
  Общение: ["Communication", "Қарым-қатынас"],
  "Семья и люди": ["Family and people", "Отбасы және адамдар"],
  Учёба: ["Learning", "Оқу"],
  "Каждый день": ["Daily life", "Күнделікті өмір"],
  Время: ["Time", "Уақыт"],
  Числа: ["Numbers", "Сандар"],
  Описание: ["Descriptions", "Сипаттау"],
  "Цвета и животные": ["Colours and animals", "Түстер мен жануарлар"],
};
const categoryName = (c: string) =>
  at(c, categoryTranslations[c]?.[0] ?? c, categoryTranslations[c]?.[1] ?? c);
export function SignDictionaryPage() {
  const [params, setParams] = useSearchParams();
  const tab =
    params.get("tab") === "dictionary"
      ? "dictionary"
      : params.get("tab") === "grammar"
        ? "grammar"
        : "text";
  const setTab = (next: "text" | "dictionary" | "grammar") =>
    setParams(next === "text" ? {} : { tab: next });
  const [words, setWords] = useState<DictionaryEntry[]>([]),
    [forms, setForms] = useState<DictionaryForms>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [text, setText] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [spelling, setSpelling] = useState(false),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("Все"),
    [selected, setSelected] = useState<DictionaryEntry | null>(null),
    [page, setPage] = useState(1),
    [message, setMessage] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      fetch("/research/rsl/words/catalog.json", { signal: abort.signal }).then(
        (r) => {
          if (!r.ok) throw Error();
          return r.json();
        },
      ),
      fetch("/research/rsl/words/forms.json", { signal: abort.signal }).then(
        (r) => {
          if (!r.ok) throw Error();
          return r.json();
        },
      ),
    ])
      .then(([w, f]) => {
        setWords(w);
        setForms(f);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            at(
              "Не удалось загрузить словарь. Обновите страницу.",
              "Could not load dictionary. Refresh the page.",
              "Сөздік жүктелмеді. Бетті жаңартыңыз.",
            ),
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, []);
  const entries = useMemo(() => [...alphabetEntries(), ...words], [words]);
  const pieces = useMemo(
    () => decomposeText(submitted, entries, forms, spelling),
    [submitted, entries, forms, spelling],
  );
  const prepared = !spelling ? planText(submitted) : null;
  const readyExercise = prepared?.ok
    ? exercises().find(
        (e) =>
          e.id ===
          (prepared.animation === "name-demo" ? "name" : prepared.animation),
      )
    : undefined;
  const visible = entries.filter(
    (e) =>
      (category === "Все" || e.category === category) &&
      e.label.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")),
  );
  const categories = ["Все", ...new Set(entries.map((e) => e.category))];
  function choose(entry: DictionaryEntry) {
    setSelected(entry);
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function analyse() {
    if (!text.trim()) {
      setMessage(
        at(
          "Введите слово, имя или предложение.",
          "Enter a word, name or sentence.",
          "Сөз, есім не сөйлем енгізіңіз.",
        ),
      );
      return;
    }
    if (Array.from(text).length > 500) {
      setMessage(
        at(
          "Не больше 500 символов.",
          "Maximum 500 characters.",
          "500 таңбадан артық емес.",
        ),
      );
      return;
    }
    setMessage("");
    setSubmitted(text);
    setSelected(null);
  }
  return (
    <div className="sign-workspace sign-dictionary">
      <div className="page-heading">
        <div>
          <h1>
            {at(
              "Текст и словарь жестов",
              "Text and sign dictionary",
              "Мәтін және ым сөздігі",
            )}
          </h1>
          <p>
            {at(
              "Найдите жест, разберите текст по словам или посмотрите имя по буквам.",
              "Find a sign, break text into words or view a name letter by letter.",
              "Ымды табыңыз, мәтінді сөздерге бөліңіз не есімді әріптеп қараңыз.",
            )}
          </p>
        </div>
      </div>
      <nav
        className="sign-training-levels"
        aria-label={at(
          "Разделы словаря",
          "Dictionary sections",
          "Сөздік бөлімдері",
        )}
      >
        {(["text", "dictionary", "grammar"] as const).map((v, i) => (
          <button
            key={v}
            aria-pressed={tab === v}
            onClick={() => {
              setTab(v);
              setSelected(null);
            }}
          >
            {
              [
                at(
                  "Текст → показы",
                  "Text → demonstrations",
                  "Мәтін → көрсетілімдер",
                ),
                at("Словарь", "Dictionary", "Сөздік"),
                at("Как устроен РЖЯ", "How RSL works", "Ым тілінің құрылысы"),
              ][i]
            }
          </button>
        ))}
      </nav>
      <p className="sign-dictionary-count">
        33 {at("буквы", "letters", "әріп")} · {words.length || "…"}{" "}
        {at(
          "слов и выражений с видео",
          "words and expressions with videos",
          "сөз бен тіркестің бейнесі",
        )}{" "}
        ·{" "}
        {at(
          "10 пробных 3D-показов",
          "10 trial 3D demonstrations",
          "10 сынақ 3D көрсетілімі",
        )}
      </p>
      {loading && (
        <p role="status">
          {at("Загружаем словарь…", "Loading dictionary…", "Сөздік жүктелуде…")}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {tab === "text" && (
        <>
          <section className="panel sign-text-editor">
            <label htmlFor="dictionary-text">
              {at(
                "Ваш текст на русском",
                "Your text in Russian",
                "Орыс тіліндегі мәтініңіз",
              )}
            </label>
            <textarea
              id="dictionary-text"
              value={text}
              maxLength={500}
              rows={3}
              onChange={(e) => {
                setText(e.target.value);
                setSubmitted("");
                setSelected(null);
              }}
              placeholder={at(
                "Например: Я хочу читать книгу",
                "For example: Я хочу читать книгу",
                "Мысалы: Я хочу читать книгу",
              )}
            />
            <div className="sign-reference-controls">
              <label>
                <input
                  type="checkbox"
                  checked={spelling}
                  onChange={(e) => {
                    setSpelling(e.target.checked);
                    setSelected(null);
                  }}
                />
                {at(
                  "Показать по буквам",
                  "Show letter by letter",
                  "Әріптеп көрсету",
                )}
              </label>
              <span>{text.length}/500</span>
              <button
                className="button primary"
                disabled={loading || !!error}
                onClick={analyse}
              >
                <Search size={17} />
                {at("Разобрать текст", "Analyse text", "Мәтінді талдау")}
              </button>
            </div>
            <div className="sign-examples">
              {[
                "Как тебя зовут?",
                "Спасибо",
                "Я хочу читать книгу",
                "Сегодня мы идём в школу",
              ].map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setText(v);
                    setSubmitted("");
                    setSelected(null);
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            {message && <p role="status">{message}</p>}
          </section>
          {submitted && (
            <section className="panel sign-text-analysis">
              <h2>
                {readyExercise
                  ? at(
                      "Подготовленный показ",
                      "Prepared demonstration",
                      "Дайын көрсетілім",
                    )
                  : spelling
                    ? at(
                        "Дактиль по буквам",
                        "Fingerspelling",
                        "Әріптеп көрсету",
                      )
                    : at(
                        "Словарный разбор",
                        "Dictionary breakdown",
                        "Сөздік бойынша талдау",
                      )}
              </h2>
              <p>
                {spelling
                  ? at(
                      "Это буквенная запись. Она полезна для имён, но не заменяет перевод предложения на РЖЯ.",
                      "This spells letters. Useful for names, but not a sentence translation into RSL.",
                      "Бұл — әріптік жазба. Есімдерге пайдалы, бірақ сөйлемнің ым тіліне аудармасы емес.",
                    )
                  : readyExercise
                    ? at(
                        "Для этого текста уже есть отдельная пробная анимация.",
                        "A trial animation exists for this exact text.",
                        "Осы мәтінге жеке сынақ анимациясы бар.",
                      )
                    : at(
                        "Слова идут в порядке русского текста. Это учебный разбор, а не готовый перевод с грамматикой РЖЯ. Нажмите на слово, чтобы увидеть образец.",
                        "Words retain Russian text order. This is a learning breakdown, not a grammatical RSL translation. Select a word to view its reference.",
                        "Сөздер орысша мәтін ретімен берілген. Бұл — оқу талдауы, ым тілі грамматикасымен дайын аударма емес. Үлгіні көру үшін сөзді таңдаңыз.",
                      )}
              </p>
              {!readyExercise && (
                <div className="sign-token-list">
                  {pieces.map((p, i) =>
                    p.punctuation ? (
                      <span key={i}>{p.text}</span>
                    ) : (
                      <button
                        key={i}
                        disabled={!p.entry}
                        className={p.entry ? "known" : "unknown"}
                        onClick={() => p.entry && choose(p.entry)}
                      >
                        <b>{p.text}</b>
                        <small>
                          {p.inflected
                            ? `→ ${p.entry!.label}`
                            : p.entry
                              ? at("Смотреть", "Watch", "Көру")
                              : p.ambiguous
                                ? at(
                                    "Несколько значений",
                                    "Ambiguous",
                                    "Бірнеше мағына",
                                  )
                                : at(
                                    "Пока нет в словаре",
                                    "Not in dictionary yet",
                                    "Сөздікте әзірге жоқ",
                                  )}
                        </small>
                      </button>
                    ),
                  )}
                </div>
              )}
              {readyExercise && (
                <ExercisePlayer
                  key={readyExercise.id}
                  exercise={readyExercise}
                />
              )}
            </section>
          )}
        </>
      )}
      {tab === "dictionary" && (
        <>
          <div className="sign-dictionary-filter">
            <label>
              <Search size={18} />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={at(
                  "Найти слово или букву",
                  "Find a word or letter",
                  "Сөз не әріпті табу",
                )}
                aria-label={at(
                  "Поиск по словарю",
                  "Search dictionary",
                  "Сөздіктен іздеу",
                )}
              />
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              aria-label={at(
                "Тема словаря",
                "Dictionary topic",
                "Сөздік тақырыбы",
              )}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "Все"
                    ? at("Все темы", "All topics", "Барлық тақырып")
                    : categoryName(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="sign-dictionary-grid">
            {visible.slice(0, page * 24).map((e) => (
              <button
                className="panel sign-word-card"
                key={e.id}
                onClick={() => choose(e)}
              >
                {e.poster ? (
                  <img src={e.poster} alt="" loading="lazy" />
                ) : (
                  <span className="sign-letter-cover">{e.label}</span>
                )}
                <strong>{e.label}</strong>
                <small>{categoryName(e.category)}</small>
                <span>
                  <Play size={14} />
                  {at("Смотреть образец", "Watch reference", "Үлгіні көру")}
                </span>
              </button>
            ))}
          </div>
          {!visible.length && !loading && (
            <p role="status">
              {at(
                "Такого слова пока нет. Попробуйте другую форму или другую тему.",
                "No match yet. Try another form or topic.",
                "Әзірге табылмады. Басқа тұлға не тақырыпты қолданыңыз.",
              )}
            </p>
          )}
          {visible.length > page * 24 && (
            <button
              className="button secondary"
              onClick={() => setPage((p) => p + 1)}
            >
              {at("Показать ещё", "Show more", "Тағы көрсету")}
            </button>
          )}
        </>
      )}
      {tab === "grammar" && <GrammarGuide />}
      <div ref={resultRef} className="sign-dictionary-result">
        {selected && (
          <>
            <ReferenceVideo key={selected.id} entry={selected} />
            {selected.category === "Алфавит" && (
              <Link
                className="button secondary"
                to={`/practice?exercise=${exercises().find((e) => e.letter === selected.label)?.id}`}
              >
                <ArrowRight size={17} />
                {at(
                  "Повторить и проверить ИИ",
                  "Practise with AI",
                  "ЖИ арқылы жаттығу",
                )}
              </Link>
            )}
            <p>
              {at(
                "Образец из исследовательского набора; для учебной программы нужна проверка преподавателя РЖЯ.",
                "Research dataset reference; a teaching curriculum needs review by an RSL educator.",
                "Зерттеу деректеріндегі үлгі; оқу бағдарламасын ым тілі мұғалімі тексеруі қажет.",
              )}
            </p>
          </>
        )}
      </div>
      <p className="sign-catalog-note">
        <a
          href="/research/rsl/words/ATTRIBUTION.txt"
          target="_blank"
          rel="noreferrer"
        >
          Slovo ·{" "}
          {at(
            "авторы и лицензия",
            "credits and license",
            "авторлар мен лицензия",
          )}
        </a>{" "}
        ·{" "}
        <a
          href="/research/rsl/ATTRIBUTION.txt"
          target="_blank"
          rel="noreferrer"
        >
          Bukva
        </a>
      </p>
    </div>
  );
}
function GrammarGuide() {
  return (
    <section className="sign-grammar">
      <div className="panel">
        <BookOpen />
        <h2>
          {at(
            "РЖЯ — самостоятельный язык",
            "RSL is a language in its own right",
            "Ым тілі — дербес тіл",
          )}
        </h2>
        <p>
          {at(
            "Переставить русские слова и показать их руками недостаточно. Значение передают форма кисти, место, направление и движение, а также лицо и корпус.",
            "Reordering Russian words and signing them is not enough. Hand shape, location, orientation, motion, face and torso carry meaning.",
            "Орыс сөздерінің орнын ауыстырып, қолмен көрсету жеткіліксіз. Мағынаны қол пішіні, орны, бағыты, қимылы, бет пен дене жеткізеді.",
          )}
        </p>
      </div>
      {[
        [
          at(
            "Буквы и слова — разные упражнения",
            "Letters and words are different tasks",
            "Әріп пен сөз — бөлек жаттығу",
          ),
          at(
            "Дактиль передаёт буквенную запись. У многих слов есть собственные жесты. Начните с коротких имён, затем изучайте слова по видео.",
            "Fingerspelling represents written letters. Many words have lexical signs. Start with short names, then learn words from videos.",
            "Дактиль әріптік жазбаны береді. Көп сөздің жеке ымы бар. Қысқа есімнен бастап, сөздерді бейнемен үйреніңіз.",
          ),
        ],
        [
          at(
            "Смотрите на лицо и тело",
            "Watch the face and body",
            "Бет пен денеге қараңыз",
          ),
          at(
            "Наблюдайте за бровями, взглядом, ртом и наклоном головы вместе с руками. Наша модель букв эти признаки не проверяет.",
            "Observe eyebrows, gaze, mouth and head position alongside the hands. Our letter model does not assess these features.",
            "Қолмен бірге қас, көзқарас, ауыз және бас қалпын бақылаңыз. Біздің әріп моделі бұл белгілерді тексермейді.",
          ),
        ],
        [
          at(
            "Разбирайте целую фразу",
            "Study the whole phrase",
            "Толық сөйлемді талдаңыз",
          ),
          at(
            "Для грамматики нужны образцы целых высказываний с контекстом. Нет одного правила перестановки слов, которое переводит любые предложения.",
            "Grammar needs complete utterances in context. No single word-order rule translates every sentence.",
            "Грамматика үшін контексті бар тұтас сөйлемдер қажет. Кез келген сөйлемді аударатын жалғыз сөз реті ережесі жоқ.",
          ),
        ],
      ].map(([title, body]) => (
        <article className="panel" key={title}>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
      <p>
        {at(
          "Материалы для дальнейшего изучения:",
          "Further reading:",
          "Қосымша материалдар:",
        )}{" "}
        <a
          href="https://minlang.iling-ran.ru/en/lang/russian-sign-language"
          target="_blank"
          rel="noreferrer"
        >
          {at(
            "Институт языкознания РАН — РЖЯ",
            "Institute of Linguistics — RSL",
            "Тіл білімі институты — ым тілі",
          )}
        </a>
        ;{" "}
        <a
          href="https://krslproject.github.io/FluentSigners-50/"
          target="_blank"
          rel="noreferrer"
        >
          FluentSigners-50
        </a>
        .{" "}
        {at(
          "FluentSigners-50 содержит казахско-русский жестовый язык; региональные варианты нельзя автоматически считать одинаковыми.",
          "FluentSigners-50 contains Kazakh-Russian signing; regional variants should not automatically be treated as identical.",
          "FluentSigners-50 қазақ-орыс ым тілін қамтиды; аймақтық нұсқалар автоматты түрде бірдей саналмайды.",
        )}
      </p>
    </section>
  );
}
