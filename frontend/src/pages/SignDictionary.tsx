import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, BookOpen, Play, ArrowRight } from "lucide-react";
import { at } from "../i18n/automation";
import {
  alphabetEntries,
  type DictionaryEntry,
  type DictionaryForms,
} from "../sign/dictionary";
import { planMotion, type MotionAsset } from "../sign/motion";
import { SignSequencePlayer } from "../components/SignSequencePlayer";
import { exercises } from "../sign/exercises";
import "./sign-dictionary.css";
import { ReferenceVideo } from "../components/SignReferenceVideo";
import { phraseArt } from "../sign/phraseArt";
import { phraseGroups } from "../sign/phraseExamples";
import { alphabetIllustration } from "../sign/alphabetIllustrations";
import { AlphabetCardArt } from "../components/AlphabetCardArt";
import { SignActionCards } from "../components/SignActionCards";
const emptyMotionPlan = { steps: [], missing: [], spelling: false };
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
        : params.get("tab") === "phrases"
          ? "phrases"
          : "text";
  const setTab = (next: "text" | "phrases" | "dictionary" | "grammar") =>
    setParams(next === "text" ? {} : { tab: next });
  const [motions, setMotions] = useState<MotionAsset[]>([]);
  const [phraseGroup, setPhraseGroup] = useState(0);
  const [run, setRun] = useState(0);
  const sequenceRef = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState<DictionaryEntry[]>([]),
    [forms, setForms] = useState<DictionaryForms>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [text, setText] = useState(() =>
      (params.get("text") || "").slice(0, 500),
    ),
    [submitted, setSubmitted] = useState(""),
    [spelling, setSpelling] = useState(false),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("Все"),
    [selected, setSelected] = useState<DictionaryEntry | null>(null),
    [page, setPage] = useState(1),
    [message, setMessage] = useState("");

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
      fetch("/avatars/sign-motion/catalog.json", { signal: abort.signal }).then(
        (r) => {
          if (!r.ok) throw Error();
          return r.json();
        },
      ),
    ])
      .then(([w, f, m]) => {
        setMotions(m);
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
  const motionPlan = useMemo(
    () => planMotion(submitted, entries, forms, motions, spelling),
    [submitted, entries, forms, motions, spelling],
  );
  const selectedPlan = useMemo(
    () =>
      selected
        ? planMotion(
            selected.label,
            entries,
            forms,
            motions,
            selected.category === "Алфавит",
          )
        : null,
    [selected, entries, forms, motions],
  );
  const visible = entries.filter(
    (e) =>
      (category === "Все" || e.category === category) &&
      e.label.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")),
  );
  const categories = ["Все", ...new Set(entries.map((e) => e.category))];
  function choose(entry: DictionaryEntry) {
    setSelected(entry);
    setRun((v) => v + 1);
    requestAnimationFrame(() =>
      sequenceRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
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
    setRun((v) => v + 1);
    setSelected(null);
    requestAnimationFrame(() =>
      sequenceRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    );
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
              "Введите фразу — аватар покажет доступные жесты подряд. Или выберите слово в словаре.",
              "Enter a phrase to play available signs in sequence, or choose a dictionary entry.",
              "Сөйлем енгізіңіз — аватар қолжетімді ымдарды ретімен көрсетеді. Немесе сөздіктен сөз таңдаңыз.",
            )}
          </p>
        </div>
      </div>
      <SignActionCards
        label={at(
          "Что хотите сделать?",
          "What would you like to do?",
          "Не істегіңіз келеді?",
        )}
        value={tab}
        onChange={(next) => {
          if (next === "text" || next === "phrases" || next === "dictionary") {
            setTab(next);
            setSelected(null);
            setSubmitted("");
          }
        }}
        items={[
          {
            id: "text",
            title: at("Написать текст", "Write text", "Мәтін жазу"),
            description: at(
              "Слово или имя → показ аватара",
              "A word or name → avatar demonstration",
              "Сөз не есім → аватар көрсетілімі",
            ),
            tag: at("Ваш вариант", "Your choice", "Өз нұсқаңыз"),
          },
          {
            id: "phrases",
            title: at("Выбрать фразу", "Choose a phrase", "Сөйлем таңдау"),
            description: at(
              "Готовые примеры для тренировки",
              "Ready examples to practice",
              "Жаттығуға дайын мысалдар",
            ),
            tag: at("32 примера", "32 examples", "32 мысал"),
          },
          {
            id: "dictionary",
            title: at("Найти жест", "Find a sign", "Ым табу"),
            description: at(
              "Буквы и слова по темам",
              "Letters and words by topic",
              "Тақырып бойынша әріптер мен сөздер",
            ),
            tag: at("А–Я · словарь", "А–Я · dictionary", "А–Я · сөздік"),
          },
        ]}
      />
      <div className="sign-workspace-meta">
        <span>
          33 {at("буквы", "letters", "әріп")} · {words.length || "…"}{" "}
          {at("слов и выражений", "words and expressions", "сөз бен тіркес")}
        </span>
        <button
          className="sign-help-link"
          aria-pressed={tab === "grammar"}
          onClick={() => setTab("grammar")}
        >
          <BookOpen size={16} />
          {at("Как устроен РЖЯ", "How RSL works", "Ым тілінің құрылысы")}
        </button>
      </div>
      {loading && (
        <p role="status">
          {at("Загружаем словарь…", "Loading dictionary…", "Сөздік жүктелуде…")}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {tab === "text" && (
        <>
          <section className="panel sign-text-editor" data-workspace-enter>
            <div className="sign-editor-title">
              <span className="sign-step-number">01</span>
              <div>
                <h2>
                  {at(
                    "Что покажет аватар?",
                    "What should the avatar show?",
                    "Аватар нені көрсетеді?",
                  )}
                </h2>
                <p>
                  {at(
                    "Введите текст, затем нажмите «Показать аватаром».",
                    "Enter text, then select Show with avatar.",
                    "Мәтінді енгізіп, «Аватармен көрсету» түймесін басыңыз.",
                  )}
                </p>
              </div>
            </div>
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
                setMessage("");
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
                  "Имя по буквам (не перевод фразы)",
                  "Spell a name (not phrase translation)",
                  "Есімді әріптеу (сөйлем аудармасы емес)",
                )}
              </label>
              <span>{text.length}/500</span>
              <button
                className="button primary"
                disabled={loading || !!error}
                onClick={analyse}
              >
                <Search size={17} />
                {at(
                  "Показать аватаром",
                  "Show with avatar",
                  "Аватармен көрсету",
                )}
              </button>
            </div>
            <details className="sign-letter-picker">
              <summary>
                {at(
                  "Выбрать букву · А–Я",
                  "Choose a letter · А–Я",
                  "Әріпті таңдау · А–Я",
                )}
              </summary>
              <div
                className="sign-examples"
                aria-label={at("Алфавит", "Alphabet", "Әліпби")}
              >
                {alphabetEntries().map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => choose(entry)}
                    aria-pressed={selected?.id === entry.id}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </details>
            <p className="sign-input-hint">
              {at(
                "Одна буква распознаётся автоматически. Для целого имени включите показ по буквам.",
                "A single letter is selected automatically. For a whole name, enable spelling.",
                "Бір әріп автоматты таңдалады. Толық есім үшін әріптеуді қосыңыз.",
              )}
            </p>
            {message && <p role="status">{message}</p>}
            <div className="sign-workflow-hint">
              <span>01 · {at("Ваш текст", "Your text", "Мәтініңіз")}</span>
              <ArrowRight size={16} />
              <span>
                02 ·{" "}
                {at(
                  "Показ аватара",
                  "Avatar demonstration",
                  "Аватар көрсетілімі",
                )}
              </span>
              <ArrowRight size={16} />
              <span>
                03 · {at("Повторите жест", "Repeat the sign", "Ымды қайталау")}
              </span>
            </div>
          </section>
        </>
      )}
      {tab === "phrases" && (
        <section className="panel sign-phrase-workspace" data-workspace-enter>
          <div className="sign-phrase-library">
            <label htmlFor="phrase-topic">
              {at(
                "Готовые фразы · 32 примера",
                "Ready phrases · 32 examples",
                "Дайын сөйлемдер · 32 мысал",
              )}
            </label>
            <select
              id="phrase-topic"
              value={phraseGroup}
              onChange={(e) => setPhraseGroup(Number(e.target.value))}
            >
              {phraseGroups.map((group, i) => (
                <option key={group.title[0]} value={i}>
                  {at(group.title[0], group.title[1], group.title[2])}
                </option>
              ))}
            </select>
            <p>
              {at(
                "Нажмите на карточку, чтобы открыть показ. Картинки — обложки по теме, а не точные образцы жестов. Показы составлены из доступных слов.",
                "Select a card to open its demonstration. Pictures are thematic covers, not exact sign references. Demonstrations combine available word signs.",
                "Көрсетілім үшін карточканы таңдаңыз. Суреттер — тақырыптық мұқабалар, нақты ым үлгілері емес. Көрсетілімдер қолжетімді сөздерден құралады.",
              )}
            </p>
          </div>
          <div className="sign-phrase-tiles">
            {phraseGroups[phraseGroup].phrases.map((v) => (
              <button
                key={v}
                disabled={loading || !!error}
                onClick={() => {
                  setText(v);
                  setSubmitted(v);
                  setSpelling(false);
                  setRun((n) => n + 1);
                  setSelected(null);
                  requestAnimationFrame(() =>
                    sequenceRef.current?.scrollIntoView({
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "auto"
                        : "smooth",
                      block: "start",
                    }),
                  );
                }}
              >
                <span className="sign-phrase-cover">
                  <img
                    src={phraseArt(v)}
                    alt=""
                    loading="lazy"
                    width="800"
                    height="533"
                  />
                  <span className="sign-phrase-play">
                    <Play size={18} aria-hidden="true" />
                  </span>
                </span>
                <span className="sign-phrase-caption">
                  <strong>{v}</strong>
                  <span>
                    {at("Смотреть показ", "Watch signs", "Көрсетілімді қарау")}
                    <ArrowRight size={16} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {tab !== "grammar" && !!(selected || submitted) && (
        <div ref={sequenceRef} className="sign-dictionary-result">
          <SignSequencePlayer
            key={`${tab}-${run}-${spelling}-${selected?.id ?? submitted}`}
            plan={
              selectedPlan ??
              (tab === "text" || tab === "phrases"
                ? motionPlan
                : emptyMotionPlan)
            }
            autoPlay={
              !!(
                selected ||
                ((tab === "text" || tab === "phrases") && submitted)
              )
            }
          />
          {(((tab === "text" || tab === "phrases") && submitted) ||
            selected) && (
            <details className="sign-dictionary-reference">
              <summary>
                {at(
                  "Что входит в показ",
                  "What is included",
                  "Көрсетілім құрамы",
                )}
              </summary>
              <p>
                {at(
                  "Слова, для которых есть движения, показываются последовательно. Неизвестные слова не пропускаются. Это пробный показ слов, а не проверенный перевод предложения на РЖЯ.",
                  "Available signs play in sequence. Unknown words are never silently skipped. This is an experimental sign sequence, not a verified sentence translation into RSL.",
                  "Қолжетімді ымдар ретімен көрсетіледі. Белгісіз сөздер түсіп қалмайды. Бұл — сынақ көрсетілімі, сөйлемнің тексерілген аудармасы емес.",
                )}
              </p>
            </details>
          )}
        </div>
      )}
      <div className="sign-dictionary-result">
        {selected && (
          <>
            <details
              className="sign-dictionary-reference"
              open={!selectedPlan?.steps.length}
            >
              <summary>
                {at(
                  "Сравнить с видео человека",
                  "Compare with the human reference",
                  "Адамның бейнесімен салыстыру",
                )}
              </summary>
              <ReferenceVideo key={selected.id} entry={selected} />
            </details>
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
                {e.category === "Алфавит" && alphabetIllustration(e.label) ? (
                  <AlphabetCardArt letter={e.label} />
                ) : motions.some((m) => m.id === e.id) ? (
                  <img
                    className="sign-avatar-cover"
                    src="/avatars/sign-motion/preview.png"
                    alt=""
                    loading="lazy"
                  />
                ) : e.poster ? (
                  <img src={e.poster} alt="" loading="lazy" />
                ) : (
                  <span className="sign-letter-cover">{e.label}</span>
                )}
                <strong>{e.label}</strong>
                <small>{categoryName(e.category)}</small>
                <span>
                  <Play size={14} />
                  {motions.some((m) => m.id === e.id)
                    ? at(
                        "Показать аватаром",
                        "Show with avatar",
                        "Аватармен көрсету",
                      )
                    : at("Видеообразец", "Video reference", "Бейнеүлгі")}
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
