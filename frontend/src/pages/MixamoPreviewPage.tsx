import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SignSequencePlayer } from "../components/SignSequencePlayer";
import type { MotionPlan } from "../sign/motion";
import { at } from "../i18n/automation";
import "./sign-workspace.css";

export function MixamoPreviewPage() {
  const [motion, setMotion] = useState("talking");
  const [plan, setPlan] = useState<MotionPlan>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    setPlan(undefined);
    fetch(`/avatars/mixamo-trial/${motion}.json`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Missing motion");
        return r.json();
      })
      .then((m) =>
        setPlan({
          missing: [],
          spelling: false,
          steps: [
            {
              id: "mixamo-" + motion,
              label: m.label,
              text: m.label,
              duration: m.duration,
              url: m.url,
              review: "body-motion-trial",
            },
          ],
        }),
      )
      .catch((e) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [attempt, motion]);
  return (
    <main className="sign-workspace">
      <Link to="/text-to-sign">
        ← {at("К жестам", "Back to signs", "Ымдарға оралу")}
      </Link>
      <h1>
        {at(
          "Пробуем движения Mixamo",
          "Mixamo motion trial",
          "Mixamo қимылдарын сынау",
        )}
      </h1>
      <p>
        {at(
          "Два примера из Mixamo на нашей наставнице: спокойная стойка и разговорные жесты. Нажмите «Показать всё», чтобы оценить стойку, перенос веса и движение рук.",
          "Two Mixamo examples on our mentor: standing idle and conversational gestures. Press Play all to inspect the posture, weight shift and arms.",
          "Тәлімгерімізде Mixamo-ның екі мысалы: тыныш тұру және әңгімелесу қимылдары. Дене қалпы мен қол қимылын бағалау үшін «Толық көрсету» түймесін басыңыз.",
        )}
      </p>
      <label
        style={{ display: "grid", gap: 8, maxWidth: 360, margin: "24px 0" }}
      >
        {at("Выберите движение", "Choose motion", "Қимылды таңдаңыз")}
        <select value={motion} onChange={(e) => setMotion(e.target.value)}>
          <option value="talking">
            {at(
              "Разговорные жесты",
              "Conversational gestures",
              "Әңгімелесу қимылдары",
            )}
          </option>
          <option value="standing-idle">
            {at("Спокойная стойка", "Standing idle", "Тыныш тұру")}
          </option>
        </select>
      </label>
      {failed ? (
        <p role="alert">
          {at(
            "Не удалось загрузить движение.",
            "Could not load the motion.",
            "Қимыл жүктелмеді.",
          )}{" "}
          <button
            className="button secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {at("Повторить", "Retry", "Қайталау")}
          </button>
        </p>
      ) : plan ? (
        <SignSequencePlayer
          key={motion}
          plan={plan}
          framing="body"
          note={at(
            "Это проба естественных движений тела, а не жест РЖЯ. Во время обучения сохраняются отдельные движения букв и слов.",
            "This is a body movement trial, not an RSL sign. Lessons keep their separate letter and word motions.",
            "Бұл — дене қимылының сынағы, ым тілі емес. Сабақтарда әріптер мен сөздердің жеке қимылдары сақталады.",
          )}
        />
      ) : (
        <p role="status">
          {at("Загружаем движение…", "Loading motion…", "Қимыл жүктелуде…")}
        </p>
      )}
      <p>
        <a href="https://www.mixamo.com/" target="_blank" rel="noreferrer">
          Adobe Mixamo
        </a>{" "}
        · {motion === "talking" ? "Talking" : "Standing Idle"} · 30 fps
      </p>
    </main>
  );
}
