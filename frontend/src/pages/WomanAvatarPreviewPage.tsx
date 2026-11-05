import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SignSequencePlayer } from "../components/SignSequencePlayer";
import { planMotion, type MotionAsset, type MotionPlan } from "../sign/motion";
import { alphabet } from "../sign/exercises";
import type { DictionaryEntry, DictionaryForms } from "../sign/dictionary";
import { at } from "../i18n/automation";
import "./sign-workspace.css";
import "./woman-avatar.css";

type TrialAsset = MotionAsset & { originalUrl: string };
export function WomanAvatarPreviewPage() {
  const [assets, setAssets] = useState<TrialAsset[]>([]);
  const [words, setWords] = useState<DictionaryEntry[]>([]);
  const [forms, setForms] = useState<DictionaryForms>({});
  const [error, setError] = useState("");
  const [model, setModel] = useState("woman01");
  const [selected, setSelected] = useState("word-f17a6060");
  const [text, setText] = useState("Привет!");
  const [plan, setPlan] = useState<MotionPlan>();
  const [run, setRun] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all(
      [
        "/avatars/woman01/catalog.json",
        "/research/rsl/words/catalog.json",
        "/research/rsl/words/forms.json",
      ].map(async (url) => {
        const r = await fetch(url, { signal: abort.signal });
        if (!r.ok) throw Error("load");
        return r.json();
      }),
    )
      .then(([a, w, f]) => {
        setAssets(a);
        setWords(w);
        setForms(f);
        const first =
          a.find((s: TrialAsset) => s.id === "word-f17a6060") ?? a[0];
        if (first)
          setPlan({
            steps: [{ ...first, text: first.label }],
            missing: [],
            spelling: false,
          });
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            at(
              "Не удалось загрузить движения. Обновите страницу.",
              "Could not load motions. Refresh the page.",
              "Қимылдар жүктелмеді. Бетті жаңартыңыз.",
            ),
          );
      });
    return () => abort.abort();
  }, []);
  function choose(id: string) {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    setSelected(id);
    setText(asset.label);
    setPlan({
      steps: [{ ...asset, text: asset.label }],
      missing: [],
      spelling: asset.id.startsWith("letter-"),
    });
    setRun((n) => n + 1);
  }
  function letter(value: string) {
    const asset = assets.find(
      (a) => a.id.startsWith("letter-") && a.label === value,
    );
    if (asset) choose(asset.id);
  }
  const shown =
    plan && model === "mira"
      ? {
          ...plan,
          steps: plan.steps.map((s) => ({
            ...s,
            url: assets.find((a) => a.id === s.id)?.originalUrl ?? s.url,
          })),
        }
      : plan;
  return (
    <section className="sign-workspace practice-workspace woman-avatar-trial">
      <Link to="/text-to-sign">
        ← {at("Текст и жесты", "Text and signs", "Мәтін және ымдар")}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{at("Новый аватар", "New avatar", "Жаңа аватар")}</h1>
          <p>
            {at(
              "Сравните движения, приблизьте кисти и выберите ракурс.",
              "Compare motions, zoom in on the hands and choose a view.",
              "Қимылдарды салыстырып, қолды жақындатыңыз және көріністі таңдаңыз.",
            )}
          </p>
        </div>
      </div>
      <div className="woman-trial-controls">
        <label>
          {at("Модель", "Model", "Модель")}
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="woman01">Woman 01 · {at("новый аватар", "new avatar", "жаңа аватар")}</option>
            <option value="mira">
              {at("Текущий аватар", "Current avatar", "Қазіргі аватар")}
            </option>
          </select>
        </label>
        <label>
          {at("Движение", "Motion", "Қимыл")}
          <select
            value={selected}
            onChange={(e) => choose(e.target.value)}
            disabled={!assets.length}
          >
            {selected === "" && (
              <option value="">
                {at("Ваш текст", "Your text", "Сіздің мәтініңіз")}
              </option>
            )}
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form
        className="woman-trial-text"
        onSubmit={(e) => {
          e.preventDefault();
          const next = planMotion(text, words, forms, assets);
          setPlan(next);
          setSelected(next.steps.length === 1 ? next.steps[0].id : "");
          setRun((n) => n + 1);
        }}
      >
        <input
          aria-label={at(
            "Буква или фраза",
            "Letter or phrase",
            "Әріп немесе сөйлем",
          )}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={at(
            "Введите букву или фразу",
            "Enter a letter or phrase",
            "Әріп немесе сөйлем енгізіңіз",
          )}
        />
        <button className="button primary" disabled={!assets.length}>
          {at("Показать", "Show", "Көрсету")}
        </button>
      </form>
      <div
        className="woman-trial-alphabet"
        aria-label={at("Алфавит", "Alphabet", "Әліпби")}
      >
        {alphabet.map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => letter(a)}
            disabled={!assets.length}
            aria-pressed={assets.find((asset) => asset.id === selected)?.label === a}
            aria-label={at(`Буква ${a}`, `Letter ${a}`, `${a} әрпі`)}
          >
            {a}
          </button>
        ))}
      </div>
      <p className="woman-trial-caption">
        {at(
          "Пробная версия · новые материалы. Движения проходят проверку.",
          "Trial version · new materials. Motions are being reviewed.",
          "Сынақ нұсқасы · жаңа материалдар. Қимылдар тексерілуде.",
        )}
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : shown ? (
        <SignSequencePlayer
          key={`${model}:${run}`}
          modelUrl={
            model === "woman01"
              ? "/avatars/woman01/woman01.glb?v=studio-3"
              : undefined
          }
          plan={shown}
          naturalIdle={false}
          studio
          onLetterChange={letter}
        />
      ) : (
        <p role="status">
          {at("Загружаем движения…", "Loading motions…", "Қимылдар жүктелуде…")}
        </p>
      )}
    </section>
  );
}
