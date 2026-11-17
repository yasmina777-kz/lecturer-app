import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { LiveLetterStream, trackingQuality } from "./liveRecognition";
import { temporalFrame, recognizeSequence, completedLetterFrames, type TemporalFrame } from "./temporal";
import { agreeLetters } from "./phraseCapture";
import { validClassifier, type SignClassifier } from "./recognition";

let detector: HandLandmarker;
let model: SignClassifier;
let verifier: SignClassifier;
let balancedModel: SignClassifier;
let mode: "balanced" | "strict" = "balanced";
let capture: {generation: number; frames: TemporalFrame[]} | null = null;

function finishLetter() {
  if (!capture) return;
  const {generation, frames: observed} = capture;
  capture = null;
  const frames = completedLetterFrames(observed);
  const primary = frames ? recognizeSequence(frames, mode === "strict" ? model : balancedModel) : null;
  const prediction = mode === "strict" ? agreeLetters(primary, frames ? recognizeSequence(frames, verifier) : null) : primary;
  live.reset();
  if (prediction?.accepted) live.acknowledge(prediction.label);
  self.postMessage({type: "captured", generation, prediction});
}
let poseDetector: PoseLandmarker | undefined;
let visionFiles: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | undefined;
let poseRestarting = false;
let poseRetryAt = -Infinity;
let selectedSide = "";
let poseAt = -Infinity;
let lastPose: import("@mediapipe/tasks-vision").NormalizedLandmark[] = [];

const live = new LiveLetterStream();

function recoverPoseDetector(now: number) {
  if (!visionFiles || poseRestarting || now < poseRetryAt) return;
  poseRestarting = true;
  poseRetryAt = now + 2000;
  void PoseLandmarker.createFromOptions(visionFiles, {
    baseOptions: {
      modelAssetPath: `${self.location.origin}/models/rsl/pose_landmarker_lite.task`,
      delegate: "CPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    outputSegmentationMasks: false,
  })
    .then((next) => {
      poseDetector = next;
      poseAt = -Infinity;
      lastPose = [];
      self.postMessage({ type: "body-ready" });
    })
    .catch(() => {
      self.postMessage({ type: "body-error" });
    })
    .finally(() => {
      poseRestarting = false;
    });
}

// Detection and classification run off the UI thread. Only one bitmap is in flight.
self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const [files, response, verifyResponse, balancedResponse] = await Promise.all([
        FilesetResolver.forVisionTasks(`${data.origin}/models/rsl/wasm`),
        fetch(`${data.origin}/models/rsl/alphabet-classifier.json`),
        fetch(`${data.origin}/models/rsl/alphabet-cautious-classifier.json`),
        fetch(`${data.origin}/models/rsl/alphabet-v4-classifier.json`),
      ]);
      visionFiles = files;
      if (!response.ok || !verifyResponse.ok || !balancedResponse.ok) throw new Error("model");
      model = await response.json();
      verifier = await verifyResponse.json();
      balancedModel = await balancedResponse.json();
      if (
        !validClassifier(model) ||
        !validClassifier(verifier) ||
        !validClassifier(balancedModel) ||
        model.mean.length !== 474 ||
        verifier.mean.length !== 474 ||
        balancedModel.mean.length !== 474
      )
        throw new Error("Invalid alphabet model");
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
        fatal: true,
        message: "Не удалось загрузить распознавание букв. Обновите страницу.",
      });
    }
  } else if (data.type === "reset") {
    capture = null;
    mode = data.mode === "strict" ? "strict" : "balanced";
    live.reset();
    selectedSide = "";
    poseAt = -Infinity;
    lastPose = [];
  } else if (data.type === "capture-start") {
    capture = {generation: data.generation, frames: []};
    live.reset();
  } else if (data.type === "capture-finish") {
    if (capture?.generation === data.generation) finishLetter();
  } else if (data.type === "frame") {
    try {
      const detected = detector.detectForVideo(data.bitmap, data.now);
      if (!poseDetector) recoverPoseDetector(data.now);
      try {
        // Framing feedback needs fewer updates than fingers. Do not block every
        // hand frame on a second neural network; discard stale poses on gaps.
        // Pose landmarks are only used for the body guide and phrase-capture
        // framing. Running this second CPU model four times per second competes
        // with the hand classifier on laptops and throttled mobile browsers.
        // Two updates per second keep the guide responsive while freeing the
        // worker for hand tracking on every sampled frame.
        if (data.now - poseAt >= 500) {
          lastPose =
            poseDetector?.detectForVideo(data.bitmap, data.now).landmarks[0] ??
            [];
          poseAt = data.now;
        }
      } catch {
        lastPose = [];
        const failedPoseDetector = poseDetector;
        poseDetector = undefined;
        try {
          failedPoseDetector?.close();
        } catch {
          /* A failed WASM graph may already be closed. */
        }
        self.postMessage({ type: "body-error" });
        recoverPoseDetector(data.now);
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
        if (selectedSide && side !== selectedSide) {
          live.reset(true);
          if (capture) capture.frames = [];
        }
        selectedSide = side;
      }
      const selected = {
        landmarks: index < 0 ? [] : [detected.landmarks[index]],
        worldLandmarks: index < 0 ? [] : [detected.worldLandmarks[index]],
        handedness: index < 0 ? [] : [detected.handedness[index]],
        handednesses: index < 0 ? [] : [detected.handedness[index]],
      };
      const quality = trackingQuality(selected);
      const frame = temporalFrame(selected);
      const capturing = capture !== null;
      if (capture && capture.generation === data.generation) {
        capture.frames.push(quality === "ready" ? frame : Array(66).fill(0));
        if (capture.frames.length >= 100) finishLetter();
      }
      const frames = capturing ? null : live.sample(frame, data.now, quality);
      const primary = frames ? recognizeSequence(frames, mode === "strict" ? model : balancedModel) : null;
      const second = frames && mode === "strict" ? recognizeSequence(frames, verifier) : null;
      const prediction = mode === "strict" ? agreeLetters(primary, second) : primary;
      const accepted = frames ? live.confirm(prediction) : false;
      self.postMessage({
        type: "frame",
        generation: data.generation,
        detected,
        pose: lastPose,
        bodyAvailable: !!poseDetector,
        disagreement: !!(primary?.accepted && !prediction?.accepted),
        quality,
        progress: live.progress,
        prediction,
        accepted,
      });
    } catch {
      self.postMessage({
        type: "error",
        generation: data.generation,
        message:
          "Не удалось прочитать кадр. Остановите и включите камеру снова.",
      });
    } finally {
      data.bitmap?.close();
    }
  }
};
