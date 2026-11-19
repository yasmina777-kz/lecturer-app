"""Bake saved sign motions onto the realistic avatar's own MPFB Mixamo rig.
Same method as art/woman01-trial/retarget.py: world-space bone directions and
palm frames are transferred, never raw local quaternions (rest poses differ).

  Blender -b --python art/realistic-male/retarget.py -- all | <clip.glb ...>
  env KEEP_BLEND=1 also saves build/<clip>.blend for render checks.
"""
from pathlib import Path
import bpy, sys, json, math, os
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[2]
ART = Path(__file__).resolve().parent
OUT = ROOT / "frontend/public/avatars/alex"
OUT.mkdir(parents=True, exist_ok=True)
P = "mixamorig:"
RIG = "Avatar"


def basis(f, n):
    f = f.normalized()
    n = (n - f * n.dot(f)).normalized()
    return Matrix((f.cross(n).normalized(), f, n)).transposed()


def palm(rig, side):
    b = rig.data.bones
    w = b[P + side + "Hand"].head_local
    f = b[P + side + "HandMiddle1"].head_local - w
    x = b[P + side + "HandIndex1"].head_local - b[P + side + "HandPinky1"].head_local
    if side == "Left":
        x = -x
    return (rig.matrix_world.to_quaternion() @ basis(f, x.cross(f)).to_quaternion())


paths = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if paths == ["all"]:
    paths = [str(p) for p in sorted((ROOT / "frontend/public/avatars/sign-motion").glob("*.glb")) if p.stem != "retarget-rest-anchor"]
paths = [str(ROOT / p) if not Path(p).is_absolute() else p for p in paths]
if os.environ.get("BATCH"):
    i, n = map(int, os.environ["BATCH"].split("/"))
    paths = paths[i::n]
done = 0
for pathstr in paths:
    path = Path(pathstr)
    bpy.ops.wm.open_mainfile(filepath=str(ART / "build/avatar.blend"))
    dst = bpy.data.objects[RIG]
    dst.animation_data_clear()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    added = set(bpy.data.objects) - before
    src = next(o for o in added if o.type == "ARMATURE")
    sc = bpy.context.scene
    sc.render.fps = 30
    end = sc.frame_end
    if src.animation_data and src.animation_data.nla_tracks:
        end = round(max(s.frame_end for tr in src.animation_data.nla_tracks for s in tr.strips))
    elif src.animation_data and src.animation_data.action:
        end = round(src.animation_data.action.frame_range[1])
    times = list(range(0, end + 1))
    sc.frame_start, sc.frame_end = 0, end
    W = dst.matrix_world
    rest = {b.name: W @ b.matrix_local for b in dst.data.bones}
    srest = {b.name: src.matrix_world @ b.matrix_local for b in src.data.bones}
    parents = {b.name: b.parent.name if b.parent else None for b in dst.data.bones}
    names = [n for n in rest if n in srest]
    rp = {s: palm(src, s) for s in ["Left", "Right"]}
    tp = {s: palm(dst, s) for s in ["Left", "Right"]}
    values = {n: {"location": [], "rotation_quaternion": []} for n in names}
    lastq, maxstep = {}, 0.0
    for frame in times:
        sc.frame_set(frame)
        bpy.context.view_layer.update()
        sp = {n: src.matrix_world @ src.pose.bones[n].matrix for n in names}
        desired = {}
        for n in names:
            short = n.removeprefix(P)
            side = "Left" if short.startswith("Left") else "Right"
            sr, sq, tr = srest[n].to_quaternion(), sp[n].to_quaternion(), rest[n].to_quaternion()
            par = parents[n]
            if par and par in desired:
                head = desired[par] @ rest[par].inverted() @ rest[n].translation
            else:
                head = rest[n].translation + (sp[n].translation - srest[n].translation) * 0.0
            q = sq @ sr.inverted() @ tr
            if short in (side + "UpLeg", side + "Leg"):
                # Stand straight: legs follow the source direction (MPFB rest is a wide A-stance).
                direction = sq @ Vector((0, 1, 0))
                q = (tr @ Vector((0, 1, 0))).rotation_difference(direction) @ tr
            elif short in (side + "Arm", side + "ForeArm"):
                direction = sq @ Vector((0, 1, 0))
                # Keep the target's own twist convention: rotate the rest frame onto the new direction.
                q = (tr @ Vector((0, 1, 0))).rotation_difference(direction) @ tr
                twist_src = sq @ sr.inverted()
                ref = (twist_src @ (tr @ Vector((0, 0, 1))))
                cur = q @ Vector((0, 0, 1))
                ref = (ref - direction * ref.dot(direction)).normalized()
                cur = (cur - direction * cur.dot(direction)).normalized()
                ang = cur.angle(ref, 0.0)
                if direction.dot(cur.cross(ref)) < 0:
                    ang = -ang
                q = Quaternion(direction.normalized(), ang) @ q
            elif short == side + "Hand":
                delta = sq @ sr.inverted() @ rp[side] @ tp[side].inverted()
                q = delta @ tr
            elif "Hand" in short:
                # Finger: same world direction as the source, curled about the palm.
                direction = sq @ Vector((0, 1, 0))
                q = (tr @ Vector((0, 1, 0))).rotation_difference(direction) @ tr
                hand_delta = sp[P + side + "Hand"].to_quaternion() @ srest[P + side + "Hand"].to_quaternion().inverted()
                ref = hand_delta @ rp[side] @ tp[side].inverted() @ (tr @ Vector((0, 0, 1)))
                cur = q @ Vector((0, 0, 1))
                d = direction.normalized()
                ref = (ref - d * ref.dot(d)).normalized()
                cur = (cur - d * cur.dot(d)).normalized()
                ang = cur.angle(ref, 0.0)
                if d.dot(cur.cross(ref)) < 0:
                    ang = -ang
                q = Quaternion(d, ang) @ q
            m = q.to_matrix().to_4x4()
            m.translation = head
            desired[n] = m
            if par and par in desired:
                local = rest[n].inverted() @ rest[par] @ desired[par].inverted() @ m
            else:
                local = rest[n].inverted() @ m
            loc, lq, _ = local.decompose()
            if n in lastq:
                if lq.dot(lastq[n]) < 0:
                    lq.negate()
                maxstep = max(maxstep, lq.rotation_difference(lastq[n]).angle)
            lastq[n] = lq.copy()
            values[n]["location"].extend(loc)
            values[n]["rotation_quaternion"].extend(lq)
    action = bpy.data.actions.new("Alex_" + path.stem)
    dst.animation_data_create()
    dst.animation_data.action = action
    for pb in dst.pose.bones:
        pb.rotation_mode = "QUATERNION"
    for n, props in values.items():
        for prop, data in props.items():
            count = 3 if prop == "location" else 4
            for axis in range(count):
                curve = action.fcurves.new(data_path=f'pose.bones["{n}"].{prop}', index=axis, action_group=n)
                curve.keyframe_points.add(len(times))
                coords = []
                for i, f in enumerate(times):
                    coords.extend([f, data[i * count + axis]])
                curve.keyframe_points.foreach_set("co", coords)
                for p in curve.keyframe_points:
                    p.interpolation = "LINEAR"
    if action.slots:
        dst.animation_data.action_slot = action.slots[0]
    for o in list(added):
        bpy.data.objects.remove(o, do_unlink=True)
    for old in list(bpy.data.actions):
        if old != action:
            bpy.data.actions.remove(old)
    sc.frame_set(0)
    bpy.context.view_layer.update()
    if os.environ.get("KEEP_BLEND"):
        bpy.ops.wm.save_as_mainfile(filepath=str(ART / "build" / (path.stem + ".blend")))
    bpy.ops.object.select_all(action="DESELECT")
    dst.select_set(True)
    bpy.context.view_layer.objects.active = dst
    bpy.ops.export_scene.gltf(filepath=str(OUT / (path.stem + ".glb")), export_format="GLB", use_selection=True,
                              export_animations=True, export_frame_range=True, export_force_sampling=True, export_yup=True)
    (OUT / (path.stem + ".json")).write_text(json.dumps({"duration": end / 30, "source": str(path.relative_to(ROOT)), "frames": len(times),
                                                        "maxLocalStepDegrees": math.degrees(maxstep),
                                                        "review": "Retargeted motion; not a teacher-validated sign."}, indent=2))
    done += 1
    print("RETARGETED", path.stem, round(end / 30, 2), round(math.degrees(maxstep), 1), flush=True)
print("RETARGET_DONE", done, flush=True)
