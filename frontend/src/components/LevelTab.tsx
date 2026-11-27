import { Check } from "lucide-react";
import { at } from "../i18n/automation";

/** One stop on the level path (RSL and KSL courses): a node on a line,
 * the level code and name, and how many lessons are done. */
export function LevelTabBody({ id, name, desc, done, total }: { id: string; name: string; desc: string; done: number; total: number }) {
  const full = total > 0 && done === total;
  const pct = total ? (100 * done) / total : 0;
  return (
    <>
      <span className="lvl-line" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
      <span className={`lvl-node${full ? " is-full" : ""}`} aria-hidden="true">{full ? <Check size={14} /> : null}</span>
      <span className="lvl-label"><b>{id}</b> {name}</span>
      <small className="lvl-count">
        {total > 0 ? at(`${done} из ${total} уроков`, `${done} of ${total} lessons`, `${done} / ${total} сабақ`) : at("Скоро", "Coming", "Жақында")}
      </small>
      <span className="lvl-desc" title={desc}>{desc}</span>
    </>
  );
}
