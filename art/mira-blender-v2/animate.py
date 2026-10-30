"""Bake a continuous eight-second gesture into the Blender deform rig and GLB."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'Mira-base.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');bones=rig.pose.bones
B=lambda n:bones['mixamorig:'+n]
V=Vector
sc=bpy.context.scene;sc.frame_start=1;sc.frame_end=241;sc.render.fps=30
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
qrestR=orient('Right',(-.15,-.05,-1),(1,-.2,0));qrestL=orient('Left',(.15,-.05,-1),(-1,-.2,0))

def put(b,head,q):
 m=q.to_matrix().to_4x4();m.translation=head;b.matrix=m;bpy.context.view_layer.update()
def fingers(side,contact,point):
 for name in ['Index','Middle','Ring','Pinky','Thumb']:
  for j in range(1,4):
   b=B(side+'Hand'+name+str(j));base=([.08,.14,.10][j-1])
   extended=(side=='Right' and name=='Middle') or (side=='Left' and name=='Thumb')
   amount=base*(1-contact)+([1.20,1.40,.65][j-1] if not extended else 0)*contact
   if side=='Right':amount=amount*(1-point)+(0 if name=='Index' else [1.20,1.40,.65][j-1])*point
   axisworld=rest[side]['across']
   if name=='Thumb':
    amount*=.60
    direction=b.bone.tail_local-b.bone.head_local
    axisworld=direction.cross(rest[side]['basis'].col[2]).normalized()
   axis=b.bone.matrix_local.to_quaternion().inverted()@axisworld
   b.rotation_quaternion=Quaternion(axis,amount)
   if name=='Thumb' and j==1 and side=='Right':
    normal=b.bone.matrix_local.to_quaternion().inverted()@rest[side]['basis'].col[2]
    b.rotation_quaternion=Quaternion(normal,-.65*max(contact,point))@b.rotation_quaternion
 bpy.context.view_layer.update()
def arm(side,wrist,q):
 upper=B(side+'Arm');fore=B(side+'ForeArm');hand=B(side+'Hand')
 shoulder=upper.head.copy();l1=upper.bone.length;l2=fore.bone.length
 axis=wrist-shoulder;distance=min(axis.length,l1+l2-.0005);axis.normalize()
 pole=V((-1 if side=='Right' else 1,.1,-.8));pole=(pole-axis*pole.dot(axis)).normalized()
 along=(l1*l1-l2*l2+distance*distance)/(2*distance);height=math.sqrt(max(0,l1*l1-along*along));elbow=shoulder+axis*along+pole*height
 for b,a,c in [(upper,shoulder,elbow),(fore,elbow,wrist)]:
  restdir=b.bone.tail_local-b.bone.head_local
  rot=restdir.rotation_difference(c-a)@b.bone.matrix_local.to_quaternion()
  if b==fore:
   hint=q@b.bone.matrix_local.to_quaternion();rot=(hint@V((0,1,0))).rotation_difference(c-a)@hint
  put(b,a,rot)
 put(hand,wrist,q@hand.bone.matrix_local.to_quaternion())
def pose(t):
 for b in bones:b.matrix_basis=Matrix.Identity(4)
 active=smooth(.45,1.85,t)*(1-smooth(6.2,7.65,t));contact=smooth(.9,2,t)*(1-smooth(4.2,4.95,t));point=smooth(4.3,5.15,t)*(1-smooth(6.2,7.65,t))
 # Breath, attentive head tilt, eyebrow region through upper-eye bones.
 B('Spine2').rotation_quaternion=Quaternion((1,0,0),.008*math.sin(t*math.pi/4))
 B('Neck').rotation_quaternion=Quaternion((0,1,0),-.025*active)
 B('Head').rotation_quaternion=Quaternion((1,0,0),-.024*active)@Quaternion((0,0,1),.018*math.sin(t*math.pi/4))
 blink=sum(math.sin(math.pi*(t-a)/.20)**2 for a in [1.0,6.75] if a<t<a+.20)
 for side in ['Left','Right']:
  B(side+'OrbicularisTop').rotation_quaternion=Quaternion((1,0,0),-.30*blink)
  B(side+'OrbicularisBottom').rotation_quaternion=Quaternion((1,0,0),.12*blink)
 bpy.context.view_layer.update()
 for side in ['Left','Right']:fingers(side,contact,point if side=='Right' else 0)
 qR=qrestR.slerp(qcontactR,active).slerp(qpointR,point);qL=qrestL.slerp(qcontactL,active*(1-smooth(4.35,5.3,t)))
 # Get offsets of posed fingertip relative to wrist independently of arm placement.
 offsets={}
 for side,q,name in [('Left',qL,'Thumb'),('Right',qR,'Middle')]:
  hand=B(side+'Hand');put(hand,V((0,0,0)),q@hand.bone.matrix_local.to_quaternion());offsets[side]=B(side+'Hand'+name+'3').tail.copy()
 target=V((.005,-.25,1.27))
 # Anatomical model is 1.56m tall; explicit contact is solved from the fingertip positions.
 lrest=V((.22,-.07,.91));rrest=V((-.22,-.07,.91))
 lp=lrest.lerp(target-offsets['Left'],active*(1-smooth(4.35,5.3,t)))
 rp=rrest.lerp(target-offsets['Right']+V((-.008*(1-smooth(2.4,2.8,t)),0,0)),active)
 rp=rp.lerp(V((-.13,-.39,1.19)),point)
 arm('Left',lp,qL);arm('Right',rp,qR)
 return (B('LeftHandThumb3').tail-B('RightHandMiddle3').tail).length

face=bpy.data.objects['Mira • continuous human mesh'].data.shape_keys
report={}
for frame in range(1,242):
 t=(frame-1)/30;sc.frame_set(frame);distance=pose(t)
 attentive=smooth(.45,1.85,t)*(1-smooth(6.2,7.65,t))
 for name,value in [('Smile',.22+.10*attentive),('BrowLeft',.13*attentive),('BrowRight',.10*attentive)]:
  face.key_blocks[name].value=value;face.key_blocks[name].keyframe_insert('value',frame=frame)
 for b in bones:
  for path in ['location','rotation_quaternion','scale']:b.keyframe_insert(path,frame=frame,group=b.name)
 if frame in [1,76,106,163,241]:report[str(t)]={'contact_distance_m':distance,'right_tip':list(B('RightHandMiddle3').tail),'left_tip':list(B('LeftHandThumb3').tail)}
rig.animation_data.action.name='Mira • How are you called • 8 seconds'
for fc in rig.animation_data.action.fcurves:
 for k in fc.keyframe_points:k.interpolation='LINEAR'
rig['motion_note']='Authored RSL study, not a verified translation; reference VOG Conversation at 00:17.'
rig['source']='MakeHuman CC0 base; 3 phalanges per finger; smooth deform skinning; animation baked in Blender at 30fps.'
(P/'motion-report.json').write_text(json.dumps(report,indent=2))
sc.frame_set(106);sc.camera.location=(.10,-1.85,1.40);sc.camera.rotation_euler=(V((0,-.10,1.31))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=72
sc.view_settings.exposure=-.6
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(P/'AI-Mentor-Mira.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for o in rig.children_recursive:
 if o.type=='MESH':o.select_set(True)
out=P.parents[1]/'frontend/public/avatars/mira-blender';out.mkdir(exist_ok=True,parents=True)
bpy.ops.export_scene.gltf(filepath=str(out/'mira-signing.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_yup=True,export_image_format='AUTO')
for frame,name in [(106,'contact'),(163,'point'),(1,'rest')]:
 sc.frame_set(frame);sc.render.filepath=str(P/(name+'.png'));bpy.ops.render.render(write_still=True)
print('MIRA_ANIMATED',json.dumps(report),flush=True)
