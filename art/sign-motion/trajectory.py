"""Smooth hand paths before a final IK pass, keeping arm bones and contact coherent."""
def smooth_vectors(samples, radius=2):
 weights=[1,4,6,4,1]
 result=[]
 for i,point in enumerate(samples):
  if i in (0,len(samples)-1):result.append(point.copy());continue
  total=0;value=V((0,0,0))
  for delta,w in zip(range(-2,3),weights):
   j=max(0,min(len(samples)-1,i+delta));value+=samples[j]*w;total+=w
  result.append(value/total)
 return result

def interpolate_landmarks(track,a,b,u,key):
 """Monotone cubic Hermite: continuous velocity without overshooting a measured pose."""
 if a==b:return [V(p) for p in track[a][key]]
 before=max(0,a-1);after=min(len(track)-1,b+1)
 result=[]
 for p0,p1,p2,p3 in zip(track[before][key],track[a][key],track[b][key],track[after][key]):
  point=[]
  for y0,y1,y2,y3 in zip(p0,p1,p2,p3):
   d=y2-y1;left=y1-y0;right=y3-y2
   # Harmonic slopes vanish at a local extremum. No spline loops or ringing.
   m1=2*left*d/(left+d) if left*d>0 else 0
   m2=2*d*right/(d+right) if d*right>0 else 0
   point.append((2*u**3-3*u*u+1)*y1+(u**3-2*u*u+u)*m1+(-2*u**3+3*u*u)*y2+(u**3-u*u)*m2)
  result.append(V(point))
 return result

def coherent_arm_paths(samples):
 result=[{} for _ in samples]
 for side in ['Left','Right']:
  for field in ['wrist','elbow']:
   values=smooth_vectors([row[side][field] for row in samples])
   for i,value in enumerate(values):result[i].setdefault(side,{})[field]=value
  rotations=smooth_rotations([{side:row[side]['rotation']} for row in samples])
  for i,value in enumerate(rotations):result[i][side]['rotation']=value[side]
 return result

def coordinated_times(rows,fps=30,speed=240):
 """Retiming a whole pose keeps finger/arm contacts; independent clamps do not."""
 required=[1/fps]
 for a,b in zip(rows,rows[1:]):
  angle=max(a[name].rotation_difference(b[name]).angle for name in a)
  # Blender interpolates quaternion components (nlerp), whose midpoint
  # can rotate faster than slerp on large turns. Bound that peak too.
  required.append(max(1/fps,1.01*4*math.tan(min(math.pi,angle)/4)/math.radians(speed)))
 # Anticipate a sharp turn and ease out of it instead of changing speed in one frame.
 for _ in range(3):
  required=[max(value,sum(required[max(0,i-2):i+3])/len(required[max(0,i-2):i+3])) for i,value in enumerate(required)]
 times=[0.0]
 for dt in required[1:]:times.append(times[-1]+dt)
 return times
