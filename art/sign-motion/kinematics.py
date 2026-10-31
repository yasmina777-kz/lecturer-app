"""Anatomical retarget helpers. Executed inside the Blender rig namespace."""
def clamp(value, low, high):
 return max(low, min(high, value))

def filtered_samples(samples, radius=2):
 """Symmetric binomial filter: no causal lag, preserve endpoints exactly."""
 weights=[1,4,6,4,1] if radius==2 else [1,2,1]
 result=[]
 for i, sample in enumerate(samples):
  if i in (0,len(samples)-1):result.append(sample);continue
  nearby=[(samples[j],weights[j-i+radius]) for j in range(max(0,i-radius),min(len(samples),i+radius+1))]
  total=sum(w for _,w in nearby)
  result.append([[sum(s[k][c]*w for s,w in nearby)/total for c in range(len(point))] for k,point in enumerate(sample)])
 return result

def signed_angle(a,b,axis):
 a=a.normalized();b=b.normalized();axis=axis.normalized()
 return math.atan2(axis.dot(a.cross(b)),clamp(a.dot(b),-1,1))

hand_calibration=json.loads((ROOT/"art/sign-motion/mixamo-hand-calibration.json").read_text())

def hinge_axis(side,name,j):
 bone=B(side+'Hand'+name+str(j))
 calibrated=hand_calibration['axes'].get(bone.name)
 if calibrated:return V(calibrated)
 direction=(bone.bone.tail_local-bone.bone.head_local).normalized()
 axis=direction.cross(rest[side]['basis'].col[2]).normalized()
 return bone.bone.matrix_local.to_quaternion().inverted()@axis

# Fit a complete articulated chain instead of measuring each joint in unrelated planes.
finger_fit_previous={}
finger_fit_rigs={}
finger_fit_errors=[]
def finger_chain(side,name,values):
 riginfo=finger_fit_rigs[(side,name)];parent=riginfo['parent'];directions=[];rotations=[]
 for j in range(3):
  q=Quaternion(riginfo['axes'][j],values[(0,2,3)[j]])
  if j==0:
   q=Quaternion(riginfo['spread'],values[1])@q
   # The thumb CMC is a saddle joint: opposition needs axial rotation in
   # addition to flexion/abduction. Other fingers remain hinge-only distally.
   if name=='Thumb' and len(values)>4:q=q@Quaternion((0,1,0),values[4])
  parent=parent@riginfo['local'][j]@q
  directions.append(parent@V((0,1,0)));rotations.append(q)
 return directions,rotations

def init_finger_rigs():
 for side in ['Left','Right']:
  for name in finger_indices:
   parent=B(side+'Hand').bone.matrix_local.to_quaternion();local=[];axes=[]
   for j in range(1,4):
    q=B(side+'Hand'+name+str(j)).bone.matrix_local.to_quaternion()
    local.append(parent.inverted()@q);parent=q;axes.append(hinge_axis(side,name,j))
   root=B(side+'Hand'+name+'1').bone
   spread=root.matrix_local.to_quaternion().inverted()@rest[side]['basis'].col[2]
   offsets=[hand_calibration['restBends'].get(B(side+'Hand'+name+str(j)).name,0) for j in (2,3)]
   if name=='Thumb':bounds=[(-40,70),(-65,65),(-5-math.degrees(offsets[0]),70-math.degrees(offsets[0])),(-5-math.degrees(offsets[1]),80-math.degrees(offsets[1])),(-35,35)]
   else:bounds=[(-15,95),(-18,18),(-5-math.degrees(offsets[0]),105-math.degrees(offsets[0])),(-5-math.degrees(offsets[1]),75-math.degrees(offsets[1]))]
   finger_fit_rigs[(side,name)]={'parent':B(side+'Hand').bone.matrix_local.to_quaternion(),'local':local,'axes':axes,'spread':spread,'bounds':[(math.radians(a),math.radians(b)) for a,b in bounds],'offsets':offsets}

def project_finger_values(side,name,values):
 info=finger_fit_rigs[(side,name)]
 values=list(values)+[0]*max(0,len(info['bounds'])-len(values))
 values=[clamp(v,*info['bounds'][j]) for j,v in enumerate(values)]
 if name!='Thumb':
  # MCP abduction closes with flexion; a curled finger cannot fan sideways
  # through its neighbour as freely as an extended finger.
  spread=math.radians(18)*(1-.75*clamp(values[0]/math.radians(90),0,1))
  values[1]=clamp(values[1],-spread,spread)
 total=values[0]+values[2]+values[3]+sum(info['offsets'])
 excess=max(0,total-math.radians(240 if name!='Thumb' else 190))
 for j in [3,2,0]:
  reduction=min(excess,max(0,values[j]-info['bounds'][j][0]))
  values[j]-=reduction;excess-=reduction
 return values

def fit_finger_directions(side,name,target,previous=None):
 info=finger_fit_rigs[(side,name)]
 def cost(values):
  predicted,_=finger_chain(side,name,values)
  error=sum((a-b).length_squared*w for a,b,w in zip(predicted,target,[1.0,1.0,.8]))
  # Weak temporal preference selects the nearby solution in ambiguous frames;
  # it never substitutes an idle pose for the observed sign.
  if previous is not None:error+=.012*sum((a-b)**2 for a,b in zip(values,previous))
  return error
 candidates=[previous or [.2,0,.2,.1],[0,0,0,0],[1.2,0,1.3,.7]]
 values=min((project_finger_values(side,name,c) for c in candidates),key=cost)
 best=cost(values)
 for degrees in [16,8,4,2,.75]:
  step=math.radians(degrees)
  for sweep in range(3):
   improved=False
   for j in range(len(values)):
    for sign in [-1,1]:
     candidate=values.copy();candidate[j]+=sign*step
     candidate=project_finger_values(side,name,candidate);score=cost(candidate)
     if score<best-1e-9:values=candidate;best=score;improved=True
   if not improved:break
 return values

def anatomical_fingers(side,pts,fade):
 if not finger_fit_rigs:init_finger_rigs()
 forward=(pts[9]-pts[0]).normalized();across=(pts[5]-pts[17]).normalized()*(-1 if side=='Left' else 1)
 normal=across.cross(forward).normalized();source=basis(forward,normal)
 transfer=rest[side]['basis']@source.transposed()
 for name,ids in finger_indices.items():
  target=[transfer@(pts[ids[k+1]]-pts[ids[k]]).normalized() for k in range(3)]
  key=(side,name)
  values=fit_finger_directions(side,name,target,finger_fit_previous.get(key))
  finger_fit_previous[key]=values.copy()
  predicted,_=finger_chain(side,name,values)
  finger_fit_errors.append(sum(a.angle(b) for a,b in zip(predicted,target))/3)
  apply_finger_values(side,name,values,fade)
 bpy.context.view_layer.update()

forearm_twist={}
def tracked_arm(side,wrist,q,elbow_hint=None,influence=1):
 """Two-bone IK with a captured elbow pole, connected wrist and distributed roll."""
 upper=B(side+'Arm');fore=B(side+'ForeArm');hand=B(side+'Hand')
 shoulder=upper.head.copy();l1=upper.bone.length;l2=fore.bone.length
 delta=wrist-shoulder;distance=clamp(delta.length,abs(l1-l2)+.015,l1+l2-.012)
 axis=delta.normalized();wrist=shoulder+axis*distance
 sign=-1 if side=='Right' else 1
 default=V((sign*.7,.12,-1));default=(default-axis*default.dot(axis)).normalized()
 pole=default
 if elbow_hint is not None:
  hint=elbow_hint-shoulder;hint-=axis*hint.dot(axis)
  if hint.length>.001:
   confidence=smooth(.015,.08,hint.length)
   pole=default.lerp(hint.normalized(),.85*influence*confidence).normalized()
 # Near an extended arm, a tiny landmark error must not flip the elbow plane.
 previous_pole=forearm_twist.get(side+'_pole')
 if previous_pole is not None:
  previous_pole=previous_pole-axis*previous_pole.dot(axis)
  if previous_pole.length>.001:
   previous_pole.normalize()
   rotation=previous_pole.rotation_difference(pole)
   amount=min(.35,math.radians(6)/max(.0001,rotation.angle))
   pole=Quaternion().slerp(rotation,amount)@previous_pole
 forearm_twist[side+'_pole']=pole.copy()
 along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 elbow=shoulder+axis*along+pole*math.sqrt(max(0,l1*l1-along*along))
 upperq=(upper.bone.tail_local-upper.bone.head_local).rotation_difference(elbow-shoulder)@upper.bone.matrix_local.to_quaternion()
 put(upper,shoulder,upperq)
 basic=(fore.bone.tail_local-fore.bone.head_local).rotation_difference(wrist-elbow)@fore.bone.matrix_local.to_quaternion()
 foreaxis=(wrist-elbow).normalized();handaxis=q@rest[side]['basis'].col[1]
 deviation=handaxis.angle(foreaxis);limit=math.radians(90)
 if deviation>limit:q=Quaternion().slerp(handaxis.rotation_difference(foreaxis),(deviation-limit)/deviation)@q
 hint=q@fore.bone.matrix_local.to_quaternion()
 foreq=(hint@V((0,1,0))).rotation_difference(wrist-elbow)@hint
 # Unwrap roll across +/-180 degrees before distributing it across skin bones.
 relative=foreq@basic.inverted()
 roll=2*math.atan2(V((relative.x,relative.y,relative.z)).dot(foreaxis),relative.w)
 previous=forearm_twist.get(side,roll)
 roll=previous+(roll-previous+math.pi)%(2*math.pi)-math.pi
 origin=forearm_twist.setdefault(side+'_origin',roll)
 roll=clamp(roll,origin-math.radians(120),origin+math.radians(120))
 roll=origin+(roll-origin)*influence
 forearm_twist[side]=roll
 put(fore,elbow,Quaternion(foreaxis,roll)@basic)
 for k,mix in enumerate([0,.48,1]):put(B(side+'ForearmRoll'+str(k)),elbow,Quaternion(foreaxis,roll*mix)@basic)
 put(hand,wrist,q@hand.bone.matrix_local.to_quaternion())

def smooth_rotations(samples):
 """Reject isolated flips, then smooth in both directions (no one-way lag).

 Bound the angular rate of noisy observations before the final symmetric pass.
 This is curve cleanup, not reconstruction of missing finger observations.
 """
 out=[{} for _ in samples]
 for name in samples[0]:
  raw=[row[name].copy() for row in samples]
  for i in range(1,len(raw)):
   if raw[i-1].dot(raw[i])<0:raw[i].negate()
  clean=[q.copy() for q in raw]
  for i in range(1,len(raw)-1):
   mid=raw[i-1].slerp(raw[i+1],.5)
   deviation=raw[i].rotation_difference(mid).angle
   span=raw[i-1].rotation_difference(raw[i+1]).angle
   if deviation>math.radians(25) and span<deviation*.7:clean[i]=mid
  # First filter around each measured pose, then project the curve onto a
  # bounded angular-rate trajectory in alternating directions. Averaging two
  # very different forward/backward paths could itself introduce a 180° flip.
  filtered=[]
  for i in range(len(raw)):
   weights=[1,4,6,4,1];q=clean[i].copy();total=6
   for delta in [-2,-1,1,2]:
    k=i+delta
    if 0<=k<len(raw):
     w=weights[delta+2];q=q.slerp(clean[k],w/(total+w));total+=w
   window=min(21,(len(raw)-1)//2)
   if i<window:q=raw[0].slerp(q,clamp(smooth(0,window,i),0,1))
   elif i>len(raw)-1-window:q=raw[-1].slerp(q,clamp(smooth(0,window,len(raw)-1-i),0,1))
   filtered.append(q.normalized())
  limit=math.radians(8 if 'Hand' in name else 7)
  for iteration in range(4):
   for indices in [range(1,len(raw)-1),range(len(raw)-2,0,-1)]:
    forward=indices.step>0
    for i in indices:
     neighbour=filtered[i-1 if forward else i+1]
     angle=neighbour.rotation_difference(filtered[i]).angle
     if angle>limit:filtered[i]=neighbour.slerp(filtered[i],limit/angle)
  # A final local average reduces acceleration at the speed-limit boundary.
  final=[q.copy() for q in filtered]
  for i in range(1,len(raw)-1):
   final[i]=filtered[i-1].slerp(filtered[i+1],.5).slerp(filtered[i],.5)
  for i,q in enumerate(final):out[i][name]=q.normalized()
 return out


body_calibration=json.loads((ROOT/'art/sign-motion/mixamo-body-calibration.json').read_text())
def natural_body(t):
 """Mixamo body micro-motion; hand targets are solved afterwards in rig space."""
 frames=body_calibration['frames'];position=(t*body_calibration['fps'])%(len(frames)-1)
 a=int(position);u=position-a
 for name in frames[a]:
  first=frames[a][name];second=frames[a+1][name];bone=B(name)
  q=Quaternion(first['rotation']).slerp(Quaternion(second['rotation']),u)
  seam=1-smooth(len(frames)-13,len(frames)-1,position)
  bone.rotation_quaternion=Quaternion().slerp(q,.65*seam)
  bone.location=V(first['location']).lerp(V(second['location']),u)*.65*seam
 bpy.context.view_layer.update()

# All sign finger curves share the workshop's articulated coordinates. Blending
# these coordinates keeps MCP flexion/spread and thumb opposition independent.
current_hand_values={}
def neutral_finger_values(name):
 values=[relaxed[name][0],0,relaxed[name][1],relaxed[name][2]]
 return values+[0] if name=='Thumb' else values

def apply_finger_values(side,name,values,fade=1):
 values=project_finger_values(side,name,values)
 values=[a+(b-a)*fade for a,b in zip(neutral_finger_values(name),values)]
 current_hand_values[(side,name)]=values
 _,rotations=finger_chain(side,name,values)
 for j,q in enumerate(rotations,1):B(side+'Hand'+name+str(j)).rotation_quaternion=q

def filter_hand_values(samples):
 result=[{} for _ in samples]
 for side,name in samples[0]:
  raw=[row[(side,name)] for row in samples]
  # Remove isolated one-frame capture flips in joint coordinates, then use a
  # symmetric kernel so fingertips do not lag behind the arm's trajectory.
  clean=[v.copy() for v in raw]
  for i in range(1,len(raw)-1):
   for j,value in enumerate(raw[i]):
    mid=(raw[i-1][j]+raw[i+1][j])*.5
    if abs(value-mid)>math.radians(25) and abs(raw[i+1][j]-raw[i-1][j])<abs(value-mid)*.7:clean[i][j]=mid
  for i in range(len(raw)):
   if i in (0,len(raw)-1):values=raw[i].copy()
   else:
    window=[(k,[1,4,6,4,1][k-i+2]) for k in range(max(0,i-2),min(len(raw),i+3))]
    values=[sum(clean[k][j]*w for k,w in window)/sum(w for _,w in window) for j in range(len(raw[i]))]
   result[i][(side,name)]=project_finger_values(side,name,values)
 return result
