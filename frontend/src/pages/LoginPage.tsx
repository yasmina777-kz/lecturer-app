import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await login({ email, password });
      setAuth(res.token, res.role, res.fullName);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-page">
        <Link to="/" className="brand auth-brand">
          <span className="brand-badge">AI</span>
          <span>AI-лектор</span>
        </Link>

        <h2>Вход</h2>
        <p className="subtitle">
          Продолжите обучение с вашим персональным AI-ментором
        </p>

        <form onSubmit={handleSubmit}>
          {error && <p className="error-msg">{error}</p>}

          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <div className="field-label-row">
              <label htmlFor="login-password">Пароль</label>
              {/* TODO: подключить, когда появится маршрут /forgot-password */}
              <button type="button" className="field-hint-link" disabled>
                Забыли пароль?
              </button>
            </div>
            <div className="password-input">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? "Скрыть" : "Показать"}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Входим…" : "Войти"}
          </button>
        </form>

        <p className="switch-link">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}