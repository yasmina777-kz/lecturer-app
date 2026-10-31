"""Check the saved controls and evaluated skinned geometry, then render QA views."""
from pathlib import Path
import bpy,math,json,sys
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'art/hand-rig';PUBLIC=ROOT/'frontend/public/avatars/hand-workshop'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Mira-Hand-Workshop.blend'));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');sc=bpy.context.scene
report=json.loads((OUT/'validation.json').read_text());bones=rig.pose.bones
# Native drivers must evaluate after a normal reopen, without Python namespaces.
assert all(fc.driver.is_valid for fc in rig.animation_data.drivers), 'Invalid native driver'
checks={}
for side in ['Left','Right']:
 hand=bones['CTRL_'+side+'Hand'];root=bones['CTRL_'+side+'Index1'];root['curl']=0.;rig.update_tag();bpy.context.view_layer.update();before=bones['mixamorig:'+side+'HandIndex2'].matrix.copy()
 root['curl']=1.;rig.update_tag();bpy.context.view_layer.update();after=bones['mixamorig:'+side+'HandIndex2'].matrix.copy();angle=before.to_quaternion().rotation_difference(after.to_quaternion()).angle
 assert angle>.25,('Finger control inactive',side,angle)
 root['curl']=0.;hand['IK_FK']=1.;hand.location.x+=.025;rig.update_tag();bpy.context.view_layer.update()
 error=(bones['mixamorig:'+side+'Hand'].head-hand.head).length;assert error<.002,('IK wrist target',side,error)
 hand.location.x-=.025;hand['IK_FK']=0.;fk=bones['CTRL_FK_'+side+'ForeArm'];fk.rotation_mode='QUATERNION';fk.rotation_quaternion=Quaternion((1,0,0),.18)@fk.rotation_quaternion;rig.update_tag();bpy.context.view_layer.update()
 diff=bones['mixamorig:'+side+'ForeArm'].matrix.to_quaternion().rotation_difference(fk.matrix.to_quaternion()).angle;assert diff<.002,('FK mismatch',side,diff)
 checks[side]={'fingerControlRotationDegrees':math.degrees(angle),'ikTargetErrorMeters':error,'fkRotationErrorDegrees':math.degrees(diff)}
report['controls']=checks
body=bpy.data.objects['Mira • continuous human mesh'];ball=bpy.data.objects['QA • grasp sphere'];center=ball.location.copy();radius=.033
contacts={};maxstep=0
for slug in ['fist','point','pinch','wave','grasp']:
 rig.animation_data.action=bpy.data.actions['TEST • '+report[slug]['label']];rig['controls_enabled']=0.;sc.frame_start=1;sc.frame_end=round(report[slug]['duration']*30)+1
 previous={}
 for frame in range(1,sc.frame_end+1):
  sc.frame_set(frame);bpy.context.view_layer.update()
  for bone in rig.pose.bones:
   if bone.name.startswith('CTRL_'):continue
   q=bone.rotation_quaternion
   if bone.name in previous:maxstep=max(maxstep,previous[bone.name].rotation_difference(q).angle)
   previous[bone.name]=q.copy();assert all(math.isfinite(v) for row in bone.matrix for v in row)
  if slug=='grasp':
   deps=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(deps);mesh=ev.to_mesh();mins={}
   for v in body.data.vertices:
    for g in v.groups:
     n=body.vertex_groups[g.group].name
     if g.weight>.2 and 'RightHand' in n and any(d in n for d in ['Thumb','Index','Middle','Ring','Pinky']):
      finger=next(d for d in ['Thumb','Index','Middle','Ring','Pinky'] if d in n);gap=(ev.matrix_world@mesh.vertices[v.index].co-center).length-radius
      mins[finger]=min(mins.get(finger,1),gap)
   ev.to_mesh_clear()
   if abs((frame-1)/30-report[slug]['holdTime'])<.02:contacts['hold']=mins
   if min(mins.values())<contacts.get('worstPenetrationMeters',0):contacts.update(worstPenetrationMeters=min(mins.values()),worstFrame=frame,worstFinger=min(mins,key=mins.get))
 sc.frame_set(round(report[slug]['holdTime']*30)+1);bpy.context.view_layer.update();ball.hide_render=slug!='grasp';ball.hide_viewport=slug!='grasp'
 if 'render' in sys.argv:
  wrist=rig.pose.bones['mixamorig:RightHand'].head;target=wrist+Vector((0,0,.065))
  for label,offset in [('front',(0,-.7,.05)),('three-quarter',(-.46,-.55,.1)),('side',(-.7,-.05,.08))]:
   sc.camera.location=target+Vector(offset);sc.camera.rotation_euler=(target-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=60
   sc.render.resolution_x=640;sc.render.resolution_y=640;sc.render.filepath=str(OUT/(slug+'-'+label+'.png'));sc.render.image_settings.file_format='PNG';sc.cycles.samples=8;bpy.ops.render.render(write_still=True)
assert contacts.get('worstPenetrationMeters',0)>-.001,('Visible sphere intersection',contacts)
assert all(0<=gap<.002 for gap in contacts['hold'].values()),('Grasp lacks skin contact',contacts)
report['graspSkinContact']=contacts;report['bakedMaxJointStepDegrees']=math.degrees(maxstep)
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(PUBLIC/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('WORKSHOP_VALIDATION',json.dumps({'controls':checks,'grasp':contacts,'maxStep':math.degrees(maxstep)}),flush=True)
