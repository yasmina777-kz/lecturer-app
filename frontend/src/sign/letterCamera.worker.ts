import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  FaceLandmarker,
} from "@mediapipe/tasks-vision";
import { LETTER_SAMPLE_MS, LiveLetterStream, trackingQuality } from "./liveRecognition";
import { BODY_CHANNELS, bodyFrame, temporalFrame, recognizeSequence, completedLetterFrames, type TemporalFrame } from "./temporal";
import { agreeLetters } from "./phraseCapture";
import { FACE_POINTS } from "./faceContours";
import { validClassifier, type SignClassifier } from "./recognition";
import { loadSeqModel, type SeqModel } from "./seqModel";

let detector: HandLandmarker;
let model: SignClassifier;
let verifier: SignClassifier;
let balancedModel: SeqModel;
let mode: "balanced" | "strict" = "balanced";
let capture: {generation: number; frames: TemporalFrame[]; sampledAt: number} | null = null;

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
/** Face contours for the on-screen guide (eyes, brows, lips, oval) — the
 * face carries grammar in sign language. A few times a second is enough to
 * draw; recognition models do not read it yet. */
let faceDetector: FaceLandmarker | undefined;
let faceLoading = false;
let faceAt = -Infinity;
let lastFace: number[] = [];
function loadFace() {
  if (faceDetector || faceLoading || !visionFiles) return;
  faceLoading = true;
  void FaceLandmarker.createFromOptions(visionFiles, {
    baseOptions: { modelAssetPath: `${self.location.origin}/models/rsl/face_landmarker.task`, delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 1,
  })
    .then((f) => (faceDetector = f))
    .catch(() => undefined)
    .finally(() => (faceLoading = false));
}
let visionFiles: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | undefined;
let poseRestarting = false;
let poseRetryAt = -Infinity;
let selectedSide = "";
let poseAt = -Infinity;
/** Smoothed milliseconds one pose detection takes on this device. */
let poseCost = 0;
let lastPose: import("@mediapipe/tasks-vision").NormalizedLandmark[] = [];

const live = new LiveLetterStream();
let withBody = false;

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
        fetch(`${data.origin}/models/rsl/alphabet-v6-classifier.json`).then((r) => (r.ok ? r : fetch(`${data.origin}/models/rsl/alphabet-v5-classifier.json`))),
      ]);
      visionFiles = files;
      if (!response.ok || !verifyResponse.ok || !balancedResponse.ok) throw new Error("model");
      model = await response.json();
      verifier = await verifyResponse.json();
      const balancedFile = await balancedResponse.json();
      const balanced = loadSeqModel(balancedFile);
      if (!balanced) throw new Error("Invalid alphabet model");
      balancedModel = balanced;
      // v6 also reads the body (pose) channels and may show a letter after one window.
      withBody = balanced.channels === 66 + BODY_CHANNELS;
      live.agree = Number(balancedFile.agree) >= 1 ? Number(balancedFile.agree) : 2;
      if (
        !validClassifier(model) ||
        !validClassifier(verifier) ||
        model.mean.length !== 474 ||
        verifier.mean.length !== 474 ||
        balancedModel.labels.length !== 34
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
    capture = {generation: data.generation, frames: [], sampledAt: -Infinity};
    live.reset();
  } else if (data.type === "capture-finish") {
    if (capture?.generation === data.generation) finishLetter();
  } else if (data.type === "frame") {
    try {
      const detected = detector.detectForVideo(data.bitmap, data.now);
      if (!poseDetector) recoverPoseDetector(data.now);
      try {
        // The word and letter models read hand position relative to the body
        // and were trained with a pose on every frame, so while hands are in
        // view the pose runs every frame (a stale pose from 500 ms ago put the
        // hands next to the wrong body position). Without hands two updates a
        // second keep the framing guide alive. Slow machines fall back to
        // ~10 poses a second instead of starving the hand tracker.
        const poseEvery = detected.landmarks.length ? (poseCost > 30 ? 100 : 0) : 500;
        if (data.now - poseAt >= poseEvery) {
          const t0 = performance.now();
          lastPose =
            poseDetector?.detectForVideo(data.bitmap, data.now).landmarks[0] ??
            [];
          poseCost = poseCost * 0.8 + (performance.now() - t0) * 0.2;
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
      const hand = temporalFrame(selected);
      const frame = withBody
        ? [...hand, ...bodyFrame(hand, lastPose, (data.bitmap?.width ?? 1) / Math.max(1, data.bitmap?.height ?? 1))]
        : hand;
      const capturing = capture !== null;
      // Keep explicit captures at the trained 100 ms cadence even when the
      // page polls the camera faster for word recognition.
      if (capture && capture.generation === data.generation && data.now - capture.sampledAt >= LETTER_SAMPLE_MS - 5) {
        capture.sampledAt = data.now;
        capture.frames.push(quality === "ready" ? frame : Array(frame.length).fill(0));
        if (capture.frames.length >= 100) finishLetter();
      }
      const frames = capturing ? null : live.sample(frame, data.now, quality);
      const primary = frames ? recognizeSequence(frames, mode === "strict" ? model : balancedModel) : null;
      const second = frames && mode === "strict" ? recognizeSequence(frames, verifier) : null;
      const prediction = mode === "strict" ? agreeLetters(primary, second) : primary;
      const accepted = frames ? live.confirm(prediction) : false;
      loadFace();
      if (faceDetector && data.now - faceAt >= 150) {
        faceAt = data.now;
        try {
          const f = faceDetector.detectForVideo(data.bitmap, data.now).faceLandmarks[0];
          lastFace = f ? FACE_POINTS.flatMap((i) => [f[i].x, f[i].y]) : [];
        } catch {
          lastFace = [];
        }
      }
      self.postMessage({
        type: "frame",
        generation: data.generation,
        detected,
        pose: lastPose,
        face: lastFace,
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
