"""Human mesh and deform rig, using local CC0 MakeHuman system assets."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent
SRC=Path('/Users/asminauldaseva/Documents/Codex/2026-10-16/new-chat-2/work/blender')
sys.path.insert(0,str(SRC/'mpfb2-master/src'))
original=bpy.utils.extension_path_user
bpy.utils.extension_path_user=lambda package,path='',create=False: str(P/'mpfb-cache') if package=='mpfb' else original(package,path=path,create=create)
bpy.context.preferences.addons.new().module='mpfb'
import mpfb
mpfb.register()
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
macro=TargetService.get_default_macro_info_dict();macro.update(gender=0.0,age=.45,muscle=.45,weight=.48,height=.65,proportions=.5,cupsize=.3)
body=HumanService.create_human(macro_detail_dict=macro);body.name='Mira • continuous human mesh'
rig=HumanService.add_builtin_rig(body,'mixamo_unity');rig.name='Mira • anatomical deform rig'
assets={}
for key,path,kind in [('outfit','clothes/female_casualsuit02/female_casualsuit02.mhclo','Clothes'),('hair','hair/ponytail01/ponytail01.mhclo','Hair'),('eyes','eyes/high-poly/high-poly.mhclo','Eyes'),('brows','eyebrows/eyebrow001/eyebrow001.mhclo','Eyebrows'),('lashes','eyelashes/eyelashes01/eyelashes01.mhclo','Eyelashes')]:
 assets[key]=HumanService.add_mhclo_asset(str(SRC/'assets'/path),body,asset_type=kind,material_type='GAMEENGINE',subdiv_levels=1)
 assets[key].name='Mira • '+key
# Preserve expression deltas through the topology modifiers as point attributes.
import gzip
expression_targets={'Smile':'mouth-corner-puller','BrowLeft':'eyebrows-left-up','BrowRight':'eyebrows-right-up'}
for name,target in expression_targets.items():
 attr=body.data.attributes.new('expr_'+name,'FLOAT_VECTOR','POINT')
 targetpath=SRC/'mpfb2-master/src/mpfb/data/targets/expression/units/caucasian'/(target+'.target.gz')
 for line in gzip.open(targetpath,'rt'):
  if not line.strip() or line.startswith('#'):continue
  index,x,y,z=line.split();index=int(index)
  if index<len(attr.data):attr.data[index].vector=(float(x)*.1,-float(z)*.1,float(y)*.1)
# Bake the static macro shape; keep smooth armature deformation editable.
for ob in [body,*assets.values()]:
 bpy.context.view_layer.objects.active=ob
 if ob.data.shape_keys:bpy.ops.object.shape_key_remove(all=True,apply_mix=True)
 for mod in list(ob.modifiers):
  if mod.type in {'MASK','SUBSURF'}:
   try:bpy.ops.object.modifier_apply(modifier=mod.name)
   except RuntimeError:ob.modifiers.remove(mod)
 for f in ob.data.polygons:f.use_smooth=True
 for mod in ob.modifiers:
  if mod.type=='ARMATURE':mod.use_deform_preserve_volume=False

body.shape_key_add(name='Basis')
for name in expression_targets:
 attr=body.data.attributes['expr_'+name];key=body.shape_key_add(name=name)
 for v,d in zip(key.data,attr.data):v.co+=d.vector
 body.data.attributes.remove(attr)

def texture_material(name,path,rough=.6):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=rough
 tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path));tex.image.pack();m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);return m
body.data.materials.clear();body.data.materials.append(texture_material('Mira • natural skin',SRC/'assets/skins/young_caucasian_female/young_lightskinned_female_diffuse.png'))
for p in body.data.polygons:p.material_index=0
assets['eyes'].data.materials.clear();assets['eyes'].data.materials.append(texture_material('Mira • brown eyes',SRC/'assets/eyes/materials/brown_eye.png',.25))
for p in assets['eyes'].data.polygons:p.material_index=0
# Exportable material nodes, no generator shaders required at runtime.
for ob in assets.values():
 for mat in ob.data.materials:
  if not mat.use_nodes:continue
  bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if not bs:continue
  bs.inputs['Emission Strength'].default_value=0;bs.inputs['Roughness'].default_value=.7
  mat.use_backface_culling=False
  if ob==assets['hair']:
   # Dark chestnut colour baked into a private texture copy, preserving strand alpha.
   for n in mat.node_tree.nodes:
    if n.type=='TEX_IMAGE' and 'diffuse' in n.image.name:
     import numpy as np
     im=n.image.copy();pixels=np.array(im.pixels[:],dtype=np.float32).reshape(-1,4);pixels[:,:3]*=[.32,.23,.18];im.pixels.foreach_set(pixels.ravel());im.pack();n.image=im
# Studio setup and useful default viewport.
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
sc.render.resolution_x=800;sc.render.resolution_y=960;sc.render.resolution_percentage=100
sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.38,.42,.46,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.45
sc.render.film_transparent=True
sc.view_settings.view_transform='AgX'
def aim(ob,point):ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,size in [('Key',(-1,-1.5,2.5),85,1.5),('Fill',(1,-1,1.6),45,1.3),('Rim',(.5,.8,2),70,1)]:
 d=bpy.data.lights.new(name,'AREA');ob=bpy.data.objects.new(name,d);sc.collection.objects.link(ob);ob.location=loc;d.energy=power;d.size=size;aim(ob,(0,0,1.2))
d=bpy.data.cameras.new('Portrait camera');cam=bpy.data.objects.new('Portrait camera',d);sc.collection.objects.link(cam);sc.camera=cam;cam.location=(.12,-2.5,1.3);aim(cam,(0,-.02,1.15));d.lens=62
for im in bpy.data.images:
 if im.source=='FILE' and im.size[0]:im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(P/'Mira-base.blend'),compress=True)
sc.render.filepath=str(P/'base-preview.png');bpy.ops.render.render(write_still=True)
print('HUMAN_BASE_READY',flush=True)
