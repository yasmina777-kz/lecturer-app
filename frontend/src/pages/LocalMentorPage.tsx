import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Cpu,
  LoaderCircle,
  Pause,
  Play,
  Send,
  Upload,
} from "lucide-react";
import { AvatarPlayer } from "../components/AvatarPlayer";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { useNarrator, type SpeechPosition } from "../hooks/useNarrator";
import { at } from "../i18n/automation";
import { useLocalMentor, localError } from "../local-ai/useLocalMentor";
import { fractionSources, fractionChecks } from "../local-ai/fractions";
import {
  splitSources,
  type LocalAnswer,
  type StudySource,
} from "../local-ai/retrieval";
import type { Language } from "../types/auth";
import "./local-mentor.css";
export function LocalMentorPage() {
  const engine = useLocalMentor();
  const [sources, setSources] = useState<StudySource[]>(fractionSources);
  const [custom, setCustom] = useState(false);
  const [material, setMaterial] = useState("");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState<LocalAnswer>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number>();
  const [language, setLanguage] = useState<Language>("ru");
  const narrator = useNarrator(1, language, "female", "device");
  const saved = useRef<SpeechPosition>();
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  const busy = !!engine.progress;
  const check =
    !custom && answer?.source
      ? fractionChecks[answer.source.id.split(":")[0]]
      : undefined;
  function clear() {
    revision.current++;
    engine.cancel();
    narrator.cancel();
    saved.current = undefined;
    setAnswer(undefined);
    setSelected(undefined);
    setError("");
    setAsked("");
  }
  async function ask(value: string) {
    if (busy || !value.trim()) return;
    narrator.cancel();
    saved.current = undefined;
    setSelected(undefined);
    setAnswer(undefined);
    setError("");
    setAsked(value);
    setQuestion(value);
    const version = ++revision.current;
    try {
      const result = await engine.ask(value, sources);
      if (version === revision.current) setAnswer(result);
    } catch (e) {
      if (version === revision.current) setError(localError(e));
    }
  }
  function applyMaterial() {
    if (material.trim().length < 80) {
      setError(
        at(
          "Добавьте хотя бы один абзац учебного текста.",
          "Add at least one paragraph of learning material.",
          "Оқу мәтінінен кемінде бір абзац қосыңыз.",
        ),
      );
      return;
    }
    try {
      const next = splitSources(
        material
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((text, i) => ({
            id: `material-${i}`,
            title: at(
              `Мой материал · раздел ${i + 1}`,
              `My material · section ${i + 1}`,
              `Менің материалым · ${i + 1}-бөлім`,
            ),
            text,
          })),
      );
      clear();
      setSources(next);
      setCustom(true);
    } catch (e) {
      setError(localError(e));
    }
  }
  async function readFile(file?: File) {
    if (!file) return;
    if (file.size > 100000 || !/\.(txt|md)$/i.test(file.name)) {
      setError(
        at(
          "Выберите TXT или MD до 100 КБ. Из презентации можно скопировать текст.",
          "Choose TXT or MD up to 100 KB. You can paste text from a presentation.",
          "100 КБ дейінгі TXT немесе MD таңдаңыз. Презентация мәтінін көшіруге болады.",
        ),
      );
      return;
    }
    try {
      setMaterial((await file.text()).slice(0, 40000));
      setError("");
    } catch {
      setError(
        at(
          "Не удалось прочитать файл.",
          "Could not read the file.",
          "Файл оқылмады.",
        ),
      );
    }
  }
  function speak() {
    if (narrator.active) {
      saved.current = narrator.pause();
      return;
    }
    if (saved.current)
      narrator.resume(saved.current, () => {
        saved.current = undefined;
      });
    else if (answer?.source)
      narrator.say(answer.source.text, () => {
        saved.current = undefined;
      });
  }
  return (
    <div className="local-mentor-page">
      <header className="local-mentor-header">
        <Link to="/">
          <ArrowLeft size={18} />
          AI Mentor
        </Link>
        <div>
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </header>
      <main className="local-mentor-main">
        <div className="local-mentor-heading">
          <span className="eyebrow">
            <Cpu size={15} />
            {at(
              "AI НА ВАШЕМ УСТРОЙСТВЕ",
              "AI ON YOUR DEVICE",
              "ҚҰРЫЛҒЫҢЫЗДАҒЫ AI",
            )}
          </span>
          <h1>
            {at(
              "Спросите. Разберёмся вместе.",
              "Ask. Let’s work it out together.",
              "Сұраңыз. Бірге түсінейік.",
            )}
          </h1>
          <p>
            {at(
              "Наставник находит объяснения в учебном материале. Без ключей OpenAI и Azure.",
              "Your mentor finds explanations in your learning material. No OpenAI or Azure keys.",
              "Тәлімгер оқу материалынан түсіндірмелерді табады. OpenAI және Azure кілттері қажет емес.",
            )}
          </p>
        </div>
        <div className="local-mentor-layout">
          <aside className="local-mentor-avatar">
            <div className="local-model-badge">
              <span className="status-dot" />
              {busy
                ? at(
                    "Работаю с материалом",
                    "Working with your material",
                    "Материалды талдау",
                  )
                : at("Готова помочь", "Ready to help", "Көмектесуге дайынмын")}
            </div>
            <AvatarPlayer
              state={
                busy ? "thinking" : narrator.speaking ? "speaking" : "idle"
              }
            />
            <div className="local-avatar-caption">
              <b>
                {custom
                  ? at(
                      "Ваш учебный материал",
                      "Your learning material",
                      "Сіздің оқу материалыңыз",
                    )
                  : at(
                      "Математика · Дроби",
                      "Mathematics · Fractions",
                      "Математика · Бөлшектер",
                    )}
              </b>
              <p>
                {at(
                  "Вопрос → объяснение → проверка понимания",
                  "Question → explanation → understanding check",
                  "Сұрақ → түсіндірме → түсінуді тексеру",
                )}
              </p>
            </div>
          </aside>
          <section
            className="local-mentor-dialogue"
            aria-label={at(
              "Диалог с наставником",
              "Mentor dialogue",
              "Тәлімгермен диалог",
            )}
          >
            <div className="local-material-bar">
              <BookOpen size={20} />
              <div>
                <strong>
                  {custom
                    ? at(
                        "Свой материал подключён",
                        "Your material is ready",
                        "Материалыңыз дайын",
                      )
                    : at(
                        "Пример: основы дробей",
                        "Example: fraction basics",
                        "Мысал: бөлшектер негіздері",
                      )}
                </strong>
                <span>
                  {at("Разделов:", "Sections:", "Бөлімдер:")} {sources.length}
                </span>
              </div>
            </div>
            {!custom && (
              <div className="local-suggestions">
                {[
                  "Почему знаменатели не складывают?",
                  "Как сократить дробь?",
                  "Как сравнить дроби с разными знаменателями?",
                ].map((q) => (
                  <button key={q} disabled={busy} onClick={() => void ask(q)}>
                    {q}
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
            >
              <label htmlFor="local-question">
                {at(
                  "Что осталось непонятным?",
                  "What would you like explained?",
                  "Не түсініксіз болды?",
                )}
              </label>
              <textarea
                id="local-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={at(
                  "Задайте вопрос по материалу…",
                  "Ask about the material…",
                  "Материал бойынша сұрақ қойыңыз…",
                )}
                disabled={busy}
              />
              <div className="local-submit-row">
                <small>
                  {at(
                    "Пилот проверен на вопросах по-русски.",
                    "This pilot was tested with Russian questions.",
                    "Пилот орысша сұрақтармен тексерілді.",
                  )}
                </small>
                <button
                  className="button primary"
                  disabled={busy || !question.trim()}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Send size={17} />
                  )}{" "}
                  {at("Спросить", "Ask", "Сұрау")}
                </button>
              </div>
            </form>
            {busy && (
              <div role="status" className="local-progress">
                <LoaderCircle size={20} className="spin" />
                <div>
                  {engine.status}
                  <small>
                    {at(
                      "Первая загрузка модели — около 170 МБ. Подготовка может занять минуту или больше.",
                      "The first model download is about 170 MB. Preparation may take a minute or longer.",
                      "Модель алғаш рет шамамен 170 МБ жүктейді. Дайындау бір минуттан ұзақ болуы мүмкін.",
                    )}
                  </small>
                </div>
                <button className="text-link" onClick={clear}>
                  {at("Отмена", "Cancel", "Бас тарту")}
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="local-error">
                {error}
              </p>
            )}
            {answer && (
              <article className="local-answer" aria-live="polite">
                <span className="eyebrow">
                  {at(
                    "ПО ВАШЕМУ ВОПРОСУ",
                    "FOR YOUR QUESTION",
                    "СҰРАҒЫҢЫЗ БОЙЫНША",
                  )}
                </span>
                <h2>{asked}</h2>
                {answer.found && answer.source ? (
                  <>
                    <p>{answer.source.text}</p>
                    <div className="local-source">
                      <BookOpen size={16} />
                      {at("Источник:", "Source:", "Дереккөз:")}{" "}
                      {answer.source.title}
                    </div>
                    <div className="local-speech">
                      <button
                        className="button secondary small"
                        onClick={speak}
                      >
                        {narrator.active ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} />
                        )}{" "}
                        {narrator.active
                          ? at("Пауза", "Pause", "Кідірту")
                          : at("Озвучить", "Read aloud", "Дауыстап оқу")}
                      </button>
                      <select
                        aria-label={at(
                          "Язык голоса",
                          "Voice language",
                          "Дауыс тілі",
                        )}
                        value={language}
                        onChange={(e) => {
                          narrator.cancel();
                          saved.current = undefined;
                          setLanguage(e.target.value as Language);
                        }}
                      >
                        <option value="ru">Русский</option>
                        <option value="en">English</option>
                        <option value="kk">Қазақша</option>
                      </select>
                    </div>
                    <small>
                      {at(
                        "Язык голоса не переводит текст. Нужен установленный голос этого языка.",
                        "Voice language does not translate the text. An installed voice is required.",
                        "Дауыс тілі мәтінді аудармайды. Құрылғыда тиісті дауыс орнатылуы керек.",
                      )}
                    </small>
                  </>
                ) : (
                  <p>
                    {at(
                      "В материале не нашлось достаточно близкого объяснения. Уточните вопрос или добавьте нужный раздел. Я не буду придумывать ответ.",
                      "No sufficiently relevant explanation was found. Rephrase your question or add the relevant material. I will not invent an answer.",
                      "Материалдан сәйкес түсіндірме табылмады. Сұрақты нақтылаңыз немесе тиісті бөлімді қосыңыз.",
                    )}
                  </p>
                )}
              </article>
            )}
            {narrator.speechError && (
              <p role="status" className="local-error">
                {narrator.speechError}
              </p>
            )}
            {check && (
              <fieldset className="local-check">
                <legend>
                  {at(
                    "Проверим понимание",
                    "Check your understanding",
                    "Түсінуді тексерейік",
                  )}
                </legend>
                <p>{check.question}</p>
                {check.options.map((option, i) => (
                  <button
                    key={option}
                    disabled={selected !== undefined}
                    aria-pressed={selected === i}
                    className={
                      selected !== undefined && i === check.correct
                        ? "correct"
                        : ""
                    }
                    onClick={() => setSelected(i)}
                  >
                    {option}
                  </button>
                ))}
                {selected !== undefined && (
                  <div role="status">
                    <strong>
                      {selected === check.correct
                        ? at("Верно!", "Correct!", "Дұрыс!")
                        : at(
                            "Вернёмся к объяснению.",
                            "Let’s revisit the explanation.",
                            "Түсіндірмеге оралайық.",
                          )}
                    </strong>
                    <p>{check.explanation}</p>
                    {selected !== check.correct && (
                      <button
                        onClick={() => {
                          saved.current = undefined;
                          narrator.say(answer!.source!.text, () => {});
                        }}
                      >
                        {at(
                          "Послушать объяснение ещё раз",
                          "Hear the explanation again",
                          "Түсіндірмені қайта тыңдау",
                        )}
                      </button>
                    )}
                  </div>
                )}
              </fieldset>
            )}
          </section>
        </div>
        <section className="local-material-editor">
          <div>
            <span className="eyebrow">
              {at(
                "ПОПРОБУЙТЕ НА СВОЁМ МАТЕРИАЛЕ",
                "TRY YOUR OWN MATERIAL",
                "ӨЗ МАТЕРИАЛЫҢЫЗБЕН ТЕКСЕРІҢІЗ",
              )}
            </span>
            <h2>
              {at(
                "Ваши объяснения. Вопросы студентов.",
                "Your explanations. Students’ questions.",
                "Сіздің түсіндірмелеріңіз. Студенттердің сұрақтары.",
              )}
            </h2>
            <p>
              {at(
                "Вставьте текст из презентации или загрузите TXT/MD. Он остаётся на этой странице до её закрытия; на AI-сервер не отправляется. Для своего материала тест пока нужно подготовить отдельно.",
                "Paste presentation text or load TXT/MD. It stays on this page until it is closed and is not sent to an AI server. Tests for custom material must be prepared separately.",
                "Презентация мәтінін қойыңыз немесе TXT/MD жүктеңіз. Мәтін осы бетте ғана сақталады және AI серверіне жіберілмейді. Өз материалыңызға тест бөлек дайындалады.",
              )}
            </p>
            <label className="button secondary">
              <Upload size={16} />
              {at("Выбрать файл", "Choose file", "Файл таңдау")}
              <input
                type="file"
                accept=".txt,.md"
                onChange={(e) => void readFile(e.target.files?.[0])}
              />
            </label>
          </div>
          <div>
            <label htmlFor="local-material">
              {at(
                "Текст учебного материала",
                "Learning material text",
                "Оқу материалының мәтіні",
              )}
            </label>
            <textarea
              id="local-material"
              rows={7}
              value={material}
              maxLength={40000}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder={at(
                "Разделяйте темы пустой строкой…",
                "Separate topics with a blank line…",
                "Тақырыптарды бос жолмен бөліңіз…",
              )}
            />
            <div className="local-submit-row">
              <button className="button primary" onClick={applyMaterial}>
                {at(
                  "Использовать материал",
                  "Use material",
                  "Материалды қолдану",
                )}
              </button>
              {custom && (
                <button
                  className="text-link"
                  onClick={() => {
                    clear();
                    setSources(fractionSources);
                    setCustom(false);
                  }}
                >
                  {at("Вернуть пример", "Restore example", "Мысалға қайту")}
                </button>
              )}
            </div>
          </div>
        </section>
        <p className="local-model-note">
          {at(
            "AI-компонент: предобученная E5 находит близкие по смыслу фрагменты. Ответ — текст источника, а не новая генерация. Это не собственная обученная модель. Анимация аватара и проверка теста работают отдельно от нейросети.",
            "AI component: pretrained E5 retrieves semantically related passages. Answers quote the source, rather than generating new text. This is not a model trained by us. Avatar animation and quiz scoring are separate from the neural network.",
            "AI компоненті: алдын ала оқытылған E5 мағынасы жақын үзінділерді табады. Жауап — жаңа мәтін емес, дереккөз мәтіні. Бұл өзіміз оқытқан модель емес. Аватар анимациясы мен тестті тексеру нейрожеліден бөлек жұмыс істейді.",
          )}
        </p>
      </main>
    </div>
  );
}
