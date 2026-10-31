"""Blender hand rig study: articulation QA, not a sign-language example."""
from pathlib import Path
source=Path(__file__).with_name('retarget.py');__file__=str(source)
exec(compile(source.read_text().split('manifest=[]')[0],str(source),'exec'),globals())
init_finger_rigs();sc.render.fps=24;sc.frame_start=1;sc.frame_end=145
for frame in range(1,146):
 t=(frame-1)/24;sc.frame_set(frame)
 for b in bones:b.matrix_basis=Matrix.Identity(4)
 natural_body(t)
 lift=smooth(0,.8,t)*(1-smooth(5.2,6,t))
 for side in ['Left','Right']:
  sign=1 if side=='Left' else -1
  wrist=V((sign*.205,-.105,.94)).lerp(V((sign*.23,-.30,1.4)),lift)
  q=(qrestL if side=='Left' else qrestR).slerp(orient(side,(0,0,1),(0,-1,0)),lift)
  tracked_arm(side,wrist,q)
  for name in finger_indices:
   delay={'Pinky':0,'Ring':.025,'Middle':.05,'Index':.075,'Thumb':.10}[name]
   curl=smooth(1.1+delay,2.15+delay,t)*(1-smooth(3.4+delay,4.55+delay,t))
   if name=='Thumb':
    opened=[math.radians(v) for v in [-25,15,0,0,0]]
    closed=[math.radians(v) for v in [20,35,25,15,25]]
   else:
    opened=flat_shape(side)[name]
    closed=[math.radians(v) for v in [68,0,82,42]]
   values=project_finger_values(side,name,[a*(1-curl)+b*curl for a,b in zip(opened,closed)])
   _,rotations=finger_chain(side,name,values)
   for j,q in enumerate(rotations,1):
    neutral=Quaternion(finger_fit_rigs[(side,name)]['axes'][j-1],relaxed[name][j-1])
    B(side+'Hand'+name+str(j)).rotation_quaternion=neutral.slerp(q,lift)
 for b in bones:
  for prop in ['location','rotation_quaternion']:b.keyframe_insert(prop,frame=frame,group=b.name)
rig.animation_data.action.name='Hand articulation study — not a sign'
for fc in rig.animation_data.action.fcurves:
 for k in fc.keyframe_points:k.interpolation='LINEAR'
sc.camera.location=(0,-1.55,1.48);sc.camera.rotation_euler=(V((0,-.15,1.42))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=55
sc.render.resolution_x=720;sc.render.resolution_y=600;sc.render.resolution_percentage=100
sc.render.film_transparent=False;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.045,.065,1)
sc.render.engine='CYCLES';sc.cycles.samples=8;sc.cycles.use_denoising=True
sc.frame_set(54)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/sign-motion/Hand-motion-study.blend'),compress=True)
sc.render.image_settings.file_format='FFMPEG';sc.render.ffmpeg.format='MPEG4';sc.render.ffmpeg.codec='H264';sc.render.ffmpeg.constant_rate_factor='MEDIUM'
sc.render.filepath=str(ROOT/'art/sign-motion/hand-motion-study.mp4')
bpy.ops.render.render(animation=True)
