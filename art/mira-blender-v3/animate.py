"""Bake a continuous eight-second gesture into the Blender deform rig and GLB."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P.parent/'mira-blender-v2/Mira-base.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');bones=rig.pose.bones
B=lambda n:bones['mixamorig:'+n]
V=Vector
sc=bpy.context.scene;sc.frame_start=1;sc.frame_end=241;sc.render.fps=30
sc.render.fps_base=1
# Simple tailored cream jersey, leaving the arm silhouette unobstructed.
outfit=bpy.data.objects['Mira • outfit'];mat=bpy.data.materials.new('Mira • ivory jersey');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.065,.12,.18,1);bs.inputs['Roughness'].default_value=.87
outfit.data.materials.clear();outfit.data.materials.append(mat)
for f in outfit.data.polygons:f.material_index=0
for ob in [bpy.data.objects['Mira • lashes'],bpy.data.objects['Mira • brows'],bpy.data.objects['Mira • hair']]:
 for m in ob.data.materials:
  bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
  tex=next((n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and ('diffuse' in n.image.name or 'eyelash' in n.image.name or 'eyebrow' in n.image.name)),None)
  if tex:m.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
# Restore eye alpha: the high-poly asset contains a transparent corneal overlay.
eye=bpy.data.objects['Mira • eyes'];m=eye.data.materials[0];bs=m.node_tree.nodes.get('Principled BSDF');tex=next(n for n in m.node_tree.nodes if n.type=='TEX_IMAGE');m.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
for b in bones:b.rotation_mode='QUATERNION'

def smooth(a,b,t):
 u=max(0,min(1,(t-a)/(b-a)));return u*u*u*(u*(u*6-15)+10)
def basis(f,n):
 f=V(f).normalized();n=(V(n)-f*V(n).dot(f)).normalized();x=f.cross(n).normalized();return Matrix((x,f,n)).transposed()
rest={}
for side in ['Right','Left']:
 wrist=B(side+'Hand').bone.head_local
 f=(B(side+'HandMiddle3').bone.tail_local-wrist).normalized()
 x=(B(side+'HandIndex1').bone.head_local-B(side+'HandPinky1').bone.head_local).normalized()
 if side=='Left':x=-x
 n=x.cross(f).normalized();base=basis(f,n)
 rest[side]={'basis':base,'across':base.col[0].copy(),'wrist':wrist.copy()}

def orient(side,f,n):return (basis(f,n)@rest[side]['basis'].transposed()).to_quaternion()
qcontactR=orient('Right',(1,0,0),(0,1,0));qpointR=orient('Right',(0,-1,0),(1,0,0))
indexdir=B('RightHandIndex3').bone.tail_local-B('RightHandIndex1').bone.head_local
qpointR=(qpointR@indexdir).rotation_difference(V((0,-1,0)))@qpointR
# Left fist: knuckles forward, thumb upright.
qcontactL=orient('Left',(0,-1,0),(-1,0,0))
thumbdir=B('LeftHandThumb3').bone.tail_local-B('LeftHandThumb1').bone.head_local
qcontactL=(qcontactL@thumbdir).rotation_difference(V((0,0,1)))@qcontactL
leftforward=qcontactL@rest['Left']['basis'].col[1]
# Rotate the fist around its upright thumb to align the wrist with the forearm.
qcontactL=Quaternion((0,0,1),math.pi-math.atan2(leftforward.y,leftforward.x))@qcontactL
qrestR=orient('Right',(-.15,-.05,-1),(1,-.2,0));qrestL=orient('Left',(.15,-.05,-1),(-1,-.2,0))

def put(b,head,q):
 m=q.to_matrix().to_4x4();m.translation=head;b.matrix=m;bpy.context.view_layer.update()
# Three deform bones distribute the forearm roll instead of twisting the wrist seam.
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for side in ['Left','Right']:
 source=rig.data.edit_bones['mixamorig:'+side+'ForeArm']
 for k in range(3):
  b=rig.data.edit_bones.new('mixamorig:'+side+'ForearmRoll'+str(k))
  b.head=source.head;b.tail=source.tail;b.roll=source.roll;b.parent=source.parent;b.use_deform=True
bpy.ops.object.mode_set(mode='OBJECT')
bones=rig.pose.bones
for b in bones:b.rotation_mode='QUATERNION'
for ob in rig.children_recursive:
 if ob.type!='MESH':continue
 for side in ['Left','Right']:
  old=ob.vertex_groups.get('mixamorig:'+side+'ForeArm')
  if not old:continue
  groups=[ob.vertex_groups.new(name='mixamorig:'+side+'ForearmRoll'+str(k)) for k in range(3)]
  b=B(side+'ForeArm').bone;axis=b.tail_local-b.head_local;length2=axis.length_squared
  for v in ob.data.vertices:
   weight=next((g.weight for g in v.groups if g.group==old.index),0)
   if weight<1e-7:continue
   co=rig.matrix_world.inverted()@ob.matrix_world@v.co
   u=max(0,min(1,(co-b.head_local).dot(axis)/length2))
   # Most pronation occurs in the middle/distal forearm, not at the elbow.
   x=u*2;j=min(1,int(x));fraction=x-j
   groups[j].add([v.index],weight*(1-fraction),'REPLACE')
   groups[j+1].add([v.index],weight*fraction,'REPLACE')
   old.remove([v.index])

relaxed={'Index':(.18,.26,.12),'Middle':(.24,.32,.15),'Ring':(.30,.37,.18),'Pinky':(.36,.42,.20),'Thumb':(.14,.20,.10)}
closed={'Index':(1.10,1.32,.65),'Middle':(1.16,1.38,.70),'Ring':(1.20,1.42,.72),'Pinky':(1.23,1.44,.74),'Thumb':(.36,.65,.32)}
delays={'Pinky':0,'Ring':.035,'Middle':.075,'Index':.11,'Thumb':.16}

def fingers(side,t):
 for name in ['Index','Middle','Ring','Pinky','Thumb']:
  for j in range(1,4):
   b=B(side+'Hand'+name+str(j));delay=delays[name]+.028*(j-1)
   c=smooth(.65+delay,2.06+delay,t)
   p=smooth(4.05+delay,5.10+delay,t) if side=='Right' else 0
   release=smooth((6.0 if side=='Right' else 4.12)+delay,(7.65 if side=='Right' else 5.72)+delay,t)
   restangle=relaxed[name][j-1]
   extended=(side=='Right' and name=='Middle') or (side=='Left' and name=='Thumb')
   contactangle=(.035,.055,.025)[j-1] if extended else closed[name][j-1]
   pointangle=(.015,.035,.015)[j-1] if name=='Index' else closed[name][j-1]
   amount=(restangle*(1-c)+contactangle*c)*(1-p)+pointangle*p
   amount=amount*(1-release)+restangle*release
   # Each finger has its own anatomical flexion plane; no identical claw rotation.
   direction=(b.bone.tail_local-b.bone.head_local).normalized()
   axisworld=direction.cross(rest[side]['basis'].col[2]).normalized()
   axis=b.bone.matrix_local.to_quaternion().inverted()@axisworld
   b.rotation_quaternion=Quaternion(axis,amount)
   if j==1:
    normal=b.bone.matrix_local.to_quaternion().inverted()@rest[side]['basis'].col[2]
    cup={'Index':.015,'Middle':0,'Ring':-.025,'Pinky':-.06,'Thumb':0}[name]
    opposition=cup*c*(1-release)
    if name=='Thumb':opposition=(-.25*(1-c)+(-.38 if side=='Right' else 0)*c)*(1-release)-.25*release
    b.rotation_quaternion=Quaternion(normal,opposition)@b.rotation_quaternion
 bpy.context.view_layer.update()

def arm(side,wrist,q,t):
 upper=B(side+'Arm');fore=B(side+'ForeArm');hand=B(side+'Hand')
 shoulder=upper.head.copy();l1=upper.bone.length;l2=fore.bone.length
 delta=wrist-shoulder;distance=min(delta.length,l1+l2-.001);axis=delta.normalized();wrist=shoulder+axis*distance
 sign=-1 if side=='Right' else 1
 effort=smooth(.35,2,t)*(1-smooth(6.1,7.8,t))
 pole=V((sign*(.70+.15*effort),.16-.12*effort,-1))
 pole=(pole-axis*pole.dot(axis)).normalized()
 along=(l1*l1-l2*l2+distance*distance)/(2*distance);height=math.sqrt(max(0,l1*l1-along*along));elbow=shoulder+axis*along+pole*height
 restdir=upper.bone.tail_local-upper.bone.head_local
 upperq=restdir.rotation_difference(elbow-shoulder)@upper.bone.matrix_local.to_quaternion()
 put(upper,shoulder,upperq)
 basic=(fore.bone.tail_local-fore.bone.head_local).rotation_difference(wrist-elbow)@fore.bone.matrix_local.to_quaternion()
 # Keep the wrist inside a natural bend range throughout the transition.
 foreaxis=(wrist-elbow).normalized();handaxis=q@rest[side]['basis'].col[1]
 deviation=handaxis.angle(foreaxis);limit=math.radians(52)
 if deviation>limit:
  correction=handaxis.rotation_difference(foreaxis)
  q=Quaternion().slerp(correction,(deviation-limit)/deviation)@q
 hint=q@fore.bone.matrix_local.to_quaternion();foreq=(hint@V((0,1,0))).rotation_difference(wrist-elbow)@hint
 put(fore,elbow,foreq)
 for k,mix in enumerate([0,.48,1]):put(B(side+'ForearmRoll'+str(k)),elbow,basic.slerp(foreq,mix))
 put(hand,wrist,q@hand.bone.matrix_local.to_quaternion())

def arc(a,b,u,bend):
 # A curved reach with zero velocity at each end, driven by a quintic phase.
 return a.lerp(b,u)+V(bend)*(math.sin(math.pi*u)**2)

# Reference wrist endpoints use the actual posed fingertips, not guessed offsets.
contact_offsets={}
for side,q,name in [('Left',qcontactL,'Thumb'),('Right',qcontactR,'Middle')]:
 fingers(side,3.5);hand=B(side+'Hand');put(hand,V((0,0,0)),q@hand.bone.matrix_local.to_quaternion())
 contact_offsets[side]=B(side+'Hand'+name+'3').tail.copy()

def pose(t):
 for b in bones:b.matrix_basis=Matrix.Identity(4)
 leftlift=smooth(.25,1.98,t);rightlift=smooth(.43,2.30,t)
 leftrelease=smooth(4.13,5.93,t);rightrelease=smooth(6.14,7.84,t)
 reach=smooth(4.12,5.32,t)
 attentive=smooth(.3,2.1,t)*(1-smooth(6.2,7.8,t))
 # The chest and shoulder girdle lead; wrists and fingertips settle later.
 breath=math.sin(math.pi*t/4)
 B('Spine').rotation_quaternion=Quaternion((0,1,0),.018*math.sin(math.pi*t/4))
 B('Spine1').rotation_quaternion=Quaternion((0,0,1),-.035*attentive*(1-.75*reach))
 B('Spine2').rotation_quaternion=Quaternion((1,0,0),.014*breath+.018*attentive)
 B('LeftShoulder').rotation_quaternion=Quaternion((0,0,1),-.035*leftlift*(1-leftrelease))
 B('RightShoulder').rotation_quaternion=Quaternion((0,0,1),.045*rightlift*(1-rightrelease))
 glance=smooth(.65,1.6,t)*(1-smooth(3.65,4.6,t))
 B('Neck').rotation_quaternion=Quaternion((0,1,0),-.035*attentive)
 B('Head').rotation_quaternion=Quaternion((1,0,0),.045*glance-.025*reach*(1-rightrelease))@Quaternion((0,0,1),.025*breath)
 blink=sum(math.sin(math.pi*(t-a)/.23)**2 for a in [1.12,6.80] if a<t<a+.23)
 for side in ['Left','Right']:
  B(side+'Eye').rotation_quaternion=Quaternion((1,0,0),.035*glance)
  B(side+'OrbicularisTop').rotation_quaternion=Quaternion((1,0,0),-.30*blink)
  B(side+'OrbicularisBottom').rotation_quaternion=Quaternion((1,0,0),.12*blink)
 bpy.context.view_layer.update()
 for side in ['Left','Right']:fingers(side,t)
 # Delayed wrist rotation gives overlap instead of all joints starting/stopping together.
 lturn=smooth(.40,2.18,t)*(1-smooth(4.30,6.06,t))
 rturn=smooth(.62,2.45,t)*(1-smooth(6.27,7.88,t))
 pturn=smooth(4.23,5.43,t)*(1-smooth(6.27,7.88,t))
 qL=qrestL.slerp(qcontactL,lturn)
 qR=qrestR.slerp(qcontactR,rturn).slerp(qpointR,pturn)
 # Shared breathing drift maintains the fingertip contact while the body remains alive.
 target=V((.005+.0018*breath,-.25+.0015*math.sin(math.pi*t/2),1.27+.0018*breath))
 lrest=V((.205,-.10,.935));rrest=V((-.205,-.105,.94))
 lc=target-contact_offsets['Left'];rc=target-contact_offsets['Right']
 lp=arc(lrest,lc,leftlift,(.022,-.028,.025))
 lp=arc(lp,lrest,leftrelease,(.025,-.025,.012))
 rp=arc(rrest,rc,rightlift,(-.035,-.032,.038))
 rp=arc(rp,V((-.13,-.39,1.19)),reach,(-.012,.018,.043))
 rp=arc(rp,rrest,rightrelease,(-.032,-.030,.025))
 arm('Left',lp,qL,t);arm('Right',rp,qR,t)
 # Reconcile the wrist limit with exact fingertip contact, fading in/out smoothly.
 lock=smooth(2.05,2.60,t)*(1-smooth(3.95,4.30,t))
 if lock>0:
  correctedL=lp.copy();correctedR=rp.copy()
  for iteration in range(8):
   correctedL+=target-B('LeftHandThumb3').tail
   correctedR+=target-B('RightHandMiddle3').tail
   arm('Left',correctedL,qL,t);arm('Right',correctedR,qR,t)
  arm('Left',lp.lerp(correctedL,lock),qL,t);arm('Right',rp.lerp(correctedR,lock),qR,t)
 return (B('LeftHandThumb3').tail-B('RightHandMiddle3').tail).length

face=bpy.data.objects['Mira • continuous human mesh'].data.shape_keys
report={}
previous_rotations={}
for frame in range(1,242):
 t=(frame-1)/30;sc.frame_set(frame);distance=pose(t)
 attentive=smooth(.45,1.85,t)*(1-smooth(6.2,7.65,t))
 for name,value in [('Smile',.22+.10*attentive),('BrowLeft',.13*attentive),('BrowRight',.10*attentive)]:
  face.key_blocks[name].value=value;face.key_blocks[name].keyframe_insert('value',frame=frame)
 for b in bones:
  previous=previous_rotations.get(b.name)
  if previous is not None and previous.dot(b.rotation_quaternion)<0:b.rotation_quaternion.negate()
  previous_rotations[b.name]=b.rotation_quaternion.copy()
  for path in ['location','rotation_quaternion','scale']:b.keyframe_insert(path,frame=frame,group=b.name)
 if frame in [1,76,106,163,241]:report[str(t)]={'contact_distance_m':distance,'right_tip':list(B('RightHandMiddle3').tail),'left_tip':list(B('LeftHandThumb3').tail)}
rig.animation_data.action.name='Mira • How are you called • 8 seconds'
for fc in rig.animation_data.action.fcurves:
 for k in fc.keyframe_points:k.interpolation='LINEAR'
rig['motion_note']='Authored RSL study, not a verified translation; reference VOG Conversation at 00:17.'
rig['source']='MakeHuman CC0 base; independent finger phasing; curved hand trajectories; 6 forearm roll bones; Blender 30fps.'
(P/'motion-report.json').write_text(json.dumps(report,indent=2))
sc.frame_set(106);sc.camera.location=(.10,-1.85,1.40);sc.camera.rotation_euler=(V((0,-.10,1.31))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=72
sc.view_settings.exposure=-.6
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(P/'AI-Mentor-Mira-Soft-Motion.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for o in rig.children_recursive:
 if o.type=='MESH':o.select_set(True)
out=P.parents[1]/'frontend/public/avatars/mira-blender';out.mkdir(exist_ok=True,parents=True)
bpy.ops.export_scene.gltf(filepath=str(out/'mira-signing-soft.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_yup=True,export_image_format='AUTO')
for frame,name in [(106,'contact'),(163,'point'),(1,'rest'),(46,'lift'),(142,'transition'),(214,'release')]:
 sc.frame_set(frame);sc.render.filepath=str(P/(name+'.png'));bpy.ops.render.render(write_still=True)
print('MIRA_ANIMATED',json.dumps(report),flush=True)
