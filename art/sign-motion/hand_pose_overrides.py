"""Explicit authored corrections for failed capture, never applied to other signs.

А: four fingers curl together, thumb stays alongside the index. Angles are
rig-specific pose rotations in degrees, including the rig's rest curvature.
The video remains available for linguistic review; this is a mesh/pose correction.
"""
HAND_POSE_CORRECTIONS={
 'letter-410':{'Right':{
  'Index':[70,0,70,35], 'Middle':[72,0,72,35],
  'Ring':[74,0,74,35], 'Pinky':[76,0,74,35],
  'Thumb':[-30,30,0,0],
 },'Left':{
  'Index':[18,0,22,8], 'Middle':[22,0,26,10],
  'Ring':[26,0,30,12], 'Pinky':[30,0,34,14],
  'Thumb':[0,-10,10,5],
 }}
}

def authored_finger_angles(entry_id,side,fade):
 correction=HAND_POSE_CORRECTIONS.get(entry_id,{}).get(side)
 if not correction:return
 if not finger_fit_rigs:init_finger_rigs()
 for name,degrees in correction.items():
  values=project_finger_values(side,name,[math.radians(x) for x in degrees])
  apply_finger_values(side,name,values,fade)
 bpy.context.view_layer.update()

# Reviewed against the exact catalog reference frames, not inferred from text.
# These shapes remain stable through the captured wrist motion.
REFERENCE_HAND_SHAPES={
 'word-teacher-hello':{'Left':'flat','Right':'flat'},
 'word-teacher-thanks':{'Right':'fist'},
 'word-f17a6060':{'Right':'flat'}, # Open palm throughout the Slovo greeting reference.
 'word-0cca1e04':{'Left':'point'},
 'word-8c1a7f26':{'Left':'point'},
 'word-ed66b0ff':{'Left':'flat','Right':'straight-point'},
 'word-9fcf26f7':{'Right':'thumb'},
 'word-542b93a5':{'Left':'flat-tucked'},
 'word-a8989f04':{'Left':'flat','Right':'flat'},
 'word-f1a5226d':{'Left':'flat','Right':'flat'},
}
flat_shape_cache={}

def flat_shape(side):
 if side not in flat_shape_cache:
  result={}
  forward=rest[side]['basis'].col[1]
  for name in ['Index','Middle','Ring','Pinky']:
   # Parallel, extended phalanges rather than the model's splayed rest fingers.
   result[name]=fit_finger_directions(side,name,[forward,forward,forward])
  flat_shape_cache[side]=result
 return flat_shape_cache[side]

def corrected_hand_pose(entry_id,side,fade):
 authored_finger_angles(entry_id,side,fade)
 shapes=REFERENCE_HAND_SHAPES.get(entry_id)
 if not shapes:return
 if not finger_fit_rigs:init_finger_rigs()
 shape=shapes.get(side,'relaxed')
 angles={}
 for name in finger_indices:
  if shape=='relaxed':values=[18,0,22,8] if name!='Thumb' else [0,-10,10,5]
  elif name=='Thumb' and shape in ['point','straight-point','fist']:
   angles[name]=closed_pose[side][name].copy();continue
  elif name=='Thumb':
   values={'thumb':[-30,30,0,0],'flat':[0,0,5,0],'flat-tucked':[20,35,25,15]}[shape]
  elif shape in ['point','straight-point'] and name=='Index':
   angles[name]=flat_shape(side)[name].copy()
   if shape=='point':angles[name][0]+=math.radians(55)
   continue
  elif shape.startswith('flat'):
   angles[name]=flat_shape(side)[name];continue
  else:
   angles[name]=closed_pose[side][name].copy();continue
  angles[name]=[math.radians(v) for v in values]
 for name,values in angles.items():
  values=project_finger_values(side,name,values)
  apply_finger_values(side,name,values,fade)
 bpy.context.view_layer.update()
