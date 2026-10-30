"""Free MakeHuman assets: build an isolated portrait-study base, no app changes."""
import sys, bpy, json, os
from pathlib import Path
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
macro=TargetService.get_default_macro_info_dict()
macro.update(gender=0.0,age=.4,muscle=.40,weight=.45,height=.5,proportions=.5,cupsize=.35)
human=HumanService.create_human(macro_detail_dict=macro);human.name='Study body'
rig=HumanService.add_builtin_rig(human,'mixamo_unity');rig.name='Study base rig'
HumanService.add_mhclo_asset(str(SRC/'assets/clothes/female_casualsuit02/female_casualsuit02.mhclo'),human,asset_type='Clothes',material_type='GAMEENGINE',subdiv_levels=1)
for name in ['long01','elvs_hazel_hair']:
 HumanService.add_mhclo_asset(str(P/'assets/hair'/name/(name+'.mhclo')),human,asset_type='Hair',material_type='GAMEENGINE',subdiv_levels=1)
for ob in list(rig.children_recursive):
 if ob.type!='MESH':continue
 bpy.context.view_layer.objects.active=ob
 if ob.data.shape_keys:bpy.ops.object.shape_key_remove(all=True,apply_mix=True)
 for mod in list(ob.modifiers):
  if mod.type in {'MASK','SUBSURF'}:
   try:bpy.ops.object.modifier_apply(modifier=mod.name)
   except RuntimeError:ob.modifiers.remove(mod)
 for p in ob.data.polygons:p.use_smooth=True
for im in bpy.data.images:
 if im.source=='FILE' and im.size[0]:im.pack()
report={'bones':{b.name:[list(b.head_local),list(b.tail_local)] for b in rig.data.bones if any(n in b.name for n in ['Head','Neck','Eye','Spine2','Shoulder'])},'objects':{o.name:[list(o.dimensions),[list(min(v.co[i] for v in o.data.vertices) for i in range(3)),list(max(v.co[i] for v in o.data.vertices) for i in range(3))]] for o in rig.children_recursive if o.type=='MESH'}}
(P/'base-report.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(P/'MakeHuman-portrait-base.blend'),compress=True)
print('BASE_READY',json.dumps(report),flush=True)
