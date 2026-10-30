"""Editable portrait study using an existing reconstructed head and free body/hair assets."""
import bpy, math, json, bmesh, sys, wave
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent
variant=sys.argv[-1] if sys.argv[-1] in ['long01','elvs_hazel_hair'] else 'long01'
bpy.ops.wm.open_mainfile(filepath=str(P/'MakeHuman-portrait-base.blend'))
for o in list(bpy.data.objects):
 if o.type!='MESH' or not ('female_casualsuit02' in o.name or o.name.endswith('.'+variant)):
  bpy.data.objects.remove(o,do_unlink=True)
for o in list(bpy.context.scene.objects):
 o.parent=None
 for m in list(o.modifiers):o.modifiers.remove(m)
 for v in o.data.vertices:v.co=v.co*1.14+Vector((0,.025,.080))
 # Portrait-only crop: discard lower torso and shorts outside this study.
 if 'female_casualsuit02' in o.name:
  bm=bmesh.new();bm.from_mesh(o.data)
  bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<1.15],context='VERTS');bm.to_mesh(o.data);bm.free()
  for v in o.data.vertices:
   w=max(0,min(1,(abs(v.co.x)-.16)/.09))
   v.co.z-=.065*w;v.co.x*=1-.13*w
  mat=bpy.data.materials.new('Charcoal knit');mat.use_nodes=True
  bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.020,.026,.032,1);bs.inputs['Roughness'].default_value=.82
  o.data.materials.clear();o.data.materials.append(mat)
  for poly in o.data.polygons:poly.material_index=0
  o.name='Portrait shoulders'
 else:
  o.name='Portrait hair'
  bpy.context.view_layer.objects.active=o
  sub=o.modifiers.new('Smooth hair silhouette','SUBSURF');sub.levels=2;sub.render_levels=2
  bpy.ops.object.modifier_apply(modifier=sub.name)
  for mat in o.data.materials:
   bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
   bs.inputs['Emission Strength'].default_value=0;bs.inputs['Emission Color'].default_value=(0,0,0,1)
   bs.inputs['Roughness'].default_value=.72;bs.inputs['Specular IOR Level'].default_value=.08
   for n in mat.node_tree.nodes:
    if n.type=='NORMAL_MAP':n.inputs['Strength'].default_value=.18
   # Use original hair UV textures and transparency; darken blond source where needed.
   color=bs.inputs['Base Color']
   if color.links:
    src=color.links[0].from_socket;mix=mat.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    mix.inputs[2].default_value=(.055,.035,.025,1) if variant=='elvs_hazel_hair' else (.20,.14,.10,1)
    mat.node_tree.links.new(src,mix.inputs[1]);mat.node_tree.links.new(mix.outputs[0],color)
   mat.use_backface_culling=False
with bpy.data.libraries.load(str(P.parent/'reference-woman-v1/AI-Mentor-Reference-Woman.blend'),link=False) as (a,b):
 b.objects=['ReferenceWomanFace']+[n for n in a.objects if n.startswith('Tooth ')]
for o in b.objects:
 bpy.context.scene.collection.objects.link(o);o.parent=None
 for m in list(o.modifiers):o.modifiers.remove(m)
 o.data.shape_keys.animation_data_clear()
 for k in o.data.shape_keys.key_blocks:k.value=0
head=bpy.data.objects['ReferenceWomanFace']
mat=head.data.materials[0];bs=mat.node_tree.nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value=.54;bs.inputs['Subsurface Weight'].default_value=.035
# Make teeth sit behind the lips, avoiding the forward-pop in the earlier trial.
for o in b.objects:
 if not o.name.startswith('Tooth '):continue
 for v in o.data.shape_keys.key_blocks['Basis'].data:v.co.y+=.002
 for v,k in zip(o.data.vertices,o.data.shape_keys.key_blocks['Basis'].data):v.co=k.co
 for v,base in zip(o.data.shape_keys.key_blocks['jawOpen'].data,o.data.shape_keys.key_blocks['Basis'].data):
  v.co=base.co.copy()
  if 'lower' in o.name:v.co.z-=.018;v.co.y+=.004
pivot=bpy.data.objects.new('Portrait head pivot',None);bpy.context.scene.collection.objects.link(pivot);pivot.location=(0,.0,1.53)
bpy.context.view_layer.update()
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and o.name!='Portrait shoulders':
  o.parent=pivot;o.matrix_parent_inverse=pivot.matrix_world.inverted()
sc=bpy.context.scene;sc.frame_start=1;sc.frame_end=241;sc.render.fps=30
allcues=json.loads((P.parent/'reference-woman-v1/kim-visemes.json').read_text())['mouthCues']
# Subdued mouth shapes with short anticipatory coarticulation, not exaggerated jaw flapping.
poses={'X':{},'A':{'mouthPressLeft':.28,'mouthPressRight':.28},'B':{'jawOpen':.065,'mouthStretchLeft':.07,'mouthStretchRight':.07},'C':{'jawOpen':.18,'mouthStretchLeft':.09,'mouthStretchRight':.09},'D':{'jawOpen':.28},'E':{'jawOpen':.16,'mouthFunnel':.30},'F':{'jawOpen':.065,'mouthPucker':.36},'G':{'jawOpen':.025,'mouthRollLower':.25},'H':{'jawOpen':.12}}
names=set(k for p in poses.values() for k in p)|{'eyeBlinkLeft','eyeBlinkRight','browInnerUp'}
owners=[o.data.shape_keys for o in b.objects];values={n:0 for n in names}
for frame in range(1,242):
 t=(frame-1)/30
 cue=next((c for c in allcues if c['start']<=t+.025<c['end']),{'value':'X'})
 target=poses.get(cue['value'],{})
 envelope=min(1,t/.18,(8-t)/.20)
 for name in names:
  goal=target.get(name,0)*max(0,envelope)
  if name.startswith('eyeBlink'):
   goal=sum(math.sin(math.pi*(t-a)/.18)**2 for a in [2.70,6.15] if a<=t<=a+.18)
  if name=='browInnerUp':goal=.015*(1+math.sin(t*1.5))*max(0,envelope)
  speed=36 if cue['value']=='A' else 23
  values[name]+=(goal-values[name])*(1-math.exp(-speed/30))
  if frame in [1,241]:values[name]=0
  for owner in owners:
   k=owner.key_blocks.get(name)
   if k:k.value=values[name];k.keyframe_insert('value',frame=frame)
 pivot.rotation_euler=(math.radians(.4*math.sin(t*1.4)),math.radians(.65*math.sin(t*.9)),math.radians(.45*math.sin(t*.6)))
 pivot.keyframe_insert('rotation_euler',frame=frame)
for owner in owners+[pivot]:
 if owner.animation_data and owner.animation_data.action:
  owner.animation_data.action.name='Portrait speech'
  for fc in owner.animation_data.action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
# Pack an eight-second excerpt of the existing recording, without generating a new voice.
with wave.open(str(P.parent/'lecture-portraits-v2/kim.wav'),'rb') as src:
 with wave.open(str(P/'kim-preview.wav'),'wb') as dst:dst.setparams(src.getparams());dst.writeframes(src.readframes(round(src.getframerate()*8)))
seq=sc.sequence_editor_create();sound=seq.strips.new_sound('Ким • 8-second study',str(P/'kim-preview.wav'),channel=1,frame_start=1);sound.sound.pack()
sc.sync_mode='AUDIO_SYNC';sc.frame_set(1)
# Studio framing: no horizon behind the head, neutral soft lighting.
sc.render.engine='CYCLES';sc.cycles.samples=32;sc.cycles.use_denoising=True
sc.render.resolution_x=720;sc.render.resolution_y=900;sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX';sc.view_settings.exposure=-.7;sc.world.use_nodes=True
sc.world.node_tree.nodes.get('Background').inputs[0].default_value=(.35,.39,.43,1)
sc.world.node_tree.nodes.get('Background').inputs[1].default_value=.35
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,size,color in [('Key',(-.8,-1,2.2),45,1.1,(1,.95,.90)),('Fill',(.7,-.7,1.7),25,1,(.90,.94,1)),('Hair rim',(.3,.5,2.0),10,1,(1,.93,.86))]:
 d=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);o.location=loc;d.energy=power;d.shape='DISK';d.size=size;d.color=color;aim(o,(0,0,1.6))
cd=bpy.data.cameras.new('Portrait camera');cam=bpy.data.objects.new('Portrait camera',cd);sc.collection.objects.link(cam);cam.location=(0,-1.25,1.66);aim(cam,(0,-.01,1.59));cd.lens=75;sc.camera=cam
for im in bpy.data.images:
 if im.source=='FILE' and im.size[0]:im.pack()
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(P/('Portrait-'+variant+'.blend')),compress=True)
sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P/('portrait-'+variant+'.png'));bpy.ops.render.render(write_still=True)
print('PORTRAIT_READY',variant,flush=True)
