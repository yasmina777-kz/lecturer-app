"""Face channels for word recognition (Python twin of faceRow in
frontend/src/sign/wordFeatures.ts). From MediaPipe Face Landmarker output:
17 blendshape groups (left/right averaged: brows = RSL question grammar, mouth =
mouthing of the Russian word, cheeks) + head yaw/pitch/roll from landmarks
(image coords, aspect-corrected; head shake / nod) + a face-found flag = 21.
Yaw and roll are NOT mirrored here; clip features mirror them for left-handed signers."""
import math

FACE = 21
GROUPS = [
    ['browInnerUp'], ['browDownLeft', 'browDownRight'], ['browOuterUpLeft', 'browOuterUpRight'],
    ['eyeSquintLeft', 'eyeSquintRight'], ['eyeWideLeft', 'eyeWideRight'], ['eyeBlinkLeft', 'eyeBlinkRight'],
    ['jawOpen'], ['mouthFunnel'], ['mouthPucker'], ['mouthSmileLeft', 'mouthSmileRight'],
    ['mouthPressLeft', 'mouthPressRight'], ['mouthRollLower', 'mouthRollUpper'],
    ['mouthStretchLeft', 'mouthStretchRight'], ['mouthClose'], ['mouthUpperUpLeft', 'mouthUpperUpRight'],
    ['mouthLowerDownLeft', 'mouthLowerDownRight'], ['cheekPuff'],
]
YAW, ROLL = 17, 19  # indices mirrored with the hands
# landmarks: nose tip, face edges (left/right), outer eye corners, forehead, chin
NOSE, EDGE_L, EDGE_R, EYE_L, EYE_R, TOP, CHIN = 1, 234, 454, 33, 263, 10, 152


def face_row(blend, landmarks, width, height):
    """blend: {name: score}; landmarks: list of (x, y) normalized image coords (478 points)."""
    if not blend or not landmarks or len(landmarks) <= EDGE_R:
        return [0.0] * FACE
    row = [sum(blend.get(n, 0.0) for n in g) / len(g) for g in GROUPS]
    m = max(width, height)
    P = lambda i: (landmarks[i][0] * width / m, landmarks[i][1] * height / m)
    nx, ny = P(NOSE); lx, ly = P(EDGE_L); rx, ry = P(EDGE_R)
    tx, ty = P(TOP); cx, cy = P(CHIN); ax, ay = P(EYE_L); bx, by = P(EYE_R)
    fw = max(math.hypot(rx - lx, ry - ly), 1e-4); fh = max(math.hypot(cx - tx, cy - ty), 1e-4)
    yaw = ((nx - (lx + rx) / 2) / fw) * 2
    pitch = ((ny - (ty + cy) / 2) / fh) * 2
    roll = math.atan2(by - ay, bx - ax)
    return row + [yaw, pitch, roll, 1.0]
