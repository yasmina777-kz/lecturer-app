import { useEffect, useRef, useState } from "react";
import { apiGet, post } from "../api/httpClient";
import { at } from "../i18n/automation";
import { ErrorMessage, messageOf } from "./UI";
interface Review {id:string;questionIndex:number;explanation:string;slideIndex:number;question:string;options:string[];generated:boolean;resolvedAt:string|null}
export function MistakeReview({lectureId,wrong,run,onSlide}:{lectureId:string;wrong:number[];run:number;onSlide:(index:number)=>void}) {
  const [items,setItems]=useState<Review[]>([]);const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [selected,setSelected]=useState<Record<string,number>>({});const [feedback,setFeedback]=useState<Record<string,{correct:boolean;explanation:string}>>({});
  const sequence=useRef(0);
  useEffect(()=>{let active=true;apiGet<Review[]>(`/lectures/${lectureId}/remediation`).then(r=>{if(active)setItems(r);}).catch(e=>{if(active)setError(messageOf(e));});return()=>{active=false;sequence.current++;};},[lectureId]);
  async function prepare() {
    const seq=++sequence.current;setBusy(true);setError("");setFeedback({});
    try{for(const questionIndex of wrong){const r=await post<Review>(`/lectures/${lectureId}/remediation/${questionIndex}`);if(sequence.current!==seq)return;setItems(list=>[...list.filter(i=>i.questionIndex!==questionIndex),r].sort((a,b)=>a.questionIndex-b.questionIndex));}}
    catch(e){if(sequence.current===seq)setError(messageOf(e));}finally{if(sequence.current===seq)setBusy(false);}
  }
  const lastRun=useRef(0);
  useEffect(()=>{if(run>0&&run!==lastRun.current){lastRun.current=run;if(wrong.length)void prepare();}},[run]);
  async function check(item:Review) {setBusy(true);setError("");try{const r=await post<{correct:boolean;explanation:string;resolvedAt:string|null}>(`/lectures/${lectureId}/remediation/${item.id}/answer`,{answer:selected[item.id]});setFeedback(f=>({...f,[item.id]:r}));setItems(list=>list.map(i=>i.id===item.id?{...i,resolvedAt:r.resolvedAt}:i));}catch(e){setError(messageOf(e));}finally{setBusy(false);}}
  if(!items.length&&!wrong.length&&!error)return null;
  return <section className="mistake-review"><h3>{at("Работа над ошибками","Learn from mistakes","Қателермен жұмыс")}</h3><p className="form-hint">{at("Разберите объяснение, вернитесь к слайду и проверьте себя. Этот результат не меняет балл исходного теста.","Read the explanation, revisit the slide and check your understanding. This does not change your original quiz score.","Түсіндірмені оқып, слайдқа оралып, өзіңізді тексеріңіз. Бұл бастапқы тест балын өзгертпейді.")}</p><ErrorMessage message={error}/>{busy&&<p role="status">{at("Готовим разбор…","Preparing review…","Талдау дайындалуда…")}</p>}
    {items.map(item=><article key={item.id} className="remediation-card"><span className="tag">{at("Вопрос","Question","Сұрақ")} {item.questionIndex+1}{item.resolvedAt?" · ✓":""}</span><p>{item.explanation}</p><button type="button" className="text-link" onClick={()=>onSlide(item.slideIndex)}>{at("Вернуться к слайду","Return to slide","Слайдқа оралу")} {item.slideIndex+1} →</button><h4>{item.generated?at("Похожее задание","Similar question","Ұқсас тапсырма"):at("Повторение исходного вопроса · без AI","Repeat the original question · no AI","Бастапқы сұрақты қайталау · AI жоқ")}</h4><p><strong>{item.question}</strong></p><fieldset disabled={busy||!!item.resolvedAt}><legend className="sr-only">{item.question}</legend>{item.options.map((o,i)=><label className="quiz-option" key={i}><input type="radio" name={`review-${item.id}`} checked={selected[item.id]===i} onChange={()=>setSelected(s=>({...s,[item.id]:i}))}/>{o}</label>)}</fieldset>{feedback[item.id]&&<p className={`quiz-explanation ${feedback[item.id].correct?"success":""}`}>{feedback[item.id].correct?at("Верно. ","Correct. ","Дұрыс. "):at("Пока неверно. ","Not yet. ","Әзірге қате. ")}{feedback[item.id].explanation}</p>}{item.resolvedAt?<p className="success-text">✓ {at("Ошибка разобрана","Mistake reviewed","Қате талданды")}</p>:<button type="button" className="button secondary small" disabled={busy||selected[item.id]==null} onClick={()=>check(item)}>{at("Проверить себя","Check understanding","Өзіңізді тексеру")}</button>}</article>)}
    {wrong.length>0&&<button type="button" className="button secondary" disabled={busy} onClick={prepare}>{at("Подготовить разбор ошибок","Prepare mistake review","Қателерді талдауды дайындау")}</button>}
  </section>;
}
