"""Solve Alex's skeleton directly from video landmarks (MediaPipe pose + hands,
ml/rsl/capture_motion.py), with game-style anatomical limits.

  Blender -b art/realistic-male/build/avatar.blend --python art/realistic-male/solve_video.py -- all | <ids>
  env BATCH=i/n splits the work.

Per frame:
  * arms: shoulder/elbow/wrist directions; bone lengths stay the avatar's own
    (no stretching), elbow twist from the bend plane, forearm takes part of the
    wrist roll (pronation) like a real forearm;
  * hand: palm frame from wrist / index / middle / pinky knuckles;
  * fingers: flexion per joint and spread at the knuckle, clamped to human
    ranges; neighbouring fingers may not sweep past each other; spread closes
    as the hand makes a fist. This is what stops fingers crossing;
  * torso / head: small rotations relative to the signer's own neutral pose.
Landmarks are smoothed in time, short tracking gaps are filled, and every clip
eases from and back to the same relaxed pose so words join seamlessly.
"""
from pathlib import Path
import bpy, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("MOTION_DIR", ROOT / "ml/rsl/data/motion"))
OUT = Path(os.environ.get("AVATAR_OUT", ROOT / "frontend/public/avatars/alex"))
OUT.mkdir(parents=True, exist_ok=True)
P = "mixamorig:"
FPS = 30
HOLD = int(0.1 * FPS)   # relaxed pose held at both ends
TRANS = int(0.3 * FPS)  # move into / out of the sign
rig = bpy.data.objects["Avatar"]
W = rig.matrix_world.copy()
bones = rig.data.bones
order = []
def walk(b):
    order.append(b.name)
    for c in b.children:
        walk(c)
for b in bones:
    if b.parent is None:
        walk(b)
rest = {n: W @ bones[n].matrix_local for n in order}
restq = {n: rest[n].to_quaternion() for n in order}
parent = {n: bones[n].parent.name if bones[n].parent else None for n in order}
head = {n: rest[n].translation.copy() for n in order}
Y = Vector((0, 1, 0))
cv = lambda p: Vector((p[0], p[2], -p[1]))
FINGERS = {"Index": [5, 6, 7, 8], "Middle": [9, 10, 11, 12], "Ring": [13, 14, 15, 16], "Pinky": [17, 18, 19, 20]}
THUMB = [1, 2, 3, 4]
SPREAD = {"Index": (-5, 22), "Middle": (-8, 8), "Ring": (-20, 5), "Pinky": (-32, 0)}  # degrees, + toward the index side, from the palm axis
FLEX_MAX = (90, 105, 80)


def look(q, d):
    if d.length < 1e-6:
        return q.copy()
    return (q @ Y).rotation_difference(d.normalized()) @ q


def frame(f, a):
    y = f.normalized()
    x = (a - y * a.dot(y)).normalized()
    return Matrix((x, y, x.cross(y))).transposed()


def limit(q, ref, deg):
    d = ref.rotation_difference(q)
    ang = d.angle
    if ang <= math.radians(deg):
        return q
    return ref.slerp(q, math.radians(deg) / ang)


def frac(q, t):
    return Quaternion().slerp(q, t)


def signed(v1, v2, axis):
    a = axis.normalized()
    p1 = (v1 - a * v1.dot(a)).normalized()
    p2 = (v2 - a * v2.dot(a)).normalized()
    ang = p1.angle(p2, 0.0)
    return ang if a.dot(p1.cross(p2)) >= 0 else -ang


def twist(q, axis):
    """Twist part of q about axis (swing-twist decomposition)."""
    a = axis.normalized()
    v = Vector((q.x, q.y, q.z))
    p = a * v.dot(a)
    t = Quaternion((q.w, p.x, p.y, p.z))
    if t.magnitude < 1e-9:
        return Quaternion()
    t.normalize()
    return t


# --- rig rest measurements ------------------------------------------------------
def rig_palm(side):
    w = head[P + side + "Hand"]
    return frame(head[P + side + "HandMiddle1"] - w, head[P + side + "HandIndex1"] - head[P + side + "HandPinky1"])


def rig_palm_normal(side):
    # Rest fingers are slightly curled: the curl points to the palm side.
    n = Vector()
    for f in FINGERS:
        a, tip = head[P + side + "Hand" + f + "1"], rest[P + side + "Hand" + f + "3"] @ Vector((0, bones[P + side + "Hand" + f + "3"].length, 0))
        d1 = (head[P + side + "Hand" + f + "2"] - a).normalized()
        c = tip - a
        n += c - d1 * c.dot(d1)
    return n.normalized()


# Alex's own face landmarks, measured on the mesh: nose tip and ear span.
def _face_geometry():
    body = bpy.data.objects.get("Avatar.body")
    if not body:
        return head[P + "Head"] + Vector((0, -0.16, 0.055)), 0.166
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    hz = head[P + "Head"].z
    face = [v for v in vs if hz + 0.02 < v.z < hz + 0.12 and abs(v.x) < 0.03]
    nose = min(face, key=lambda v: v.y) if face else head[P + "Head"] + Vector((0, -0.16, 0.055))
    band = [v for v in vs if abs(v.z - nose.z) < 0.03 and v.y > nose.y + 0.08]
    ear = (max(v.x for v in band) - min(v.x for v in band)) if band else 0.166
    return nose, ear


NOSE_AV, EARS_AV = _face_geometry()
print("face geometry", [round(c, 3) for c in NOSE_AV], round(EARS_AV, 3), flush=True)
RP = {s: rig_palm(s) for s in ("Left", "Right")}
RN = {s: rig_palm_normal(s) for s in ("Left", "Right")}
# Rig palm normal must agree in sign with frame z for the solver below.
RNSIGN = {s: (1 if RN[s].dot(RP[s].col[2]) >= 0 else -1) for s in RN}
print("palm normal sign", RNSIGN, flush=True)


def _hinge(d, n):
    """Bend axis of a finger pointing along d on a palm with normal n:
    +angle about it curls the finger toward the palm."""
    h = d.cross(n).normalized()
    return -h if h.cross(d).dot(n) < 0 else h


# Each finger bone's own bend axis, in bone space (from the rest pose). Used to
# give the solved phalanges their roll as well as their direction: with the
# direction alone (shortest-arc "look"), each phalanx picked up a random twist
# about its length and curled fingers looked crooked and corkscrewed.
HINGE_LOCAL = {}
for _s in ("Left", "Right"):
    for _f in ("Index", "Middle", "Ring", "Pinky"):
        for _k in (1, 2, 3):
            _b = P + _s + "Hand" + _f + str(_k)
            if _b in restq:
                HINGE_LOCAL[_b] = restq[_b].inverted() @ _hinge(restq[_b] @ Y, RN[_s])


def orient(bname, direction, hinge):
    """World rotation for a finger bone: length along `direction`, bend axis on `hinge`."""
    hl = HINGE_LOCAL.get(bname)
    if hl is None:
        return None
    world = frame(direction, hinge)
    local = frame(Y, hl)
    return (world @ local.transposed()).to_quaternion()


def relaxed_pose():
    """Arms down, slightly forward, fingers softly curled."""
    q = {}
    for n in order:
        p = parent[n]
        q[n] = restq[n].copy() if p is None else q[p] @ restq[p].inverted() @ restq[n]
        short = n.removeprefix(P)
        for s, sg in (("Left", 1), ("Right", -1)):
            if short == s + "Arm":
                q[n] = look(q[n], Vector((sg * 0.16, -0.06, -1)))
            elif short == s + "ForeArm":
                q[n] = look(q[n], Vector((sg * 0.04, -0.42, -1)))
    # Softly curled fingers on their own hinges (the rig's rest fingers are
    # bunched and the thumb sticks out).
    for s in ("Left", "Right"):
        solve_fingers(q, s, None)
    return q


# --- landmark preparation ---------------------------------------------------------
def series(frames, get, size):
    """[T, size, 3] with NaN where missing."""
    out = np.full((len(frames), size, 3), np.nan)
    for i, f in enumerate(frames):
        v = get(f)
        if v is not None:
            out[i] = np.asarray(v, float)
    return out


def fill_smooth(a, max_gap=6, sigma=1.0):
    t = np.arange(len(a))
    ok = ~np.isnan(a[:, 0, 0])
    present = ok.copy()
    if ok.sum() < 2:
        return a, ok
    for j in range(a.shape[1]):
        for k in range(3):
            a[:, j, k] = np.interp(t, t[ok], a[ok, j, k])
    # Mark long gaps as missing again.
    run = 0
    for i in range(len(ok)):
        run = run + 1 if not ok[i] else 0
        if run > max_gap:
            present[i - run + 1:i + 1] = False
        elif not ok[i]:
            present[i] = True
    r = int(3 * sigma)
    kern = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    kern /= kern.sum()
    pad = np.pad(a, ((r, r), (0, 0), (0, 0)), mode="edge")
    sm = np.stack([np.convolve(pad[:, j, k], kern, "valid") for j in range(a.shape[1]) for k in range(3)], 1)
    return sm.reshape(a.shape), present


def resample(a, t_src, t_dst):
    out = np.empty((len(t_dst),) + a.shape[1:])
    for j in range(a.shape[1]):
        for k in range(3):
            out[:, j, k] = np.interp(t_dst, t_src, a[:, j, k])
    return out


def assign_hands(f):
    """Match detected hands to the pose wrists (15 left, 16 right) in the image."""
    res = {"Left": None, "Right": None}
    pose = f.get("pose")
    for h in f["hands"]:
        if pose:
            wl, wr = np.array(pose[15][:2]), np.array(pose[16][:2])
            p = np.array(h["image"][0][:2])
            side = "Left" if np.linalg.norm(p - wl) < np.linalg.norm(p - wr) else "Right"
        else:
            side = "Right" if h["side"] == "Left" else "Left"
        if res[side] is None:
            res[side] = h["world"]
    return res


def mean_quat(qs):
    acc = np.zeros(4)
    ref = qs[0]
    for q in qs:
        v = np.array(q[:]) * (1 if q.dot(ref) >= 0 else -1)
        acc += v
    m = Quaternion(acc)
    m.normalize()
    return m


# --- solver -----------------------------------------------------------------------------
def solve_clip(cap):
    frames = [f for f in cap["frames"] if f.get("world")]
    if len(frames) < 4:
        raise ValueError("too few pose frames")
    t_src = np.array([f["t"] for f in frames])
    pose, _ = fill_smooth(series(frames, lambda f: f["world"], 33), max_gap=10**6, sigma=1.2)
    img, _ = fill_smooth(series(frames, lambda f: f.get("pose"), 33), max_gap=10**6, sigma=1.0)
    aspect = float(cap.get("aspect") or 1.0)
    hands = {}
    for s in ("Left", "Right"):
        a, present = fill_smooth(series(frames, lambda f, s=s: assign_hands(f)[s], 21), max_gap=6, sigma=1.0)
        hands[s] = (a, present)
    dur = float(t_src[-1] - t_src[0])
    t_dst = t_src[0] + np.arange(0, dur + 1e-6, 1 / FPS)
    pose = resample(pose, t_src, t_dst)
    img = resample(img, t_src, t_dst)
    for s in hands:
        a, present = hands[s]
        idx = np.clip(np.searchsorted(t_src, t_dst), 0, len(t_src) - 1)
        hands[s] = (resample(a, t_src, t_dst) if not np.isnan(a).all() else None, present[idx])
    T = len(t_dst)

    # Signer's neutral torso / head orientation (removes camera angle and posture).
    def torso(i):
        L, R = cv(pose[i, 11]), cv(pose[i, 12])
        return Vector((1, 0, 0)).rotation_difference((L - R).normalized())

    def headq(i):
        e7, e8, nose = cv(pose[i, 7]), cv(pose[i, 8]), cv(pose[i, 0])
        x = (e7 - e8).normalized()
        back = -(nose - (e7 + e8) / 2)
        return frame(back, x).to_quaternion() @ frame(Y, Vector((1, 0, 0))).to_quaternion().inverted()

    T0 = mean_quat([torso(i) for i in range(T)])
    H0 = mean_quat([T0.inverted() @ headq(i) for i in range(T)])
    relax = relaxed_pose()
    out = []
    prev_twist = {}
    # Hands are placed where the signer's hands are relative to the shoulders,
    # in the avatar's own proportions (scale = shoulder span ratio), then reached
    # with two-bone IK; the elbow points where the signer's elbow points.
    span_avatar = (head[P + "LeftArm"] - head[P + "RightArm"]).length
    span_signer = float(np.median([np.linalg.norm(pose[i, 11] - pose[i, 12]) for i in range(T)]))
    scale = span_avatar / max(span_signer, 1e-3)
    # Where things are ACROSS and UP comes from the image (exact as seen);
    # only the depth comes from the 3D estimate, which wanders, and is clamped.
    gi = lambda i_, j: Vector(((img[i_, j, 0] - 0.5) * aspect, 0.0, -(img[i_, j, 1] - 0.5)))
    span_img = float(np.median([abs(img[i, 11, 0] - img[i, 12, 0]) * aspect for i in range(T)]))
    scale_img = span_avatar / max(span_img, 1e-3)
    ears_img = float(np.median([np.hypot((img[i, 7, 0] - img[i, 8, 0]) * aspect, img[i, 7, 1] - img[i, 8, 1]) for i in range(T)]))
    face_img = EARS_AV / max(ears_img, 1e-3)
    ears = float(np.median([np.linalg.norm(pose[i, 7] - pose[i, 8]) for i in range(T)]))
    face_scale = EARS_AV / max(ears, 1e-3)
    head_c = Vector((NOSE_AV.x, NOSE_AV.y + 0.1, NOSE_AV.z + 0.02))  # avatar skull centre
    nose_av = NOSE_AV
    reach = {s_: ((head[P + s_ + "ForeArm"] - head[P + s_ + "Arm"]).length, (head[P + s_ + "Hand"] - head[P + s_ + "ForeArm"]).length) for s_ in ("Left", "Right")}
    for i in range(T):
        inv = T0.inverted()
        g = lambda j: inv @ cv(pose[i, j])
        q = {}
        pos = {}
        arm_dirs = {}
        sig_mid = (g(11) + g(12)) / 2
        img_mid = (gi(i, 11) + gi(i, 12)) / 2
        D = limit(inv @ torso(i), Quaternion(), 12)
        Hd = limit(H0.inverted() @ D.inverted() @ inv @ headq(i), Quaternion(), 30)
        for n in order:
            p = parent[n]
            base = restq[n].copy() if p is None else q[p] @ restq[p].inverted() @ restq[n]
            short = n.removeprefix(P)
            if short in ("Spine", "Spine1", "Spine2"):
                k = {"Spine": 0.3, "Spine1": 0.6, "Spine2": 1.0}[short]
                base = frac(D, k) @ restq[n] if p is None else frac(D, k) @ restq[n]
            elif short == "Neck":
                base = D @ frac(Hd, 0.4) @ restq[n]
            elif short == "Head":
                base = D @ Hd @ restq[n]
            q[n] = base
            pos[n] = head[n].copy() if p is None else pos[p] + (q[p] @ restq[p].inverted()) @ (head[n] - head[p])
            for s, (js, je, jw) in (("Left", (11, 13, 15)), ("Right", (12, 14, 16))):
                if short == s + "Arm":
                    S = pos[n]
                    av_mid = (pos[n] + (pos.get(P + ("Right" if s == "Left" else "Left") + "Arm") or (head[P + ("Right" if s == "Left" else "Left") + "Arm"]))) / 2
                    rel = gi(i, jw) - img_mid
                    nose_rel = gi(i, 0) - img_mid
                    # Two vertical anchors: shoulders and nose. Above the shoulders the
                    # scale makes the signer's nose land on Alex's nose (selfie videos
                    # enlarge the head), below it is the shoulder-span scale.
                    k_up = (nose_av.z - av_mid.z) / max(nose_rel.z, 0.02)
                    k_up = max(0.6 * scale_img, min(2.2 * scale_img, k_up))
                    zr = rel.z * (k_up if rel.z > 0 else scale_img)
                    xr = (rel.x - nose_rel.x * max(0.0, min(1.0, rel.z / max(nose_rel.z, 0.02)))) * scale_img + nose_av.x * 0
                    depth = max(-0.5, min(0.0, (g(jw) - sig_mid).y * scale))
                    T_ = av_mid + Vector((xr + (nose_av.x - av_mid.x) * max(0.0, min(1.0, rel.z / max(nose_rel.z, 0.02))), depth, zr))
                    # Near the face the hand stays close in depth too.
                    relf = gi(i, jw) - gi(i, 0)
                    to_nose = relf.length / max(ears_img, 1e-3)
                    wf = max(0.0, min(1.0, 2.2 - to_nose / 1.6))
                    if wf > 0:
                        T_.y = T_.y + (max(-0.22, min(0.0, (g(jw) - g(0)).y * face_scale)) + nose_av.y - 0.02 - T_.y) * wf
                    # never inside the head
                    off = T_ - head_c
                    if off.length < 0.13:
                        T_ = head_c + (off.normalized() if off.length > 1e-4 else Vector((0, -1, 0))) * 0.13
                    # keep the hand in front of the chest, never inside the body
                    chest = pos.get(P + "Spine2", head[P + "Spine2"])
                    if abs(T_.x - chest.x) < 0.17 and head[P + "Hips"].z < T_.z < pos.get(P + "Neck", head[P + "Neck"]).z + 0.02:
                        T_.y = min(T_.y, chest.y - 0.13)
                    if os.environ.get("DEBUG_IK") and i == T // 2:
                        print("IK", s, "signer wrist-mid", [round(v, 3) for v in (g(jw) - sig_mid)], "nose-mid", [round(v, 3) for v in (g(0) - sig_mid)],
                              "shoulder", [round(v, 3) for v in S], "avmid", [round(v, 3) for v in av_mid], "target", [round(v, 3) for v in T_],
                              "head", [round(v, 3) for v in head[P + "Head"]], "scale", round(scale, 3), flush=True)
                    a_len, b_len = reach[s]
                    dv = T_ - S
                    d = min(max(dv.length, abs(a_len - b_len) + 1e-3), (a_len + b_len) * 0.995)
                    u = dv.normalized()
                    pole = (gi(i, je) - gi(i, js)) * scale_img + Vector((0, (g(je) - g(js)).y * scale, 0))
                    pole = pole - u * pole.dot(u)
                    if pole.length < 1e-4:
                        pole = Vector((0, 0, -1)) - u * u.z
                    pole.normalize()
                    cosA = max(-1.0, min(1.0, (a_len * a_len + d * d - b_len * b_len) / (2 * a_len * d)))
                    E_ = S + u * (a_len * cosA) + pole * (a_len * math.sqrt(max(0.0, 1 - cosA * cosA)))
                    W_ = S + u * d
                    d1, d2 = E_ - S, W_ - E_
                    arm_dirs[s] = (d1, d2)
                    qa = look(base, d1)
                    hinge_rest = (restq[n].inverted() @ (restq[n] @ Y).cross(Vector((0, -1, 0)))).normalized()
                    normal = d1.cross(d2)
                    if normal.length > 0.15 * d1.length * d2.length:
                        ang = signed(qa @ hinge_rest, normal, d1)
                        prev_twist[s] = ang
                    else:
                        ang = prev_twist.get(s, 0.0)
                    q[n] = Quaternion(d1.normalized(), ang) @ qa
                elif short == s + "ForeArm":
                    d1, d2 = arm_dirs.get(s, (g(je) - g(js), g(jw) - g(je)))
                    q[n] = look(base, d2)
                    pos[n] = pos[p] + (q[p] @ restq[p].inverted()) @ (head[n] - head[p])
                elif short == s + "Hand":
                    h, present = hands[s]
                    if h is not None and present[i]:
                        hp = [inv @ cv(v) for v in h[i]]
                        B = frame(hp[9] - hp[0], hp[5] - hp[17])
                        target = (B @ RP[s].inverted()).to_quaternion() @ restq[n]
                        # Forearm takes 60% of the roll about its own axis.
                        fore = P + s + "ForeArm"
                        axis = q[fore] @ Y
                        roll = twist(target @ base.inverted(), axis)
                        q[fore] = frac(roll, 0.6) @ q[fore]
                        base = q[fore] @ restq[fore].inverted() @ restq[n]
                        q[n] = limit(target, base, 75)
                        q["_hand_" + s] = hp
                    else:
                        q[n] = base
        # Fingers (after the hands so they use the final palm orientation).
        for s in ("Left", "Right"):
            hp = q.pop("_hand_" + s, None)
            solve_fingers(q, s, hp)
        # A hand resting low (on the lap of a seated signer, on a table) is not
        # part of the sign: the standing avatar lets that arm hang relaxed.
        sh_y = (img[i, 11, 1] + img[i, 12, 1]) / 2
        hip_y = (img[i, 23, 1] + img[i, 24, 1]) / 2
        span_y = max(hip_y - sh_y, 0.05)
        for s, jw in (("Left", 15), ("Right", 16)):
            down = (img[i, jw, 1] - sh_y) / span_y
            w = max(0.0, min(1.0, (down - 0.45) / 0.2))
            w = w * w * (3 - 2 * w)
            if w <= 0:
                continue
            for n in order:
                short = n.removeprefix(P)
                if short.startswith(s) and ("Arm" in short or "Hand" in short):
                    a = q[n]
                    b = relax[n] if relax[n].dot(a) >= 0 else -relax[n]
                    q[n] = a.slerp(b, w)
        out.append(q)
    if os.environ.get("NO_SMOOTH") != "1":
        out = smooth_motion(out)
    # The sign itself plays in full, frame for frame as on the video; the move
    # from and back to the shared relaxed pose is added OUTSIDE it.
    def blend(a, b, w):
        r = {}
        for n in order:
            qb = b[n] if a[n].dot(b[n]) >= 0 else -b[n]
            r[n] = a[n].slerp(qb, w)
        return r
    smooth = lambda x: x * x * (3 - 2 * x)
    lead = [blend(relax, out[0], smooth((k + 1) / (TRANS + 1))) for k in range(TRANS)]
    tail = [blend(out[-1], relax, smooth((k + 1) / (TRANS + 1))) for k in range(TRANS)]
    hold = [dict(relax) for _ in range(HOLD)]
    return hold + lead + out + tail + hold


# Calm, human motion: tracking jitter makes the solved bones twitch from frame
# to frame (a real signer's joints move smoothly). Each bone's rotation is
# smoothed in time with a Gaussian in quaternion space; the trunk and head
# most (they barely move), the fingers least (handshape changes are fast).
SMOOTH_SIGMA = {"trunk": 3.0, "head": 2.5, "arm": 1.6, "hand": 1.3, "finger": 1.0}


def bone_group(n):
    short = n.removeprefix(P)
    if any(k in short for k in ("Thumb", "Index", "Middle", "Ring", "Pinky")):
        return "finger"
    if short.endswith("Hand"):
        return "hand"
    if "Arm" in short or "Shoulder" in short:
        return "arm"
    if short in ("Neck", "Head") or "Eye" in short:
        return "head"
    return "trunk"


def smooth_motion(frames):
    T = len(frames)
    if T < 3:
        return frames
    out = [dict(f) for f in frames]
    for n in order:
        sig = SMOOTH_SIGMA[bone_group(n)]
        r = int(3 * sig)
        w = [math.exp(-0.5 * (k / sig) ** 2) for k in range(-r, r + 1)]
        seq = [frames[t][n] for t in range(T)]
        for t in range(1, T):  # one hemisphere, so averaging does not cancel out
            if seq[t].dot(seq[t - 1]) < 0:
                seq[t] = -seq[t]
        for t in range(T):
            acc = [0.0, 0.0, 0.0, 0.0]
            for k, wk in zip(range(-r, r + 1), w):
                qk = seq[min(T - 1, max(0, t + k))]
                acc = [a + wk * c for a, c in zip(acc, qk)]
            qq = Quaternion(acc)
            qq.normalize()
            out[t][n] = qq
    return out


def motion_stats(frames):
    """Mean / 95th-percentile angular acceleration (deg per frame²) per group."""
    acc = {}
    for n in order:
        g = bone_group(n)
        for t in range(1, len(frames) - 1):
            a, b, c = frames[t - 1][n], frames[t][n], frames[t + 1][n]
            d1, d2 = a.rotation_difference(b), b.rotation_difference(c)
            acc.setdefault(g, []).append(math.degrees(d1.rotation_difference(d2).angle))
    return {g: (round(float(np.mean(v)), 2), round(float(np.percentile(v, 95)), 2)) for g, v in acc.items()}


def solve_fingers(q, s, hp):
    hand = P + s + "Hand"
    Qh = q[hand]
    rot = Qh @ restq[hand].inverted()
    n_c = rot @ RN[s]
    a_c = rot @ (head[P + s + "HandIndex1"] - head[P + s + "HandPinky1"])
    spreads, flexes = {}, {}
    if hp is not None:
        B = frame(hp[9] - hp[0], hp[5] - hp[17])
        x, y = B.col[0], B.col[1]
        for f, ids in FINGERS.items():
            m = hp[ids[0]] - hp[0]
            s1 = hp[ids[1]] - hp[ids[0]]
            s2 = hp[ids[2]] - hp[ids[1]]
            s3 = hp[ids[3]] - hp[ids[2]]
            z = x.cross(y)
            # flexion: MCP in the finger's sagittal plane, PIP/DIP between segments
            s1p = s1 - x * s1.dot(x)
            mp_ = m - x * m.dot(x)
            f1 = mp_.angle(s1p, 0.0)
            f2 = s1.angle(s2, 0.0)
            f3 = s2.angle(s3, 0.0)
            f3 = 0.5 * f3 + 0.5 * 0.67 * f2  # DIP follows PIP (tracking is noisy at the tip)
            flexes[f] = [min(max(v, 0.0), math.radians(mx)) for v, mx in zip((f1, f2, f3), FLEX_MAX)]
            # spread in the palm plane, toward the index side positive
            s1q = s1 - z * s1.dot(z)
            sp = -signed(y, s1q, z)  # angle from the palm axis, + toward the index side
            lo, hi = SPREAD[f]
            sp = max(math.radians(lo), min(math.radians(hi), sp))
            sp *= 1 - 0.75 * min(1.0, flexes[f][0] / math.radians(80))  # fist closes the fan
            spreads[f] = sp
        # Neighbours may not sweep past each other (index ≥ middle ≥ ring ≥ pinky - 4°).
        names = ["Index", "Middle", "Ring", "Pinky"]
        gap = math.radians(3)
        for _ in range(3):
            for a, b in zip(names, names[1:]):
                if spreads[a] < spreads[b] + gap:
                    mid = (spreads[a] + spreads[b]) / 2
                    spreads[a], spreads[b] = mid + gap / 2, mid - gap / 2
    else:
        # A relaxed hand: index almost straight, each next finger a little more
        # curled (the natural cascade), small fan.
        for (f, sp), k in zip(zip(FINGERS, (4, 0, -4, -9)), range(4)):
            flexes[f] = [math.radians(v + 4 * k) for v in (8, 14, 6)]
            spreads[f] = math.radians(sp)
    f_c = rot @ (head[P + s + "HandMiddle1"] - head[hand])
    f_c = (f_c - n_c * f_c.dot(n_c)).normalized()
    sign = 1 if n_c.cross(f_c).dot(a_c) >= 0 else -1
    # One fixed hinge axis per finger (perpendicular to the palm normal and the
    # finger's straight direction): every joint bends about it, so a curled
    # finger stays in its plane instead of twisting sideways.
    for f in FINGERS:
        chain = [P + s + "Hand" + f + str(k) for k in (1, 2, 3)]
        d = Quaternion(n_c, sign * spreads[f]) @ f_c
        h = d.cross(n_c).normalized()
        if h.cross(d).dot(n_c) < 0:  # +θ about h must move d toward the palm
            h = -h
        prev, prev_name, cum = q[hand], hand, 0.0
        for k, bname in enumerate(chain):
            base = prev @ restq[prev_name].inverted() @ restq[bname]
            cum += flexes[f][k]
            target = Quaternion(h, cum) @ d
            q[bname] = orient(bname, target, h) or look(base, target)
            prev, prev_name = q[bname], bname
    # Thumb: the tracked directions, taken relative to the tracked palm and put
    # on Alex's palm (so a clamped wrist does not swing the thumb across it).
    chain = [P + s + "HandThumb" + str(k) for k in (1, 2, 3)]
    if hp is not None:
        av_palm = (rot.to_matrix() @ RP[s])
        to_av = av_palm @ B.inverted()
    prev, prev_name = q[hand], hand
    for k, bname in enumerate(chain):
        base = prev @ restq[prev_name].inverted() @ restq[bname]
        if hp is not None:
            dirk = to_av @ (hp[THUMB[k + 1]] - hp[THUMB[k]])
            q[bname] = limit(look(base, dirk), base, (45, 55, 70)[k])
        else:
            # Relaxed thumb rests beside the index finger instead of pointing out.
            cur = base @ Y
            toward = (cur.normalized() * 0.55 + f_c * 0.45 + n_c * 0.12).normalized()
            q[bname] = limit(look(base, toward), base, (28, 14, 10)[k])
        prev, prev_name = q[bname], bname


def bake(name, poses):
    action = bpy.data.actions.new("Alex_" + name)
    rig.animation_data_create()
    rig.animation_data.action = action
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    T = len(poses)
    for n in order:
        p = parent[n]
        vals = []
        lastq = None
        for pose in poses:
            Q = pose[n]
            if p is None:
                L = restq[n].inverted() @ Q
            else:
                L = (restq[p].inverted() @ restq[n]).inverted() @ pose[p].inverted() @ Q
            L.normalize()
            if lastq is not None and L.dot(lastq) < 0:
                L.negate()
            lastq = L
            vals.append(L)
        for axis in range(4):
            c = action.fcurves.new(data_path=f'pose.bones["{n}"].rotation_quaternion', index=axis, action_group=n)
            c.keyframe_points.add(T)
            co = []
            for i, L in enumerate(vals):
                co.extend([i, L[axis]])
            c.keyframe_points.foreach_set("co", co)
            for kp in c.keyframe_points:
                kp.interpolation = "LINEAR"
    if action.slots:
        rig.animation_data.action_slot = action.slots[0]
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, T - 1
    return action


def idle_clip(seconds=6.0):
    """Relaxed stance that breathes: chest rise, tiny weight shift, soft head drift.
    Every motion is a whole number of cycles over the clip, so it loops seamlessly."""
    relax = relaxed_pose()
    poses = []
    T = int(seconds * FPS)
    for i in range(T):
        t = i / T * 2 * math.pi
        q = {}
        breathe = Quaternion(Vector((1, 0, 0)), math.radians(1.3) * math.sin(t * 1))
        sway = Quaternion(Vector((0, 1, 0)), math.radians(0.8) * math.sin(t * 1 + 1.1))
        # Head: a slow, small drift (a quick nod read as bobbing).
        nod = Quaternion(Vector((1, 0, 0)), math.radians(0.8) * math.sin(t * 1 + 0.4)) @ Quaternion(Vector((0, 0, 1)), math.radians(1.2) * math.sin(t * 1 + 2.0))
        lift = math.radians(0.7) * max(0.0, math.sin(t * 1))  # shoulders rise on the in-breath
        for n in order:
            p = parent[n]
            short = n.removeprefix(P)
            base = relax[n] if p is None else q[p] @ relax[p].inverted() @ relax[n]
            if short == "Spine1":
                base = sway @ base
            elif short == "Spine2":
                base = breathe @ base
            elif short == "Head":
                base = nod @ base
            elif short.endswith("Shoulder"):
                base = Quaternion(Vector((0, 1, 0)), lift if short.startswith("Left") else -lift) @ base
            elif short.endswith("ForeArm"):
                base = Quaternion(Vector((1, 0, 0)), math.radians(1.2) * math.sin(t * 1 + 0.6)) @ base
            q[n] = base
        poses.append(q)
    return poses


args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args == ["idle"]:
    poses = idle_clip()
    action = bake("ready-idle", poses)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = OUT / "ready-idle.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_animations=True,
                              export_frame_range=True, export_force_sampling=True, export_yup=True)
    import hashlib
    (OUT / "ready-idle.json").write_text(json.dumps({"id": "ready-idle", "label": "Поза ожидания", "duration": (len(poses) - 1) / FPS,
                                                      "revision": hashlib.sha256(path.read_bytes()).hexdigest()[:12],
                                                      "review": "procedural-idle", "method": "idle-v1"}, ensure_ascii=False))
    print("IDLE_DONE", flush=True)
    sys.exit(0)
files = sorted(DATA.glob("word-*.json")) + sorted(DATA.glob("letter-*.json"))
if args and args != ["all"]:
    files = [f for f in files if f.stem in args]
if os.environ.get("BATCH"):
    i, nb = map(int, os.environ["BATCH"].split("/"))
    files = files[i::nb]
done = 0
for f in files:
    try:
        cap = json.loads(f.read_text())
        poses = solve_clip(cap)
        if os.environ.get("MEASURE"):
            print("STATS", f.stem, json.dumps(motion_stats(poses)), flush=True)
            continue
    except Exception as e:
        print("SKIP", f.stem, e, flush=True)
        continue
    action = bake(f.stem, poses)
    if os.environ.get("KEEP_BLEND"):
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art/realistic-male/build" / (f.stem + "-video.blend")), copy=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(OUT / (f.stem + ".glb")), export_format="GLB", use_selection=True,
                              export_animations=True, export_frame_range=True, export_force_sampling=True, export_yup=True)
    (OUT / (f.stem + ".json")).write_text(json.dumps({"duration": (len(poses) - 1) / FPS, "label": cap["entry"]["label"],
                                                      "source": cap["entry"]["video"], "method": "video-solve-v1",
                                                      "poseCoverage": cap.get("poseCoverage"),
                                                      "review": "Solved from video landmarks; not teacher-validated."}, ensure_ascii=False))
    rig.animation_data.action = None
    bpy.data.actions.remove(action)
    done += 1
    print("SOLVED", f.stem, len(poses), flush=True)
print("SOLVE_DONE", done, flush=True)
