import { useEffect, useMemo, useState } from "react";
import { Check, X, HelpCircle, Download, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { SignSequencePlayer } from "../components/SignSequencePlayer";
import { learningDictionary, type DictionaryEntry } from "../sign/dictionary";
import type { MotionAsset, MotionPlan } from "../sign/motion";
import { withVideoAssets } from "../sign/videoAssets";
import { loadAvatarCatalog, loadAvatarReview, type AvatarEntry, type AvatarReview, type AvatarVerdict } from "../sign/avatarLibrary";
import "./avatar-review.css";

/** For a sign-language consultant: compare every avatar clip with the real
 * signer video and mark it. Verdicts stay in this browser until downloaded;
 * the file is then published as /avatars/alex/review.json, and clips marked
 * "wrong" stop being shown to learners. */
const KEY = "rsl-avatar-review-v1";
type Verdicts = AvatarReview["verdicts"];
type Filter = "todo" | "all" | "wrong" | "unsure" | "ok";

function loadLocal(): Verdicts {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function AvatarReviewPage() {
  const [catalog, setCatalog] = useState<AvatarEntry[]>([]);
  const [assets, setAssets] = useState<MotionAsset[]>([]);
  const [words, setWords] = useState<DictionaryEntry[]>([]);
  const [verdicts, setVerdicts] = useState<Verdicts>(loadLocal);
  const [filter, setFilter] = useState<Filter>("todo");
  const [search, setSearch] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      loadAvatarCatalog(),
      fetch("/avatars/sign-motion/catalog.json").then((r) => r.json()),
      fetch("/research/rsl/words/catalog.json").then((r) => r.json()),
      loadAvatarReview(),
    ])
      .then(([c, m, w, published]) => {
        setCatalog(c);
        setAssets(m);
        setWords(w);
        // Published verdicts are the starting point; this browser's marks win.
        setVerdicts((v) => ({ ...published.verdicts, ...v }));
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(verdicts));
    } catch {
      /* session only */
    }
  }, [verdicts]);

  const playable = useMemo(() => {
    const entries = learningDictionary(words, assets);
    return new Map(withVideoAssets(assets, entries).map((a) => [a.id, a]));
  }, [words, assets]);

  const items = useMemo(
    () =>
      catalog
        .filter((e) => playable.has(e.id))
        .map((e) => ({ id: e.id, label: e.label ?? playable.get(e.id)!.label }))
        .sort((a, b) => Number(a.id.startsWith("letter-")) - Number(b.id.startsWith("letter-")) || a.label.localeCompare(b.label, "ru")),
    [catalog, playable],
  );
  const counts = useMemo(() => {
    const c = { ok: 0, wrong: 0, unsure: 0 };
    for (const i of items) {
      const v = verdicts[i.id]?.verdict;
      if (v) c[v]++;
    }
    return c;
  }, [items, verdicts]);
  const shown = items.filter((i) => {
    const v = verdicts[i.id]?.verdict;
    if (search && !i.label.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))) return false;
    return filter === "all" || (filter === "todo" ? !v : v === filter);
  });

  const index = shown.findIndex((i) => i.id === current);
  const item = items.find((i) => i.id === current) ?? shown[0];
  useEffect(() => {
    if (item && item.id !== current) setCurrent(item.id);
  }, [item, current]);
  useEffect(() => setNote(item ? (verdicts[item.id]?.note ?? "") : ""), [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan: MotionPlan | null = useMemo(() => {
    const a = item && playable.get(item.id);
    return a ? { steps: [{ ...a, text: item.label }], missing: [], spelling: item.id.startsWith("letter-") } : null;
  }, [item, playable]);

  const mark = (verdict: AvatarVerdict) => {
    if (!item) return;
    setVerdicts((v) => ({ ...v, [item.id]: { verdict, ...(note.trim() ? { note: note.trim() } : {}) } }));
    // In "to check" the item leaves the list, so the next one moves into place.
    const next = filter === "todo" ? shown[index + 1] ?? shown[index - 1] : shown[index + 1];
    if (next) setCurrent(next.id);
  };
  const move = (d: number) => {
    const next = shown[index + d];
    if (next) setCurrent(next.id);
  };

  const download = () => {
    const file = new Blob([JSON.stringify({ reviewedAt: new Date().toISOString(), verdicts }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = "avatar-review.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = (f: File | undefined) =>
    f?.text().then((t) => {
      try {
        const data = JSON.parse(t) as AvatarReview;
        if (data && typeof data.verdicts === "object") setVerdicts((v) => ({ ...v, ...data.verdicts }));
      } catch {
        /* not a review file */
      }
    });

  const done = counts.ok + counts.wrong + counts.unsure;
  return (
    <div className="sign-workspace avatar-review">
      <header className="ar-head">
        <div>
          <p className="ar-eyebrow">Для консультанта по РЖЯ</p>
          <h1>Проверка аватара</h1>
          <p className="ar-lead">
            Слева настоящий жест с видео, справа его показывает аватар. Если аватар показывает неверно (форма руки, место, движение,
            мимика), отметьте «Неверно» — такой жест больше не будет показан ученикам, вместо него останется видео.
          </p>
        </div>
        <div className="ar-progress" aria-label="Прогресс">
          <b>{done}</b>
          <span>из {items.length || "…"} проверено</span>
          <div className="ar-bar">
            <i className="ok" style={{ width: `${(counts.ok / Math.max(1, items.length)) * 100}%` }} />
            <i className="unsure" style={{ width: `${(counts.unsure / Math.max(1, items.length)) * 100}%` }} />
            <i className="wrong" style={{ width: `${(counts.wrong / Math.max(1, items.length)) * 100}%` }} />
          </div>
          <small>
            верно {counts.ok} · неверно {counts.wrong} · не уверена {counts.unsure}
          </small>
        </div>
      </header>

      {failed && <p className="translate-status error">Не удалось загрузить жесты. Обновите страницу.</p>}

      <div className="ar-layout">
        <aside className="ar-list ar-card">
          <input className="ar-search" placeholder="Найти слово…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="ar-filters" role="tablist">
            {(
              [
                ["todo", "Не проверены"],
                ["wrong", "Неверно"],
                ["unsure", "Не уверена"],
                ["ok", "Верно"],
                ["all", "Все"],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
          </div>
          <ul>
            {shown.slice(0, 400).map((i) => (
              <li key={i.id}>
                <button aria-current={i.id === item?.id} onClick={() => setCurrent(i.id)}>
                  <span>{i.label}</span>
                  {verdicts[i.id] && <em className={`ar-dot ${verdicts[i.id].verdict}`} aria-label={verdicts[i.id].verdict} />}
                </button>
              </li>
            ))}
            {shown.length > 400 && <li className="ar-more">Ещё {shown.length - 400} — воспользуйтесь поиском</li>}
            {!shown.length && items.length > 0 && <li className="ar-more">Здесь пусто 🎉</li>}
          </ul>
        </aside>

        <section className="ar-main ar-card">
          {item && plan ? (
            <>
              <div className="ar-title">
                <button className="ar-nav" onClick={() => move(-1)} disabled={index <= 0} aria-label="Предыдущий">
                  <ChevronLeft size={18} />
                </button>
                <h2>{item.label}</h2>
                <button className="ar-nav" onClick={() => move(1)} disabled={index < 0 || index >= shown.length - 1} aria-label="Следующий">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="ar-compare">
                <figure>
                  <figcaption>Видео (образец)</figcaption>
                  <SignSequencePlayer key={"v" + item.id} plan={plan} only="video" autoPlay />
                </figure>
                <figure>
                  <figcaption>Аватар</figcaption>
                  <SignSequencePlayer key={"a" + item.id} plan={plan} only="avatar" autoPlay />
                </figure>
              </div>
              <textarea
                className="ar-note"
                placeholder="Комментарий (необязательно): что не так — форма руки, место, движение, мимика…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
              <div className="ar-actions">
                <button className="ar-btn ok" onClick={() => mark("ok")} aria-pressed={verdicts[item.id]?.verdict === "ok"}>
                  <Check size={18} /> Верно
                </button>
                <button className="ar-btn unsure" onClick={() => mark("unsure")} aria-pressed={verdicts[item.id]?.verdict === "unsure"}>
                  <HelpCircle size={18} /> Не уверена
                </button>
                <button className="ar-btn wrong" onClick={() => mark("wrong")} aria-pressed={verdicts[item.id]?.verdict === "wrong"}>
                  <X size={18} /> Неверно
                </button>
              </div>
            </>
          ) : (
            <p className="ar-empty">{items.length ? "Выберите слово слева." : "Загружаем жесты…"}</p>
          )}
        </section>
      </div>

      <footer className="ar-foot ar-card">
        <p>
          Отметки сохраняются в этом браузере. Когда закончите (или в конце дня), нажмите «Скачать результаты» и отправьте файл автору
          платформы.
        </p>
        <div>
          <label className="ar-file">
            <Upload size={16} /> Загрузить файл
            <input type="file" accept="application/json" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <button className="ar-download" onClick={download} disabled={!done}>
            <Download size={16} /> Скачать результаты
          </button>
        </div>
      </footer>
    </div>
  );
}
