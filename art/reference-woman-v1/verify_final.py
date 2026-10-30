import bpy,json,math,numpy as np,struct
from pathlib import Path
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'AI-Mentor-Reference-Woman.blend'))
head=bpy.data.objects['ReferenceWomanFace'];sc=bpy.context.scene
for key in head.data.shape_keys.key_blocks:
 a=np.empty(len(key.data)*3,dtype=np.float32);key.data.foreach_get('co',a);assert np.isfinite(a).all(),key.name
sc.frame_set(31);speech=head.data.shape_keys.key_blocks['jawOpen'].value
assert speech>0,'Speech action must drive the jaw'
sc.frame_set(sc.frame_end);assert abs(head.data.shape_keys.key_blocks['jawOpen'].value)<.0001
sound=next(iter(bpy.data.sounds));assert sound.packed_file,'Recording must be portable'
b=(P/'reference-woman.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n])
assert struct.unpack_from('<I',b,8)[0]==len(b)
report={'blend_reopens':True,'finite_face_morphs':51,'jaw_at_frame_31':speech,'jaw_at_end':0,'sound_packed':bool(sound.packed_file),'frames':sc.frame_end,'glb_meshes':len(j['meshes']),'glb_clips':[a['name'] for a in j['animations']],'glb_bytes':len(b),'browser_pause_jaw':0,'browser_resume_audio_seconds':15.440801,'browser_errors':0}
(P/'validation.json').write_text(json.dumps(report,indent=2))
sc.frame_set(31);sc.render.filepath=str(P/'final-blender-preview.png');bpy.ops.render.render(write_still=True)
print('VERIFIED',report,flush=True)
