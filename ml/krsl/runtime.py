"""Bounded local video → original 180-D Holistic features → CTC words."""
import json
import time
from pathlib import Path
import cv2
import numpy as np
import mediapipe as mp
import torch
from model import Recognizer, decode_ctc

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
POSE = [11, 12, 13, 14, 15, 16]
FACE = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 61, 291]
MAX_SECONDS = 20
MAX_BYTES = 25 * 1024 * 1024


def vector(result):
    groups = [(result.left_hand_landmarks, range(21)),
              (result.right_hand_landmarks, range(21)),
              (result.pose_landmarks, POSE), (result.face_landmarks, FACE)]
    values = []
    for landmarks, indices in groups:
        for i in indices:
            values.extend((landmarks[i].x, landmarks[i].y, landmarks[i].z)
                          if landmarks and i < len(landmarks) else (0., 0., 0.))
    return np.asarray(values, dtype=np.float32)


class Engine:
    def __init__(self):
        torch.set_num_threads(2)
        # Explicit weights_only prevents executing objects embedded in a pickle.
        ckpt = torch.load(DATA / 'checkpoint.pt', map_location='cpu', weights_only=True)
        vocab = json.loads((DATA / 'vocab.json').read_text())
        self.vocab = vocab['idx2token']
        if isinstance(self.vocab, list):
            self.vocab = {str(i): value for i, value in enumerate(self.vocab)}
        self.model = Recognizer(len(self.vocab), ckpt['cfg'])
        self.model.load_state_dict(ckpt['model_state'], strict=True)
        self.model.eval()
        self.metrics = ckpt.get('metrics', {})
        self.epoch = ckpt.get('epoch')
        options = mp.tasks.vision.HolisticLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(DATA / 'holistic_landmarker.task')),
            running_mode=mp.tasks.vision.RunningMode.IMAGE)
        self.detector = mp.tasks.vision.HolisticLandmarker.create_from_options(options)

    def extract(self, path):
        cap = cv2.VideoCapture(str(path))
        rows = []
        try:
            if not cap.isOpened():
                raise ValueError('Не удалось открыть видео. Используйте MP4 или WebM.')
            fps = cap.get(cv2.CAP_PROP_FPS)
            if not np.isfinite(fps) or not 1 <= fps <= 120:
                raise ValueError('Не удалось определить частоту кадров видео.')
            count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            if count > 0 and count / fps > MAX_SECONDS + .25:
                raise ValueError('Видео слишком длинное. Выберите фрагмент до 20 секунд.')
            # Same frame stepping and raw normalized coordinates as training.
            step = max(1, round(fps / 12))
            n = 0
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if n / fps > MAX_SECONDS + .25:
                    raise ValueError('Видео слишком длинное. Выберите фрагмент до 20 секунд.')
                if frame.shape[0] * frame.shape[1] > 1920 * 1080:
                    raise ValueError('Выберите видео размером не больше 1920 × 1080.')
                if n % step == 0:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    result = self.detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
                    rows.append(vector(result))
                n += 1
            if len(rows) < 6:
                raise ValueError('Видео слишком короткое. Нужен полный жест, хотя бы одна секунда.')
            return np.stack(rows), n / fps
        finally:
            cap.release()

    @torch.inference_mode()
    def predict_features(self, rows):
        x = torch.from_numpy(rows)[None]
        logits = self.model(x, torch.tensor([len(rows)]))[0]
        tokens = decode_ctc(logits, self.vocab)
        probs = logits.softmax(-1)
        ids = probs.argmax(-1)
        nonblank = ids != 0
        # Diagnostic score, NOT calibrated probability of translation correctness.
        score = float(probs.max(-1).values[nonblank].mean()) if nonblank.any() else 0.
        return tokens, score

    def recognize(self, path):
        started = time.monotonic()
        rows, duration = self.extract(path)
        hands = float(np.any(rows[:, :126] != 0, axis=1).mean())
        pose = float(np.any(rows[:, 126:144] != 0, axis=1).mean())
        face = float(np.any(rows[:, 144:] != 0, axis=1).mean())
        base = dict(duration=round(duration, 2), frames=len(rows),
                    tracking={'hands': round(hands, 2), 'body': round(pose, 2), 'face': round(face, 2)},
                    model='KRSL Conformer · stage5', experimental=True)
        if hands < .35 or pose < .5 or face < .3:
            return dict(base, status='no_tracking', text='', tokens=[],
                        message='Не хватает ориентиров. Покажите лицо, плечи и обе руки целиком.',
                        seconds=round(time.monotonic() - started, 2))
        tokens, score = self.predict_features(rows)
        # The source vocabulary contains annotation punctuation; never present
        # bare parentheses, brackets or markup as a recognized human utterance.
        unknown = any(t.startswith('<') or t == '[неизвестный жест]' or
                      not any(c.isalnum() for c in t) for t in tokens)
        if not tokens or unknown or score < .4:
            return dict(base, status='uncertain', text='', tokens=[],
                        message='Модель не смогла надёжно разобрать этот фрагмент. Повторите короткую фразу.',
                        seconds=round(time.monotonic() - started, 2))
        return dict(base, status='draft', text=' '.join(tokens), tokens=tokens,
                    message='Предположение модели: проверьте слова. Это не проверенный перевод.',
                    seconds=round(time.monotonic() - started, 2))

    def close(self):
        self.detector.close()
