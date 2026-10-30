"""Memory-bounded 720px portrait enhancement; keeps the original audio timeline."""
from pathlib import Path
import os,sys,argparse,subprocess,tempfile,time
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--audio',type=Path);a=p.parse_args()
source=a.input.resolve();out=a.output.resolve();audio=(a.audio or source).resolve()
if out.exists():raise FileExistsError(out)
runtime=Path(os.environ.get('AI_MENTOR_SADTALKER',str(Path.home()/'Documents/Codex/tools/SadTalker')))
os.chdir(runtime);os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK','1')
import torch,torchvision.transforms.functional as F
sys.modules.setdefault('torchvision.transforms.functional_tensor',F)
import cv2
from gfpgan import GFPGANer
import imageio_ffmpeg
torch.set_num_threads(4);cv2.setNumThreads(2)
restorer=GFPGANer(model_path=str(runtime/'gfpgan/weights/GFPGANv1.4.pth'),upscale=1,arch='clean',channel_multiplier=2,bg_upsampler=None,device=torch.device('mps' if torch.backends.mps.is_available() else 'cpu'))
cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS);total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));writer=None;index=0;start=time.monotonic()
with tempfile.TemporaryDirectory(prefix='enhance_',dir=out.parent) as tmp:
 tmpvideo=Path(tmp)/'silent.mp4'
 while True:
  ok,frame=cap.read()
  if not ok:break
  w=720;h=round(frame.shape[0]*w/frame.shape[1]/2)*2
  frame=cv2.resize(frame,(w,h),interpolation=cv2.INTER_AREA)
  _,_,restored=restorer.enhance(frame,has_aligned=False,only_center_face=True,paste_back=True)
  if writer is None:writer=cv2.VideoWriter(str(tmpvideo),cv2.VideoWriter_fourcc(*'mp4v'),fps,(w,h))
  writer.write(restored);index+=1
  if index==1 or index%25==0:print(index,'/',total,'frames',round(time.monotonic()-start,1),'s',flush=True)
 cap.release()
 if writer is None:raise RuntimeError('Empty input video')
 writer.release()
 subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(tmpvideo),'-i',str(audio),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(out)],check=True)
print('Saved',out,flush=True)
