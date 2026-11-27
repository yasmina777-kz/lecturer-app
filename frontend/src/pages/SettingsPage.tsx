import { t } from "../i18n";
import { at } from "../i18n/automation";
import { useState, type FormEvent } from "react";
import { Check, Save, UserRound, Palette, CircleHelp, ArrowRight, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { SignLangSwitcher } from "../components/SignLangSwitcher";
import { useProductTheme } from "../components/ProductSurface";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../context/AuthContext";
import { patch } from "../api/httpClient";
import type { User } from "../types/auth";
import { ErrorMessage, messageOf } from "../components/UI";
/** Theme, interface language and studied sign language (moved here from the top bar). */
function AppearancePanel() {
  const globalTheme = useTheme();
  const productTheme = useProductTheme();
  const { theme, toggleTheme } = productTheme ?? globalTheme;
  return (
    <section className="panel settings-appearance">
      <div className="profile-panel-heading">
        <span className="profile-panel-icon" aria-hidden="true">
          <Palette size={24} />
        </span>
        <h2>{at("Внешний вид и язык", "Appearance and language", "Сыртқы түрі мен тіл")}</h2>
      </div>
      <div className="settings-row">
        <div>
          <strong>{at("Тема", "Theme", "Тақырып")}</strong>
          <span>{at("Светлая или тёмная", "Light or dark", "Ашық не қараңғы")}</span>
        </div>
        <div className="language-segments settings-theme" role="group" aria-label={at("Тема", "Theme", "Тақырып")}>
          <button type="button" aria-pressed={theme !== "dark"} onClick={() => theme === "dark" && toggleTheme()}>
            <Sun size={16} /> {at("Светлая", "Light", "Ашық")}
          </button>
          <button type="button" aria-pressed={theme === "dark"} onClick={() => theme !== "dark" && toggleTheme()}>
            <Moon size={16} /> {at("Тёмная", "Dark", "Қараңғы")}
          </button>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <strong>{at("Язык интерфейса", "Interface language", "Интерфейс тілі")}</strong>
          <span>{at("Русский, English или қазақша", "Russian, English or Kazakh", "Орысша, ағылшынша не қазақша")}</span>
        </div>
        <LanguageSwitcher />
      </div>
      <div className="settings-row">
        <div>
          <strong>{at("Жестовый язык курса", "Sign language of the course", "Курстың ым тілі")}</strong>
          <span>{at("Русский (РЖЯ) или казахский (ҚЖЯ)", "Russian (RSL) or Kazakh (KSL)", "Орыс (РЖЯ) не қазақ (ҚЖЯ)")}</span>
        </div>
        <SignLangSwitcher />
      </div>
      <Link className="settings-help-link" to="/help">
        <CircleHelp size={20} />
        <span>
          <strong>{at("Что где находится", "Where to find everything", "Қай бөлімде не бар")}</strong>
          <span>{at("Короткий путеводитель по разделам платформы", "A short guide to the platform", "Платформа бөлімдеріне қысқа нұсқаулық")}</span>
        </span>
        <ArrowRight size={18} />
      </Link>
    </section>
  );
}

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user!.fullName);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function profile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      setUser(
        await patch<User>("/auth/me", {
          fullName: name,
          avatarStyle: user!.avatarStyle,
          speechRate: user!.speechRate,
          avatarId: user!.avatarId,
          voiceGender: user!.voiceGender,
          teachingLanguage: user!.teachingLanguage,
        }),
      );
      setSuccess(t("Настройки сохранены."));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  const roleName = t(
    user!.role === "Admin" ? "Администратор" : user!.role === "Lecturer" ? "Преподаватель" : "Студент",
  );
  return (
    <div className="profile-settings-page settings-compact">
      <div className="settings-head">
        <h1>{t("Настройки")}</h1>
        <p>
          {at(
            "Всё на одном экране: внешний вид, язык и профиль.",
            "Everything on one screen: appearance, language and profile.",
            "Барлығы бір экранда: сыртқы түрі, тіл және профиль.",
          )}
        </p>
      </div>
      <ErrorMessage message={error} />
      <div className="settings-grid">
        <AppearancePanel />
        <form className="panel settings-profile" onSubmit={profile}>
          <div className="profile-panel-heading">
            <span className="profile-panel-icon" aria-hidden="true">
              <UserRound size={22} />
            </span>
            <h2>{t("Личный профиль")}</h2>
          </div>
          <div className="settings-person">
            <span className="settings-avatar" aria-hidden="true">{(name || user!.email).trim().charAt(0).toUpperCase()}</span>
            <span>
              <b>{user!.email}</b>
              <small id="profile-role-hint" title={t("Роль назначает только администратор через админ-панель.")}>{roleName}</small>
            </span>
          </div>
          <label>
            {t("Имя")}
            <span className="settings-name-row">
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSuccess("");
                }}
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
              <button className="button primary" disabled={busy || name.trim() === user!.fullName}>
                {success ? <Check size={17} /> : <Save size={17} />}
                {success ? at("Сохранено", "Saved", "Сақталды") : at("Сохранить", "Save", "Сақтау")}
              </button>
            </span>
          </label>
          <p className="form-hint">
            {at(
              "Скорость жестов меняется прямо в плеере занятия. Роль назначает администратор.",
              "Signing speed is changed in the lesson player. Roles are assigned by an administrator.",
              "Ым жылдамдығы сабақ ойнатқышында өзгереді. Рөлді әкімші тағайындайды.",
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
