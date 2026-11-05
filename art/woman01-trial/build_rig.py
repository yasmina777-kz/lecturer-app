"""Build a deform rig for Woman_01 without modifying the supplied source.
Blender --background --disable-autoexec Woman_01.blend --python this_file
"""
from pathlib import Path
import bpy, math, json
import numpy as np
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'frontend/public/avatars/woman01';OUT.mkdir(parents=True,exist_ok=True)
ART=Path(__file__).resolve().parent
mesh=bpy.data.objects['Woman_01']
points=[mesh.matrix_world@v.co for v in mesh.data.vertices]
zmin=min(v.z for v in points);scale=1.7/(max(v.z for v in points)-zmin)
for v,p in zip(mesh.data.vertices,points):v.co=Vector((p.y,-p.x,p.z-zmin))*scale
mesh.matrix_world=Matrix.Identity(4)
for o in list(bpy.data.objects):
 if o!=mesh:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.objects.active=mesh;mesh.select_set(True)
# Preserve enough surface resolution around small joints while reducing transfer size.
mod=mesh.modifiers.new('Web mesh','DECIMATE');mod.ratio=.18
bpy.ops.object.modifier_apply(modifier=mod.name)
for p in mesh.data.polygons:p.use_smooth=True
import sys
sys.path.insert(0,str(ART))
from color_materials import apply_colors
apply_colors(mesh)
rig=bpy.data.objects.new('Woman01Rig',bpy.data.armatures.new('Woman01Rig'));bpy.context.collection.objects.link(rig)
mesh.select_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
P='mixamorig:';spec={}
def bone(name,head,tail,parent=None,normal=(0,-1,0)):
 b=rig.data.edit_bones.new(P+name);b.head=head;b.tail=tail;b.align_roll(Vector(normal));b.use_connect=False
 if parent:b.parent=rig.data.edit_bones[P+parent]
 spec[name]={'head':list(head),'tail':list(tail),'parent':parent}
 return b
bone('Root',(0,0,0),(0,0,.1))
bone('Hips',(0,.01,.88),(0,.01,.97),'Root')
bone('Spine',(0,.01,.97),(0,.01,1.06),'Hips')
bone('Spine1',(0,.01,1.06),(0,.02,1.16),'Spine')
bone('Spine2',(0,.02,1.16),(0,.025,1.31),'Spine1')
bone('Neck',(0,.025,1.31),(0,.025,1.42),'Spine2')
bone('Head',(0,.025,1.42),(0,.025,1.64),'Neck')
chains={
 'Thumb':[(.58,.018,1.227),(.597,-.002,1.212),(.612,-.016,1.203),(.627,-.023,1.197)],
 'Index':[(.623,.010,1.232),(.654,.005,1.226),(.676,.001,1.220),(.694,-.001,1.217)],
 'Middle':[(.627,.031,1.234),(.662,.029,1.226),(.689,.026,1.219),(.703,.025,1.214)],
 'Ring':[(.622,.052,1.237),(.651,.055,1.230),(.676,.055,1.223),(.694,.053,1.218)],
 'Pinky':[(.612,.068,1.236),(.637,.075,1.230),(.660,.077,1.224),(.677,.076,1.220)],
}
for side,sgn in [('Left',1),('Right',-1)]:
 v=lambda x: (sgn*x[0],x[1],x[2])
 bone(side+'Shoulder',v((.025,.025,1.28)),v((.16,.025,1.28)),'Spine2')
 bone(side+'Arm',v((.16,.025,1.28)),v((.365,.035,1.255)),side+'Shoulder')
 bone(side+'ForeArm',v((.365,.035,1.255)),v((.565,.035,1.23)),side+'Arm')
 bone(side+'Hand',v((.565,.035,1.23)),v((.627,.031,1.234)),side+'ForeArm',(0,0,-1))
 for digit,pts in chains.items():
  for i in range(3):bone(side+'Hand'+digit+str(i+1),v(pts[i]),v(pts[i+1]),side+'Hand' if i==0 else side+'Hand'+digit+str(i),(0,0,-1))
 bone(side+'UpLeg',v((.09,.025,.88)),v((.105,.015,.48)),'Hips')
 bone(side+'Leg',v((.105,.015,.48)),v((.105,.03,.12)),side+'UpLeg')
 bone(side+'Foot',v((.105,.03,.12)),v((.105,-.075,.055)),side+'Leg')
bpy.ops.object.mode_set(mode='OBJECT')
# Anatomical masks prevent fingers sharing distal skin and sleeves binding to torso.
# Distance-to-segment weights blend at each joint and stay normalized to four influences.
segments={n:(np.array(d['head']),np.array(d['tail'])) for n,d in spec.items()}
def distance(p,n):
 a,b=segments[n];v=b-a;u=np.clip(np.dot(p-a,v)/np.dot(v,v),0,1)
 return np.linalg.norm(p-(a+u*v))
def weights(p):
 x,y,z=p;side='Left' if x>=0 else 'Right';ax=abs(x)
 if ax>.575 and z>1.13:
  digits=list(chains);owner=min(digits,key=lambda d:min(distance(p,side+'Hand'+d+str(i)) for i in [1,2,3]))
  names=[side+'Hand']+[side+'Hand'+owner+str(i) for i in [1,2,3]]
  base=chains[owner][0][0]
  if ax<base+.01:names=[side+'Hand']+[side+'Hand'+d+'1' for d in digits]
 elif z>1.46:names=['Head']
 elif z>.88:
  names=['Hips','Spine','Spine1','Spine2','Neck','Head',side+'Shoulder',side+'Arm',side+'ForeArm',side+'Hand']
 elif z>.76:names=['Hips','Spine',side+'UpLeg']
 else:names=['Hips',side+'UpLeg',side+'Leg',side+'Foot']
 pairs=sorted([(n,distance(p,n)) for n in names],key=lambda x:x[1])[:4]
 w=np.array([1/(d*d+.000025)**2 for n,d in pairs]);w/=sum(w)
 return [(n,float(v)) for (n,_),v in zip(pairs,w) if v>.0001]
for n in spec:mesh.vertex_groups.new(name=P+n)
for v in mesh.data.vertices:
 ws=weights(np.array(v.co));total=sum(w for _,w in ws)
 for n,w in ws:mesh.vertex_groups[P+n].add([v.index],w/total,'REPLACE')
mesh.parent=rig
arm=mesh.modifiers.new('Woman01 skin','ARMATURE');arm.object=rig;arm.use_deform_preserve_volume=True
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
rig.show_in_front=True
scene=bpy.context.scene;scene.render.fps=30
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.shading.color_type='VERTEX'
   area.spaces.active.shading.type='SOLID'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'Woman01-rig.blend'))
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'woman01.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_extras=True)
report={'vertices':len(mesh.data.vertices),'polygons':len(mesh.data.polygons),'bones':len(spec),'fingerBones':30,'sourceTexturesAvailable':False,'materials':'New skin, hair and outfit vertex colors; not original textures','rest':spec,'review':'Experimental; motion retargeting and visual joint checks required.'}
(ART/'rig-report.json').write_text(json.dumps(report,indent=2))
print('RIG_COMPLETE',len(mesh.data.vertices),len(spec),flush=True)
