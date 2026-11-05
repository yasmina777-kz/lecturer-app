"""Bake motions onto Woman01's own rest pose; never copy local quaternions blindly.
Usage: Blender -b --disable-autoexec --python this_file -- [clip paths ...]
"""
from pathlib import Path
import bpy, sys, json, math
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2];ART=Path(__file__).resolve().parent;OUT=ROOT/'frontend/public/avatars/woman01'
P='mixamorig:'
def basis(f,n):
 f=f.normalized();n=(n-f*n.dot(f)).normalized();return Matrix((f.cross(n).normalized(),f,n)).transposed()
def palm(rig,side):
 b=rig.data.bones;w=b[P+side+'Hand'].head_local;f=b[P+side+'HandMiddle1'].head_local-w
 x=b[P+side+'HandIndex1'].head_local-b[P+side+'HandPinky1'].head_local
 if side=='Left':x=-x
 return basis(f,x.cross(f)).to_quaternion()
paths=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if paths==['all']:
 paths=[str(p.relative_to(ROOT)) for p in sorted((ROOT/'frontend/public/avatars/sign-motion').glob('*.glb'))]
if not paths:paths=['frontend/public/avatars/hand-workshop/fist.glb','frontend/public/avatars/sign-motion/prepared-hello.glb']
for pathstr in paths:
 path=ROOT/pathstr
 bpy.ops.wm.open_mainfile(filepath=str(ART/'Woman01-rig.blend'))
 dst=bpy.data.objects['Woman01Rig'];mesh=bpy.data.objects['Woman_01'];dst.animation_data_clear()
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));added=set(bpy.data.objects)-before
 src=next(o for o in added if o.type=='ARMATURE')
 sc=bpy.context.scene;sc.render.fps=30
 end=sc.frame_end
 if src.animation_data and src.animation_data.nla_tracks:
  end=round(max(s.frame_end for tr in src.animation_data.nla_tracks for s in tr.strips))
 start=0
 # glTF import uses frame zero for time zero.
 times=list(range(start,end+1));sc.frame_start=0;sc.frame_end=end
 rest={b.name:b.matrix_local.copy() for b in dst.data.bones}
 srest={b.name:src.matrix_world@b.matrix_local for b in src.data.bones}
 parents={b.name:b.parent.name if b.parent else None for b in dst.data.bones}
 names=list(rest)
 rp={s:palm(src,s) for s in ['Left','Right']};tp={s:palm(dst,s) for s in ['Left','Right']}
 values={n:{'location':[],'rotation_quaternion':[]} for n in names}
 lastq={};maxstep=0
 for frame in times:
  sc.frame_set(frame);bpy.context.view_layer.update()
  sp={n:src.matrix_world@src.pose.bones[n].matrix for n in names}
  desired={};palms={}
  for n in names:
   short=n.removeprefix(P);side='Left' if short.startswith('Left') else 'Right'
   sr=srest[n].to_quaternion();sq=sp[n].to_quaternion();tr=rest[n].to_quaternion()
   par=parents[n]
   head=(desired[par]@rest[par].inverted()@rest[n].translation) if par else rest[n].translation+(sp[n].translation-srest[n].translation)
   q=sq@sr.inverted()@tr
   if short in [side+'Arm',side+'ForeArm']:
    direction=sq@Vector((0,1,0));normal=sq@sr.inverted()@Vector((0,-1,0));q=basis(direction,normal).to_quaternion()
   elif short==side+'Hand':
    delta=sq@sr.inverted()@rp[side]@tp[side].inverted();q=delta@tr;palms[side]=delta@Vector((0,0,-1))
   elif 'Hand' in short:
    q=basis(sq@Vector((0,1,0)),sq@sr.inverted()@(rp[side]@Vector((0,0,1)))).to_quaternion()
   m=q.to_matrix().to_4x4();m.translation=head;desired[n]=m
   local=rest[n].inverted()@rest[par]@desired[par].inverted()@m if par else rest[n].inverted()@m
   loc,lq,_=local.decompose()
   if n in lastq:
    if lq.dot(lastq[n])<0:lq.negate()
    maxstep=max(maxstep,lq.rotation_difference(lastq[n]).angle)
   lastq[n]=lq.copy()
   values[n]['location'].extend(loc);values[n]['rotation_quaternion'].extend(lq)
 # Bulk write the baked deform curves, avoiding controller dependencies.
 action=bpy.data.actions.new('Woman01_'+path.stem);dst.animation_data_create();dst.animation_data.action=action
 for n,props in values.items():
  for prop,data in props.items():
   count=3 if prop=='location' else 4
   for axis in range(count):
    curve=action.fcurves.new(data_path=f'pose.bones["{n}"].{prop}',index=axis,action_group=n)
    curve.keyframe_points.add(len(times));coords=[]
    for i,f in enumerate(times):coords.extend([f,data[i*count+axis]])
    curve.keyframe_points.foreach_set('co',coords)
    for p in curve.keyframe_points:p.interpolation='LINEAR'
 if action.slots:dst.animation_data.action_slot=action.slots[0]
 for o in list(added):bpy.data.objects.remove(o,do_unlink=True)
 for old in list(bpy.data.actions):
  if old!=action:bpy.data.actions.remove(old)
 sc.frame_set(0);bpy.context.view_layer.update()
 bpy.ops.object.select_all(action='DESELECT');dst.select_set(True);bpy.context.view_layer.objects.active=dst
 bpy.ops.export_scene.gltf(filepath=str(OUT/(path.stem+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_frame_range=True,export_force_sampling=True,export_yup=True)
 (OUT/(path.stem+'.json')).write_text(json.dumps({'duration':end/30,'source':pathstr,'frames':len(times),'maxLocalStepDegrees':math.degrees(maxstep),'review':'Retargeted motion trial; not a teacher-validated sign.'},indent=2))
 if path.stem in ['fist','prepared-hello','point','pinch','word-f17a6060']:
  bpy.ops.wm.save_as_mainfile(filepath=str(ART/(path.stem+'.blend')))
 print('RETARGETED',path.stem,end/30,math.degrees(maxstep),flush=True)
