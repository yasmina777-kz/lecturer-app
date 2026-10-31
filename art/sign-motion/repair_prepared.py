"""Rebake the three old authored phrases with the shared anatomical hand solver.
Keeps authored arm/face/body motion; never substitutes generic Mixamo gestures.
"""
from pathlib import Path
import sys,json,math
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art/sign-motion/retarget.py';__file__=str(source)
exec(compile(source.read_text().split('manifest=[]')[0],str(source),'exec'),globals())
repair_hand_weights(rig)
for slug,label,filename in [('hello','Здравствуйте','mira-hello.glb'),('thanks','Спасибо','mira-thanks.glb'),('name-demo','Как тебя зовут?','mira-signing-soft.glb')]:
 for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
 before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/'frontend/public/avatars/mira-blender'/filename))
 imported=[ob for ob in bpy.data.objects if ob not in before];src=next(ob for ob in imported if ob.type=='ARMATURE')
 rig.animation_data_create();rig.animation_data.action=src.animation_data.action;rig.animation_data.action_slot=src.animation_data.action_slot
 action=rig.animation_data.action
 sc.render.fps=30
 # Imported timestamps are expressed at the scene fps. Keep the whole source.
 start,end=action.frame_range;count=round(end-start)+1
 samples=[];locations=[];hand_samples=[];finger_fit_previous.clear()
 for i in range(count):
  sc.frame_set(round(start)+i);bpy.context.view_layer.update();current_hand_values.clear()
  for side in ['Left','Right']:
   hand_delta=B(side+'Hand').matrix.to_quaternion()@B(side+'Hand').bone.matrix_local.to_quaternion().inverted()
   for name in finger_indices:
    targets=[hand_delta.inverted()@(B(side+'Hand'+name+str(j)).tail-B(side+'Hand'+name+str(j)).head).normalized() for j in range(1,4)]
    values=fit_finger_directions(side,name,targets,finger_fit_previous.get((side,name)));finger_fit_previous[(side,name)]=values.copy()
    # Use the same relaxed endpoints as dictionary motions; no direct handshape
    # crossfade at a phrase boundary. This affects only preparation/release.
    fade=smooth(0,.6,i/30)*(1-smooth((count-1)/30-.6,(count-1)/30,i/30))
    apply_finger_values(side,name,values,fade)
  samples.append({b.name:b.rotation_quaternion.copy() for b in bones});locations.append({b.name:b.location.copy() for b in bones})
  hand_samples.append({key:v.copy() for key,v in current_hand_values.items()})
 rig.animation_data_clear()
 for ob in imported:bpy.data.objects.remove(ob,do_unlink=True)
 hands=filter_hand_values(hand_samples)
 for row,values in zip(samples,hands):
  for (side,name),v in values.items():
   _,qs=finger_chain(side,name,v)
   for j,q in enumerate(qs,1):row[B(side+'Hand'+name+str(j)).name]=q
 times=coordinated_times(samples)
 for i,row in enumerate(samples):
  for b in bones:
   b.rotation_quaternion=row[b.name];b.location=locations[i][b.name]
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=1+times[i]*30,group=b.name)
 rig.animation_data.action.name='prepared-'+slug
 for fc in rig.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 sc.frame_start=1;sc.frame_end=math.ceil(times[-1]*30)+1;previous={};peak=0;hinge=0
 for f in range(1,sc.frame_end+1):
  sc.frame_set(f)
  for b in bones:
   q=b.rotation_quaternion.normalized()
   if b.name in previous:peak=max(peak,previous[b.name].rotation_difference(q).angle)
   previous[b.name]=q.copy()
   if 'Hand' in b.name and b.name[-1:] in ['2','3']:
    side='Left' if 'Left' in b.name else 'Right';name=next((n for n in finger_indices if n in b.name),None)
    if name:hinge=max(hinge,V((q.x,q.y,q.z)).cross(hinge_axis(side,name,int(b.name[-1]))).length)
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 id='prepared-'+slug
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
 meta={'id':id,'label':label,'url':'/avatars/sign-motion/'+id+'.glb','duration':(sc.frame_end-1)/30,'review':'experimental-unreviewed','source':'Existing project-authored phrase; anatomical hand rebake','motionVersion':6,'handMechanics':'workshop-parameter-curves-v1','maxJointStepDegrees':math.degrees(peak),'maxHingeOffAxis':hinge,'leadIn':times[18],'leadOut':(sc.frame_end-1)/30-times[-19]}
 (OUT/(id+'.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2));print('REPAIRED',label,meta['duration'],flush=True)
