import { t } from "../i18n";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { login, register } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { AvatarPlayer } from "../components/AvatarPlayer";
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
    <div className="auth-layout">
      <section className="auth-story">
        <Link to="/">
          <Brand />
        </Link>
        <div className="auth-story-text">
          <span className="eyebrow">
            <Sparkles size={14} /> {t("ВАШ ПЕРСОНАЛЬНЫЙ AI-ЛЕКТОР")}
          </span>
          <h1>
            {t("Сложные темы.")}
            <br />
            <em>{t("Простые объяснения.")}</em>
          </h1>
          <p>
            {t("Лекции, в которых можно спросить «почему?»")}
            <br />
            {t("И разобраться по-настоящему.")}
          </p>
        </div>
        <AvatarPlayer avatarId="classic-male" />
        <div className="auth-benefits">
          <span>
            <Check size={16} />
            {t("Ваш темп")}
          </span>
          <span>
            <Check size={16} />
            {t("Живые вопросы")}
          </span>
          <span>
            <Check size={16} />
            {t("Практика")}
          </span>
        </div>
        <small>{t("Знания начинаются с любопытства.")}</small>
      </section>
      <section className="auth-form-area">
        <Link to="/" className="auth-back">
          <ArrowLeft size={14} />
          {t("На главную")}
        </Link>
        <div className="auth-preferences"><ThemeSwitcher /><LanguageSwitcher /></div>
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <span className="eyebrow">
            {signup ? t("НОВОЕ НАЧАЛО") : t("РАДЫ ВАС ВИДЕТЬ")}
          </span>
          <h2>{signup ? t("Начните с любопытства") : t("С возвращением")}</h2>
          <p>
            {signup
              ? t("Создайте аккаунт — и найдите свой способ учиться.")
              : t("Ваши лекции и новые открытия уже ждут.")}
          </p>
          <form onSubmit={submit}>
            <ErrorMessage message={error} />
            {signup && (
              <p className="form-hint">
                {t(
                  "Все новые аккаунты — студенты. Роль преподавателя назначает администратор.",
                )}
              </p>
            )}
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
                  autoComplete={signup ? "new-password" : "current-password"}
                  placeholder={
                    signup ? t("Не менее 8 символов") : t("Ваш пароль")
                  }
                  minLength={signup ? 8 : undefined}
                  maxLength={64}
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={show ? t("Скрыть пароль") : t("Показать пароль")}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {signup && (
              <p className="form-hint">
                {t(
                  "Загружайте только материалы, которые имеете право использовать. При генерации текст передаётся AI-провайдеру.",
                )}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? t("Подождите…")
                : signup
                  ? t("Создать аккаунт")
                  : t("Войти в аккаунт")}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="switch-link">
            {signup ? t("Уже есть аккаунт?") : t("Впервые здесь?")}{" "}
            <Link to={signup ? "/login" : "/register"}>
              {signup ? t("Войти") : t("Зарегистрироваться")}
            </Link>
          </p>
          {!signup && (
            <p className="form-hint center">
              {t("Не помните пароль? Обратитесь к владельцу вашей установки.")}
            </p>
          )}
        </div>
        <small className="auth-footer">
          {t("Одна тема. Один вопрос. На шаг ближе к пониманию.")}
        </small>
      </section>
    </div>
  );
}
