"""Regression checks for trajectory interpolation and whole-pose time warping."""
from pathlib import Path
source=Path(__file__).with_name('retarget.py');__file__=str(source)
exec(compile(source.read_text().split('manifest=[]')[0],str(source),'exec'),globals())
track=[{'world':[[x,x*2,-x]]} for x in [0,.1,.11,.8,1]]
for a in range(len(track)-1):
 lo,hi=track[a]['world'][0][0],track[a+1]['world'][0][0]
 for i in range(101):
  point=interpolate_landmarks(track,a,a+1,i/100,'world')[0]
  assert lo-1e-7<=point.x<=hi+1e-7,'interpolation overshoot'
# Adjacent intervals have matching endpoint velocity when sampling intervals are equal.
for i in range(1,len(track)-1):
 e=.0001
 left=(interpolate_landmarks(track,i-1,i,1,'world')[0]-interpolate_landmarks(track,i-1,i,1-e,'world')[0])/e
 right=(interpolate_landmarks(track,i,i+1,e,'world')[0]-interpolate_landmarks(track,i,i+1,0,'world')[0])/e
 assert (left-right).length<.005,'velocity jumps at capture frame'
rows=[{'hand':Quaternion((1,0,0),math.radians(v)),'elbow':Quaternion((0,1,0),math.radians(v/2))} for v in [0,2,8,70,72,73]]
times=coordinated_times(rows)
assert all(b>a for a,b in zip(times,times[1:]))
for i in range(1,len(rows)):
 for name in rows[i]:
  speed=math.degrees(rows[i-1][name].rotation_difference(rows[i][name]).angle)/(times[i]-times[i-1])
  assert speed<=240.001
print('TRAJECTORIES: monotone positions, continuous velocities, shared angular-speed timing passed')
