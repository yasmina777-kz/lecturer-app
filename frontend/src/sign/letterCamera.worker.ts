import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { LiveLetterStream, trackingQuality } from "./liveRecognition";
import { temporalFrame, recognizeSequence } from "./temporal";
import type { SignClassifier } from "./recognition";

let detector: HandLandmarker;
let model: SignClassifier;
const live = new LiveLetterStream();
// Detection and classification run off the UI thread. Only one bitmap is in flight.
self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const [files, response] = await Promise.all([
        FilesetResolver.forVisionTasks(`${data.origin}/models/rsl/wasm`),
        fetch(`${data.origin}/models/rsl/alphabet-classifier.json`),
      ]);
      if (!response.ok) throw new Error("model");
      model = await response.json();
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${data.origin}/models/rsl/hand_landmarker.task`,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numHands: 2,
      });
      self.postMessage({ type: "ready" });
    } catch (error) {
      console.error("Letter worker initialization:", error);
      self.postMessage({
        type: "error",
        message: "Не удалось загрузить распознавание букв. Обновите страницу.",
      });
    }
  } else if (data.type === "reset") live.reset();
  else if (data.type === "frame") {
    try {
      const detected = detector.detect(data.bitmap);
      const quality = trackingQuality(detected);
      const frames = live.sample(temporalFrame(detected), data.now, quality);
      const prediction = frames ? recognizeSequence(frames, model) : null;
      const accepted = frames ? live.confirm(prediction) : false;
      self.postMessage({
        type: "frame",
        generation: data.generation,
        detected,
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
