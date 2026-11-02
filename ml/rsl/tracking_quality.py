"""Source-observation checks, not RSL correctness or recognizer accuracy."""
import math
def tracking_quality(data):
 frames=data['frames'];assigned=[];active={s:[] for s in ['Left','Right']}
 for frame in frames:
  pose=frame.get('pose');hands=frame.get('hands',[]);row={}
  if pose:
   pairs=sorted((math.hypot(h['image'][0][0]-pose[k][0],h['image'][0][1]-pose[k][1]),side,i) for i,h in enumerate(hands) for side,k in [('Left',15),('Right',16)])
   used=set()
   for distance,side,i in pairs:
    if distance<.24 and side not in row and i not in used:row[side]=i;used.add(i)
   shoulders=(pose[11][1]+pose[12][1])/2;hips=(pose[23][1]+pose[24][1])/2
   for side,k in [('Left',15),('Right',16)]:active[side].append(pose[k][1]<shoulders+.72*max(.1,hips-shoulders))
  else:
   for side in active:active[side].append(False)
  assigned.append(row)
 hands={};flags=[];scores=[]
 for side,mask in active.items():
  used=sum(mask)>=max(3,len(frames)*.2)
  observed=[i for i,row in enumerate(assigned) if side in row]
  coverage=sum(bool(flag and side in row) for flag,row in zip(mask,assigned))/max(1,sum(mask))
  gap=maximum=0
  for i,(flag,row) in enumerate(zip(mask,assigned)):
   gap=gap+1 if flag and side not in row else 0;maximum=max(maximum,gap)
  dt=(frames[-1]['t']-frames[0]['t'])/max(1,len(frames)-1);seconds=maximum*dt
  hands[side]={'active':used,'activeCoverage':round(coverage,4),'missingActiveSeconds':round(seconds,4)}
  if used:
   scores.append(coverage-min(.5,seconds)*.5)
   if coverage<.85:flags.append(side+': missing active hand observations')
   if seconds>.25:flags.append(side+': active hand gap over 250 ms')
 if not scores:flags.append('No active hand identified')
 if data['poseCoverage']<.95:flags.append('Incomplete body tracking')
 return {'hands':hands,'flags':flags,'score':round(min(scores,default=0)*data['poseCoverage'],5),'scope':'Landmark visibility only; not sign correctness'}
