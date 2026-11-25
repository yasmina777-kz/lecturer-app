import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import "./letter-tile.css";

/** One fingerspelling letter as a card: picture (illustration or a signer
 * frame), the letter itself and a short caption. Used for РЖЯ and ҚЖЯ. */
export function LetterTile({
  letter,
  to,
  media,
  caption,
  badge,
  photo = false,
}: {
  letter: string;
  to: string;
  media: ReactNode;
  caption: string;
  badge?: string;
  /** media is a photo/video frame (cover) rather than a line illustration (contain). */
  photo?: boolean;
}) {
  return (
    <Link className={`letter-tile card-motion${photo ? " is-photo" : ""}`} to={to}>
      <span className="letter-tile-media">{media}</span>
      {badge && <span className="letter-tile-badge">{badge}</span>}
      <span className="letter-tile-foot">
        <b className="letter-tile-glyph">{letter}</b>
        <span className="letter-tile-caption">{caption}</span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Level switcher shown above a stage: 1 · 2 · 3 as pills. */
export function StageTabs({
  levels,
  current,
}: {
  levels: { id: number; title: string }[];
  current: number;
}) {
  return (
    <nav className="stage-tabs" aria-label="Levels">
      {levels.map((l) => (
        <Link key={l.id} to={`/learn?stage=${l.id}`} aria-current={l.id === current ? "page" : undefined}>
          <span>{l.id}</span>
          {l.title}
        </Link>
      ))}
    </nav>
  );
}
