import {
  ArrowUpRight,
  BookOpen,
  Camera,
  Hand,
  MessageCircle,
  Type,
  Play,
  Check,
} from "lucide-react";
import { at } from "../i18n/automation";
import "./sign-action-cards.css";

type Kind = "text" | "phrases" | "dictionary" | "watch" | "camera";
const icons = {
  text: Type,
  phrases: MessageCircle,
  dictionary: BookOpen,
  watch: Play,
  camera: Camera,
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
        const Icon = icons[item.id];
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
              <span className="sign-art-orbit" />
              <span className="sign-art-sheet sign-art-sheet--back">
                <Hand strokeWidth={1.4} />
              </span>
              <span className="sign-art-sheet sign-art-sheet--front">
                <Icon strokeWidth={1.5} />
              </span>
              <span className="sign-art-token">
                {item.id === "dictionary"
                  ? "А–Я"
                  : item.id === "camera"
                    ? "21"
                    : item.id === "phrases"
                      ? "…"
                      : item.id === "watch"
                        ? "▶"
                        : "Аа"}
              </span>
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
