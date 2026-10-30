import bpy,math,json
from pathlib import Path
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'AI-Mentor-Reference-Woman.blend'))
sc=bpy.context.scene;rig=bpy.data.objects['AI_Mentor_Rig'];col=bpy.data.collections['MENTOR • character']
cues=json.loads((P/'kim-visemes.json').read_text())['mouthCues']
poses={'X':{},'A':{'mouthPressLeft':.35,'mouthPressRight':.35},'B':{'jawOpen':.10,'mouthStretchLeft':.12,'mouthStretchRight':.12},'C':{'jawOpen':.26,'mouthStretchLeft':.16,'mouthStretchRight':.16},'D':{'jawOpen':.42},'E':{'jawOpen':.21,'mouthFunnel':.48},'F':{'jawOpen':.10,'mouthPucker':.52},'G':{'jawOpen':.045,'mouthRollLower':.38},'H':{'jawOpen':.18}}
end=math.ceil(cues[-1]['end']*30)+1;sc.frame_start=1;sc.frame_end=end
names=set(n for d in poses.values() for n in d)|{'eyeBlinkLeft','eyeBlinkRight','browInnerUp'}
owners=[o.data.shape_keys for o in col.objects if o.type=='MESH' and o.data.shape_keys]
for owner in owners:owner.animation_data_clear()
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=None
values={n:0.0 for n in names};ci=0
for frame in range(1,end+1):
 t=(frame-1)/30
 while ci<len(cues)-1 and t>=cues[ci]['end']:ci+=1
 target=poses.get(cues[ci]['value'],{}) if t<cues[-1]['end'] else {}
 for n in names:
  wanted=target.get(n,0)
  if n.startswith('eyeBlink'):
   phase=t%4.8;wanted=max(0,math.sin((phase-4.52)/.28*math.pi)) if phase>4.52 else 0
  if n=='browInnerUp':wanted=.035*(1+math.sin(t*.7))
  values[n]+=(wanted-values[n])*(1-math.exp(-28/30))
  if frame==end:values[n]=0
 for owner in owners:
  for n in names:
   k=owner.key_blocks.get(n)
   if k:k.value=values[n];k.keyframe_insert('value',frame=frame)
 # Smooth gestures remain modest so the head/hair never snap between poses.
 env=math.sin(math.pi*min(1,t/2)) if t<1 else min(1,(end/30-t)/1.2)
 env=max(0,env)
 gest=(.5-.5*math.cos(t*.85))*env
 rotations={'spine':(.5*math.sin(t*1.2),0,.35*math.sin(t*.45)),
  'head':(.8*math.sin(t*1.1),1.8*math.sin(t*.48),.7*math.sin(t*.67)),
  'arm.L':(-6*gest,0,-10*gest),'forearm.L':(-30*gest,0,-10*gest),
  'hand.L':(0,4*math.sin(t)*gest,0),
  'arm.R':(-2*gest,0,3*gest),'forearm.R':(-9*gest,0,3*gest)}
 for name,angles in rotations.items():
  bone=rig.pose.bones[name];bone.rotation_mode='XYZ';bone.rotation_euler=[math.radians(a) for a in angles];bone.keyframe_insert('rotation_euler',frame=frame)
for owner in owners+[rig]:
 act=owner.animation_data.action;act.name='Kim facial speech' if owner!=rig else 'Kim lecture gestures'
 for fc in act.fcurves:
  for key in fc.keyframe_points:key.interpolation='LINEAR'
 track=owner.animation_data.nla_tracks.new();track.name=act.name
 strip=track.strips.new(act.name,1,act);strip.extrapolation='NOTHING';owner.animation_data.action=None
seq=sc.sequence_editor_create();strips=seq.strips if hasattr(seq,'strips') else seq.sequences
strip=strips.new_sound('Ким — original recording',str(P.parent/'lecture-portraits-v2/kim.wav'),channel=1,frame_start=1)
try:strip.sound.pack()
except AttributeError:pass
sc.sync_mode='AUDIO_SYNC';sc.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(P/'AI-Mentor-Reference-Woman.blend'))
report={'photo':'ии модель ai модель.jpg','duration_seconds':45.49,'frames':end,'fps':30,'bones':len(rig.data.bones),'face_shapes':len(bpy.data.objects['ReferenceWomanFace'].data.shape_keys.key_blocks)-1,'viseme_cues':len(cues),'speech':'Rhubarb phonetic auto-alignment with smoothed FACS mapping','limitations':['Single-view head reconstruction; unseen angles inferred','Authored approximate hair and reused clothed body','Automatic articulation needs manual refinement','No voice cloning; original Kim recording']}
(P/'avatar-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('ANIMATED_SCENE_SAVED',report,flush=True)
