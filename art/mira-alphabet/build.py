"""Hand-authored alphabet studies using the existing Blender rig.
Reference: Bukva labelled videos (see ml/rsl/data/manifest.json). Expert review pending.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art/mira-blender-v3/animate.py'
scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nface=bpy.data.objects')[0].replace('limit=math.radians(52)','limit=math.radians(115)'),str(source),'exec'),scope)
globals().update({k:v for k,v in scope.items() if not k.startswith('__')})
OUT=ROOT/'frontend/public/avatars/mira-blender'
for letter in ['a','v','g','l','u','y','sh']:
 for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
 face=bpy.data.objects['Mira • continuous human mesh'].data.shape_keys;face.animation_data_clear()
 previous={};first=None;maxstep=0
 for frame in range(1,242):
  t=(frame-1)/30;sc.frame_set(frame)
  for b in bones:b.matrix_basis=Matrix.Identity(4)
  blend=smooth(.4,2,t)*(1-smooth(6.2,7.8,t))
  # Small connected torso/shoulder motion; the signing wrist remains in world space.
  # Do not add expressive facial grammar to an isolated-letter demonstration.
  engaged=smooth(.20,1.70,t)*(1-smooth(6.25,7.90,t))
  breath=math.sin(t*math.pi/4)
  B('Spine').rotation_quaternion=Quaternion((0,1,0),.012*breath)
  B('Spine1').rotation_quaternion=Quaternion((0,0,1),-.018*engaged)
  B('Spine2').rotation_quaternion=Quaternion((1,0,0),.014*engaged+.008*breath)
  B('RightShoulder').rotation_quaternion=Quaternion((0,0,1),.032*engaged)
  B('LeftShoulder').rotation_quaternion=Quaternion((0,0,1),-.010*engaged)
  B('Neck').rotation_quaternion=Quaternion((0,0,1),.010*engaged)
  B('Head').rotation_quaternion=Quaternion((1,0,0),-.018*engaged)@Quaternion((0,0,1),.008*breath)
  blink=sum(math.sin(math.pi*(t-a)/.23)**2 for a in [1.1,6.8] if a<t<a+.23)
  for side in ['Left','Right']:
   B(side+'OrbicularisTop').rotation_quaternion=Quaternion((1,0,0),-.30*blink)
   B(side+'OrbicularisBottom').rotation_quaternion=Quaternion((1,0,0),.12*blink)
   for name in ['Index','Middle','Ring','Pinky','Thumb']:
    for j in range(1,4):
     b=B(side+'Hand'+name+str(j));target=closed[name][j-1]
     if letter=='v':target=(.025,.035,.015)[j-1]
     if letter=='l' and name in ['Index','Middle']:target=(.05,.04,.02)[j-1]
     if letter=='g' and name=='Index':target=(.025,.035,.015)[j-1]
     if letter=='u' and name=='Pinky':target=(.025,.035,.015)[j-1]
     if letter=='y' and name in ['Index','Pinky']:target=(.025,.035,.015)[j-1]
     if letter=='sh' and name in ['Index','Middle','Ring']:target=(.025,.035,.015)[j-1]
     if name=='Thumb':target={'a':(.10,.15,.12),'v':(.10,.12,.04),'l':(.5,.65,.3),'g':(.05,.06,.03),'u':(.04,.06,.02),'y':(.5,.65,.3),'sh':(.5,.65,.3)}[letter][j-1]
     # Fingers settle successively, before the stable viewing interval.
     delay={'Thumb':.02,'Index':0,'Middle':.035,'Ring':.065,'Pinky':.095}[name]+.018*(j-1)
     u=smooth(.40+delay,1.90+delay,t)*(1-smooth(6.15+delay,7.65+delay,t)) if side=='Right' else 0
     amount=relaxed[name][j-1]*(1-u)+target*u
     direction=(b.bone.tail_local-b.bone.head_local).normalized()
     axis=b.bone.matrix_local.to_quaternion().inverted()@direction.cross(rest[side]['basis'].col[2]).normalized()
     b.rotation_quaternion=Quaternion(axis,amount)
     if j==1:
      normal=b.bone.matrix_local.to_quaternion().inverted()@rest[side]['basis'].col[2]
      spread={'Index':.02,'Middle':0,'Ring':-.02,'Pinky':-.03,'Thumb':(.2 if letter=='a' else -.12)}[name]
      if letter in ['g','u'] and name=='Thumb':
       desired=rest[side]['across'];normal_world=rest[side]['basis'].col[2]
       spread=math.atan2(normal_world.dot(direction.cross(desired)),direction.dot(desired))
      if letter in ['y','sh'] and name=='Thumb':spread=-.42
      if letter=='l' and name=='Index':spread=-.3
      if letter=='l' and name=='Middle':spread=.15
      if (letter=='sh' and name in ['Index','Middle','Ring']) or (letter=='v' and name!='Thumb'):
       desired=(B(side+'HandMiddle1').bone.tail_local-B(side+'HandMiddle1').bone.head_local).normalized();normal_world=rest[side]['basis'].col[2]
       spread=math.atan2(normal_world.dot(direction.cross(desired)),direction.dot(desired))
      b.rotation_quaternion=Quaternion(normal,spread*u)@b.rotation_quaternion
  bpy.context.view_layer.update()
  arm('Left',V((.205,-.105,.94)),qrestL,t)
  start=V((-.205,-.105,.94));target=V((-.23,-.25,1.35))
  goal=orient('Right',(0,0,1),(0,-1,0))
  if letter=='g':target=V((-.23,-.32,1.30));goal=orient('Right',(0,0,-1),(0,1,0))
  if letter=='u':goal=orient('Right',(-1,0,.12),(0,-1,0))
  if letter=='l':target=V((-.23,-.32,1.18));goal=orient('Right',(0,-.2,-1),(0,1,-.2))
  wrist=arc(start,target,blend,(-.025,-.03,.02));q=qrestR.slerp(goal,blend)
  arm('Right',wrist,q,t)
  for name,value in [('Smile',.18),('BrowLeft',.03),('BrowRight',.03)]:
   face.key_blocks[name].value=value;face.key_blocks[name].keyframe_insert('value',frame=frame)
  for b in bones:
   if b.name in previous:
    if previous[b.name].dot(b.rotation_quaternion)<0:b.rotation_quaternion.negate()
    maxstep=max(maxstep,previous[b.name].rotation_difference(b.rotation_quaternion).angle)
   assert all(math.isfinite(x) for row in b.matrix for x in row)
   previous[b.name]=b.rotation_quaternion.copy()
   for path in ['location','rotation_quaternion','scale']:b.keyframe_insert(path,frame=frame,group=b.name)
  if frame==1:first={b.name:b.matrix.copy() for b in bones}
 loop_error=max(abs(b.matrix[i][j]-first[b.name][i][j]) for b in bones for i in range(4) for j in range(4))
 assert loop_error<1e-5,loop_error
 assert math.degrees(maxstep)<20,(letter,math.degrees(maxstep))
 print('MOTION_CHECK',letter,'loop',loop_error,'max_step_degrees',math.degrees(maxstep),flush=True)
 rig.animation_data.action.name='Mira letter '+letter
 for action in [rig.animation_data.action,face.animation_data.action]:
  for fc in action.fcurves:
   for key in fc.keyframe_points:key.interpolation='LINEAR'
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 for ob in rig.children_recursive:
  if ob.type=='MESH':ob.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/('letter-'+letter+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_yup=True,export_image_format='AUTO')
 print('EXPORTED',letter,flush=True)
