"""Repair distal cross-finger influences without changing mesh coordinates/webbing."""
import re
from mathutils import Vector

def repair_hand_weights(rig):
 report={'verticesChanged':0,'crossFingerDistalBefore':0,'crossFingerDistalAfter':0,'maxWeightSumError':0,'handVertices':0}
 digits=['Thumb','Index','Middle','Ring','Pinky']
 deform={b.name for b in rig.data.bones if b.use_deform}
 def segment(p,a,b):
  u=max(0,min(1,(p-a).dot(b-a)/(b-a).length_squared));return (p-a.lerp(b,u)).length,u
 for ob in rig.children_recursive:
  if ob.type!='MESH':continue
  transform=rig.matrix_world.inverted()@ob.matrix_world
  for v in ob.data.vertices:
   original={ob.vertex_groups[g.group].name:g.weight for g in v.groups if ob.vertex_groups[g.group].name in deform and g.weight>1e-8}
   finger={n:w for n,w in original.items() if re.search(r'Hand(Thumb|Index|Middle|Ring|Pinky)[123]$',n)}
   if not finger:continue
   report['handVertices']+=1;weights=original.copy();p=transform@v.co
   side='Left' if sum(w for n,w in finger.items() if 'Left' in n)>sum(w for n,w in finger.items() if 'Right' in n) else 'Right'
   sums={d:sum(w for n,w in finger.items() if side+'Hand'+d in n) for d in digits}
   owner=max(sums,key=sums.get)
   first=rig.data.bones['mixamorig:'+side+'Hand'+owner+'1']
   _,u=segment(p,first.head_local,first.tail_local)
   distal=u>.30
   other=[n for n in finger if side+'Hand'+owner not in n]
   if distal and sum(weights[n] for n in other)>.001:
    report['crossFingerDistalBefore']+=1
    # Keep existing joint gradients on the owning digit. Do not pull another
    # finger's skin; proximal webbing deliberately retains its original blend.
    removed=sum(weights.pop(n) for n in other);own=[n for n in finger if side+'Hand'+owner in n]
    total=sum(weights[n] for n in own)
    for n in own:weights[n]+=removed*weights[n]/total
   weights=dict(sorted(weights.items(),key=lambda x:x[1],reverse=True)[:4]);total=sum(weights.values())
   weights={n:w/total for n,w in weights.items()}
   if set(weights)!=set(original) or any(abs(weights[n]-original.get(n,0))>1e-6 for n in weights):
    report['verticesChanged']+=1
    for n in original:ob.vertex_groups[n].remove([v.index])
    for n,w in weights.items():ob.vertex_groups[n].add([v.index],w,'REPLACE')
   report['maxWeightSumError']=max(report['maxWeightSumError'],abs(sum(weights.values())-1))
   if distal and sum(w for n,w in weights.items() if re.search(r'Hand(Thumb|Index|Middle|Ring|Pinky)[123]$',n) and side+'Hand'+owner not in n)>.001:report['crossFingerDistalAfter']+=1
 return report
