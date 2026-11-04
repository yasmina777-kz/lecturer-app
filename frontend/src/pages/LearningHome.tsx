import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Eye,
  MessageCircle,
  Play,
  Type,
} from "lucide-react";
import { at } from "../i18n/automation";
import { courseLevels } from "../sign/exercises";

export function LearningHome() {
  return (
    <div className="sign-workspace learning-home">
      <section className="learning-intro" aria-labelledby="learning-title">
        <div className="learning-intro-copy">
          <h1 id="learning-title">
            {at(
              "Изучайте\nрусский жестовый\nязык",
              "Learn\nRussian Sign\nLanguage",
              "Орыс\nым тілін\nүйреніңіз",
            )}
          </h1>
          <p>
            {at(
              "Пошаговые уроки, интерактивные упражнения и ваш учебный помощник",
              "Step-by-step lessons, interactive exercises and your learning companion",
              "Қадамдық сабақтар, интерактивті жаттығулар және оқу көмекшіңіз",
            )}
          </p>
          <div className="learning-intro-actions">
            <Link className="button primary" to="/practice?exercise=a">
              {at("Начать обучение", "Start learning", "Оқуды бастау")}
              <ArrowRight size={18} />
            </Link>
            <Link className="learning-demo-link" to="/learn/getting-started">
              <span>
                <Play size={16} fill="currentColor" />
              </span>
              {at(
                "Как это работает?",
                "How does it work?",
                "Бұл қалай жұмыс істейді?",
              )}
            </Link>
          </div>
        </div>
        <div className="learning-intro-art" aria-hidden="true">
          <img
            className="learning-hero-artwork"
            src="/images/learning/hero.png"
            alt=""
          />
        </div>
      </section>
      <section className="learning-path" aria-labelledby="learning-path-title">
        <div className="section-heading">
          <div>
            <p className="section-label">
              {at("Ваш путь", "Your path", "Оқу жолыңыз")}
            </p>
            <h2 id="learning-path-title">
              {at(
                "От букв до диалогов",
                "From letters to dialogues",
                "Әріптерден диалогтарға дейін",
              )}
            </h2>
          </div>
          <Link className="text-link" to="/practice">
            {at("Все упражнения", "All exercises", "Барлық жаттығулар")}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="learning-levels">
          {courseLevels().map((level, index) => (
            <Link
              className="learning-level"
              key={level.id}
              to={`/learn?stage=${level.id}`}
            >
              <span className="learning-level-number">{level.id}</span>
              <div className="learning-level-copy">
                <h3>{level.title}</h3>
                <p>{level.description}</p>
                <small>{level.count}</small>
              </div>
              <img
                className="learning-level-hand"
                src={`/images/learning/${["hands-alphabet", "hand-words", "hand-phrases"][index]}.png`}
                alt=""
              />
              <span className="learning-level-arrow">
                <ArrowRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <div className="learning-next-grid">
        <section className="learning-practice-banner">
          <div>
            <h2>
              {at(
                "Практикуйтесь\nв удобном формате",
                "Practise\nyour way",
                "Өзіңізге ыңғайлы\nтәсілмен жаттығыңыз",
              )}
            </h2>
            <p>
              {at(
                "Аватар, ракурсы и замедление — чтобы разобраться в каждом движении.",
                "Avatar views and slow motion help you understand each movement.",
                "Аватар, ракурстар және баяулату әр қимылды түсінуге көмектеседі.",
              )}
            </p>
            <Link to="/practice" className="button secondary">
              {at("Перейти к практике", "Open practice", "Жаттығуға өту")}
              <ArrowRight size={17} />
            </Link>
          </div>
          <img
            className="learning-practice-art"
            src="/images/learning/practice-hands.png"
            alt=""
          />
        </section>
        <section
          className="learning-activities"
          aria-labelledby="learning-activities-title"
        >
          <h2 id="learning-activities-title">
            {at("Больше практики", "More ways to practise", "Көбірек жаттығу")}
          </h2>
          <Link to="/dialogues">
            <MessageCircle size={21} />
            <div>
              <strong>{at("Диалоги", "Dialogues", "Диалогтар")}</strong>
              <span>
                {at(
                  "Знакомство, занятие и магазин",
                  "Meeting, class and shopping",
                  "Танысу, сабақ және дүкен",
                )}
              </span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/understanding">
            <Eye size={21} />
            <div>
              <strong>
                {at("Понимание жестов", "Understand signs", "Ымдарды түсіну")}
              </strong>
              <span>
                {at(
                  "Смотрите видео и выбирайте значение",
                  "Watch a video and choose its meaning",
                  "Бейнені көріп, мағынасын таңдаңыз",
                )}
              </span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        </section>
      </div>
      <section
        className="learning-resources"
        aria-label={at(
          "Полезные материалы",
          "Useful resources",
          "Пайдалы материалдар",
        )}
      >
        <Link to="/text-to-sign?tab=dictionary">
          <Type size={21} />
          <div>
            <h3>
              {at(
                "Открыть словарь · 171 слово",
                "Open dictionary · 171 words",
                "Сөздікті ашу · 171 сөз",
              )}
            </h3>
            <p>
              {at(
                "Слова, выражения и все 33 буквы",
                "Words, expressions and all 33 letters",
                "Сөздер, тіркестер және 33 әріп",
              )}
            </p>
          </div>
          <ArrowRight size={18} />
        </Link>
        <Link to="/learn/alphabet-intro">
          <BookOpen size={21} />
          <div>
            <h3>
              {at(
                "Для чего нужен дактиль?",
                "What is fingerspelling for?",
                "Дактиль не үшін қажет?",
              )}
            </h3>
            <p>
              {at(
                "Короткая справка — читать необязательно",
                "An optional short introduction",
                "Міндетті емес қысқа анықтама",
              )}
            </p>
          </div>
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
