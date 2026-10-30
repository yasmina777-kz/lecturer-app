"""Run in Blender: test actual joint transforms, not only stored calibration values."""
from pathlib import Path
import json,math
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art/mira-blender-v3/animate.py';scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nface=bpy.data.objects')[0],str(source),'exec'),scope)
globals().update({k:v for k,v in scope.items() if not k.startswith('__')})
d=json.loads((ROOT/'art/sign-motion/mixamo-hand-calibration.json').read_text())
maximum=0;checks=0
for name,offset in d['restBends'].items():
 b=bones[name];a=V(d['axes'][name]);assert abs(a.length-1)<1e-5 and abs(a.y)<1e-6
 for angle in [0,20,60]:
  for bone in bones:bone.matrix_basis=Matrix.Identity(4)
  b.rotation_quaternion=Quaternion(a,math.radians(angle)-offset)
  bpy.context.view_layer.update()
  world=b.bone.matrix_local.to_quaternion()@a
  parent=(b.parent.tail-b.parent.head).normalized();child=(b.tail-b.head).normalized()
  parent=(parent-world*parent.dot(world)).normalized();child=(child-world*child.dot(world)).normalized()
  measured=math.degrees(math.atan2(world.dot(parent.cross(child)),parent.dot(child)))
  error=abs(measured-angle);maximum=max(maximum,error);checks+=1
  assert error<1.5,(name,angle,measured)
  assert b.location.length<1e-7
print('FINGER_CALIBRATION',checks,'actual joint poses; max error',maximum,'degrees',flush=True)
