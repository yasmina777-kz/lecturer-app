"""Regression checks for applying workshop mechanics to sign playback."""
from pathlib import Path
import math
ROOT=Path(__file__).resolve().parents[2];source=ROOT/'art/sign-motion/retarget.py';__file__=str(source)
exec(compile(source.read_text().split('manifest=[]')[0],str(source),'exec'),globals())
checks=0
for side in ['Left','Right']:
 for name in finger_indices:
  key=(side,name);opened=open_pose[side][name];closed=closed_pose[side][name]
  # MCP spread/curl change together; filtering must not create an extra axial
  # degree of freedom. Bounds and closed-finger spread survive the whole curve.
  rows=[]
  for i in range(61):
   u=smooth(0,1,i/60)
   values=[a+(b-a)*u for a,b in zip(opened,closed)]
   rows.append({key:project_finger_values(side,name,values)})
  clean=filter_hand_values(rows)
  assert clean[0][key]==rows[0][key] and clean[-1][key]==rows[-1][key]
  for row in clean:
   values=row[key];info=finger_fit_rigs[key]
   assert all(lo-1e-8<=v<=hi+1e-8 for v,(lo,hi) in zip(values,info['bounds']))
   dirs,qs=finger_chain(side,name,values)
   assert all(abs(q.magnitude-1)<1e-5 for q in qs)
   for j in [1,2]:assert V(qs[j][1:]).cross(info['axes'][j]).length<1e-6
   checks+=1
  # A tracking impulse must not become a visible twitch in a held sign.
  steady=[{key:opened.copy()} for _ in range(9)];steady[4][key][0]+=math.radians(50)
  out=filter_hand_values(steady)
  assert abs(out[4][key][0]-opened[0])<math.radians(1)
  apply_finger_values(side,name,closed,0)
  assert current_hand_values[key]==neutral_finger_values(name)
print('PASS',checks,'anatomical hand samples; endpoints, joint limits, hinge planes and capture impulse rejection')
