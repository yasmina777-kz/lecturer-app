"""New procedural vertex paint for the supplied texture-less mesh (linear RGB).
This does not restore the missing original skin/wardrobe texture maps.
"""
import bpy, math

def apply_colors(mesh):
    mat=bpy.data.materials.new('Woman 01 • navy wardrobe');mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.72
    old=mesh.data.color_attributes.get('Wardrobe')
    if old:mesh.data.color_attributes.remove(old)
    attr=mesh.data.color_attributes.new(name='Wardrobe',type='FLOAT_COLOR',domain='POINT')
    skin=(.48,.265,.17);hair=(.025,.012,.007);jacket=(.025,.060,.105)
    pants=(.058,.08,.105);shirt=(.21,.26,.29);shoe=(.018,.022,.029)
    def smooth(a,b,v):
        t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
    def mix(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
    def ellipse(x,z,cx,cz,rx,rz):return ((x-cx)/rx)**2+((z-cz)/rz)**2
    for v in mesh.data.vertices:
        x,y,z=v.co;ax=abs(x);c=jacket
        if z<.14:c=shoe
        elif z<1.015:c=pants
        elif ax<.105 and y<-.065 and z<1.21:c=shirt
        if ax>.555 and z>1.13:c=mix(c,skin,smooth(.555,.57,ax))
        # Neck and face, keeping the collar and shoulders in jacket fabric.
        neck=1-smooth(.045,.051,ax)
        if 1.36<z<1.415:c=mix(c,skin,neck*smooth(1.36,1.38,z))
        if z>=1.415:
            c=skin
            # Follow the front face outline; the outside includes the loose curls.
            if z<1.48:limit=.054
            elif z<1.52:limit=.054-(z-1.48)*.15
            elif z<1.57:limit=.048-(z-1.52)*.28
            else:limit=.034-(z-1.57)*.3
            h=max(smooth(limit,limit+.005,ax),smooth(1.583,1.592,z),smooth(.005,.025,y))
            c=mix(c,hair,h)
            if y<-.035 and h<.1:
                # Small facial details are paint only; no change to facial geometry.
                eye=ellipse(ax,z,.028,1.522,.014,.0042)
                c=mix(c,(.42,.40,.35),1-smooth(.65,1.15,eye))
                iris=ellipse(ax,z,.028,1.522,.0065,.005)
                c=mix(c,(.07,.032,.013),1-smooth(.6,1.05,iris))
                pupil=ellipse(ax,z,.028,1.522,.0032,.004)
                c=mix(c,(.008,.006,.005),1-smooth(.65,1.1,pupil))
                brow=ellipse(ax,z,.030,1.534,.015,.0022)
                c=mix(c,hair,(1-smooth(.55,1.1,brow))*.8)
                lip=ellipse(x,z,0,1.457,.015,.0045)
                c=mix(c,(.30,.095,.070),(1-smooth(.4,1.3,lip))*.85)
        attr.data[v.index].color=(*c,1)
    mesh.data.color_attributes.active_color=attr
    n=mat.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Wardrobe'
    mat.node_tree.links.new(n.outputs['Color'],bs.inputs['Base Color'])
    mesh.data.materials.clear();mesh.data.materials.append(mat)
    for p in mesh.data.polygons:p.material_index=0
