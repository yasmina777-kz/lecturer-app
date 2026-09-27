import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { apiGet } from "../api/httpClient";
import { at } from "../i18n/automation";
import { ErrorMessage, messageOf } from "./UI";
export interface QualityCheck { code: string; status: string; count: number; total: number; detail?: string }
export function QualityChecks({ checks }: { checks: QualityCheck[] }) {
  const labels: Record<string,string> = {
    source_alignment: at("Соответствие материалу (проверка AI)", "Source alignment (AI review)", "Материалға сәйкестік (AI тексеруі)"),
    slides: at("Слайды", "Slides", "Слайдтар"), narration: at("Подробная озвучка", "Detailed narration", "Толық баяндау"), structure: at("Структура слайдов", "Slide structure", "Слайд құрылымы"), visuals: at("Учебные иллюстрации", "Learning visuals", "Оқу иллюстрациялары"), quiz: at("Тест", "Quiz", "Тест"), tasks: at("Практические задания", "Practice tasks", "Практикалық тапсырмалар"), summary: at("Конспект", "Summary", "Конспект"), duration: at("Длительность, минут", "Duration, minutes", "Ұзақтығы, минут"), source_missing: at("Нет загруженного источника — проверьте факты", "No uploaded source — review the facts", "Жүктелген дереккөз жоқ — фактілерді тексеріңіз"), source_quotes: at("Цитаты найдены в источнике", "Quotes found in the source", "Дереккөзден табылған дәйексөздер"),
  };
  return <div className="quality-checks">{checks.map(c => <div key={c.code} className={`quality-check ${c.status}`}>
    {c.status === "pass" ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}
    <span>{labels[c.code] || c.code}{c.detail&&<small className="quality-detail">{c.detail}</small>}</span><strong>{c.total > 0 ? `${c.count} / ${c.total}` : c.count > 0 ? c.count : c.status === "pass" ? "✓" : "!"}</strong>
  </div>)}<p className="form-hint">{at("Проверка цитат подтверждает совпадение текста, а не достоверность всех утверждений. Изучите лекцию перед публикацией.", "Quote checks confirm text matches, not the truth of every claim. Review the lesson before publishing.", "Дәйексөзді тексеру мәтіннің сәйкестігін растайды, барлық тұжырымның дұрыстығын емес. Жариялау алдында дәрісті қарап шығыңыз.")}</p></div>;
}
export function QualityPanel({lectureId}: {lectureId:string}) {
  const [checks,setChecks] = useState<QualityCheck[]>([]); const [error,setError] = useState("");
  useEffect(() => { let alive=true; apiGet<QualityCheck[]>(`/lectures/${lectureId}/quality`).then(r=>{if(alive)setChecks(r);}).catch(e=>{if(alive)setError(messageOf(e));}); return ()=>{alive=false;}; },[lectureId]);
  return <section className="quality-panel"><h3>{at("Проверка качества", "Quality review", "Сапаны тексеру")}</h3><ErrorMessage message={error}/><QualityChecks checks={checks}/></section>;
}
