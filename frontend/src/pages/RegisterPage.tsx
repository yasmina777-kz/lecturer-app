import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/authApi";
import type { UserRole } from "../types/auth";

// Публичная регистрация всегда создаёт студента.
// Роль преподавателя/организации назначается позже через админ-панель.
const DEFAULT_ROLE: UserRole = "Student";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({ email, password, fullName, role: DEFAULT_ROLE });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="auth-wrap">
        <div className="auth-page">
          <p className="success-msg">
            Регистрация прошла успешно! Теперь можно войти.
          </p>
          <button type="button" onClick={() => navigate("/login")}>
            Перейти ко входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-page">
        <Link to="/" className="brand auth-brand">
          <span className="brand-badge">AI</span>
          <span>AI-лектор</span>
        </Link>

        <h2>Регистрация</h2>
        <p className="subtitle">
          Создайте аккаунт, чтобы начать заниматься с AI-ментором
        </p>

        <form onSubmit={handleSubmit}>
          {error && <p className="error-msg">{error}</p>}

          <div className="field">
            <label htmlFor="register-name">Имя</label>
            <input
              id="register-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Имя Фамилия"
              autoComplete="name"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="register-password">Пароль</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 8 символов"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Регистрируем…" : "Зарегистрироваться"}
          </button>
        </form>

        <p className="switch-link">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}