"""Shared anatomical hand primitives for the workshop AND captured sign motions.
Executed in the retarget rig namespace after hand_pose_overrides.py.
These are mechanical priors, never substitutes for a sign reference.
"""
init_finger_rigs()
open_pose={s:{n:(flat_shape(s)[n].copy() if n!='Thumb' else [math.radians(v) for v in [-20,15,0,0,0]]) for n in finger_indices} for s in ['Left','Right']}
closed_pose={s:{n:project_finger_values(s,n,[math.radians(v) for v in ([62,0,78,38] if n!='Thumb' else [35,30,35,20,25])]) for n in finger_indices} for s in ['Left','Right']}
def apply_hand(side,values):
 for name,v in values.items():
  _,qs=finger_chain(side,name,project_finger_values(side,name,v))
  for j,q in enumerate(qs,1):B(side+'Hand'+name+str(j)).rotation_quaternion=q

def mix_hand(side,amount):
 return {n:[a*(1-amount)+b*amount for a,b in zip(open_pose[side][n],closed_pose[side][n])] for n in finger_indices}

def finger_points(side,name,angles):
 dirs,_=finger_chain(side,name,project_finger_values(side,name,angles));points=[B(side+'Hand'+name+'1').bone.head_local.copy()]
 for j,d in enumerate(dirs,1):points.append(points[-1]+d*B(side+'Hand'+name+str(j)).bone.length)
 return points

def minimize(seed,cost,side,names):
 values={n:list(seed[n]) for n in names};best=cost(values)
 for degrees in [12,6,3,1.5,.5]:
  for sweep in range(14):
   changed=False
   for n in names:
    for j in range(len(values[n])):
     for direction in [-1,1]:
      trial={k:v.copy() for k,v in values.items()};trial[n][j]+=math.radians(degrees)*direction;trial[n]=project_finger_values(side,n,trial[n]);score=cost(trial)
      if score<best-1e-12:best=score;values=trial;changed=True
   if not changed:break
 return values

# Fold the thumb over the curled fingers, using their actual rig positions.
# A fixed thumb flexion angle previously left it sticking out of the fist.
for side in ['Left','Right']:
 target=(finger_points(side,'Index',closed_pose[side]['Index'])[2]+finger_points(side,'Middle',closed_pose[side]['Middle'])[2])*.5+rest[side]['basis'].col[2]*.009
 def thumb_cost(v):return (finger_points(side,'Thumb',v['Thumb'])[-1]-target).length_squared
 fitted=minimize(closed_pose[side],thumb_cost,side,['Thumb']);closed_pose[side]['Thumb']=fitted['Thumb']

# Solve pad-to-pad pinch in rest-hand coordinates; don't guess thumb opposition.
pinch_pose={};pinch_distances={}
for side in ['Left','Right']:
 seed=mix_hand(side,.55)
 def pinch_cost(v):
  p=finger_points(side,'Index',v['Index'])[-1];q=finger_points(side,'Thumb',v['Thumb'])[-1]
  distance=(p-q).length
  return (distance-.012)**2 + .00002*sum((x-y)**2 for n in ['Thumb','Index'] for x,y in zip(v[n],seed[n]))
 fitted=minimize(seed,pinch_cost,side,['Thumb','Index']);pinch_pose[side]=mix_hand(side,.18);pinch_pose[side].update(fitted)
 pinch_distances[side]=(finger_points(side,'Index',fitted['Index'])[-1]-finger_points(side,'Thumb',fitted['Thumb'])[-1]).length
