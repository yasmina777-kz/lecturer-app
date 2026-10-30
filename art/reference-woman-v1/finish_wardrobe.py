import bpy,math
from pathlib import Path
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'AI-Mentor-Reference-Woman.blend'))
rig=bpy.data.objects['AI_Mentor_Rig'];col=bpy.data.collections['MENTOR • character'];sc=bpy.context.scene
if not bpy.data.objects.get('Continuous trouser waist'):
 rows=[(.94,.125,.078),(.99,.145,.087),(1.04,.14,.085),(1.09,.132,.078),(1.12,.125,.074)]
 vs=[];faces=[];n=64
 for z,rx,ry in rows:
  for i in range(n):a=2*math.pi*i/n;vs.append((rx*math.sin(a),-ry*math.cos(a),z))
 for j in range(len(rows)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
 d=bpy.data.meshes.new('Continuous trouser waist');d.from_pydata(vs,[],faces);d.update()
 o=bpy.data.objects.new(d.name,d);col.objects.link(o);o.parent=rig
 m=next(m for m in bpy.data.materials if m.name.startswith('Trousers'));d.materials.append(m)
 gs={n:o.vertex_groups.new(name=n) for n in ['hips','spine']}
 for v in d.vertices:
  w=max(0,min(1,(v.co.z-1.01)/.08))
  gs['hips'].add([v.index],1-w,'REPLACE');gs['spine'].add([v.index],w,'REPLACE')
 for p in d.polygons:p.use_smooth=True
 mo=o.modifiers.new('Waist skin','ARMATURE');mo.object=rig
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(P/'AI-Mentor-Reference-Woman.blend'))
# Export browser animation set, leaving the full recording in the saved Blender file.
for ob in col.objects:
 if ob.type=='MESH' and ob.data.shape_keys:
  ob.data.shape_keys.animation_data_clear()
  for k in ob.data.shape_keys.key_blocks:k.value=0
rig.animation_data.action=None
for tr in list(rig.animation_data.nla_tracks):
 if tr.name.startswith('Kim'):rig.animation_data.nla_tracks.remove(tr)
 else:tr.mute=False
sc.frame_set(1)
for ob in col.objects:
 if ob.type!='MESH':continue
 bpy.context.view_layer.objects.active=ob
 for mo in list(ob.modifiers):
  if mo.type!='ARMATURE':
   if ob.data.shape_keys:ob.modifiers.remove(mo)
   else:bpy.ops.object.modifier_apply(modifier=mo.name)
bpy.ops.object.select_all(action='DESELECT')
for ob in col.objects:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(P/'reference-woman.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_morph=True,export_yup=True)
import shutil
shutil.copy2(P/'reference-woman.glb',P.parent.parent/'frontend/public/avatars/live/reference-woman.glb')
print('FINAL_ASSETS_SAVED')
