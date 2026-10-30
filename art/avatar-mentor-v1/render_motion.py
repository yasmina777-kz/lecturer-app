import bpy
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AI-Mentor-Teacher-v1.blend'))
s=bpy.context.scene;r=bpy.data.objects['AI_Mentor_Rig']
s.cycles.samples=12;s.render.resolution_x=480;s.render.resolution_y=640;s.render.resolution_percentage=100
s.camera=bpy.data.objects['Camera • full body']
keys=[o.data.shape_keys for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys]
frames=OUT/'motion-frames';frames.mkdir(exist_ok=True)
idx=0
for clip,range_ in [('Greeting',range(1,91,4)),('Explain',range(1,121,5))]:
 for owner in [r]+keys:
  if owner.animation_data:
   for t in owner.animation_data.nla_tracks:t.mute=t.name not in ([clip] if owner==r else ['Idle','Talk'])
 for bone in r.pose.bones:bone.rotation_euler=(0,0,0)
 for k in keys:
  for key in k.key_blocks:key.value=0
 for frame in range_:
  s.frame_set(frame);s.render.filepath=str(frames/('%03d.png'%idx));bpy.ops.render.render(write_still=True);idx+=1
print('MOTION FRAMES',idx)
