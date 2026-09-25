import {
  Atom,
  BookOpen,
  Brain,
  Code2,
  Globe2,
  Leaf,
  ChartColumn,
  Lightbulb,
  Target,
  Clock3,
  ArrowDown,
} from "lucide-react";
export interface TeachingVisual {
  kind: "process" | "compare" | "concept";
  title: string;
  items: { label: string; detail: string; icon?: string }[];
  caption?: string;
}
const icons = {
  book: BookOpen,
  brain: Brain,
  code: Code2,
  atom: Atom,
  globe: Globe2,
  leaf: Leaf,
  chart: ChartColumn,
  lightbulb: Lightbulb,
  target: Target,
  clock: Clock3,
};
export function SlideVisual({ visual }: { visual: TeachingVisual }) {
  if (!Array.isArray(visual.items)) return null;
  return (
    <figure
      className={`teaching-visual visual-${visual.kind}`}
      aria-label={visual.title}
    >
      <h3>{visual.title}</h3>
      <div className="visual-items">
        {visual.items.slice(0, 4).map((item, i) => {
          const Icon = icons[item.icon as keyof typeof icons] || Lightbulb;
          return (
            <div className="visual-item-wrap" key={i}>
              <div className="visual-item">
                <span className="visual-icon">
                  <Icon size={28} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
              {visual.kind === "process" && i < visual.items.length - 1 && (
                <ArrowDown className="visual-arrow" size={18} />
              )}
            </div>
          );
        })}
      </div>
      {visual.caption && <figcaption>{visual.caption}</figcaption>}
    </figure>
  );
}
