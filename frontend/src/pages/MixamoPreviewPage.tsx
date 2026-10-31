import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SignSequencePlayer } from "../components/SignSequencePlayer";
import type { MotionPlan } from "../sign/motion";
import { at } from "../i18n/automation";
import "./sign-workspace.css";

export function MixamoPreviewPage() {
  const [motion, setMotion] = useState("fist");
  const [plan, setPlan] = useState<MotionPlan>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const workshop = !["talking", "standing-idle"].includes(motion);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    setPlan(undefined);
    fetch(
      `/avatars/${workshop ? "hand-workshop" : "mixamo-trial"}/${motion}.json`,
      {
        signal: controller.signal,
      },
    )
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
              revision: m.revision,
              review: "body-motion-trial",
            },
          ],
        }),
      )
      .catch((e) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [attempt, motion, workshop]);
  return (
    <main className="sign-workspace">
      <Link to="/text-to-sign">
        ← {at("К жестам", "Back to signs", "Ымдарға оралу")}
      </Link>
      <h1>
        {at(
          "Проверка рук и движения Mixamo",
          "Hand workshop and Mixamo motion",
          "Қол қимылдары және Mixamo",
        )}
      </h1>
      <p>
        {at(
          "Пять тестов кистей с исправленными весами кожи и два исходных движения Mixamo. Выберите тест, приблизьте руки и посмотрите спереди, сбоку и в три четверти. Это проверка механики аватара, а не урок РЖЯ.",
          "Five hand tests with repaired skin weights and two original Mixamo movements. Choose a test, zoom in and inspect the front, side and three-quarter views. These are mechanical tests, not RSL lessons.",
          "Тері салмақтары түзетілген бес қол сынағы және Mixamo-ның екі қимылы. Сынақты таңдап, қолды жақындатып, алдынан, қырынан және үш ширек көріністе тексеріңіз. Бұл — аватар механикасының сынағы, ым тілі сабағы емес.",
        )}
      </p>
      <label
        style={{ display: "grid", gap: 8, maxWidth: 360, margin: "24px 0" }}
      >
        {at("Выберите движение", "Choose motion", "Қимылды таңдаңыз")}
        <select value={motion} onChange={(e) => setMotion(e.target.value)}>
          <option value="fist">
            {at(
              "Сжать и раскрыть кулак",
              "Close and open fist",
              "Жұдырықты жұму және ашу",
            )}
          </option>
          <option value="point">
            {at("Указательный жест", "Point", "Нұсқау")}
          </option>
          <option value="pinch">{at("Щипок", "Pinch", "Шымшу")}</option>
          <option value="wave">
            {at("Взмах рукой", "Wave", "Қол бұлғау")}
          </option>
          <option value="grasp">
            {at("Захват шара", "Grasp a ball", "Шарды ұстау")}
          </option>
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
          modelUrl={
            motion === "grasp"
              ? "/avatars/hand-workshop/grasp-scene.glb"
              : undefined
          }
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
        ·{" "}
        {workshop
          ? at(
              "Тесты кистей подготовлены в Blender",
              "Hand tests authored in Blender",
              "Қол сынақтары Blender-де дайындалған",
            )
          : motion === "talking"
            ? "Talking"
            : "Standing Idle"}{" "}
        · 30 fps
      </p>
    </main>
  );
}
