"""Check whole chains against Blender FK, valid targets and impossible curl input."""
from pathlib import Path
source=Path(__file__).with_name('retarget.py')
__file__=str(source)
exec(compile(source.read_text().split('manifest=[]')[0],str(source),'exec'),globals())
for bone in bones:bone.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();init_finger_rigs()
maximum=0;count=0
for side in ['Left','Right']:
 for name in finger_indices:
  requests=[[0,0,0,0],[.35,.03,.5,.3],[1.1,0,1.3,.7]]
  if name=='Thumb':requests.extend([[-.2,.3,.5,.2,.4],[.3,-.2,.4,.2,-.4]])
  for requested in requests:
   expected=project_finger_values(side,name,requested)
   targets,rotations=finger_chain(side,name,expected)
   for j,q in enumerate(rotations,1):B(side+'Hand'+name+str(j)).rotation_quaternion=q
   bpy.context.view_layer.update()
   for j,target in enumerate(targets,1):
    bone=B(side+'Hand'+name+str(j));actual=(bone.tail-bone.head).normalized()
    assert actual.angle(target)<.002,(side,name,j,'FK mismatch')
   fitted=fit_finger_directions(side,name,targets)
   predicted,_=finger_chain(side,name,fitted)
   error=max(math.degrees(a.angle(b)) for a,b in zip(predicted,targets));maximum=max(maximum,error)
   assert error<6,(side,name,expected,fitted,error)
   count+=1
  limited=project_finger_values(side,name,[10,10,10,10]);info=finger_fit_rigs[(side,name)]
  assert all(lo-1e-7<=v<=hi+1e-7 for v,(lo,hi) in zip(limited,info['bounds']))
  assert sum(limited[j] for j in [0,2,3])+sum(info['offsets'])<=math.radians(240 if name!='Thumb' else 190)+1e-7
print('WHOLE_FINGER_CHAINS',count,'poses, FK and joint limits; max target error',maximum,'degrees',flush=True)
# The authored open hand must be straight in the actual rig, on BOTH sides.
for side in ['Left','Right']:
 for name,values in flat_shape(side).items():
  directions,_=finger_chain(side,name,values)
  assert max(math.degrees(v.angle(rest[side]['basis'].col[1])) for v in directions)<12,(side,name,'open fingers do not align')
print('REFERENCE_HAND_SHAPES: both open palms have aligned, extended phalanges',flush=True)
