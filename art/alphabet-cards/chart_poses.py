"""Hand-authored chart-based study, not a trained or linguistically certified model.
Values: MCP flexion, spread, PIP, DIP (degrees); thumb adds opposition.
Dynamic arrows are explicit paths rather than noisy inferred finger movement.
"""
# Name the extended fingers. All others start in the shared closed-hand pose.
CHART = {
 'А':('fist','','up',''), 'Б':('point','Index','up','circle'),
 'В':('open','Index Middle Ring Pinky','up',''),
 'Г':('L','Index','down',''), 'Д':('point','Index Middle','up','arc'),
 'Е':('pinch','','up',''), 'Ж':('flat-pinch','','up',''),
 'З':('hook','Index','up','circle'), 'И':('point','Index Pinky','up',''),
 'Й':('point','Index Pinky','up','side'), 'К':('point','Index Middle','up','side'),
 'Л':('point','Index Middle','down',''), 'М':('point','Index Middle Ring','down',''),
 'Н':('point','Index Middle Pinky','up',''),
 'О':('ring','Middle Ring Pinky','up',''), 'П':('point','Index Middle','down',''),
 'Р':('cross','Index Middle','up',''), 'С':('cup','','up',''),
 'Т':('point','Index Middle Ring','down',''), 'У':('L','Pinky','side',''),
 'Ф':('flat-pinch','','up',''), 'Х':('hook','Index','up',''),
 'Ц':('point','Index Middle','up','down'), 'Ч':('pinch','','up',''),
 'Ш':('point','Index Middle Ring','up',''), 'Щ':('point','Index Middle Ring','up','down'),
 'Ъ':('L','Index','side','arc'), 'Ы':('point','Index Pinky','up','arc'),
 'Ь':('L','Index','up','side'), 'Э':('small-cup','Index','up',''),
 'Ю':('ring','','up',''), 'Я':('bent-two','','up',''),
}

def chart_hand(letter,side='Right'):
 shape,extended,orientation,movement=CHART[letter]
 values={n:(v.copy() if n=='Thumb' else [math.radians(x) for x in [86,0,92,42]]) for n,v in closed_pose[side].items()}
 for n in extended.split():values[n]=open_pose[side][n].copy()
 if shape=='open':
  direction=(rest[side]['basis'].col[0]+rest[side]['basis'].col[1]*.4).normalized()
  values['Thumb']=fit_finger_directions(side,'Thumb',[direction]*3)
 elif shape in ['fist','L']:
  # Thumb lies alongside the fist for А; L-shapes use abduction.
  direction=rest[side]['basis'].col[1] if shape=='fist' else rest[side]['basis'].col[0]
  values['Thumb']=fit_finger_directions(side,'Thumb',[direction]*3)
 elif shape in ['ring','pinch']:
  values.update({n:pinch_pose[side][n].copy() for n in ['Thumb','Index']})
 elif shape in ['cup','small-cup']:
  names=['Index','Middle','Ring','Pinky'] if shape=='cup' else ['Index']
  for n in names:values[n]=[math.radians(v) for v in [35,0,35,12]]
  direction=rest[side]['basis'].col[0]
  values['Thumb']=fit_finger_directions(side,'Thumb',[direction]*3)
 elif shape=='flat-pinch':
  for n in ['Index','Middle','Ring','Pinky']:
   values[n]=open_pose[side][n].copy();values[n][0]+=math.radians(65)
  values['Thumb']=pinch_pose[side]['Thumb'].copy()
 elif shape=='bent-two':
  for n in ['Index','Middle']:
   values[n]=open_pose[side][n].copy();values[n][0]+=math.radians(60)
  values['Thumb']=fit_finger_directions(side,'Thumb',[rest[side]['basis'].col[0]]*3)
 elif shape=='hook':values['Index']=[math.radians(v) for v in [8,0,78,25]]
 if letter in ['Л','М']:
  values['Index'][1]+=math.radians(-10);values['Middle'][1]+=math.radians(4)
  if letter=='М':values['Ring'][1]+=math.radians(10)
 if shape=='cross':
  values['Index'][1]+=math.radians(10);values['Middle'][1]-=math.radians(10)
 if shape=='flat-pinch':
  target=finger_points(side,'Index',values['Index'])[-1]
  def cost(v):return ((finger_points(side,'Thumb',v['Thumb'])[-1]-target).length-.012)**2
  values.update(minimize(values,cost,side,['Thumb']))
 if shape=='fist':
  target=finger_points(side,'Index',values['Index'])[0]+rest[side]['basis'].col[1]*.035+rest[side]['basis'].col[0]*.017
  def cost(v):
   points=finger_points(side,'Thumb',v['Thumb'])
   direction=(points[-1]-points[-2]).normalized()
   return (points[-1]-target).length_squared + .0004*(1-direction.dot(rest[side]['basis'].col[1]))
  values.update(minimize(values,cost,side,['Thumb']))
 if shape in ['ring','pinch']:
  values['Index']=[math.radians(v) for v in [8,0,85,42]]
  target=finger_points(side,'Index',values['Index'])[-1]
  def cost(v):return ((finger_points(side,'Thumb',v['Thumb'])[-1]-target).length-.012)**2
  values.update(minimize(values,cost,side,['Thumb']))
 return {n:project_finger_values(side,n,v) for n,v in values.items()}
