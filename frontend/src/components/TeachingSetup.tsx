import { t } from "../i18n";
import { at } from "../i18n/automation";
import { Check, Volume2 } from "lucide-react";
import type { AvatarId, Language, VoiceGender } from "../types/auth";
import { AvatarPlayer } from "./AvatarPlayer";
import { useNarrator } from "../hooks/useNarrator";
export interface TeachingChoice {
  avatarId: AvatarId;
  voiceGender: VoiceGender;
  teachingLanguage: Language;
}
export function TeachingSetup({
  value,
  onChange,
  speechProvider = "browser",
}: {
  value: TeachingChoice;
  onChange: (value: TeachingChoice) => void;
  speechProvider?: string;
}) {
  const speech = useNarrator(
    1,
    value.teachingLanguage,
    value.voiceGender,
    speechProvider,
  );
  const change = (next: Partial<TeachingChoice>) => {
    speech.cancel();
    onChange({ ...value, ...next, avatarId: "classic-female" });
  };
  return (
    <div className="teaching-setup">
      <h3>{t("Ваш преподаватель")}</h3>
      <p className="muted">
        {at("Мира — ваша наставница на главной странице и во всех занятиях.", "Mira is your mentor on the home page and throughout your lessons.", "Мира — басты бетте де, барлық сабақтарда да сіздің тәлімгеріңіз.")}
      </p>
      <div className="current-mentor-card">
        <AvatarPlayer state={speech.speaking ? "speaking" : "idle"} compact />
        <div>
          <strong>{at("Мира", "Mira", "Мира")}</strong>
          <p>{at("Виртуальная наставница", "Virtual mentor", "Виртуалды тәлімгер")}</p>
          <span><Check size={14} />{at("Ваш преподаватель", "Your teacher", "Сіздің оқытушыңыз")}</span>
        </div>
      </div>
      <div className="form-grid">
        <label>
          {t("Голос лектора")}
          <select
            value={value.voiceGender}
            onChange={(e) =>
              change({ voiceGender: e.target.value as VoiceGender })
            }
          >
            <option value="male">{t("Мужской")}</option>
            <option value="female">{t("Женский")}</option>
          </select>
        </label>
        <label>
          {t("Язык преподавания")}
          <select
            value={value.teachingLanguage}
            onChange={(e) =>
              change({ teachingLanguage: e.target.value as Language })
            }
          >
            <option value="ru">{t("Русский")}</option>
            <option value="en">English</option>
            <option value="kk">{t("Қазақша")}</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        className="button secondary small"
        onClick={() =>
          speech.active
            ? speech.cancel()
            : speech.say(
                value.teachingLanguage === "kk"
                  ? "Сәлеметсіз бе! Мен сіздің оқытушыңызбын. Бірге жаңа тақырыпты меңгерейік."
                  : value.teachingLanguage === "en"
                    ? "Hello! I am your lecturer. Let us explore a new topic together."
                    : "Здравствуйте! Я ваш преподаватель. Давайте разберём новую тему вместе.",
                () => {},
              )
        }
      >
        <Volume2 size={15} />
        {speech.active ? t("Остановить пример") : t("Послушать голос")}
      </button>
      {speech.speechError && (
        <p role="status" className="form-hint">
          {speech.speechError}
        </p>
      )}
    </div>
  );
}
