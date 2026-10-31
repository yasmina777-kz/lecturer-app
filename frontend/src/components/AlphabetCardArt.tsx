import { at } from "../i18n/automation";
import { alphabetIllustration } from "../sign/alphabetIllustrations";
import "./alphabet-card-art.css";

/** Keep the source handshape and arrows intact; only decorate its presentation. */
export function AlphabetCardArt({ letter }: { letter: string }) {
  return (
    <span className="alphabet-card-art">
      <span className="alphabet-card-art__tag" aria-hidden="true">
        {at("РЖЯ", "RSL", "ОЫТ")}
      </span>
      <img
        src={alphabetIllustration(letter)}
        alt={at(`Дактильная буква ${letter}`, `Fingerspelling: ${letter}`, `Дактиль әрпі: ${letter}`)}
        loading="lazy"
      />
      <span className="alphabet-card-art__dot" aria-hidden="true" />
    </span>
  );
}
