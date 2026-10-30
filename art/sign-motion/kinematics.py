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

def hinge_axis(side,name,j):
 bone=B(side+'Hand'+name+str(j))
 direction=(bone.bone.tail_local-bone.bone.head_local).normalized()
 axis=direction.cross(rest[side]['basis'].col[2]).normalized()
 return bone.bone.matrix_local.to_quaternion().inverted()@axis

def anatomical_fingers(side,pts,fade):
 """MCP flexion/spread, PIP/DIP hinges; no per-phalanx twist or translation.

 Measurements are in the source palm frame, so wrist IK correction cannot
 counter-rotate the fingers into an unrelated world-space direction.
 """
 forward=(pts[9]-pts[0]).normalized()
 across=(pts[5]-pts[17]).normalized()*(-1 if side=='Left' else 1)
 normal=across.cross(forward).normalized()
 for name,ids in finger_indices.items():
  segments=[(pts[ids[k+1]]-pts[ids[k]]).normalized() for k in range(3)]
  base=(pts[ids[0]]-pts[0]).normalized()
  flat=(base-normal*base.dot(normal)).normalized()
  if name=='Thumb':
   # Thumb CMC is a saddle joint. Transfer its two-axis direction without roll.
   bone=B(side+'HandThumb1')
   source_basis=basis(forward,normal)
   desired=rest[side]['basis']@(source_basis.transposed()@segments[0])
   initial=(bone.bone.tail_local-bone.bone.head_local).normalized()
   swing=initial.rotation_difference(desired)
   angle=swing.angle
   if angle>math.radians(85):swing=Quaternion().slerp(swing,math.radians(85)/angle)
   local=bone.bone.matrix_local.to_quaternion()
   thumbq=local.inverted()@swing@local
   bone.rotation_quaternion=Quaternion(hinge_axis(side,name,1),relaxed[name][0]).slerp(thumbq,fade)
  else:
   bend=math.atan2(segments[0].dot(normal),segments[0].dot(flat))
   if bend < -math.pi/2:bend=math.pi
   bend=clamp(bend,math.radians(-12),math.radians(100))
   flat_segment=segments[0]-normal*segments[0].dot(normal)
   spread=clamp(signed_angle(flat,flat_segment,normal),math.radians(-25),math.radians(25))
   spread*=clamp(segments[0].dot(flat)/.35,0,1)
   bone=B(side+'Hand'+name+'1')
   local_normal=bone.bone.matrix_local.to_quaternion().inverted()@rest[side]['basis'].col[2]
   target=Quaternion(local_normal,spread)@Quaternion(hinge_axis(side,name,1),bend)
   bone.rotation_quaternion=Quaternion(hinge_axis(side,name,1),relaxed[name][0]).slerp(target,fade)
  for j in (2,3):
   # Interphalangeal joints bend in one plane; tracking cannot twist them.
   axis=segments[j-2].cross(normal)
   # A noisy palm normal must not flip a bent finger into hyperextension.
   angle=segments[j-2].angle(segments[j-1])
   limit=math.radians((80 if j==2 else 85) if name=='Thumb' else (115 if j==2 else 85))
   angle=clamp(angle,math.radians(-5),limit)
   bone=B(side+'Hand'+name+str(j))
   bone.rotation_quaternion=Quaternion(hinge_axis(side,name,j),relaxed[name][j-1]*(1-fade)+angle*fade)
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
  if hint.length>.035:
   pole=default.lerp(hint.normalized(),.85*influence).normalized()
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
