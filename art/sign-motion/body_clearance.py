"""Body-space contact checks for hands and forearms (Blender rig namespace).
The front surface is built from the character's evaluated torso/head and clothes,
excluding the moving arms. A negative-Y correction moves a hand out toward the
viewer while preserving its horizontal position, height and finger articulation.
"""
from mathutils.bvhtree import BVHTree
class BodyClearance:
 def __init__(self,rig):
  self.rig=rig;self.sources=[];self.arm_vertices={s:[] for s in ['Left','Right']}
  for name in ['Mira • continuous human mesh','Mira • outfit']:
   ob=bpy.data.objects[name];groups={g.index:g.name for g in ob.vertex_groups}
   def arm_weight(v):return sum(g.weight for g in v.groups if any(p in groups[g.group] for p in ['Arm','Hand','ForearmRoll','Shoulder']))
   allowed={v.index for v in ob.data.vertices if arm_weight(v)<.12}
   polygons=[tuple(p.vertices) for p in ob.data.polygons if all(i in allowed for i in p.vertices)]
   self.sources.append((ob,polygons))
   if name.endswith('human mesh'):
    for side in ['Left','Right']:
     ids=[]
     for v in ob.data.vertices:
      moving=sum(g.weight for g in v.groups if side+'Hand' in groups[g.group] or side+'ForearmRoll' in groups[g.group] or side+'ForeArm' in groups[g.group])
      upper=sum(g.weight for g in v.groups if side+'Arm' in groups[g.group])
      if moving>.7 and upper<.1:ids.append(v.index)
     self.arm_vertices[side]=ids
  self.body=bpy.data.objects['Mira • continuous human mesh']
 def geometry(self):
  bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();verts=[];polys=[];arms={}
  for ob,faces in self.sources:
   evaluated=ob.evaluated_get(dg);mesh=evaluated.to_mesh();matrix=self.rig.matrix_world.inverted()@evaluated.matrix_world
   coords=[matrix@v.co for v in mesh.vertices];offset=len(verts);verts.extend(coords);polys.extend(tuple(offset+i for i in f) for f in faces)
   if ob==self.body:arms={side:[coords[i] for i in ids] for side,ids in self.arm_vertices.items()}
   evaluated.to_mesh_clear()
  return BVHTree.FromPolygons(verts,polys),arms
 def inspect(self,margin=.004,stride=1):
  tree,arms=self.geometry();result={}
  for side,points in arms.items():
   deficit=0;worst=None;hits=0
   for p in points[::stride]:
    # Body has no arms in this BVH. A ray from the front finds the visible
    # torso/head surface, including the shirt, at this exact x/z coordinate.
    hit,normal,index,distance=tree.ray_cast(V((p.x,-1.2,p.z)),V((0,1,0)),2.0)
    if hit is None:continue
    gap=hit.y-p.y
    if gap<margin:
     hits+=1
     if margin-gap>deficit:deficit=margin-gap;worst=tuple(p)
   result[side]={'deficit':deficit,'vertices':hits,'point':worst}
  return result
