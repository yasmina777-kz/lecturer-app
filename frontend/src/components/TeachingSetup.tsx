import { t } from "../i18n";
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
    onChange({ ...value, ...next });
  };
  return (
    <div className="teaching-setup">
      <h3>{t("Ваш преподаватель")}</h3>
      <p className="muted">
        {t(
          "Выберите персонажа из нашего каталога. Он будет вести ваши лекции.",
        )}
      </p>
      <div className="avatar-catalog">
        {[
          {
            id: "classic-male",
            name: t("Классический лектор"),
            detail: t("Мужской персонаж · 2D"),
          },
          {
            id: "classic-female",
            name: t("Классическая преподавательница"),
            detail: t("Женский персонаж · 2D"),
          },
        ].map((a) => (
          <button
            type="button"
            key={a.id}
            className={value.avatarId === a.id ? "selected" : ""}
            aria-pressed={value.avatarId === a.id}
            onClick={() =>
              change({
                avatarId: a.id as AvatarId,
                ...(a.id === "classic-male"
                  ? { voiceGender: "male" }
                  : a.id === "classic-female"
                    ? { voiceGender: "female" }
                    : {}),
              })
            }
          >
            <AvatarPlayer avatarId={a.id as AvatarId} compact />
            <span>
              <strong>{a.name}</strong>
              <small>{a.detail}</small>
            </span>
            {value.avatarId === a.id && (
              <Check className="selected-mark" size={17} />
            )}
          </button>
        ))}
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
          speech.speaking
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
        {speech.speaking ? t("Остановить пример") : t("Послушать голос")}
      </button>
      {speech.speechError && (
        <p role="status" className="form-hint">
          {speech.speechError}
        </p>
      )}
    </div>
  );
}
