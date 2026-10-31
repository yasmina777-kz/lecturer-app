"""Editable Mira hand workshop + controller-free game clips. Blender 4.5.
Run from repository root with Blender --background --python art/hand-rig/build.py.
Existing character geometry/materials are preserved; only skin weights are repaired.
"""
from pathlib import Path
import sys,json,math,hashlib
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art/sign-motion/retarget.py';__file__=str(source)
exec(compile(source.read_text().split('manifest=[]')[0],str(source),'exec'),globals())
exec(compile((ROOT/'art/hand-rig/weights.py').read_text(),'weights.py','exec'),globals())
OUT=ROOT/'art/hand-rig';PUBLIC=ROOT/'frontend/public/avatars/hand-workshop';PUBLIC.mkdir(parents=True,exist_ok=True)
report={'weights':repair_hand_weights(rig),'source':'Existing Mira mesh; Mixamo-calibrated flexion planes; independent mechanical tests, not RSL signs'}
init_finger_rigs();deform_names=[b.name for b in bones];mesh_objects=[o for o in rig.children_recursive if o.type=='MESH']
original_geometry={o.name:[tuple(v.co) for v in o.data.vertices] for o in mesh_objects}
# Anatomical axes use the existing Mixamo calibration. Keep the stable open pose
# and limit isolated distal curl; do not copy Talking gestures into RSL.
report['pinchBoneTipGapMeters']=pinch_distances

# Grasp a sphere with the right hand. Fit whole finger chains to the surface;
# capsule collision penalties prevent a fingertip contact hiding a buried phalanx.
side='Right';palm=rest[side]['basis'];center=rest[side]['wrist']+palm.col[1]*.073+palm.col[2]*.043;radius=.033
seed=mix_hand(side,.65)
def grasp_cost(v):
 cost=0
 for name in finger_indices:
  pts=finger_points(side,name,v[name]);pad=.005 if name!='Thumb' else .006
  cost+=((pts[-1]-center).length-radius-pad)**2
  for a,b in zip(pts,pts[1:]):
   for k in range(7):cost+=12*max(0,radius+pad-(a.lerp(b,k/6)-center).length)**2
  cost+=.000004*sum((x-y)**2 for x,y in zip(v[name],seed[name]))
 return cost
grasp_pose=minimize(seed,grasp_cost,side,list(finger_indices))
# Refine contact on the evaluated skinned mesh, not only the finger bones.
# This accounts for the thick thumb pad and the character's actual skin weights.
body=bpy.data.objects['Mira • continuous human mesh']
finger_vertices={name:[] for name in finger_indices}
for v in body.data.vertices:
 for name in finger_indices:
  if sum(g.weight for g in v.groups if 'RightHand'+name in body.vertex_groups[g.group].name)>.4:finger_vertices[name].append(v.index)
for b in bones:b.matrix_basis=Matrix.Identity(4)
base_grasp={n:v.copy() for n,v in grasp_pose.items()}
def skin_cost(v):
 apply_hand('Right',v);bpy.context.view_layer.update();ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();tr=rig.matrix_world.inverted()@ev.matrix_world
 cost=0
 for name,ids in finger_vertices.items():
  gap=min((tr@mesh.vertices[i].co-center).length-radius for i in ids)
  cost+=10*(gap-.0006)**2+30*min(0,gap)**2
  cost+=.0000002*sum((a-b)**2 for a,b in zip(v[name],base_grasp[name]))
 ev.to_mesh_clear();return cost
grasp_pose=minimize(grasp_pose,skin_cost,'Right',list(finger_indices))
report['graspBoneTipSurfaceGapsMeters']={n:(finger_points(side,n,grasp_pose[n])[-1]-center).length-radius for n in finger_indices}
# Primitive included in Blender review only; also export it with the grasp clip.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=radius,location=center)
ball=bpy.context.object;ball.name='QA • grasp sphere';material=bpy.data.materials.new('QA • warm gold');material.diffuse_color=(.75,.43,.12,1);ball.data.materials.append(material)
ball.hide_render=True;ball.hide_viewport=True
sc.render.fps=30;sc.frame_start=1;sc.frame_end=181
specs=[('fist','Сжать и раскрыть кулак'),('point','Указательный жест'),('pinch','Щипок'),('wave','Взмах рукой'),('grasp','Захват шара')]
actions={};poses_at_hold={}
for slug,label in specs:
 for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
 forearm_twist.clear();peak=0;previous={};pose_rows=[];location_rows=[]
 for frame in range(1,182):
  t=(frame-1)/30;sc.frame_set(frame)
  for b in bones:b.matrix_basis=Matrix.Identity(4)
  natural_body(t)
  lift=smooth(0,.9,t)*(1-smooth(5.15,6,t))
  for side in ['Left','Right']:
   sign=1 if side=='Left' else -1
   wrist=V((sign*.205,-.105,.94)).lerp(V((sign*.235,-.30,1.38)),lift)
   q=(qrestL if side=='Left' else qrestR).slerp(orient(side,(0,0,1),(0,-1,0)),lift)
   if slug=='grasp' and side=='Right':
    # Withdraw behind the stationary sphere before lowering the arm; the
    # direct downwards path used to drag the thumb pad through the object.
    wrist.y+=.10*(smooth(0,.3,t)*(1-smooth(.9,1.1,t))+smooth(4.9,5.15,t)*(1-smooth(5.6,6,t)))
   if slug=='wave' and side=='Right':
    phase=math.sin((t-1.2)*math.pi*1.5)*smooth(.9,1.5,t)*(1-smooth(4.4,5.1,t))
    wrist.x+=.035*phase;q=Quaternion((0,1,0),.18*phase)@q
   tracked_arm(side,wrist,q)
   values={}
   for name in finger_indices:
    delay={'Pinky':0,'Ring':.025,'Middle':.05,'Index':.075,'Thumb':.12}[name]
    u=smooth(1.1+delay,2.2+delay,t)*(1-smooth(3.7+delay,4.8+delay,t))
    target=closed_pose[side][name]
    if slug=='point' and name=='Index':target=open_pose[side][name]
    if slug=='pinch':target=pinch_pose[side][name]
    if slug=='wave':target=mix_hand(side,.07)[name]
    if slug=='grasp':target=grasp_pose[name] if side=='Right' else mix_hand(side,.18)[name]
    values[name]=[a+(b-a)*u for a,b in zip(open_pose[side][name],target)]
   apply_hand(side,values)
  for b in bones:
   q=b.rotation_quaternion.copy();old=previous.get(b.name)
   if old and old.dot(q)<0:q.negate();b.rotation_quaternion=q
   if old:peak=max(peak,old.rotation_difference(q).angle)
   previous[b.name]=q
  pose_rows.append({b.name:b.rotation_quaternion.copy() for b in bones});location_rows.append({b.name:b.location.copy() for b in bones})
 times=coordinated_times(pose_rows)
 for k,row in enumerate(pose_rows):
  for b in bones:
   b.rotation_quaternion=row[b.name];b.location=location_rows[k][b.name]
   b.keyframe_insert('rotation_quaternion',frame=1+times[k]*30,group=b.name);b.keyframe_insert('location',frame=1+times[k]*30,group=b.name)
 sc.frame_end=math.ceil(times[-1]*30)+1
 action=rig.animation_data.action;action.name='TEST • '+label;action.use_fake_user=True;actions[slug]=action
 for fc in action.fcurves:
  for key in fc.keyframe_points:key.interpolation='LINEAR'
 sc.frame_set(round(times[89]*30)+1);poses_at_hold[slug]={b.name:b.matrix.copy() for b in bones}
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(PUBLIC/(slug+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
 raw=(PUBLIC/(slug+'.glb')).read_bytes();gltf=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')]);actual_duration=max(gltf['accessors'][sampler['input']]['max'][0] for animation in gltf['animations'] for sampler in animation['samplers']);meta={'label':label,'url':'/avatars/hand-workshop/'+slug+'.glb','duration':actual_duration,'holdTime':times[89],'revision':hashlib.sha256(raw).hexdigest()[:12],'scope':'mechanical hand test, not RSL','sourcePeakJointStepDegrees':math.degrees(peak),'speedLimitDegreesPerSecond':240}
 (PUBLIC/(slug+'.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2))
 report[slug]=meta
 print('BAKED',slug,flush=True)
# Bake the static QA sphere into a self-contained grasp scene.
rig.animation_data.action=actions['grasp'];sc.frame_end=math.ceil(report['grasp']['duration']*30)+1;sc.frame_set(round(report['grasp']['holdTime']*30)+1)
ball.location=poses_at_hold['grasp']['mixamorig:RightHand']@B('RightHand').bone.matrix_local.inverted()@center
ball.hide_viewport=False;ball.hide_render=False
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);ball.select_set(True)
for ob in mesh_objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'grasp-scene.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
# Export repaired character without controllers. All old animation-only clips
# retain their bone names/rest transforms and can use the corrected weights.
rig.animation_data_clear()
for b in bones:b.matrix_basis=Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for ob in mesh_objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'mira-rig.glb'),export_format='GLB',use_selection=True,export_animations=False)

# Native Blender controls: FK chain + two-bone IK chain + hand target/pole.
# Constraints live only in this workshop; exported clips above contain no controls.
rig['controls_enabled']=1.0;rig.id_properties_ui('controls_enabled').update(min=0,max=1,description='1 = editable controls; 0 = baked test actions')
ctrl_collection=rig.data.collections.new('Hand controls');mechanism_collection=rig.data.collections.new('IK mechanisms');mechanism_collection.is_visible=False
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for side in ['Left','Right']:
 for prefix in ['FK_','IK_']:
  for part in ['Arm','ForeArm','Hand']:
   src=rig.data.edit_bones['mixamorig:'+side+part];b=rig.data.edit_bones.new('CTRL_'+prefix+side+part);b.matrix=src.matrix.copy();b.length=src.length;b.use_deform=False
   b.parent=rig.data.edit_bones['mixamorig:'+side+'Shoulder'] if part=='Arm' else rig.data.edit_bones['CTRL_'+prefix+side+('Arm' if part=='ForeArm' else 'ForeArm')]
   if part!='Arm':b.use_connect=True
   (ctrl_collection if prefix=='FK_' else mechanism_collection).assign(b)
 src=rig.data.edit_bones['mixamorig:'+side+'Hand'];b=rig.data.edit_bones.new('CTRL_'+side+'Hand');b.matrix=src.matrix.copy();b.length=.12;b.use_deform=False;ctrl_collection.assign(b)
 b=rig.data.edit_bones.new('CTRL_'+side+'Elbow');b.head=rig.data.edit_bones['mixamorig:'+side+'ForeArm'].head+V((0,-.35,-.1));b.tail=b.head+V((0,0,.08));b.use_deform=False;ctrl_collection.assign(b)
 for name in finger_indices:
  for j in range(1,4):
   src=rig.data.edit_bones['mixamorig:'+side+'Hand'+name+str(j)];b=rig.data.edit_bones.new('CTRL_'+side+name+str(j));b.matrix=src.matrix.copy();b.length=src.length;b.use_deform=False
   b.parent=rig.data.edit_bones['mixamorig:'+side+'Hand'] if j==1 else rig.data.edit_bones['CTRL_'+side+name+str(j-1)];ctrl_collection.assign(b)
bpy.ops.object.mode_set(mode='OBJECT');bones=rig.pose.bones

def prop(b,name,value,lo,hi,description):
 b[name]=value;b.id_properties_ui(name).update(min=lo,max=hi,description=description)
def driver(owner,path,expression,variables,index=None):
 assert len(expression)<256,(path,len(expression))
 fc=owner.driver_add(path) if index is None else owner.driver_add(path,index);d=fc.driver;d.type='SCRIPTED';d.expression=expression
 for name,data_path in variables.items():v=d.variables.new();v.name=name;v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path=data_path
 return d
def path(b,p):return 'pose.bones['+json.dumps(b.name)+']['+json.dumps(p)+']'
def controlled(c):driver(c,'influence','enabled',{'enabled':'["controls_enabled"]'})
def qmul(a,b):
 w,x,y,z=a;v,i,j,k=b
 return [f'({w}*{v}-{x}*{i}-{y}*{j}-{z}*{k})',f'({w}*{i}+{x}*{v}+{y}*{k}-{z}*{j})',f'({w}*{j}-{x}*{k}+{y}*{v}+{z}*{i})',f'({w}*{k}+{x}*{j}-{y}*{i}+{z}*{v})']
def qaxis(axis,angle):return [f'cos(({angle})/2)']+[f'({v:.8f}*sin(({angle})/2))' for v in axis]
for side in ['Left','Right']:
 hand=bones['CTRL_'+side+'Hand'];hand.rotation_mode='QUATERNION';hand.color.palette='THEME04'
 for name,value,lo,hi,description in [('IK_FK',1,0,1,'0 FK / 1 IK; move Hand and Elbow targets'),('curl',0,0,1,'Close all fingers'),('relax',.15,0,1,'Relax hand'),('spread',0,-1,1,'Spread fingers'),('point',0,0,1,'Extend index and curl other fingers'),('pinch',0,0,1,'Thumb/index pad contact')]:prop(hand,name,value,lo,hi,description)
 fore=bones['CTRL_IK_'+side+'ForeArm'];ik=fore.constraints.new('IK');ik.target=rig;ik.subtarget=hand.name;ik.pole_target=rig;ik.pole_subtarget='CTRL_'+side+'Elbow';ik.chain_count=2;ik.use_stretch=False
 for part in ['Arm','ForeArm']:bones['CTRL_IK_'+side+part].ik_stretch=0
 c=bones['CTRL_IK_'+side+'Hand'].constraints.new('COPY_ROTATION');c.target=rig;c.subtarget=hand.name
 for part in ['Arm','ForeArm','Hand']:
  b=B(side+part);c=b.constraints.new('COPY_TRANSFORMS');c.target=rig;c.subtarget='CTRL_FK_'+side+part;controlled(c)
  c=b.constraints.new('COPY_TRANSFORMS');c.target=rig;c.subtarget='CTRL_IK_'+side+part;driver(c,'influence','enabled*blend',{'enabled':'["controls_enabled"]','blend':path(hand,'IK_FK')})
 for k in range(3):c=B(side+'ForearmRoll'+str(k)).constraints.new('COPY_ROTATION');c.target=rig;c.subtarget='mixamorig:'+side+'ForeArm';controlled(c)
 for name in finger_indices:
  root=bones['CTRL_'+side+name+'1'];root.color.palette='THEME03'
  for p,lo,hi in [('curl',-1,1),('spread',-15,15),('MCP',-15,30),('PIP',-20,20),('DIP',-15,15),('opposition',-25,25)]:prop(root,p,0,lo,hi,'Individual '+name+' '+p+' adjustment')
  for j in range(1,4):
   b=bones['CTRL_'+side+name+str(j)];b.rotation_mode='QUATERNION'
   variables={'curl':path(hand,'curl'),'relax':path(hand,'relax'),'point':path(hand,'point'),'pinch':path(hand,'pinch'),'individual':path(root,'curl'),'joint':path(root,['MCP','PIP','DIP'][j-1]),'spread':path(root,'spread'),'fan':path(hand,'spread'),'opp':path(root,'opposition')}
   amount=f'min(1,max(0,(curl+individual+relax*.25)*(1-point)+point*{0 if name=="Index" else 1}))'
   idx=[0,2,3][j-1];a=open_pose[side][name][idx];z=closed_pose[side][name][idx];pin=pinch_pose[side][name][idx]
   angle=f'(({a:.8f}+({z-a:.8f})*{amount})*(1-pinch)+{pin:.8f}*pinch+joint*pi/180)'
   lo,hi=finger_fit_rigs[(side,name)]['bounds'][idx];angle=f'min({hi:.8f},max({lo:.8f},{angle}))'
   b['_angle']=0.;driver(b,'["_angle"]',angle,variables)
   short={'a':path(b,'_angle')}
   q=qaxis(finger_fit_rigs[(side,name)]['axes'][j-1],'a')
   if j==1:
    spread_angle=f'(({open_pose[side][name][1]:.8f}+{closed_pose[side][name][1]-open_pose[side][name][1]:.8f}*{amount})*(1-pinch)+{pinch_pose[side][name][1]:.8f}*pinch+spread*pi/180+fan*{({"Index":-.12,"Middle":-.025,"Ring":.06,"Pinky":.14,"Thumb":.20}[name]):.8f})'
    b['_spread']=0.;driver(b,'["_spread"]',spread_angle,variables);short['s']=path(b,'_spread')
    q=qmul(qaxis(finger_fit_rigs[(side,name)]['spread'],'s'),q)
   for k,expression in enumerate(q):
    b['_q'+str(k)]=0.;driver(b,'["_q'+str(k)+'"]',expression,short)
   final_vars={f'q{k}':path(b,'_q'+str(k)) for k in range(4)}
   final=[f'q{k}' for k in range(4)]
   if j==1 and name=='Thumb':
    opposition=f'({closed_pose[side][name][4]:.8f}*{amount}*(1-pinch)+{pinch_pose[side][name][4]:.8f}*pinch+opp*pi/180)'
    b['_opposition']=0.;driver(b,'["_opposition"]',opposition,variables);final_vars['o']=path(b,'_opposition');final=qmul(final,qaxis(V((0,1,0)),'o'))
   for k,expression in enumerate(final):driver(b,'rotation_quaternion',expression,final_vars,k)
   c=B(side+'Hand'+name+str(j)).constraints.new('COPY_ROTATION');c.target=rig;c.subtarget=b.name;c.owner_space='LOCAL';c.target_space='LOCAL';controlled(c)
# Start controls in a relaxed, raised-hand pose rather than a T pose.
for side in ['Left','Right']:
 for part in ['Arm','ForeArm','Hand']:bones['CTRL_FK_'+side+part].matrix=poses_at_hold['wave']['mixamorig:'+side+part]
 bones['CTRL_'+side+'Hand'].matrix=poses_at_hold['wave']['mixamorig:'+side+'Hand']
 target=poses_at_hold['wave']['mixamorig:'+side+'ForeArm'].translation
 pole=bones['CTRL_'+side+'Elbow'];pole.location=V((0,0,0));m=pole.matrix.copy();m.translation=target+V((0,-.35,-.1));pole.matrix=m
 # Solve pole angle from the authored elbow; don't guess opposite-side signs.
 ik=bones['CTRL_IK_'+side+'ForeArm'].constraints[0];best=(1e9,0)
 for i in range(72):
  ik.pole_angle=math.tau*i/72;bpy.context.view_layer.update();err=(bones['CTRL_IK_'+side+'ForeArm'].head-target).length
  if err<best[0]:best=(err,ik.pole_angle)
 ik.pole_angle=best[1]
for o in mesh_objects:
 assert original_geometry[o.name]==[tuple(v.co) for v in o.data.vertices],'Character geometry changed'
# Baked actions key controls off when selected in the Action Editor.
for slug,action in actions.items():
 rig.animation_data_create();rig.animation_data.action=action;rig['controls_enabled']=0;rig.keyframe_insert(data_path='["controls_enabled"]',frame=1)
rig.animation_data.action=None;rig['controls_enabled']=1
ball.hide_viewport=True;ball.hide_render=True
sc.frame_set(1);bpy.context.view_layer.update()
report['controllerBones']=sum(b.name.startswith('CTRL_') for b in rig.data.bones);report['deformBones']=len(deform_names)
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(PUBLIC/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
# Visible compact widgets; deform/mechanism bones stay out of the animator's way.
widgets=bpy.data.collections.new('Widgets (hidden)');sc.collection.children.link(widgets)
def widget(name,points,edges):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(points,edges,[]);ob=bpy.data.objects.new(name,mesh);widgets.objects.link(ob);ob.hide_render=True;ob.hide_set(True);return ob
ring=widget('WGT • ring',[(.5*math.cos(i*math.tau/24),0,.5*math.sin(i*math.tau/24)) for i in range(24)],[(i,(i+1)%24) for i in range(24)])
diamond=widget('WGT • pole',[(0,0,.5),(.5,0,0),(0,0,-.5),(-.5,0,0)],[(0,1),(1,2),(2,3),(3,0)])
for side in ['Left','Right']:
 bones['CTRL_'+side+'Hand'].custom_shape=ring;bones['CTRL_'+side+'Elbow'].custom_shape=diamond
 for part in ['Arm','ForeArm','Hand']:bones['CTRL_FK_'+side+part].custom_shape=ring;bones['CTRL_FK_'+side+part].custom_shape_scale_xyz=(.35,.35,.35)
 for name in finger_indices:bones['CTRL_'+side+name+'1'].custom_shape=ring;bones['CTRL_'+side+name+'1'].custom_shape_scale_xyz=(.6,.6,.6)
deform_collection=rig.data.collections.new('Deform skeleton (export)');deform_collection.is_visible=False
for name in deform_names:
 b=rig.data.bones[name]
 for collection in list(b.collections):collection.unassign(b)
 deform_collection.assign(b)
rig.show_in_front=True;rig.data.display_type='STICK'
readme=bpy.data.texts.new('START HERE • Hand workshop')
readme.write('Mira hand workshop\n\nPose Mode: CTRL_LeftHand / CTRL_RightHand: IK_FK, curl, relax, spread, point, pinch.\nMove hand target and elbow pole in IK mode. Rotate CTRL_FK_* in FK mode.\nCTRL_Left/Right + finger + 1: individual curl/spread/MCP/PIP/DIP/opposition.\n\nAction Editor: TEST actions are baked game-skeleton clips; they set controls_enabled=0.\nClear action and set rig controls_enabled=1 to edit with controls.\n\nAll five exported GLBs are in frontend/public/avatars/hand-workshop.\nThey are mechanical tests, not sign-language instruction.\n')
sc.camera.location=(0,-1.85,1.46);sc.camera.rotation_euler=(V((0,-.1,1.35))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=55
sc.render.resolution_x=900;sc.render.resolution_y=700;sc.render.resolution_percentage=100;sc.render.engine='CYCLES';sc.cycles.samples=12;sc.cycles.use_denoising=True
sc.render.film_transparent=False;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.045,.065,1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Mira-Hand-Workshop.blend'),compress=True)
print('HAND_WORKSHOP_READY',json.dumps(report),flush=True)
