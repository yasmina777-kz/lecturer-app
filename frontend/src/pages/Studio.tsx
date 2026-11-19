import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AudioLines, Download, FileText, FileVideo, Mic, Pause, Play, RotateCcw, Square, X } from "lucide-react";
import { SPEECH_MODELS, transcribe, type SpeechProgress } from "../local-ai/speech";
import { ProductSurface } from "../components/ProductSurface";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { at } from "../i18n/automation";
import { loadWordCatalog } from "../components/SignChain";
import { alphabetEntries, type DictionaryEntry, type DictionaryForms } from "../sign/dictionary";
import {
  TEMPLATES,
  buildSchedule,
  formatTime,
  itemAt,
  parseSubtitles,
  timeCues,
  translateCue,
  type Cue,
  type Position,
  type ScheduleItem,
} from "../sign/studio";
import { AVATAR_MODEL, useAvatarLibrary } from "../sign/avatarLibrary";
import type { AvatarStage } from "../sign/avatarStage";
import "./studio.css";

const durations = new Map<string, number>();
function loadDuration(src: string) {
  return new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (d: number) => {
      durations.set(src, d);
      v.removeAttribute("src");
      resolve(d);
    };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1.6);
    v.onerror = () => done(1.6);
    v.src = src;
  });
}

const KIND_LABEL: Record<string, string> = {
  sign: "жест",
  form: "форма слова",
  spell: "буквами",
  skip: "не показывается",
  none: "нет жеста",
};

type Step = 1 | 2 | 3;

export function StudioPage() {
  const [words, setWords] = useState<DictionaryEntry[] | null>(null);
  const [forms, setForms] = useState<DictionaryForms>({});
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [step, setStep] = useState<Step>(1);
  const [video, setVideo] = useState<{ url: string; name: string } | null>(null);
  const [videoDur, setVideoDur] = useState(0);
  const [cues, setCues] = useState<Cue[]>(() => TEMPLATES[0].script.split("\n").map((text) => ({ text })));
  const [subsName, setSubsName] = useState("");
  const [position, setPosition] = useState<Position>(TEMPLATES[0].position);
  const [size, setSize] = useState(TEMPLATES[0].size);
  const [captions, setCaptions] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ url: string; ext: string } | null>(null);

  const canvas = useRef<HTMLCanvasElement>(null);
  const main = useRef<HTMLVideoElement>(null);
  const ovA = useRef<HTMLVideoElement>(null);
  const ovB = useRef<HTMLVideoElement>(null);
  const clock = useRef({ base: 0, since: 0, running: false });
  const overlay = useRef({ active: 0, item: -1 });
  // Last decoded frame of each overlay video, so a clip switch never shows a blank box.
  const frames = useRef([0, 1].map(() => ({ cv: document.createElement("canvas"), src: "" })));
  const audio = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const media = useRef<Blob | null>(null);
  const mic = useRef<{ rec: MediaRecorder; started: number } | null>(null);
  const [recording, setRecording] = useState(0);
  const [speechModel, setSpeechModel] = useState(SPEECH_MODELS[1].id);
  const [signer, setSigner] = useState<"avatar" | "video">("avatar");
  const avatarLib = useAvatarLibrary();
  const stage = useRef<AvatarStage | null>(null);
  const [stageReady, setStageReady] = useState(false);
  const [speech, setSpeech] = useState<SpeechProgress | { stage: "error"; message: string } | null>(null);

  useEffect(() => {
    void loadWordCatalog().then(setWords);
    fetch("/research/rsl/words/forms.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setForms)
      .catch(() => {});
  }, []);

  const letters = useMemo(() => alphabetEntries(), []);
  const timed = useMemo(() => (video ? timeCues(cues, videoDur) : cues), [cues, video, videoDur]);
  const translated = useMemo(
    () => (words ? timed.map((c) => translateCue(c.text, words, forms, letters)) : []),
    [timed, words, forms, letters],
  );

  // The avatar shows the same signs from its own clips (same dictionary ids).
  const useAvatar = signer === "avatar" && !!avatarLib;
  const shown = useMemo(
    () =>
      useAvatar
        ? translated.map((ws) =>
            ws.map((w) => ({ ...w, clips: w.clips.map((c) => {
              const e = avatarLib!.get(c.id);
              if (e) durations.set(e.url, e.duration);
              return e ? { ...c, src: e.url } : c;
            }) })),
          )
        : translated,
    [translated, useAvatar, avatarLib],
  );

  // Clip lengths are needed to place clips on the timeline.
  useEffect(() => {
    if (!words) return;
    let alive = true;
    const srcs = [...new Set(shown.flat().flatMap((w) => w.clips.map((c) => c.src)))];
    void Promise.all(srcs.map((s) => (durations.has(s) ? durations.get(s)! : loadDuration(s)))).then(() => {
      if (alive) setSchedule(buildSchedule(timed, shown, (s) => durations.get(s) ?? 1.6));
    });
    return () => {
      alive = false;
    };
  }, [shown, timed, words]);

  // Off-screen 3D avatar, created on first use; clips are loaded before playing.
  useEffect(() => {
    if (signer !== "avatar") return;
    let alive = true;
    void (async () => {
      if (!stage.current) {
        const { AvatarStage } = await import("../sign/avatarStage");
        stage.current ??= new AvatarStage(`${AVATAR_MODEL}?v=2`, "/avatars/alex/ready-idle.glb");
      }
      setStageReady(false);
      await stage.current.prepare(schedule.map((i) => i.src).filter((u) => u.endsWith(".glb")));
      if (alive) setStageReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [signer, schedule]);
  useEffect(() => () => stage.current?.dispose(), []);

  const signsEnd = (schedule[schedule.length - 1]?.end ?? 0) + (video ? 0.5 : 1);
  const total = video ? Math.max(videoDur, signsEnd) : signsEnd;

  const stats = useMemo(() => {
    const all = translated.flat().filter((w) => w.kind !== "skip");
    const n = all.length || 1;
    const count = (k: string) => all.filter((w) => w.kind === k).length;
    return {
      signs: Math.round(((count("sign") + count("form")) / n) * 100),
      spell: Math.round((count("spell") / n) * 100),
      none: count("none"),
    };
  }, [translated]);

  // --- clock -------------------------------------------------------------
  // With media the media is the clock. If the signs run past its end (a short
  // voice note), a virtual "tail" clock carries on until the last sign.
  const tail = useRef(false);
  const onMedia = () => !!state.current.video && !!main.current && !tail.current;
  const now = () => {
    if (onMedia()) return main.current!.currentTime;
    const c = clock.current;
    return c.running ? c.base + (performance.now() - c.since) / 1000 : c.base;
  };
  const play = () => {
    if (now() >= state.current.total - 0.05) seek(0);
    if (onMedia()) void main.current!.play().catch(() => {});
    else clock.current = { base: clock.current.base, since: performance.now(), running: true };
    void audio.current?.ctx.resume();
    setPlaying(true);
  };
  const pause = () => {
    if (onMedia()) main.current!.pause();
    else clock.current = { base: now(), since: 0, running: false };
    setPlaying(false);
  };
  const seek = (t: number) => {
    const m = state.current.video ? main.current : null;
    const inMedia = !!m && t < (m.duration || 0) - 0.02;
    tail.current = !!m && !inMedia;
    if (m) {
      if (inMedia) m.currentTime = t;
      else m.pause();
    }
    clock.current = { base: t, since: performance.now(), running: !inMedia && clock.current.running };
    overlay.current.item = -1;
    setTime(t);
  };
  const onEnded = () => {
    const m = main.current!;
    if (state.current.total > m.duration + 0.1) {
      tail.current = true;
      clock.current = { base: m.duration, since: performance.now(), running: true };
    } else setPlaying(false);
  };

  // --- overlay sync + drawing (one loop renders both preview and export) ---
  const state = useRef({ schedule, timed, captions, position, size, template, video, total, exporting, signer });
  state.current = { schedule, timed, captions, position, size, template, video, total, exporting, signer };

  useEffect(() => {
    const els = [ovA.current, ovB.current];
    const stops: (() => void)[] = [];
    els.forEach((el, i) => {
      if (!el) return;
      const grab = () => {
        if (!el.videoWidth || el.readyState < 2) return;
        const f = frames.current[i];
        const w = 360;
        const h = Math.round((w * el.videoHeight) / el.videoWidth);
        if (f.cv.width !== w || f.cv.height !== h) {
          f.cv.width = w;
          f.cv.height = h;
        }
        f.cv.getContext("2d")!.drawImage(el, 0, 0, w, h);
        f.src = el.dataset.src ?? "";
      };
      let alive = true;
      const rvfc = (el as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
      if (rvfc) {
        const loop = () => {
          grab();
          if (alive) rvfc.call(el, loop);
        };
        rvfc.call(el, loop);
      } else {
        const id = setInterval(grab, 33);
        stops.push(() => clearInterval(id));
      }
      el.addEventListener("loadeddata", grab);
      el.addEventListener("seeked", grab);
      stops.push(() => {
        alive = false;
        el.removeEventListener("loadeddata", grab);
        el.removeEventListener("seeked", grab);
      });
    });
    return () => stops.forEach((f) => f());
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastUi = 0;
    const els = () => [ovA.current!, ovB.current!];
    const load = (el: HTMLVideoElement, item: ScheduleItem) => {
      if (el.dataset.src !== item.src) {
        el.dataset.src = item.src;
        el.src = item.src;
      }
    };
    const sync = (t: number, running: boolean) => {
      const { schedule: items } = state.current;
      const [a, b] = els();
      if (!a || !b) return null;
      const k = itemAt(items, t);
      const o = overlay.current;
      if (k < 0) {
        a.pause();
        b.pause();
        o.item = -1;
        // Before the first sign starts, hold its first frame instead of an empty box.
        const first = items[0];
        if (!first) return null;
        const el = [a, b][o.active];
        load(el, first);
        if (el.currentTime > 0.05 && el.readyState >= 1) el.currentTime = 0;
        const f = frames.current[o.active];
        return f.src === first.src ? f.cv : null;
      }
      const item = items[k];
      const pool = [a, b];
      if (o.item !== k) {
        const other = 1 - o.active;
        if (pool[other].dataset.src === item.src) o.active = other;
        else load(pool[o.active], item);
        pool[1 - o.active].pause();
        o.item = k;
        const next = items[k + 1];
        if (next && pool[1 - o.active].dataset.src !== next.src) load(pool[1 - o.active], next);
      }
      const el = pool[o.active];
      const own = frames.current[o.active];
      const prev = frames.current[1 - o.active];
      const frame = own.src === item.src ? own.cv : prev.src ? prev.cv : null;
      el.playbackRate = item.rate;
      const want = Math.min((t - item.start) * item.rate, (el.duration || 99) - 0.05);
      if (t >= item.end || !running) {
        el.pause();
        if (t < item.end && Math.abs(el.currentTime - want) > 0.08) el.currentTime = want;
      } else {
        if (el.paused) void el.play().catch(() => {});
        if (Math.abs(el.currentTime - want) > 0.3) el.currentTime = want;
      }
      return frame;
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const cv = canvas.current;
      if (!cv) return;
      const s = state.current;
      const t = now();
      const running = onMedia() ? !main.current!.paused : clock.current.running;
      if (!onMedia() && running && t >= s.total) {
        clock.current = { base: s.total, since: 0, running: false };
        setPlaying(false);
      }
      let ov: HTMLCanvasElement | null;
      if (s.signer === "avatar" && stage.current) {
        const k = itemAt(s.schedule, t);
        const it = s.schedule[k];
        const on = it && t < it.end && it.src.endsWith(".glb");
        ov = stage.current.draw(on ? it.src : null, on ? (t - it.start) * it.rate : 0, t);
      } else ov = sync(t, running);
      draw(cv, t, ov);
      if (s.exporting && t >= s.total - 0.05) stopExport();
      if (performance.now() - lastUi > 120) {
        lastUi = performance.now();
        setTime(t);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(cv: HTMLCanvasElement, t: number, ov: HTMLCanvasElement | null) {
    const s = state.current;
    const m = main.current;
    const W = s.video && m?.videoWidth ? Math.min(1280, m.videoWidth) : 1280;
    const H = s.video && m?.videoWidth ? Math.round((W * m.videoHeight) / m.videoWidth) : 720;
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const ctx = cv.getContext("2d")!;
    const cue = s.timed.find((c) => c.start !== undefined && c.end !== undefined && t >= c.start && t < c.end);
    const item = s.schedule[itemAt(s.schedule, t)];
    const text = cue?.text ?? (item && t < item.end + 0.6 ? s.timed[item.cue]?.text : "");
    const pad = Math.round(H * 0.035);
    if (s.video && m && m.readyState >= 2 && m.videoWidth) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(m, 0, 0, W, H);
      const bh = Math.round(H * s.size);
      const bw = Math.round(bh * 0.75);
      const x = s.position.endsWith("r") ? W - bw - pad : pad;
      const y = s.position.startsWith("b") ? H - bh - pad - (s.captions ? Math.round(H * 0.1) : 0) : pad;
      drawSigner(ctx, ov, x, y, bw, bh, s.template.color);
      if (s.captions && text) drawCaption(ctx, text, W, H, pad);
    } else {
      // Standalone message: coloured band, text on the left, signer on the right.
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0f172a");
      g.addColorStop(1, "#1e293b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const bh = Math.round(H * 0.86);
      const bw = Math.round(bh * 0.75);
      const x = W - bw - pad * 2;
      const y = Math.round((H - bh) / 2);
      ctx.fillStyle = s.template.color;
      ctx.fillRect(0, pad * 2, x - pad * 2, Math.round(H * 0.1));
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.round(H * 0.05)}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(s.template.band, pad * 2, pad * 2 + Math.round(H * 0.05));
      if (text) {
        ctx.font = `600 ${Math.round(H * 0.075)}px system-ui, sans-serif`;
        ctx.textBaseline = "top";
        wrap(ctx, text, x - pad * 4).forEach((line, i) => ctx.fillText(line, pad * 2, H * 0.32 + i * H * 0.095));
      }
      drawSigner(ctx, ov, x, y, bw, bh, s.template.color);
    }
  }

  // --- export -----------------------------------------------------------
  function startExport() {
    const cv = canvas.current;
    if (!cv || exporting) return;
    setResult(null);
    seek(0);
    const stream = cv.captureStream(30);
    if (video && main.current) {
      if (!audio.current) {
        const ctx = new AudioContext();
        const src = ctx.createMediaElementSource(main.current);
        const dest = ctx.createMediaStreamDestination();
        src.connect(dest);
        src.connect(ctx.destination);
        audio.current = { ctx, dest };
      }
      audio.current.dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }
    const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
    const mimeType = types.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || mimeType || "video/webm";
      setResult({ url: URL.createObjectURL(new Blob(chunks, { type })), ext: type.includes("mp4") ? "mp4" : "webm" });
      setExporting(false);
    };
    recorder.current = rec;
    rec.start(500);
    setExporting(true);
    state.current.exporting = true;
    play();
  }
  function stopExport() {
    state.current.exporting = false;
    pause();
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
  }

  // --- inputs -----------------------------------------------------------
  function chooseTemplate(id: string) {
    const tpl = TEMPLATES.find((x) => x.id === id)!;
    setTemplate(tpl);
    setPosition(tpl.position);
    setSize(tpl.size);
    setCaptions(tpl.captions);
    if (!subsName) setCues(tpl.script.split("\n").map((text) => ({ text })));
    seek(0);
  }
  function onVideo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (video) URL.revokeObjectURL(video.url);
    pause();
    setVideo({ url: URL.createObjectURL(f), name: f.name });
    media.current = f;
    setResult(null);
  }
  async function recognize(blob = media.current) {
    if (!blob || (speech && speech.stage !== "error")) return;
    try {
      const found = await transcribe(blob, speechModel, setSpeech);
      setSpeech(null);
      if (!found.length) return setSpeech({ stage: "error", message: at("Речь не найдена", "No speech found", "Сөйлеу табылмады") });
      setCues(found);
      setSubsName(at("Распознанная речь", "Recognized speech", "Танылған сөйлеу"));
      setStep(2);
    } catch (e) {
      setSpeech({ stage: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }
  async function toggleMic() {
    if (mic.current) {
      mic.current.rec.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const parts: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        mic.current = null;
        setRecording(0);
        const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
        if (video) URL.revokeObjectURL(video.url);
        setVideo({ url: URL.createObjectURL(blob), name: at("Запись голоса", "Voice recording", "Дауыс жазбасы") });
        media.current = blob;
        setResult(null);
        void recognize(blob);
      };
      rec.start(250);
      mic.current = { rec, started: Date.now() };
      setRecording(1);
    } catch {
      setSpeech({ stage: "error", message: at("Нет доступа к микрофону", "Microphone not available", "Микрофонға рұқсат жоқ") });
    }
  }
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => mic.current && setRecording(1 + Math.floor((Date.now() - mic.current.started) / 1000)), 500);
    return () => clearInterval(id);
  }, [recording > 0]);
  async function onSubs(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const parsed = parseSubtitles(await f.text());
    if (!parsed.length) return alert(at("В файле не нашлось субтитров", "No subtitles found in the file", "Файлда субтитр жоқ"));
    setCues(parsed);
    setSubsName(f.name);
    setStep(2);
  }
  function editScript(value: string) {
    const lines = value.split("\n");
    setCues(lines.map((text, i) => ({ ...(subsName ? cues[i] : {}), text })));
  }
  function removeVideo() {
    if (video) URL.revokeObjectURL(video.url);
    pause();
    setVideo(null);
    media.current = null;
    setVideoDur(0);
    setResult(null);
    seek(0);
  }

  const activeCue = schedule[itemAt(schedule, time)]?.cue ?? -1;

  return (
    <ProductSurface className="studio-shell">
      <header className="studio-top">
        <Link to="/learn" className="studio-back" aria-label={at("Назад к обучению", "Back to learning", "Оқуға оралу")}>
          <ArrowLeft size={18} />
        </Link>
        <strong>AI Mentor · {at("Студия", "Studio", "Студия")}</strong>
        <span className="studio-sub">{at("сурдоперевод для видео", "sign-language overlay for video", "бейнеге ымдық аударма")}</span>
        <ThemeSwitcher />
      </header>
      <main className="studio">
        <section className="studio-stage">
          <div className="studio-canvas-wrap">
            <canvas ref={canvas} onClick={() => (playing ? pause() : play())} aria-label={at("Предпросмотр", "Preview", "Алдын ала қарау")} />
            <div className="studio-hidden-videos" aria-hidden>
            {video && (
              <video
                ref={main}
                src={video.url}
                playsInline
                onLoadedMetadata={(e) => setVideoDur(e.currentTarget.duration || 0)}
                onPause={() => !tail.current && setPlaying(false)}
                onEnded={onEnded}
                onPlay={() => setPlaying(true)}
              />
            )}
            <video ref={ovA} muted playsInline preload="auto" />
            <video ref={ovB} muted playsInline preload="auto" />
          </div>
            {!words && <div className="studio-loading">{at("Загружаем словарь…", "Loading dictionary…", "Сөздік жүктелуде…")}</div>}
          </div>
          <div className="studio-transport">
            <button className="icon-button" onClick={() => (playing ? pause() : play())} disabled={exporting} aria-label={playing ? "Пауза" : "Играть"}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(total, 0.1)}
              step={0.05}
              value={Math.min(time, total)}
              disabled={exporting}
              onChange={(e) => seek(+e.target.value)}
              aria-label={at("Позиция", "Position", "Орын")}
            />
            <span className="studio-time">
              {formatTime(time)} / {formatTime(total)}
            </span>
          </div>

        </section>

        <aside className="studio-panel">
          <ol className="studio-steps">
            {([1, 2, 3] as Step[]).map((n) => (
              <li key={n}>
                <button aria-current={step === n ? "step" : undefined} onClick={() => setStep(n)}>
                  <span>{n}</span>
                  {n === 1 ? at("Загрузка", "Upload", "Жүктеу") : n === 2 ? at("Проверка", "Review", "Тексеру") : at("Скачать", "Download", "Жүктеп алу")}
                </button>
              </li>
            ))}
          </ol>

          {step === 1 && (
            <div className="studio-body">
              <div className="studio-templates">
                {TEMPLATES.map((t) => (
                  <button key={t.id} aria-pressed={t.id === template.id} onClick={() => chooseTemplate(t.id)} style={{ ["--tpl" as string]: t.color }}>
                    {t.title}
                  </button>
                ))}
              </div>
              <div className="studio-signer" role="radiogroup" aria-label={at("Кто показывает жесты", "Who signs", "Ымды кім көрсетеді")}>
                <span>{at("Переводчик", "Interpreter", "Аудармашы")}</span>
                <button role="radio" aria-checked={signer === "avatar"} onClick={() => setSigner("avatar")}>
                  {at("Аватар Алекс", "Avatar Alex", "Алекс аватары")}
                </button>
                <button role="radio" aria-checked={signer === "video"} onClick={() => setSigner("video")}>
                  {at("Видео людей", "Signer videos", "Адамдар бейнесі")}
                </button>
              </div>
              <div className="studio-files">
                <label className="studio-file">
                  <FileVideo size={18} />
                  <span>{video ? video.name : at("Видео или аудио", "Video or audio", "Бейне не аудио")}</span>
                  <input type="file" accept="video/*,audio/*" onChange={onVideo} />
                </label>
                {video && (
                  <button className="icon-button" onClick={removeVideo} aria-label={at("Убрать видео", "Remove video", "Бейнені алып тастау")}>
                    <X size={16} />
                  </button>
                )}
                <label className="studio-file">
                  <FileText size={18} />
                  <span>{subsName || at("Субтитры .srt / .vtt", "Subtitles .srt / .vtt", "Субтитр .srt / .vtt")}</span>
                  <input type="file" accept=".srt,.vtt,text/vtt" onChange={onSubs} />
                </label>
              </div>
              <div className="studio-voice">
                <button className={`button secondary${recording ? " recording" : ""}`} onClick={toggleMic} disabled={!!speech && speech.stage !== "error"}>
                  {recording ? <Square size={16} /> : <Mic size={16} />}
                  {recording ? `${at("Стоп", "Stop", "Тоқтату")} · ${recording - 1} c` : at("Сказать голосом", "Speak", "Дауыспен айту")}
                </button>
                {video && !recording && (
                  <button className="button secondary" onClick={() => void recognize()} disabled={!!speech && speech.stage !== "error"}>
                    <AudioLines size={16} />
                    {at("Речь из файла → текст", "Speech in file → text", "Файлдағы сөйлеу → мәтін")}
                  </button>
                )}
                <select value={speechModel} onChange={(e) => setSpeechModel(e.target.value)} aria-label={at("Качество распознавания речи", "Speech recognition quality", "Сөйлеуді тану сапасы")}>
                  {SPEECH_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · {m.size}
                    </option>
                  ))}
                </select>
              </div>
              {speech && (
                <p className={`studio-hint${speech.stage === "error" ? " studio-error" : ""}`} role="status">
                  {speech.stage === "decoding"
                    ? at("Читаем звук…", "Reading audio…", "Дыбыс оқылуда…")
                    : speech.stage === "download"
                      ? `${at("Загружаем модель речи (один раз)", "Downloading speech model (once)", "Сөйлеу моделі жүктелуде (бір рет)")}: ${speech.percent}%`
                      : speech.stage === "transcribing"
                        ? at("Распознаём речь… звук не покидает компьютер", "Recognizing speech… audio stays on this device", "Сөйлеу танылуда… дыбыс компьютерде қалады")
                        : speech.message}
                </p>
              )}
              <label className="studio-label" htmlFor="studio-script">
                {at("Текст — одна строка = одна фраза", "Text — one line per phrase", "Мәтін — бір жол = бір сөйлем")}
              </label>
              <textarea id="studio-script" value={cues.map((c) => c.text).join("\n")} onChange={(e) => editScript(e.target.value)} rows={7} />
              <button className="button primary" onClick={() => setStep(2)}>
                {at("Дальше: проверка", "Next: review", "Келесі: тексеру")}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="studio-body">
              <div className="studio-legend">
                <span className="k-sign">{stats.signs}% {at("жестами", "signed", "ыммен")}</span>
                <span className="k-spell">{stats.spell}% {at("буквами", "spelled", "әріппен")}</span>
                {stats.none > 0 && <span className="k-none">{stats.none} {at("без жеста", "no sign", "ымсыз")}</span>}
              </div>
              <ol className="studio-cues">
                {timed.map((c, i) => (
                  <li key={i} className={i === activeCue ? "active" : undefined}>
                    <button className="studio-cue-time" onClick={() => seek(schedule.find((s) => s.cue === i)?.start ?? c.start ?? 0)}>
                      {formatTime(schedule.find((s) => s.cue === i)?.start ?? c.start ?? 0)}
                    </button>
                    <div className="studio-words">
                      {(translated[i] ?? []).map((w, j) => (
                        <span key={j} className={`k-${w.kind}`} title={KIND_LABEL[w.kind]}>
                          {w.text}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="studio-hint">
                {at(
                  "Зелёное — есть жест. Жёлтое — покажется по буквам. Красное — жеста нет, лучше заменить слово. Серое — предлог, в РЖЯ обычно не показывается. Править текст — в шаге 1.",
                  "Green: a sign exists. Yellow: fingerspelled. Red: no sign, better reword. Grey: a preposition RSL usually omits. Edit the text in step 1.",
                  "Жасыл — ым бар. Сары — әріппен. Қызыл — ым жоқ. Сұр — көрсетілмейді. Мәтінді 1-қадамда түзетіңіз.",
                )}
              </p>
              <button className="button primary" onClick={() => setStep(3)}>
                {at("Дальше: скачать", "Next: download", "Келесі: жүктеп алу")}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="studio-body">
              {video && (
                <>
                  <span className="studio-label">{at("Где окно переводчика", "Interpreter window", "Аудармашы терезесі")}</span>
                  <div className="studio-positions">
                    {(["tl", "tr", "bl", "br"] as Position[]).map((p) => (
                      <button key={p} aria-pressed={p === position} onClick={() => setPosition(p)} className={`pos-${p}`} aria-label={p}>
                        <i />
                      </button>
                    ))}
                  </div>
                  <label className="studio-label">
                    {at("Размер окна", "Window size", "Терезе өлшемі")}
                    <input type="range" min={0.3} max={0.7} step={0.02} value={size} onChange={(e) => setSize(+e.target.value)} />
                  </label>
                </>
              )}
              <label className="studio-check">
                <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
                {at("Субтитры внизу", "Captions", "Субтитрлер")}
              </label>
              {exporting ? (
                <div className="studio-export">
                  <div className="studio-progress">
                    <i style={{ width: `${Math.min(100, (time / Math.max(total, 0.1)) * 100)}%` }} />
                  </div>
                  <button className="button secondary" onClick={stopExport}>
                    <Square size={16} />
                    {at("Остановить запись", "Stop recording", "Жазуды тоқтату")}
                  </button>
                </div>
              ) : (
                <button className="button primary" onClick={startExport} disabled={!schedule.length || (signer === "avatar" && !stageReady)}>
                  <RotateCcw size={16} />
                  {at("Записать видео", "Render video", "Бейнені жазу")} · {formatTime(total)}
                </button>
              )}
              {result && (
                <a className="button primary" href={result.url} download={`${template.id}-rsl.${result.ext}`}>
                  <Download size={16} />
                  {at("Скачать", "Download", "Жүктеп алу")} .{result.ext}
                </a>
              )}
              <p className="studio-hint">
                {at(
                  "Запись идёт в реальном времени прямо в браузере. Видео никуда не отправляется.",
                  "Rendering runs in real time in the browser. Your video is never uploaded.",
                  "Жазу браузерде нақты уақытта жүреді. Бейне ешқайда жіберілмейді.",
                )}
              </p>
            </div>
          )}
        </aside>
      </main>
    </ProductSurface>
  );
}

function drawSigner(ctx: CanvasRenderingContext2D, ov: HTMLCanvasElement | null, x: number, y: number, w: number, h: number, accent: string) {
  const r = Math.round(w * 0.06);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, "#eef1f5");
  bg.addColorStop(1, "#d3d9e2");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();
  if (ov && ov.width > 1) {
    const s = Math.max(w / ov.width, h / ov.height);
    const dw = ov.width * s;
    const dh = ov.height * s;
    ctx.drawImage(ov, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  ctx.restore();
  ctx.lineWidth = Math.max(2, Math.round(w * 0.012));
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, W: number, H: number, pad: number) {
  const fs = Math.round(H * 0.045);
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  const lines = wrap(ctx, text, W * 0.8).slice(-2);
  const bh = lines.length * fs * 1.3 + fs * 0.6;
  ctx.fillStyle = "rgba(0,0,0,.72)";
  ctx.fillRect(0, H - bh - pad * 0.5, W, bh);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H - bh - pad * 0.5 + fs * 0.3 + i * fs * 1.3));
  ctx.textAlign = "start";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
