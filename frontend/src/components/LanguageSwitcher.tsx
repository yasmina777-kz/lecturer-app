import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n";
import { patch } from "../api/httpClient";
import type { Language, User } from "../types/auth";
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const { user, setUser } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function change(value: Language) {
    if (value === language || busy) return;
    setLanguage(value);
    setError("");
    if (user) {
      setBusy(true);
      try {
        setUser(await patch<User>("/auth/language", { language: value }));
      } catch {
        setError(
          t(
            "Язык изменён на этом устройстве. Не удалось сохранить его в профиле.",
          ),
        );
      } finally {
        setBusy(false);
      }
    }
  }
  return (
    <div className="language-switcher">
      <div
        className="language-segments"
        role="group"
        aria-label={t("Язык интерфейса")}
      >
        {(
          [
            ["ru", "RU"],
            ["en", "EN"],
            ["kk", "KZ"],
          ] as const
        ).map(([code, label]) => (
          <button
            key={code}
            type="button"
            aria-pressed={language === code}
            disabled={busy}
            onClick={() => void change(code)}
            lang={code}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <span role="status" className="form-hint">
          {error}
        </span>
      )}
    </div>
  );
}
