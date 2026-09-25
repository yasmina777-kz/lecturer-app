import { t } from "../i18n";
import { useState, type FormEvent } from "react";
import { Check, Save } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { patch } from "../api/httpClient";
import type { User } from "../types/auth";
import { ErrorMessage, messageOf } from "../components/UI";
import {
  TeachingSetup,
  type TeachingChoice,
} from "../components/TeachingSetup";
import { apiGet } from "../api/httpClient";
import { useEffect } from "react";
import type { Capabilities } from "../types/lecture";
export function SettingsPage() {
  const { user, setUser } = useAuth();
  const [teaching, setTeaching] = useState<TeachingChoice>({
    avatarId: user!.avatarId,
    voiceGender: user!.voiceGender,
    teachingLanguage: user!.teachingLanguage,
  });
  const [speechProvider, setSpeechProvider] = useState("browser");
  useEffect(() => {
    apiGet<Capabilities>("/capabilities")
      .then((c) => setSpeechProvider(c.speech))
      .catch(() => {});
  }, []);
  const [name, setName] = useState(user!.fullName);
  const [rate, setRate] = useState(user!.speechRate);
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
          speechRate: rate,
          ...teaching,
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
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("ПУСТЬ ВСЁ БУДЕТ ПО-ВАШЕМУ")}</span>
          <h1>{t("Настройки")}</h1>
          <p>{t("Профиль, ваш лектор и комфортный темп обучения.")}</p>
        </div>
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
          <h2>{t("Личный профиль")}</h2>
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
          <div className="divider" />
          <TeachingSetup
            value={teaching}
            onChange={setTeaching}
            speechProvider={speechProvider}
          />
          <label>
            {t("Скорость речи")}
            <span className="muted">{rate}×</span>
            <input
              type="range"
              min="0.75"
              max="1.5"
              step="0.25"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </label>
          <p className="form-hint">
            {t(
              "Настройки применятся к новым лекциям. Уже созданные сохранят своего преподавателя и язык.",
            )}
          </p>
          <button className="button primary" disabled={busy}>
            <Save size={17} />
            {t("Сохранить настройки")}
          </button>
        </form>
      </div>
    </>
  );
}
