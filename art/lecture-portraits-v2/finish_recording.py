"""Validate the finished Kim recording and install it in the local demo."""
from pathlib import Path
import hashlib,json,shutil,subprocess
import av,numpy as np
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
PUBLIC=PROJECT/'frontend/public/avatars/lecture-demo'
video=ROOT/'female-kim-v2.mp4'
with av.open(str(video)) as c:
 v=c.streams.video[0];a=c.streams.audio[0]
 info={'width':v.width,'height':v.height,'fps':float(v.average_rate),'videoSeconds':float(v.duration*v.time_base),'audioSeconds':float(a.duration*a.time_base)}
assert info['width']==720 and info['height']==960
assert 45.3<info['videoSeconds']<45.7
assert abs(info['videoSeconds']-info['audioSeconds'])<.15
frames=[]
with av.open(str(video)) as c:
 for i,f in enumerate(c.decode(video=0)):
  if i in [50,300,600,1000]:frames.append(f.to_ndarray(format='rgb24'))
assert len(frames)==4
from PIL import Image
(ROOT/'proofs').mkdir(exist_ok=True)
for i,f in enumerate(frames):Image.fromarray(f).resize((360,480)).save(ROOT/'proofs'/f'frame-{i}.png')
with av.open(str(video)) as c:samples=np.concatenate([f.to_ndarray().reshape(-1) for f in c.decode(audio=0)])
info['audioRms']=float(np.sqrt(np.mean(samples.astype(float)**2)))
assert info['audioRms']>.005
import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
def pcm(path):
 data=subprocess.check_output([ffmpeg,'-v','error','-i',str(path),'-vn','-ac','1','-ar','24000','-f','f32le','pipe:1'])
 return np.frombuffer(data,dtype=np.float32)
source_audio=pcm(ROOT/'kim.wav');output_audio=pcm(video)
length=min(len(source_audio),len(output_audio))
info['sourceAudioCorrelation']=float(np.corrcoef(source_audio[:length],output_audio[:length])[0,1])
assert info['sourceAudioCorrelation']>.97, 'Output audio differs from supplied recording'
male_hash=hashlib.sha256((PUBLIC/'male-demo.mp4').read_bytes()).hexdigest()
assert male_hash==json.loads((ROOT/'source.json').read_text())['maleSha256']
info['maleUnchanged']=True
(ROOT/'media-validation.json').write_text(json.dumps(info,indent=2))
# A distinct filename ensures a browser does not reuse the previous female clip.
shutil.copy2(video,PUBLIC/video.name)
shutil.copy2(video,PUBLIC/'female-demo.mp4')
print(json.dumps(info,indent=2))
