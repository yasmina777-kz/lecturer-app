import { Check } from "lucide-react";
import { at } from "../i18n/automation";

/** Level tab body shared by the RSL and KSL courses: plain type and a thin progress line. */
export function LevelTabBody({ id, name, desc, done, total }: { id: string; name: string; desc: string; done: number; total: number }) {
  const full = total > 0 && done === total;
  return (
    <>
      <span className="lvl-head">
        <b>{id}</b>
        <span>{name}</span>
        {full && <Check size={15} className="lvl-done" aria-label={at("Пройден", "Done", "Өтілді")} />}
      </span>
      <span className="lvl-desc">{desc}</span>
      {total > 0 ? (
        <span className="lvl-progress">
          <span className="lvl-bar" aria-hidden="true"><i style={{ width: `${(100 * done) / total}%` }} /></span>
          <small>{at(`${done} из ${total}`, `${done} of ${total}`, `${done} / ${total}`)}</small>
        </span>
      ) : (
        <span className="lvl-progress"><small>{at("Скоро", "Coming", "Жақында")}</small></span>
      )}
    </>
  );
}
