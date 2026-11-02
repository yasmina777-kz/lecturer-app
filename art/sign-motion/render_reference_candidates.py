"""Render real candidate skeleton poses at matched source times for visual QA."""
from pathlib import Path
import bpy,sys,json,math
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];args=sys.argv[sys.argv.index('--')+1:]
base=Path(args[0]);ids=args[1:];hands_only='hands' in ids;ids=[id for id in ids if id!='hands']
audit=json.loads(base.read_text()) if base.suffix=='.json' else None
if audit:
 entries=[e for e in audit['entries'] if e['status']=='candidate-ready' and (not ids or e['id'] in ids)]
 targets=[(Path(e['candidate']),e['candidateId']) for e in entries]
 base=base.parent
else:targets=[(base/id,id) for id in ids]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig['controls_enabled']=0
for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
for b in rig.pose.bones:
 if b.name.startswith('mixamorig:'):
  for c in list(b.constraints):b.constraints.remove(c)
scene=bpy.context.scene;scene.render.fps=30;scene.render.engine='BLENDER_EEVEE_NEXT'
if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=16
scene.render.resolution_x=320;scene.render.resolution_y=400;scene.render.resolution_percentage=100
scene.render.film_transparent=False;scene.camera.location=(0,-2.2,1.42);scene.camera.rotation_euler=(Vector((0,-.1,1.32))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.lens=55
manifest=[]
for folder,id in targets:
 meta=json.loads((folder/(id+'.json')).read_text());points=meta['sourceTimeline'];last=points[-1][1]
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(folder/(id+'.glb')));added=set(bpy.data.objects)-before;src=next(o for o in added if o.type=='ARMATURE');rig.animation_data_create();rig.animation_data.action=src.animation_data.action;rig.animation_data.action_slot=src.animation_data.action_slot
 output=folder/('preview-hands' if hands_only else 'preview');output.mkdir(exist_ok=True)
 for index,fraction in enumerate([.25,.5,.75]):
  source=last*fraction;a,b=next(((a,b) for a,b in zip(points,points[1:]) if a[1]<=source<=b[1] and b[1]>a[1]),(points[0],points[-1]));t=a[0]+(b[0]-a[0])*(source-a[1])/max(.000001,b[1]-a[1]);frame=1+t*30;scene.frame_set(math.floor(frame),subframe=frame%1)
  if hands_only:
   side=max(['Left','Right'],key=lambda s:rig.pose.bones['mixamorig:'+s+'Hand'].head.z)
   pts=[rig.matrix_world@b.head for b in rig.pose.bones if b.name.startswith('mixamorig:'+side+'Hand')]
   target=(Vector(tuple(min(p[j] for p in pts) for j in range(3)))+Vector(tuple(max(p[j] for p in pts) for j in range(3))))/2
   scene.camera.location=target+Vector((0,-.8,0));scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=.30
  path=output/(str(index)+'.png');scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
  manifest.append({'id':id,'label':meta['label'],'source':meta['reference'],'sourceTime':source,'animationTime':t,'image':str(path),'folder':str(folder)})
 rig.animation_data_clear()
 for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
(base/'preview-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
