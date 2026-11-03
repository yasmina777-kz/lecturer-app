import { t } from "../i18n";
import { at } from "../i18n/automation";
import { useState, type FormEvent } from "react";
import { Check, Save, UserRound, Settings2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { patch } from "../api/httpClient";
import type { User } from "../types/auth";
import { ErrorMessage, messageOf } from "../components/UI";
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
  return (
    <div className="profile-settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("ПУСТЬ ВСЁ БУДЕТ ПО-ВАШЕМУ")}</span>
          <h1>{t("Настройки")}</h1>
          <p>
            {at(
              "Ваш профиль. Скорость жестов можно менять в плеере занятия.",
              "Your profile. Adjust signing speed in the lesson viewer.",
              "Сіздің профиліңіз. Ым қарқынын сабақ ойнатқышында өзгертуге болады.",
            )}
          </p>
        </div>
        <Settings2
          className="profile-heading-art"
          size={88}
          aria-hidden="true"
        />
      </div>
      <ErrorMessage message={error} />
      {success && (
        <div className="success-msg" role="status">
          <Check size={18} />
          {success}
        </div>
      )}
      <div className="settings-layout settings-simple">
        <form className="panel" onSubmit={profile}>
          <div className="profile-panel-heading">
            <span className="profile-panel-icon" aria-hidden="true">
              <UserRound size={25} />
            </span>
            <h2>{t("Личный профиль")}</h2>
          </div>
          <label>
            {t("Имя")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          </label>
          <label>
            Email
            <input value={user!.email} disabled type="email" />
          </label>
          <label>
            {t("Роль")}
            <input
              value={t(
                user!.role === "Admin"
                  ? "Администратор"
                  : user!.role === "Lecturer"
                    ? "Преподаватель"
                    : "Студент",
              )}
              readOnly
              aria-describedby="profile-role-hint"
            />
          </label>
          <p id="profile-role-hint" className="form-hint">
            {t("Роль назначает только администратор через админ-панель.")}
          </p>
          <button className="button primary" disabled={busy}>
            <Save size={17} />
            {t("Сохранить настройки")}
          </button>
        </form>
      </div>
    </div>
  );
}
