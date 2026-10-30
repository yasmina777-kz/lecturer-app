from pathlib import Path
import json
import av
import numpy as np
ROOT=Path(__file__).resolve().parent
report={}
for gender in ['female','male']:
 path=ROOT/f'{gender}-demo.mp4'
 with av.open(str(path)) as c:
  vs=c.streams.video[0];aud=c.streams.audio[0]
  meta={'width':vs.width,'height':vs.height,'fps':float(vs.average_rate),'videoSeconds':float(vs.duration*vs.time_base),'audioSeconds':float(aud.duration*aud.time_base),'videoCodec':vs.codec_context.name,'audioCodec':aud.codec_context.name}
 wanted={int(meta['videoSeconds']*25*p) for p in [.15,.4,.65,.85]}
 frames=[];frame_count=0
 with av.open(str(path)) as c:
  for index,frame in enumerate(c.decode(video=0)):
   frame_count+=1
   if index in wanted:frames.append(frame.to_ndarray(format='rgb24'))
 assert frame_count>100 and meta['fps']==25
 assert abs(meta['videoSeconds']-meta['audioSeconds'])<.15
 # Lip/eye animation must change actual pixels, not merely play audio over a still.
 h,w=frames[0].shape[:2]
 region=lambda a:a[h//4:3*h//4,w//4:3*w//4].astype(np.float32)
 motion=float(np.mean(np.abs(region(frames[len(frames)//3])-region(frames[2*len(frames)//3]))))
 assert motion>.5,('No visible face motion',motion)
 with av.open(str(path)) as c:
  samples=np.concatenate([f.to_ndarray().reshape(-1) for f in c.decode(audio=0)])
 rms=float(np.sqrt(np.mean(samples.astype(float)**2)))
 assert rms>.005
 meta.update(decodedFrames=frame_count,faceMotionMean=round(motion,3),audioRms=round(rms,4))
 report[gender]=meta
 (ROOT/'proofs').mkdir(exist_ok=True)
 for i,array in enumerate(frames):
  from PIL import Image
  im=Image.fromarray(array);im.thumbnail((360,480));im.save(ROOT/'proofs'/f'{gender}-frame-{i}.png')
(ROOT/'media-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
