import { at } from "../i18n/automation";
import { useSignLang, type SignLang } from "../sign/signLanguage";

/** Which sign language the course teaches: Russian (РЖЯ) or Kazakh (ҚЖЯ). */
export function SignLangSwitcher() {
  const [lang, setLang] = useSignLang();
  const opts: [SignLang, string, string][] = [
    ["rsl", "РЖЯ", at("Русский жестовый язык — уроки на русском", "Russian Sign Language — lessons in Russian", "Орыс ым тілі — сабақтар орысша")],
    ["ksl", "ҚЖЯ", at("Казахский жестовый язык — уроки на казахском", "Kazakh Sign Language — lessons in Kazakh", "Қазақ ым тілі — сабақтар қазақша")],
  ];
  return (
    <div className="language-switcher sign-lang-switcher">
      <div className="language-segments" role="group" aria-label={at("Жестовый язык", "Sign language", "Ым тілі")}>
        {opts.map(([code, label, title]) => (
          <button key={code} type="button" aria-pressed={lang === code} title={title} onClick={() => setLang(code)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
