import { at } from "../i18n/automation";
import { t } from "../i18n";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Pause,
  Play,
} from "lucide-react";
import { login, register } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { ProductSurface } from "../components/ProductSurface";
import { LandingWaves } from "../components/LandingWaves";
import "./auth-page.css";
import { Brand, ErrorMessage, messageOf } from "../components/UI";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n";
export function AuthPage({ signup = false }: { signup?: boolean }) {
  const { user, setUser } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [motionPaused, setMotionPaused] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = signup
        ? await register({
            email,
            password,
            fullName: name,
            accountType: "Student",
            avatarId: "classic-female",
            interfaceLanguage: language,
            teachingLanguage: language,
          })
        : await login({ email, password });
      setUser(u);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProductSurface className="auth-surface">
      <div
        className={`auth-entry auth-entry--${signup ? "signup" : "login"}${motionPaused ? " motion-paused" : ""}`}
      >
        <header className="auth-entry-header">
          <Link to="/" aria-label="AI Mentor">
            <Brand />
          </Link>
          <Link to="/" className="auth-entry-back">
            <ArrowLeft size={16} />
            {t("На главную")}
          </Link>
          <div className="auth-entry-preferences">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </header>
        <main className="auth-entry-main">
          <section
            className="auth-entry-story"
            aria-labelledby="auth-story-title"
          >
            <div className="auth-entry-copy">
              <h2 id="auth-story-title">
                {signup
                  ? at("Язык жестов.", "Sign language.", "Ым тілі.")
                  : at("Продолжим", "Let’s keep", "Оқуды")}
                <br />
                <span>
                  {signup
                    ? at("Начнём?", "Shall we?", "Бастаймыз ба?")
                    : at("обучение.", "learning.", "жалғастырайық.")}
                </span>
              </h2>
              <svg
                className="auth-entry-underline"
                viewBox="0 0 260 28"
                fill="none"
                aria-hidden="true"
              >
                <path d="M4 21C70 2 161 1 250 10M92 25C153 12 211 12 256 17" />
              </svg>
            </div>
            <div className="auth-entry-art" aria-hidden="true">
              <LandingWaves paused={motionPaused} />
              <div className="auth-entry-orbit" />
              <span className="auth-entry-spark">✳</span>
            </div>
            <button
              type="button"
              className="auth-entry-motion"
              aria-pressed={motionPaused}
              aria-label={
                motionPaused
                  ? at(
                      "Продолжить анимацию",
                      "Resume animation",
                      "Анимацияны жалғастыру",
                    )
                  : at(
                      "Остановить анимацию",
                      "Pause animation",
                      "Анимацияны тоқтату",
                    )
              }
              title={
                motionPaused
                  ? at(
                      "Продолжить анимацию",
                      "Resume animation",
                      "Анимацияны жалғастыру",
                    )
                  : at(
                      "Остановить анимацию",
                      "Pause animation",
                      "Анимацияны тоқтату",
                    )
              }
              onClick={() => setMotionPaused(!motionPaused)}
            >
              {motionPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </section>
          <section
            className="auth-entry-panel"
            aria-labelledby="auth-form-title"
          >
            <nav
              className="auth-entry-tabs"
              aria-label={at(
                "Вход и регистрация",
                "Sign in and sign up",
                "Кіру және тіркелу",
              )}
            >
              <Link to="/login" aria-current={!signup ? "page" : undefined}>
                {t("Войти")}
              </Link>
              <Link to="/register" aria-current={signup ? "page" : undefined}>
                {at("Регистрация", "Sign up", "Тіркелу")}
              </Link>
            </nav>
            <div className="auth-entry-form">
              <h1 id="auth-form-title">
                {signup
                  ? at("Регистрация", "Sign up", "Тіркелу")
                  : at("Вход", "Sign in", "Кіру")}
              </h1>
              <form onSubmit={submit} aria-busy={busy}>
                <ErrorMessage message={error} />
                {signup && (
                  <label>
                    {t("Как вас зовут")}
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      placeholder={t("Имя и фамилия")}
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </label>
                )}
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    maxLength={254}
                    required
                  />
                </label>
                <label>
                  {t("Пароль")}
                  <div className="password-input">
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={
                        signup ? "new-password" : "current-password"
                      }
                      placeholder={
                        signup ? t("Не менее 8 символов") : t("Ваш пароль")
                      }
                      minLength={signup ? 8 : undefined}
                      maxLength={64}
                      required
                    />
                    <button
                      type="button"
                      className="auth-entry-password-toggle"
                      aria-pressed={show}
                      aria-label={
                        show ? t("Скрыть пароль") : t("Показать пароль")
                      }
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <button className="auth-entry-submit" disabled={busy}>
                  {busy
                    ? t("Подождите…")
                    : signup
                      ? t("Создать аккаунт")
                      : t("Войти в аккаунт")}
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </button>
              </form>
              {signup && (
                <details className="auth-entry-details">
                  <summary>
                    {at(
                      "Об аккаунте и материалах",
                      "About your account and materials",
                      "Аккаунт пен материалдар туралы",
                    )}
                  </summary>
                  <p>
                    {t(
                      "Все новые аккаунты — студенты. Роль преподавателя назначает администратор.",
                    )}
                  </p>
                  <p>
                    {t(
                      "Загружайте только материалы, которые имеете право использовать. При генерации текст передаётся AI-провайдеру.",
                    )}
                  </p>
                </details>
              )}
              {!signup && (
                <p className="form-hint center">
                  {t(
                    "Не помните пароль? Обратитесь к владельцу вашей установки.",
                  )}
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    </ProductSurface>
  );
}
