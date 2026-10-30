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

def corrected_hand_pose(entry_id,side,fade):
 correction=HAND_POSE_CORRECTIONS.get(entry_id,{}).get(side)
 if not correction:return
 if not finger_fit_rigs:init_finger_rigs()
 for name,degrees in correction.items():
  values=project_finger_values(side,name,[math.radians(x) for x in degrees])
  _,rotations=finger_chain(side,name,values)
  for j,q in enumerate(rotations,1):
   axis=finger_fit_rigs[(side,name)]['axes'][j-1]
   B(side+'Hand'+name+str(j)).rotation_quaternion=Quaternion(axis,relaxed[name][j-1]).slerp(q,fade)
 bpy.context.view_layer.update()
