import bpy,math,random,json
from mathutils import Vector
from pathlib import Path
from math import sin,cos,pi
P=Path(__file__).resolve().parent;random.seed(24)
bpy.ops.wm.open_mainfile(filepath=str(P.parent/'avatar-mentor-v1/AI-Mentor-Teacher-v1.blend'))
rig=bpy.data.objects['AI_Mentor_Rig'];col=bpy.data.collections['MENTOR • character']
# Reuse the existing clothed body and skeleton only. The former head is removed.
for ob in list(col.objects):
 if ob.type=='MESH' and (ob.vertex_groups.get('head') or ob.name=='Neck'):
  bpy.data.objects.remove(ob,do_unlink=True)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=None
for bone in rig.pose.bones:bone.rotation_euler=(0,0,0);bone.location=(0,0,0)
bpy.context.scene.frame_set(1)
with bpy.data.libraries.load(str(P/'Woman-reconstructed-head.blend'),link=False) as (src,dst):dst.objects=['ReferenceWomanFace']
head=dst.objects[0];col.objects.link(head)
scale=.106;zoff=1.625
for k in head.data.shape_keys.key_blocks:
 for v in k.data:
  v.co=v.co*scale+Vector((0,0,zoff))
  w=max(0,min(1,(1.54-v.co.z)/.08))
  v.co.x*=1-.45*w;v.co.y=(1-w)*v.co.y+w*(v.co.y*.5-.025);v.co.z-=.042*w
# Shape key coordinates and basis vertex positions must agree before binding.
for v,k in zip(head.data.vertices,head.data.shape_keys.key_blocks['Basis'].data):v.co=k.co
head.parent=rig
weights={n:head.vertex_groups.new(name=n) for n in ['head','neck','spine']}
for v in head.data.vertices:
 wh=max(0,min(1,(v.co.z-1.49)/.065));wn=(1-wh)*max(0,min(1,(v.co.z-1.44)/.055));ws=1-wh-wn
 for n,w in [('head',wh),('neck',wn),('spine',ws)]:
  if w>0:weights[n].add([v.index],w,'REPLACE')
mod=head.modifiers.new('Face and neck skinning','ARMATURE');mod.object=rig
# Bake a gradual neck colour blend into the atlas to remove projected hair shadows.
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=8
mat=head.data.materials[0];nodes=mat.node_tree.nodes;links=mat.node_tree.links
photo=next(n for n in nodes if n.type=='TEX_IMAGE');bs=nodes.get('Principled BSDF');output=nodes.get('Material Output')
geo=nodes.new('ShaderNodeNewGeometry');sep=nodes.new('ShaderNodeSeparateXYZ');links.new(geo.outputs['Position'],sep.inputs[0])
ran=nodes.new('ShaderNodeMapRange');ran.inputs['From Min'].default_value=1.46;ran.inputs['From Max'].default_value=1.535;links.new(sep.outputs['Z'],ran.inputs['Value'])
mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[1].default_value=(.40,.235,.16,1);links.new(ran.outputs[0],mix.inputs[0]);links.new(photo.outputs['Color'],mix.inputs[2])
scalp_range=nodes.new('ShaderNodeMapRange');scalp_range.inputs['From Min'].default_value=1.744;scalp_range.inputs['From Max'].default_value=1.754;links.new(sep.outputs['Z'],scalp_range.inputs['Value'])
scalp_mix=nodes.new('ShaderNodeMixRGB');links.new(scalp_range.outputs[0],scalp_mix.inputs[0]);links.new(mix.outputs[0],scalp_mix.inputs[1]);scalp_mix.inputs[2].default_value=(.028,.014,.008,1)
em=nodes.new('ShaderNodeEmission');links.new(scalp_mix.outputs[0],em.inputs['Color']);links.new(em.outputs[0],output.inputs['Surface'])
baked=bpy.data.images.new('Reference woman skin finished',2048,2048,alpha=True)
target=nodes.new('ShaderNodeTexImage');target.image=baked;nodes.active=target
bpy.ops.object.select_all(action='DESELECT');head.select_set(True);bpy.context.view_layer.objects.active=head
bpy.ops.object.bake(type='EMIT',margin=8)
baked.filepath_raw=str(P/'skin-finished.png');baked.file_format='PNG';baked.save();baked.pack()
links.new(bs.outputs[0],output.inputs['Surface']);links.new(target.outputs['Color'],bs.inputs['Base Color'])
bs.inputs['Roughness'].default_value=.65;bs.inputs['Specular IOR Level'].default_value=.22
# The photographed inner lips must not be stretched into fake teeth.
inside=bpy.data.materials.new('Mouth interior');inside.diffuse_color=(.022,.004,.006,1);inside.use_nodes=True
inside.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.022,.004,.006,1)
inside.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8
head.data.materials.append(inside)
for poly in head.data.polygons:
 pts=[head.data.vertices[i].co for i in poly.vertices]
 opened=[head.data.shape_keys.key_blocks['jawOpen'].data[i].co for i in poly.vertices]
 c=sum(pts,Vector())/len(pts)
 area=lambda vs:sum((vs[k]-vs[0]).cross(vs[k+1]-vs[0]).length*.5 for k in range(1,len(vs)-1))
 if abs(c.x)<.03 and 1.585<c.z<1.60 and c.y<-.09 and area(opened)/max(area(pts),1e-12)>40:poly.material_index=1
# Neutral wardrobe and hands, without the cartoon head or accessories.
for m in bpy.data.materials:
 if not m.use_nodes:continue
 bs=m.node_tree.nodes.get('Principled BSDF')
 if not bs:continue
 if any(t in m.name for t in ['Blazer','Lapel','Seams','Trousers']):
  bs.inputs['Base Color'].default_value=(.022,.029,.035,1);bs.inputs['Roughness'].default_value=.78
 if m.name.startswith('Skin'):
  bs.inputs['Base Color'].default_value=(.42,.255,.18,1)
# Sculpted hair cap plus layered long locks. All are actual mesh geometry.
def hairmat(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.85;bs.inputs['Specular IOR Level'].default_value=.04
 bs.inputs['Anisotropic'].default_value=0
 return m
hair=hairmat('Chestnut hair',(.026,.013,.008));hlight=hairmat('Chestnut strands',(.042,.022,.013));hdark=hairmat('Deep brown strands',(.014,.007,.004))
def bind(ob,flow=False):
 for c in list(ob.users_collection):c.objects.unlink(ob)
 col.objects.link(ob);ob.parent=rig
 gs={n:ob.vertex_groups.new(name=n) for n in ['head','neck','spine']}
 for v in ob.data.vertices:
  wh=max(0,min(1,(v.co.z-1.43)/.21)) if flow else 1
  wn=(1-wh)*.35
  for n,w in [('head',wh),('neck',wn),('spine',1-wh-wn)]:
   if w>0:gs[n].add([v.index],w,'REPLACE')
 mo=ob.modifiers.new('Hair follows head and shoulders','ARMATURE');mo.object=rig
 for f in ob.data.polygons:f.use_smooth=True
 return ob
def mesh(name,vs,fs,mat,flow=False):
 d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(name,d);col.objects.link(o);d.materials.append(mat);return bind(o,flow)
from mathutils.bvhtree import BVHTree
scalp=BVHTree.FromPolygons([v.co for v in head.data.vertices],[list(p.vertices) for p in head.data.polygons])
def cap(a,t):
 end=1.02+1.13*((1-cos(a))*.5)**.6
 ph=t*end
 center=Vector((0,.005,1.67))
 guess=Vector((.109*sin(ph)*sin(a),-.122*sin(ph)*cos(a)+.003,1.674+.112*cos(ph)))
 hit,normal,_,_=scalp.ray_cast(center,(guess-center).normalized())
 return hit+normal*.003 if hit is not None else guess
vs=[];fs=[];na=128;nt=28
for i in range(nt+1):
 for j in range(na):vs.append(tuple(cap(2*pi*j/na,max(.001,i/nt))))
for i in range(nt):
 for j in range(na):
  a=i*na+j;b=i*na+(j+1)%na
  if not (i>nt*.36 and cos(2*pi*j/na)>.68):fs.append((a,b,b+na,a+na))
mesh('Hair scalp with side part',vs,fs,hair)
def lock(a,t,layer=0):
 side=-1 if sin(a)<0 else 1
 if t<.42:
  co=cap(a,.12+.88*t/.42)
 else:
  u=(t-.42)/.58;co=cap(a,1)
  endz=1.28 if side<0 else 1.35
  co.x+=side*.04*sin(pi*u/2)*abs(sin(a))
  co.y+=.03*u
  if cos(a)>.02:co.y-=.05*u
  co.z=co.z+(endz-co.z)*u
  co.x+=.005*sin(u*5+a)*u
  co.y+=.004*sin(u*5+a)*u
 co.x+=(.002+layer*.002)*sin(a)
 co.y-=(.002+layer*.002)*cos(a)
 co.z+=.002
 return co

lo=.91;hi=2*pi-.74;na=150;nt=30
for layer in range(3):
 vs=[];fs=[]
 for i in range(nt+1):
  for j in range(na+1):
   a=lo+(hi-lo)*j/na;t=i/nt;co=lock(a,t,layer)
   co.z+=.012*sin(a*11)*t**6;vs.append(tuple(co))
 for i in range(nt):
  for j in range(na):a=i*(na+1)+j;fs.append((a,a+1,a+na+2,a+na+1))
 mesh('Long hair layer '+str(layer),vs,fs,hair,True)
# Fine strands grouped in a few meshes for efficient WebGL rendering.
for group,mat in enumerate([hair,hlight,hdark]):
 d=bpy.data.curves.new('Hair fibres '+str(group),'CURVE');d.dimensions='3D';d.resolution_u=5;d.bevel_depth=.00045;d.bevel_resolution=1
 for j in range(110):
  a=lo+(hi-lo)*(j+random.random())/110
  s=d.splines.new('BEZIER');s.bezier_points.add(8)
  for i,b in enumerate(s.bezier_points):
   t=i/8;b.co=lock(a,t,3+group*.3);b.radius=.3 if i==8 else 1;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 for j in range(45):
  a=2*pi*(j+random.random())/45
  s=d.splines.new('BEZIER');s.bezier_points.add(7)
  for i,b in enumerate(s.bezier_points):
   b.co=cap(a,.03+(.30 if cos(a)>.68 else .96)*i/7)+Vector((.0005*sin(a),-.0005*cos(a),.0005));b.radius=.6;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(d.name,d);col.objects.link(o);d.materials.append(mat)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bind(o,True)
# Rounded upper and lower teeth sit behind the lips, with lower teeth following jawOpen.
teeth=bpy.data.materials.new('Natural ivory teeth');teeth.use_nodes=True
tbs=teeth.node_tree.nodes.get('Principled BSDF');tbs.inputs['Base Color'].default_value=(.65,.61,.52,1);tbs.inputs['Roughness'].default_value=.35
for row in ['upper','lower']:
 for j in range(8):
  x=(j-3.5)*.0036;y=-.108+.012*(x/.023)**2;z=1.595 if row=='upper' else 1.590
  bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z))
  o=bpy.context.object;o.name='Tooth '+row+' '+str(j);o.scale=(.0038,.003,.006)
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  # Keep coordinates in world space, like the other skinned meshes.
  offset=o.location.copy()
  for v in o.data.vertices:v.co+=offset
  o.location=(0,0,0);o.data.materials.append(teeth);bind(o)
  bpy.context.view_layer.objects.active=o
  bevel=o.modifiers.new('Soft enamel edges','BEVEL');bevel.width=.0006;bevel.segments=2
  bpy.ops.object.modifier_apply(modifier=bevel.name)
  o.shape_key_add(name='Basis');key=o.shape_key_add(name='jawOpen')
  for v in key.data:
   v.co.y-=.015
   if row=='lower':v.co.z-=.022
# Model metadata remains explicit about what the single photo can reconstruct.
head['source']='Reconstructed from user photo with FaceBuilder; 51 FACS blendshapes'
rig['version']='Reference woman v1';rig['limitations']='Body and hair are authored approximations; single frontal photo does not supply side/back appearance.'
sc=bpy.context.scene;sc.render.fps=30;sc.render.engine='CYCLES';sc.cycles.samples=32
sc.render.resolution_x=800;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX';sc.render.image_settings.file_format='PNG'
# Replace old oversized-head framing with natural portrait framing.
cd=bpy.data.cameras.new('Reference portrait camera');cam=bpy.data.objects.new('Reference portrait camera',cd);sc.collection.objects.link(cam);sc.camera=cam;cam.location=(0,-1.33,1.65);cam.rotation_euler=(Vector((0,0,1.55))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=63
for tr in rig.animation_data.nla_tracks:tr.mute=True
sc.frame_set(1)
# Retain the editable original modifiers in the .blend file.
bpy.ops.wm.save_as_mainfile(filepath=str(P/'AI-Mentor-Reference-Woman.blend'))
sc.render.filepath=str(P/'portrait-preview.png');bpy.ops.render.render(write_still=True)
for ob in col.objects:
 if ob.type=='MESH' and ob.data.shape_keys and ob.data.shape_keys.key_blocks.get('jawOpen'):ob.data.shape_keys.key_blocks['jawOpen'].value=.45
head.data.shape_keys.key_blocks['mouthFunnel'].value=.2
sc.render.filepath=str(P/'speech-preview.png');bpy.ops.render.render(write_still=True)
for ob in col.objects:
 if ob.type=='MESH' and ob.data.shape_keys:
  for k in ob.data.shape_keys.key_blocks:k.value=0
# Export non-destructive copy of the saved scene with required mesh modifiers applied.
for ob in list(col.objects):
 if ob.type!='MESH':continue
 bpy.context.view_layer.objects.active=ob
 for mo in list(ob.modifiers):
  if mo.type!='ARMATURE':
   if ob.data.shape_keys:ob.modifiers.remove(mo)
   else:bpy.ops.object.modifier_apply(modifier=mo.name)
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT')
for ob in col.objects:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(P/'reference-woman.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_morph=True,export_yup=True)
print('AVATAR_EXPORTED',flush=True)
