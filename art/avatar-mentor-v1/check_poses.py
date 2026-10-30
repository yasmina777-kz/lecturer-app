import bpy,json,math
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AI-Mentor-Teacher-v1.blend'))
s=bpy.context.scene;r=bpy.data.objects['AI_Mentor_Rig'];s.cycles.samples=20
s.render.resolution_percentage=65
owners=[r]+[o.data.shape_keys for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys]
for name,fr in [('Greeting',35),('Explain',50),('Talk',14),('Idle',50)]:
 for o in owners:
  if o.animation_data:
   for t in o.animation_data.nla_tracks:t.mute=t.name!=name
 for b in r.pose.bones:b.rotation_euler=(0,0,0)
 for o in owners[1:]:
  for k in o.key_blocks:k.value=0
 s.frame_set(fr)
 s.camera=bpy.data.objects['Camera • portrait'] if name in ['Talk','Idle'] else bpy.data.objects['Camera • full body']
 s.render.filepath=str(OUT/('check-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('POSES CHECKED')
