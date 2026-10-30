import bpy, math
from pathlib import Path
from mathutils import Quaternion
out=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
image=bpy.data.images.load('/Users/asminauldaseva/Downloads/ии модель ai модель.jpg')
image.pack()
ref=bpy.data.objects.new('REFERENCE — user portrait, not a 3D model',None)
bpy.context.collection.objects.link(ref)
ref.empty_display_type='IMAGE';ref.data=image
ref.empty_display_size=2.0;ref.rotation_euler=(math.pi/2,0,0)
ref.location=(0,0,1.5);ref.hide_render=True
bpy.context.scene['status']='Reference setup only. Face reconstruction, body, rig, visemes and motion are NOT created yet.'
bpy.context.scene['intended_face_tool']='KeenTools FaceBuilder 2026.3.1. Core EULA approval required before installation.'
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   space=area.spaces.active
   space.region_3d.view_rotation=Quaternion((1,0,0),math.pi/2)
   space.region_3d.view_perspective='ORTHO'
   space.region_3d.view_location=(0,0,1.5)
   space.region_3d.view_distance=2.6
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Woman-reference-setup.blend'))
print('REFERENCE_SCENE_SAVED',len(bpy.data.images),len(bpy.data.meshes))
