import { at } from "../i18n/automation";
import { getLanguage, setLanguage } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { patch } from "../api/httpClient";
import type { Language, User } from "../types/auth";
import { useSignLang, type SignLang } from "../sign/signLanguage";

/** Switch the studied sign language; РЖЯ → Russian interface, ҚЖЯ → Kazakh
 * interface (saved in the profile like RU/KZ). English stays English. */
export function useChooseSignLang() {
  const [lang, setLang] = useSignLang();
  const { user, setUser } = useAuth();
  const choose = (next: SignLang) => {
    setLang(next);
    const ui: Language = next === "ksl" ? "kk" : "ru";
    if (getLanguage() === ui || getLanguage() === "en") return;
    setLanguage(ui);
    if (user) patch<User>("/auth/language", { language: ui }).then(setUser).catch(() => undefined);
  };
  return [lang, choose] as const;
}

export function SignLangSwitcher() {
  const [lang, choose] = useChooseSignLang();
  const opts: [SignLang, string, string][] = [
    ["rsl", "РЖЯ", at("Русский жестовый язык — уроки на русском", "Russian Sign Language — lessons in Russian", "Орыс ым тілі — сабақтар орысша")],
    ["ksl", "ҚЖЯ", at("Казахский жестовый язык — уроки на казахском", "Kazakh Sign Language — lessons in Kazakh", "Қазақ ым тілі — сабақтар қазақша")],
  ];
  return (
    <div className="language-switcher sign-lang-switcher">
      <div className="language-segments" role="group" aria-label={at("Жестовый язык", "Sign language", "Ым тілі")}>
        {opts.map(([code, label, title]) => (
          <button key={code} type="button" aria-pressed={lang === code} title={title} onClick={() => choose(code)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
