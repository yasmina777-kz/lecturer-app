import bpy,sys,numpy as np,json
from pathlib import Path
sys.path.insert(0,'/Users/asminauldaseva/Library/Application Support/Blender/4.5/scripts/addons')
from keentools.blender_independent_packages.pykeentools_loader import module
from keentools.utils.coords import projection_matrix,xy_to_xz_rotation_matrix_3x3
from keentools.utils.images import np_array_from_bpy_image
from keentools.facebuilder.fbloader import FBLoader
from keentools.utils.blendshapes import create_facs_blendshapes
p=module();out=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
img=bpy.data.images.load('/Users/asminauldaseva/Downloads/ии модель ai модель.jpg');img.pack()
w,h=img.size[:];rgba=np_array_from_bpy_image(img)
class Cam(p.FaceBuilderCameraInputI):
 def projection(self,k):return projection_matrix(w,h,70,36,.01,1000)
 def view(self,k):return np.eye(4)
 def image_size(self,k):return (w,h)
cam=Cam();fb=p.FaceBuilder(cam)
print('LICENSE',fb.license_manager().license_status_text(),flush=True)
print('MODELS',[(x.name, x.__class__.__name__) for x in fb.models_list()],flush=True)
print('MASKS',fb.mask_names(),fb.masks(),flush=True)
faces=fb.detect_faces(rgba,1.0);print('FACES',len(faces),flush=True)
assert len(faces)==1
fb.set_use_emotions(False)
print('POSE',fb.set_detected_face_pose_keyframe(1,faces[0]),flush=True)
print('PINS',len(fb.add_preset_pins_and_solve(1)),flush=True)
(out/'facebuilder-state.json').write_text(fb.serialize())
mesh=FBLoader.get_builder_mesh(fb,'ReferenceWomanFace')
obj=bpy.data.objects.new('ReferenceWomanFace',mesh);bpy.context.collection.objects.link(obj)
print('BOUNDS',np.array([v.co for v in mesh.vertices]).min(axis=0),np.array([v.co for v in mesh.vertices]).max(axis=0),flush=True)
print('SHAPES',create_facs_blendshapes(obj,fb.current_scale()),flush=True)
print('SHAPE_NAMES',[k.name for k in obj.data.shape_keys.key_blocks],flush=True)
class Progress(p.ProgressCallback):
 def set_progress_and_check_abort(self,value):return False
def loadframe(k):
 d=p.texture_builder.FrameData();d.geo=fb.applied_args_model_at(1);d.image=rgba;d.model=fb.model_mat(1);d.view=np.eye(4);d.projection=cam.projection(1);return d
print('BAKING',flush=True)
tex=p.texture_builder.build_texture(1,loadframe,Progress(),2048,2048,1.0,.02,True,False,False,True)
print('TEXTURE',tex.shape,flush=True)
texture=bpy.data.images.new('Portrait skin atlas',width=tex.shape[1],height=tex.shape[0],alpha=True)
texture.pixels.foreach_set(tex.ravel());texture.filepath_raw=str(out/'skin-atlas.png');texture.file_format='PNG';texture.save();texture.pack()
mat=bpy.data.materials.new('Photo reconstructed skin');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.52
im=mat.node_tree.nodes.new('ShaderNodeTexImage');im.image=texture
mat.node_tree.links.new(im.outputs['Color'],bs.inputs['Base Color']);obj.data.materials.append(mat)
obj['source']='User portrait; KeenTools FaceBuilder single view reconstruction'
obj['limitations']='Back and occluded regions are inferred; hair and body are not reconstructed.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Woman-reconstructed-head.blend'))
(out/'head-report.json').write_text(json.dumps({'vertices':len(mesh.vertices),'faces':len(mesh.polygons),'shapes':[k.name for k in obj.data.shape_keys.key_blocks], 'license':fb.license_manager().license_status_text()},ensure_ascii=False,indent=2))
