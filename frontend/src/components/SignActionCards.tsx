import { ArrowUpRight, Check } from "lucide-react";
import { at } from "../i18n/automation";
import "./sign-action-cards.css";

type Kind = "text" | "phrases" | "dictionary" | "watch" | "camera";
const covers = {
  text: "13",
  phrases: "01",
  dictionary: "09",
  watch: "06",
  camera: "03",
};
export function SignActionCards({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: Kind; title: string; description: string; tag: string }[];
  value: string;
  onChange: (id: Kind) => void;
  label: string;
}) {
  return (
    <nav className="sign-action-cards" aria-label={label}>
      {items.map((item) => {
        return (
          <button
            type="button"
            key={item.id}
            className={`sign-action-card sign-action-card--${item.id}`}
            aria-pressed={value === item.id}
            onClick={() => onChange(item.id)}
            data-workspace-enter
          >
            <span className="sign-action-art" aria-hidden="true">
              <img
                className="sign-action-cover"
                src={`/illustrations/sign-phrases/phrase-${covers[item.id]}.jpg`}
                alt=""
                width="800"
                height="533"
                loading="lazy"
              />
              <span className="sign-action-tag">{item.tag}</span>
            </span>
            <span className="sign-action-copy">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </span>
            <span className="sign-action-footer">
              {value === item.id ? (
                <>
                  <Check size={16} />
                  {at("Открыто", "Selected", "Таңдалған")}
                </>
              ) : (
                <>
                  {at("Открыть", "Open", "Ашу")}
                  <ArrowUpRight size={18} />
                </>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
