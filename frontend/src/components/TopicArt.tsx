import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import "./topic-art.css";

const HUES = [0, 28, -30, 55, -60, 85];

/** Gradient tile with a big icon on a white card and three small floating icons.
 * Colour comes from `--lvl` on an ancestor, shifted per card by `index`. */
export function TopicArt({ main: Main, small, index }: { main: LucideIcon; small: LucideIcon[]; index: number }) {
  return (
    <div className="topic-art" style={{ "--hue": `${HUES[index % HUES.length]}deg` } as CSSProperties} aria-hidden="true">
      <span className="topic-blob a" />
      <span className="topic-blob b" />
      <span className="topic-main"><Main size={44} strokeWidth={1.8} /></span>
      {small.map((Icon, k) => (
        <span key={k} className={`topic-small s${k}`}><Icon size={18} strokeWidth={2} /></span>
      ))}
    </div>
  );
}
