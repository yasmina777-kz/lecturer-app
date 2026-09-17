import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing">
      <section className="hero">
        <div>
          <div className="hero-badge">
            <span className="hero-dot" />
            <span>AI-лектор · MVP v1.0 · Доступно для тестирования</span>
          </div>
          <h1>
            Интерактивный <span>AI-лектор</span>, который отвечает на вопросы прямо во время занятия
          </h1>
          <p>
            Платформа превращает обычную презентацию в живую лекцию: озвучивает слайды,
            слушает голосовые вопросы студентов и отвечает на них в контексте темы —
            без пауз и ожидания преподавателя.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn-primary">
              Начать бесплатно →
            </Link>
            <Link to="/login" className="btn-secondary">
              У меня уже есть аккаунт
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-badge">● LIVE · Пример диалога с AI-ментором</div>
          <div className="hero-visual-slide">
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Слайд 14 · Модуль 3</span>
            <h3>Архитектура нейросетей и расчёт градиента</h3>
            <p>Правило цепи для промежуточных весов скрытого слоя</p>
          </div>
          <div className="chat-bubble">
            <div className="who">Студент</div>
            «Остановись на секунду. Поясни ещё раз, почему мы умножаем частные производные?»
          </div>
          <div className="chat-bubble">
            <div className="who">AI-лектор</div>
            «Ставлю лекцию на паузу. Представь цепочку шестерёнок: ошибка на выходе
            зависит от поворота каждой предыдущей…»
          </div>
        </div>
      </section>

      <section className="stats">
        <div className="stat-card">
          <div className="value">94%</div>
          <div className="label">Доходимость курса</div>
          <div className="desc">Против ~12% у обычных записанных видеолекций без обратной связи.</div>
        </div>
        <div className="stat-card">
          <div className="value">24/7</div>
          <div className="label">Без стеснения</div>
          <div className="desc">Мгновенный ответ на любой вопрос вслух, без ожидания семинара.</div>
        </div>
        <div className="stat-card">
          <div className="value">3×</div>
          <div className="label">Экономия времени</div>
          <div className="desc">Автоматическая генерация конспектов и вопросов из слайдов лектора.</div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Три роли — три разных опыта</h2>
        <p className="section-sub">Платформа адаптируется под то, кто в неё зашёл.</p>
        <div className="roles-grid">
          <div className="role-card">
            <div className="icon">🎓</div>
            <h3>Студент</h3>
            <ul>
              <li>Слушает озвученные слайды лекции</li>
              <li>Задаёт голосовые вопросы прямо во время просмотра</li>
              <li>Получает ответы AI в контексте текущей темы</li>
            </ul>
          </div>
          <div className="role-card">
            <div className="icon">🧑‍🏫</div>
            <h3>Преподаватель</h3>
            <ul>
              <li>Загружает презентацию — платформа сама озвучивает слайды</li>
              <li>Видит вопросы студентов и статистику вовлечённости</li>
              <li>Управляет структурой лекций и модулей</li>
            </ul>
          </div>
          <div className="role-card">
            <div className="icon">🛠️</div>
            <h3>Админ</h3>
            <ul>
              <li>Управляет пользователями и ролями</li>
              <li>Следит за состоянием платформы</li>
              <li>Настраивает интеграции и доступы</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Технологии под капотом</h2>
        <p className="section-sub">Что именно сейчас работает в MVP-версии.</p>
        <div className="tech-grid">
          <div className="tech-card">
            <div className="tag">BACKEND</div>
            <div className="item">C# · ASP.NET Core 8</div>
            <div className="item">PostgreSQL + Entity Framework Core</div>
            <div className="item">JWT-авторизация по ролям</div>
          </div>
          <div className="tech-card">
            <div className="tag">FRONTEND</div>
            <div className="item">React 18 + TypeScript</div>
            <div className="item">React Router</div>
            <div className="item">Собственная дизайн-система</div>
          </div>
          <div className="tech-card">
            <div className="tag">AI-ПАЙПЛАЙН</div>
            <div className="item">Speech-to-Text для голосовых вопросов</div>
            <div className="item">Text-to-Speech для озвучки слайдов</div>
            <div className="item">Контекстные ответы через AI Client</div>
          </div>
        </div>
      </section>

      <div className="landing-footer">© 2026 AI-лектор. Учебный проект.</div>
    </div>
  );
}