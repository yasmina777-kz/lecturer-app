import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { LiveLetterStream, trackingQuality } from "./liveRecognition";
import { temporalFrame, recognizeSequence } from "./temporal";
import { agreeLetters } from "./phraseCapture";
import type { SignClassifier } from "./recognition";

let detector: HandLandmarker;
let model: SignClassifier;
let verifier: SignClassifier;
let poseDetector: PoseLandmarker | undefined;
let selectedSide = "";

const live = new LiveLetterStream();
// Detection and classification run off the UI thread. Only one bitmap is in flight.
self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const [files, response, verifyResponse] = await Promise.all([
        FilesetResolver.forVisionTasks(`${data.origin}/models/rsl/wasm`),
        fetch(`${data.origin}/models/rsl/alphabet-classifier.json`),
        fetch(`${data.origin}/models/rsl/alphabet-cautious-classifier.json`),
      ]);
      if (!response.ok || !verifyResponse.ok) throw new Error("model");
      model = await response.json();
      verifier = await verifyResponse.json();
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${data.origin}/models/rsl/hand_landmarker.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minTrackingConfidence: 0.7,
      });
      try {
        poseDetector = await PoseLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath: `${data.origin}/models/rsl/pose_landmarker_lite.task`,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          outputSegmentationMasks: false,
        });
      } catch {
        self.postMessage({ type: "body-error" });
      }
      self.postMessage({ type: "ready" });
    } catch (error) {
      console.error("Letter worker initialization:", error);
      self.postMessage({
        type: "error",
        message: "Не удалось загрузить распознавание букв. Обновите страницу.",
      });
    }
  } else if (data.type === "reset") {
    live.reset();
    selectedSide = "";
  } else if (data.type === "frame") {
    try {
      const detected = detector.detectForVideo(data.bitmap, data.now);
      let pose: import("@mediapipe/tasks-vision").NormalizedLandmark[] = [];
      try {
        pose =
          poseDetector?.detectForVideo(data.bitmap, data.now).landmarks[0] ??
          [];
      } catch {
        self.postMessage({ type: "body-error" });
      }
      // Use the trained largest-hand rule, but reset whenever its identity
      // changes: one sequence must never splice left and right hands.
      let index = -1;
      if (detected.landmarks.length) {
        const area = (ps: (typeof detected.landmarks)[number]) =>
          (Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x))) *
          (Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y)));
        index = detected.landmarks.reduce(
          (best, ps, i) =>
            area(ps) > area(detected.landmarks[best]) ? i : best,
          0,
        );
        const side = detected.handedness[index]?.[0]?.categoryName ?? "";
        if (selectedSide && side !== selectedSide) live.reset(true);
        selectedSide = side;
      }
      const selected = {
        landmarks: index < 0 ? [] : [detected.landmarks[index]],
        worldLandmarks: index < 0 ? [] : [detected.worldLandmarks[index]],
        handedness: index < 0 ? [] : [detected.handedness[index]],
        handednesses: index < 0 ? [] : [detected.handedness[index]],
      };
      const quality = trackingQuality(selected);
      const frames = live.sample(temporalFrame(selected), data.now, quality);
      const primary = frames ? recognizeSequence(frames, model) : null;
      const second = frames ? recognizeSequence(frames, verifier) : null;
      const prediction = agreeLetters(primary, second);
      const accepted = frames ? live.confirm(prediction) : false;
      self.postMessage({
        type: "frame",
        generation: data.generation,
        detected,
        pose,
        disagreement: !!(primary?.accepted && !prediction?.accepted),
        quality,
        progress: live.progress,
        prediction,
        accepted,
      });
    } catch {
      self.postMessage({
        type: "error",
        message:
          "Не удалось прочитать кадр. Остановите и включите камеру снова.",
      });
    } finally {
      data.bitmap.close();
    }
  }
};
