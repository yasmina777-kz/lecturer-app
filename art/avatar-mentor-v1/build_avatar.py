"""AI Mentor: original, fully modeled stylized teacher. Run with Blender 4.5 LTS."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi
OUT = Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(.18,.18,.18)
scene.view_settings.view_transform='AgX'
character=bpy.data.collections.new('MENTOR • character');scene.collection.children.link(character)
studio=bpy.data.collections.new('STUDIO • excluded from GLB');scene.collection.children.link(studio)
def move(o,col=character):
 for c in list(o.users_collection): c.objects.unlink(o)
 col.objects.link(o);return o

def mat(n,color,rough=.45,metal=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 return m
skin=mat('Skin • warm peach',(.64,.36,.23),.48)
skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.07
lip=mat('Lips • muted rose',(.42,.12,.105),.43)
inside=mat('Mouth • interior',(.07,.018,.025),.65)
hair=mat('Hair • espresso chestnut',(.045,.022,.014),.48)
hairlight=mat('Hair • warm strands',(.070,.034,.020),.5)
hairdark=mat('Hair • deep strands',(.037,.014,.009),.4)
coat=mat('Blazer • slate blue',(.115,.21,.30),.73)
lapel=mat('Lapel • steel blue',(.17,.28,.38),.63)
seam=mat('Seams • blue grey',(.08,.145,.205),.8)
shirt=mat('Top • warm ivory',(.83,.80,.70),.85)
pants=mat('Trousers • graphite blue',(.065,.12,.18),.78)
shoe=mat('Loafers • charcoal',(.028,.037,.043),.38)
sole=mat('Soles',(.017,.021,.025),.65)
frames=mat('Glasses • graphite',(.04,.052,.061),.28,.55)
gold=mat('Hardware • satin nickel',(.52,.59,.62),.3,.7)
white=mat('Eyes • ivory',(.90,.91,.85),.25)
iris=mat('Iris • hazel',(.16,.075,.035),.3)
pupil=mat('Pupil',(.008,.009,.01),.2)
objects=[]; bindings={}; shape_objects=[]

def finish(o,name,m,bone='head',smooth=True):
 o.name=name;move(o);o.data.materials.append(m)
 if smooth:
  for p in o.data.polygons:p.use_smooth=True
 if bone:bindings[o.name]=bone
 objects.append(o);return o

def mesh(name,verts,faces,m,bone='head',sub=0):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);character.objects.link(o)
 o.data.materials.append(m)
 for p in d.polygons:p.use_smooth=True
 if sub:
  mod=o.modifiers.new('Surface polish','SUBSURF');mod.levels=sub;mod.render_levels=sub
 if bone:bindings[o.name]=bone
 objects.append(o);return o

def uv(name,loc,scale,m,bone='head',segments=40,rings=24):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
 o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,m,bone)

def curve(name,pts,radius,m,bone='head',radii=None):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=12;d.bevel_depth=radius;d.bevel_resolution=3
 s=d.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for i,(p,co) in enumerate(zip(s.bezier_points,pts)):
  p.co=co;p.handle_left_type=p.handle_right_type='AUTO'
  if radii:p.radius=radii[i]
 o=bpy.data.objects.new(name,d);character.objects.link(o);d.materials.append(m)
 bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
 if bone:bindings[o.name]=bone
 for p in o.data.polygons:p.use_smooth=True
 objects.append(o);return o

def tube(name,points,radii,m,bone,segments=20):
 # Support loops keep cloth cuffs and limb ends from shrinking into gaps.
 p0=Vector(points[0]);p1=Vector(points[1]);pn=Vector(points[-1]);pp=Vector(points[-2])
 points=[points[0],tuple(p0.lerp(p1,.06))]+points[1:-1]+[tuple(pn.lerp(pp,.08)),points[-1]]
 radii=[radii[0],radii[0]]+radii[1:-1]+[radii[-1],radii[-1]]
 vs=[];fs=[]
 for i,p in enumerate(points):
  tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  tangent.normalize();ref=Vector((0,1,0));u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
  rx,ry=radii[i] if isinstance(radii[i],tuple) else (radii[i],radii[i])
  for j in range(segments):
   a=2*pi*j/segments;co=Vector(p)+u*(rx*cos(a))+v*(ry*sin(a));vs.append(tuple(co))
 for i in range(len(points)-1):
  for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;fs.append((a,b,b+segments,a+segments))
 fs.append(tuple(reversed(range(segments))));fs.append(tuple((len(points)-1)*segments+j for j in range(segments)))
 return mesh(name,vs,fs,m,bone,1)

def rings(name,rows,m,bone,segments=48,sub=1):
 vs=[];fs=[]
 for z,rx,ry,cy in rows:
  for j in range(segments):
   a=2*pi*j/segments;vs.append((rx*sin(a),cy-ry*cos(a),z))
 for i in range(len(rows)-1):
  for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;fs.append((a,b,b+segments,a+segments))
 fs.extend([tuple(reversed(range(segments))),tuple((len(rows)-1)*segments+j for j in range(segments))])
 return mesh(name,vs,fs,m,bone,sub)

# Torso: clothed body, shaped waist and blazer silhouette. Feet to crown: 1.86m.
rings('Body • ivory knit',[ (1.00,.12,.08,0),(1.05,.135,.09,0),(1.18,.115,.075,0),(1.32,.155,.094,0),(1.40,.18,.072,0),(1.435,.073,.056,0)],shirt,'spine',sub=2)
rings('Neck',[(1.36,.055,.049,0),(1.42,.049,.045,0),(1.51,.052,.049,0)],skin,'neck',sub=2)
# Blazer is an open shell; fronts flank the ivory shirt.
rows=[(1.035,.16,.094),(1.07,.162,.095),(1.18,.133,.087),(1.32,.174,.105),(1.395,.201,.076),(1.425,.12,.063)]
vs=[];fs=[];n=54
for z,rx,ry in rows:
 for j in range(n):
  a=.39+(2*pi-.78)*j/(n-1);vs.append((rx*sin(a),-ry*cos(a),z))
for i in range(len(rows)-1):
 for j in range(n-1):a=i*n+j;fs.append((a,a+1,a+n+1,a+n))
blazer=mesh('Blazer • open tailored jacket',vs,fs,coat,'spine',2)
sol=blazer.modifiers.new('Cloth thickness','SOLIDIFY');sol.thickness=.006
for side in [-1,1]:
 def pts(a):return [(side*x,y,z) for x,y,z in a]
 # Folded lapel planes with distinct notches.
 o=mesh('Lapel '+str(side),pts([(.061,-.067,1.43),(.146,-.08,1.388),(.115,-.109,1.332),(.145,-.108,1.319),(.047,-.102,1.19),(.077,-.096,1.326)]),[(0,1,2,3,4,5)],lapel,'spine')
 so=o.modifiers.new('Fold thickness','SOLIDIFY');so.thickness=.007
 be=o.modifiers.new('Soft edges','BEVEL');be.width=.003;be.segments=3
 curve('Pocket welt '+str(side),pts([(.082,-.092,1.115),(.115,-.083,1.11),(.144,-.065,1.105)]),.004,lapel,'spine')
 curve('Jacket shaping seam '+str(side),pts([(.15,-.061,1.36),(.112,-.075,1.25),(.107,-.074,1.17),(.132,-.075,1.06)]),.0014,seam,'spine')
uv('Blazer button',(.066,-.102,1.192),(.009,.004,.009),gold,'spine',24,12)
# Pelvis and trousers.
rings('Trousers • waistband',[(.935,.12,.071,0),(.96,.148,.087,0),(1.045,.141,.081,0),(1.056,.135,.078,0)],pants,'hips',sub=2)
curve('Belt seam',[(-.135,-.018,1.047),(-.08,-.076,1.047),(0,-.084,1.047),(.08,-.076,1.047),(.135,-.018,1.047)],.0025,seam,'hips')
# Limbs slightly away from the body in a relaxed rest pose.
for side,suffix in [(-1,'R'),(1,'L')]:
 x=lambda a:side*a
 hip=(x(.083),0,.99);knee=(x(.092),-.008,.57);ankle=(x(.095),0,.13)
 tube('Trouser leg.'+suffix,[hip,(x(.085),0,.87),(x(.09),-.007,.68),knee,(x(.095),.012,.40),(x(.095),0,.16),(x(.095),0,.13)],[(.083,.085),(.077,.079),(.062,.065),(.056,.059),(.052,.053),(.045,.049),(.045,.049)],pants,'leg.'+suffix)
 curve('Trouser crease.'+suffix,[(x(.086),-.081,.90),(x(.09),-.067,.7),(x(.094),-.057,.49),(x(.095),-.047,.18)],.0012,seam,'leg.'+suffix)
 uv('Shoe sole.'+suffix,(x(.095),-.035,.052),(.059,.114,.026),sole,'foot.'+suffix)
 uv('Loafer.'+suffix,(x(.095),-.033,.084),(.057,.105,.047),shoe,'foot.'+suffix)
 curve('Shoe strap.'+suffix,[(x(.049),-.064,.107),(x(.095),-.075,.125),(x(.14),-.064,.107)],.005,shoe,'foot.'+suffix)
 curve('Shoe hardware.'+suffix,[(x(.077),-.075,.126),(x(.113),-.075,.126)],.0028,gold,'foot.'+suffix)
 shoulder=(x(.185),0,1.375);elbow=(x(.265),-.015,1.15);wrist=(x(.305),-.052,.95)
 tube('Blazer sleeve.'+suffix,[(x(.145),0,1.385),shoulder,(x(.211),0,1.34),(x(.245),-.01,1.23),elbow,(x(.285),-.03,1.06),wrist],[(.060,.058),(.071,.069),(.066,.066),(.055,.057),(.05,.053),(.045,.046),(.036,.04)],coat,'arm.'+suffix)
 tube('Ivory cuff.'+suffix,[(x(.305),-.052,.965),(x(.308),-.055,.931)],[(.033,.036),(.033,.036)],shirt,'forearm.'+suffix)
 uv('Palm.'+suffix,(x(.316),-.059,.892),(.035,.024,.052),skin,'hand.'+suffix)
 # Four individually posed fingers and a thumb; one deform bone per digit.
 for j in range(4):
  fx=x(.293+j*.015);top=.879;length=[.061,.075,.071,.055][j]
  tube('Finger%d.%s'%(j+1,suffix),[(fx,-.064,top),(fx+x(.005),-.067,top-length*.5),(fx+x(.005),-.062,top-length*.91),(fx+x(.005),-.060,top-length)],[(.009,.009),(.009,.009),(.007,.007),(.003,.003)],skin,'finger%d.%s'%(j+1,suffix),12)
 tube('Thumb.'+suffix,[(x(.289),-.06,.918),(x(.274),-.072,.893),(x(.277),-.081,.872),(x(.282),-.081,.867)],[.014,.012,.009,.003],skin,'thumb.'+suffix,14)

# Sculpted head from smoothly varying cross sections, with jaw, cheeks and forehead.
head=rings('Face • sculpted base',[(1.466,.026,.032,-.012),(1.482,.068,.061,-.015),(1.515,.104,.082,-.012),(1.56,.137,.105,0),(1.62,.154,.12,.002),(1.69,.154,.124,.004),(1.76,.145,.118,.01),(1.81,.11,.092,.014),(1.837,.04,.039,.017),(1.841,.005,.006,.017)],skin,'head',64,2)
for side in [-1,1]:
 uv('Ear '+str(side),(side*.151,.003,1.634),(.024,.018,.045),skin)
 uv('Ear inner '+str(side),(side*.16,-.012,1.635),(.011,.004,.025),lip,segments=24,rings=16)
 # Fine hoop earrings.
 pts=[(side*(.161+.012*cos(2*pi*j/32)),-.005,1.587+.017*sin(2*pi*j/32)) for j in range(33)]
 curve('Silver earring '+str(side),pts,.0025,gold)
# Nose bridge and soft tip: volumetric, no painted facial features.
uv('Nose bridge',(0,-.117,1.641),(.018,.026,.043),skin)
uv('Nose tip',(0,-.145,1.614),(.024,.028,.018),skin)
for side in [-1,1]:
 uv('Nose wing '+str(side),(side*.018,-.136,1.608),(.012,.014,.01),skin,segments=24,rings=16)
 uv('Nostril '+str(side),(side*.014,-.150,1.603),(.005,.003,.0028),inside,segments=20,rings=12)
# Eyes and blend shapes. Eye detail collapses behind the lid on Blink.
blink=[]
for side in [-1,1]:
 ex=side*.067;ez=1.677
 eye=uv('Eye white '+str(side),(ex,-.113,ez),(.038,.017,.018),white)
 ir=uv('Iris '+str(side),(ex,-.130,ez),(.014,.004,.015),iris)
 pu=uv('Pupil '+str(side),(ex,-.134,ez),(.0065,.002,.008),pupil,segments=28,rings=16)
 gl=uv('Catchlight '+str(side),(ex-.004,-.136,ez+.005),(.003,.0015,.003),white,segments=16,rings=10)
 for ob in [eye,ir,pu,gl]:
  ob.shape_key_add(name='Basis');key=ob.shape_key_add(name='Blink')
  for v in key.data:v.co.z*=.055
  blink.append(ob);shape_objects.append(ob)
 for upper in [True,False]:
  points=[]
  for j in range(13):
   t=pi*j/12;points.append((ex+.038*cos(t),-.126-.005*sin(t),ez+(1 if upper else -1)*.018*sin(t)))
  lid=curve(('Upper' if upper else 'Lower')+' eyelid '+str(side),points,.0032,skin)
  if upper:
   lash=curve('Upper lash '+str(side),[(x,y-.002,z+.001) for x,y,z in points],.0014,hairdark)
  for ob in ([lid,lash] if upper else [lid]):
   ob.shape_key_add(name='Basis');key=ob.shape_key_add(name='Blink')
   for v in key.data:v.co.z=ez+(v.co.z-ez)*.055
   blink.append(ob);shape_objects.append(ob)
 curve('Brow '+str(side),[(ex-side*.043,-.105,1.718),(ex-side*.016,-.119,1.729),(ex+side*.012,-.115,1.728),(ex+side*.039,-.098,1.717)],.006,hair,'head',radii=[.6,1.05,.9,.25])

# Actual lip surface and mouth cavity, both with a reusable jaw-open morph.
vs=[];fs=[];count=48
for ring in [0,1]:
 for j in range(count):
  a=2*pi*j/count;xx=.033*cos(a);z=1.571+.005*(xx/.033)**2 + (.006 if ring==0 else .0015)*sin(a)
  vs.append((xx,-.116-(.005 if ring==0 else .006),z))
for j in range(count):fs.append((j,(j+1)%count,count+(j+1)%count,count+j))
lips=mesh('Lips • speech morph',vs,fs,lip,'head',1)
lips.shape_key_add(name='Basis');key=lips.shape_key_add(name='MouthOpen')
for i,v in enumerate(key.data):
 a=2*pi*(i%count)/count;v.co.z+=.009*sin(a)-.008;v.co.y-=.001
shape_objects.append(lips)
mouth=uv('Mouth cavity',(0,-.121,1.573),(.032,.003,.0024),inside,segments=40,rings=20)
mouth.shape_key_add(name='Basis');key=mouth.shape_key_add(name='MouthOpen')
for v in key.data:v.co.z=v.co.z*5-.008
shape_objects.append(mouth)
# Glasses: softly rounded rims, bridge, temples, nickel hinges.
for side in [-1,1]:
 ex=side*.069;points=[]
 for j in range(65):
  a=2*pi*j/64;points.append((ex+.052*cos(a),-.150+.008*abs(cos(a)),1.674+.037*sin(a)))
 curve('Glasses rim '+str(side),points,.0038,frames)
 curve('Glasses temple '+str(side),[(side*.119,-.142,1.682),(side*.157,-.085,1.69),(side*.163,.018,1.674),(side*.153,.038,1.654)],.0033,frames)
 uv('Glasses hinge '+str(side),(side*.12,-.140,1.683),(.006,.004,.003),gold,segments=20,rings=10)
curve('Glasses bridge',[(-.018,-.149,1.682),(0,-.158,1.693),(.018,-.149,1.682)],.003,frames)

# Closed scalp cap, longer at sides/back, shorter across the forehead.
vs=[];fs=[];nr=25;ns=80
for i in range(nr):
 for j in range(ns):
  phi=2*pi*j/ns;transition=max(0,min(1,(.65-cos(phi))/.45));transition=transition*transition*(3-2*transition);theta_end=1.10+1.55*transition
  theta=.012+(theta_end-.012)*i/(nr-1)
  width=.172*(1+.025*sin(phi*3+theta*2))
  radial=sin(theta) if theta<=pi/2 else 1-.06*(theta-pi/2)
  z=1.673+.197*cos(theta) if theta<=pi/2 else 1.673-.21*(theta-pi/2)
  yy=.014-.145*radial*cos(phi)
  vs.append((width*radial*sin(phi),yy,z))
for i in range(nr-1):
 for j in range(ns):a=i*ns+j;b=i*ns+(j+1)%ns;fs.append((a,b,b+ns,a+ns))
cap=mesh('Hair • scalp and bob shell',vs,fs,hair,'head',1)
solid=cap.modifiers.new('Hair body','SOLIDIFY');solid.thickness=.01
# Curved locks sweep from side part over the forehead and around temples.
for side in [-1,1]:
 for k in range(6):
  d=k*.007
  if side==-1:
   pts=[(.044-d,-.019,1.86),(-.045-d,-.108,1.84),(-.118-d*.6,-.128,1.755),(-.151-d*.35,-.089,1.65),(-.151-d*.3,-.036,1.51),(-.126-d*.3,-.02,1.445)]
  else:
   pts=[(.046+d*.3,-.023,1.853),(.107+d*.3,-.088,1.804),(.154+d*.3,-.063,1.715),(.171+d*.15,-.015,1.59),(.166+d*.3,.018,1.48),(.133+d*.35,.027,1.446)]
  curve('Hair lock %d %d'%(side,k),pts,.013 if k%2==0 else .01,hair if k%3 else hairlight,radii=[.25,1,1,.9,.75,.08])
# Back strands follow the bob volume and prevent a helmet-like flat finish.
for j in range(17):
 a=pi*.5+pi*j/16
 points=[]
 for q in range(7):
  theta=.38+2.11*q/6
  radial=sin(theta) if theta<=pi/2 else 1-.06*(theta-pi/2)
  z=1.673+.2*cos(theta) if theta<=pi/2 else 1.673-.21*(theta-pi/2)
  points.append((.177*radial*sin(a),.014-.151*radial*cos(a),z))
 curve('Hair back strand %02d'%j,points,.006,hairlight if j%3==0 else hairdark,radii=[.15,.6,1,1,.8,.6,.06])

# Weld the trouser waist and both legs into a continuous cloth volume.
parts=[o for o in objects if o.name=='Trousers • waistband' or o.name.startswith('Trouser leg.')]
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:
 bpy.context.view_layer.objects.active=ob
 for mod in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 ob.select_set(True)
for ob in parts:objects.remove(ob);bindings.pop(ob.name,None)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();trousers=bpy.context.object;trousers.name='Trousers • continuous tailored mesh'
mod=trousers.modifiers.new('Weld seams','REMESH');mod.mode='VOXEL';mod.voxel_size=.0035;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=trousers.modifiers.new('Cloth relax','SMOOTH');mod.factor=1;mod.iterations=20;bpy.ops.object.modifier_apply(modifier=mod.name)
for poly in trousers.data.polygons:poly.use_smooth=True
objects.append(trousers);bindings[trousers.name]='trousers'

# Armature: named deform bones, weighted meshes and independent fingers.
bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0));rig=bpy.context.object;rig.name='AI_Mentor_Rig';move(rig)
arm=rig.data;arm.name='Mentor humanoid skeleton';arm.edit_bones.remove(arm.edit_bones[0])
def bone(n,h,t,parent=None):
 b=arm.edit_bones.new(n);b.head=h;b.tail=t
 if parent:b.parent=arm.edit_bones[parent]
 return b
bone('root',(0,0,.03),(0,0,.20))
bone('hips',(0,0,.94),(0,0,1.07),'root');bone('spine',(0,0,1.07),(0,0,1.39),'hips')
bone('neck',(0,0,1.39),(0,0,1.51),'spine');bone('head',(0,0,1.51),(0,0,1.82),'neck')
for side,s in [(-1,'R'),(1,'L')]:
 x=lambda a:side*a
 bone('clavicle.'+s,(0,0,1.37),(x(.185),0,1.375),'spine')
 bone('arm.'+s,(x(.185),0,1.375),(x(.265),-.015,1.15),'clavicle.'+s)
 bone('forearm.'+s,(x(.265),-.015,1.15),(x(.305),-.052,.95),'arm.'+s)
 bone('hand.'+s,(x(.305),-.052,.95),(x(.316),-.059,.88),'forearm.'+s)
 for j in range(4):
  fx=x(.293+j*.015);le=[.061,.075,.071,.055][j]
  bone('finger%d.%s'%(j+1,s),(fx,-.064,.879),(fx+x(.005),-.06,.879-le),'hand.'+s)
 bone('thumb.'+s,(x(.289),-.06,.918),(x(.28),-.081,.868),'hand.'+s)
 bone('leg.'+s,(x(.083),0,.99),(x(.092),-.008,.57),'hips')
 bone('shin.'+s,(x(.092),-.008,.57),(x(.095),0,.13),'leg.'+s)
 bone('foot.'+s,(x(.095),0,.13),(x(.095),-.13,.065),'shin.'+s)
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True;arm.display_type='OCTAHEDRAL'
for o in objects:
 if o.name not in bindings:continue
 bn=bindings[o.name];o.parent=rig
 if bn=='trousers':
  gs={n:o.vertex_groups.new(name=n) for n in ['hips','leg.R','leg.L','shin.R','shin.L']}
  for v in o.data.vertices:
   co=o.matrix_world@v.co;suffix='R' if co.x<0 else 'L'
   wh=max(0,min(1,(co.z-.94)/.09));ws=max(0,min(1,(.62-co.z)/.10))
   for name,w in [('hips',wh),('leg.'+suffix,(1-wh)*(1-ws)),('shin.'+suffix,(1-wh)*ws)]:
    if w>0:gs[name].add([v.index],w,'REPLACE')
  mod=o.modifiers.new('Mentor skeleton','ARMATURE');mod.object=rig
  continue
 # Smooth blend around elbows and knees, rather than rigid separate segments.
 groups={bn:o.vertex_groups.new(name=bn)}
 other=None;center=0;span=0
 if bn.startswith('arm.'):
  other=bn.replace('arm.','forearm.');center=1.15;span=.10
 elif bn.startswith('leg.'):
  other=bn.replace('leg.','shin.');center=.57;span=.10
 if other:groups[other]=o.vertex_groups.new(name=other)
 for v in o.data.vertices:
  z=(o.matrix_world@v.co).z
  w=max(0,min(1,(center+span/2-z)/span)) if other else 0
  if 1-w>0:groups[bn].add([v.index],1-w,'REPLACE')
  if w>0:groups[other].add([v.index],w,'REPLACE')
 mod=o.modifiers.new('Mentor skeleton','ARMATURE');mod.object=rig
 # Deform the coarse cage before subdivision.
 bpy.context.view_layer.objects.active=o
 while o.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)

# Animation clips. NLA names carry through to GLB.
scene.render.fps=30

def push_action(owner,name,start=1):
 act=owner.animation_data.action;act.name=name
 track=owner.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,start,act);strip.name=name;strip.extrapolation='NOTHING'
 owner.animation_data.action=None
 return act

def pose_reset():
 for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0)

def animate(name,length,poses):
 pose_reset()
 for fr,rots in poses:
  for bn,rot in rots.items():rig.pose.bones[bn].rotation_euler=tuple(math.radians(v) for v in rot)
  for bn in ['spine','neck','head','arm.R','forearm.R','hand.R','arm.L','forearm.L','hand.L']:
   rig.pose.bones[bn].keyframe_insert('rotation_euler',frame=fr)
 push_action(rig,name)
 for tr in rig.animation_data.nla_tracks:tr.mute=True
animate('Idle',120,[(1,{}),(30,{'spine':(1.0,0,.4),'head':(0,2,1)}),(60,{'spine':(0,0,0),'head':(0,-1,-.6)}),(90,{'spine':(-.7,0,-.3),'head':(1,-2,0)}),(120,{'spine':(0,0,0),'head':(0,0,0)})])
animate('Greeting',90,[(1,{}),(20,{'arm.R':(-12,0,40),'forearm.R':(-15,0,95),'hand.R':(0,0,8),'head':(0,0,-4)}),(33,{'hand.R':(0,0,-15)}),(45,{'hand.R':(0,0,15)}),(57,{'hand.R':(0,0,-15)}),(68,{'hand.R':(0,0,10)}),(90,{'arm.R':(0,0,0),'forearm.R':(0,0,0),'hand.R':(0,0,0),'head':(0,0,0)})])
animate('Explain',120,[(1,{}),(30,{'arm.L':(-10,0,-14),'forearm.L':(-55,0,-16),'head':(2,0,-2)}),(65,{'forearm.L':(-45,0,-20),'hand.L':(0,10,0),'head':(-1,0,2)}),(90,{'forearm.L':(-50,0,-10),'head':(1,0,-1)}),(120,{'arm.L':(0,0,0),'forearm.L':(0,0,0),'hand.L':(0,0,0),'head':(0,0,0)})])
for o in blink:
 keys=o.data.shape_keys;k=keys.key_blocks['Blink']
 for f,v in [(1,0),(47,0),(50,1),(53,0),(120,0)]:k.value=v;k.keyframe_insert('value',frame=f)
 push_action(keys,'Idle')
 for track in keys.animation_data.nla_tracks:track.mute=True
for o in [lips,mouth]:
 keys=o.data.shape_keys;k=keys.key_blocks['MouthOpen']
 for f,v in [(1,0),(5,.7),(10,.2),(14,1),(19,.1),(24,.6),(29,0),(34,.8),(39,.25),(44,.55),(49,0),(54,.7),(60,0)]:k.value=v;k.keyframe_insert('value',frame=f)
 push_action(keys,'Talk')
 for track in keys.animation_data.nla_tracks:track.mute=True
# Export with all named clips enabled; NLA grouping merges Blink into Idle.
for owner in [rig]+[o.data.shape_keys for o in shape_objects]:
 if owner.animation_data:
  for track in owner.animation_data.nla_tracks:track.mute=False
pose_reset();scene.frame_set(1)
rig['README']='AI Mentor | stylized teacher. NLA: Idle / Greeting / Explain. Shape keys: Blink / MouthOpen. Talk is illustrative, not audio-synchronized.'
rig['Height_m']=1.87
bpy.ops.object.select_all(action='DESELECT')
for o in list(character.objects):o.select_set(True)
bpy.context.view_layer.objects.active=rig
# GLB is exported from the saved scene below, baking geometry without losing morphs.
# Keep a calm idle loop active when the Blender file is opened.
for owner in [rig]+[o.data.shape_keys for o in shape_objects]:
 if owner.animation_data:
  for tr in owner.animation_data.nla_tracks:tr.mute=tr.name!='Idle'
scene.frame_start=1;scene.frame_end=120;scene.frame_set(1)

# Studio stage, soft portrait lighting and two saved cameras.
stage=mat('Studio • pale stone',(.57,.63,.68),.88)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.018));floor=bpy.context.object;floor.name='Studio floor';move(floor,studio);floor.data.materials.append(stage)
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.38,depth=.045,location=(0,0,.005));plinth=bpy.context.object;plinth.name='Display plinth';move(plinth,studio);plinth.data.materials.append(mat('Plinth',(.22,.29,.35),.6));be=plinth.modifiers.new('Soft rim','BEVEL');be.width=.012;be.segments=4

def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,pos,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;move(o,studio);o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,1.1))
area('Key softbox',(-3,-4,5),450,4,(1,.88,.77));area('Fill softbox',(3,-2,3),250,3,(.76,.85,1));area('Hair rim',(1,2,4),500,3,(1,.94,.86))
def camera(name,pos,at,scale):
 bpy.ops.object.camera_add(location=pos);o=bpy.context.object;o.name=name;move(o,studio);o.data.type='ORTHO';o.data.ortho_scale=scale;o.data.lens=70;aim(o,at);return o
full=camera('Camera • full body',(2.4,-7,2.8),(0,0,.98),2.25)
portrait=camera('Camera • portrait',(.7,-4,1.95),(0,-.015,1.61),.74)
scene.camera=full
# Model opens in a useful solid/material preview with rig selected, not a default cube.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':
   a.spaces.active.region_3d.view_distance=3.2;a.spaces.active.region_3d.view_location=(0,0,1)
   a.spaces.active.region_3d.view_rotation=full.rotation_euler.to_quaternion();a.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'AI-Mentor-Teacher-v1.blend'))
import subprocess
subprocess.run([bpy.app.binary_path,'--background','--python',str(OUT/'export_glb.py')],check=True)
# Validation metadata is generated from the scene itself.
report={'meshes':len(objects),'vertices':sum(len(o.data.vertices) for o in objects),'bones':len(rig.data.bones),'shapeKeys':sorted({k.name for o in shape_objects for k in o.data.shape_keys.key_blocks}),'riggedMeshes':sum(any(m.type=='ARMATURE' for m in o.modifiers) for o in objects),'animations':['Idle','Greeting','Explain','Talk'],'heightMeters':1.87}
(OUT/'model-report.json').write_text(json.dumps(report,indent=2))
scene.render.filepath=str(OUT/'preview-full.png');bpy.ops.render.render(write_still=True)
scene.camera=portrait;scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.filepath=str(OUT/'preview-portrait.png');bpy.ops.render.render(write_still=True)
scene.camera=full;full.location=(-2.4,6,2.8);aim(full,(0,0,.98));scene.render.resolution_x=1000;scene.render.resolution_y=1300;scene.render.filepath=str(OUT/'preview-back.png');bpy.ops.render.render(write_still=True)
print('AVATAR COMPLETE',json.dumps(report))
