"""Run upstream SadTalker in its isolated environment with modern macOS dependencies."""
from pathlib import Path
import os,sys,runpy
ROOT=Path(os.environ.get('AI_MENTOR_SADTALKER',str(Path.home()/'Documents/Codex/tools/SadTalker'))).resolve()
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK','1')
import torch,torchvision.transforms.functional as tvf
import numpy as np
from PIL import Image
import imageio_ffmpeg
# BasicSR 1.4.2 imports a torchvision module removed in torchvision 0.17.
sys.modules.setdefault('torchvision.transforms.functional_tensor',tvf)
if not hasattr(Image,'ANTIALIAS'):Image.ANTIALIAS=Image.Resampling.LANCZOS
for name,value in [('float',float),('int',int),('complex',complex)]:
 if name not in np.__dict__:setattr(np,name,value)
torch.set_num_threads(6)
torch.manual_seed(42);np.random.seed(42)
# PyTorch 2.5 supports Metal 3D convolutions but not 3D grid sampling.
# Keep only this operation on CPU, return the result to the original device.
import torch.nn.functional as F
_original_grid_sample=F.grid_sample
def metal_grid_sample(input,grid,*args,**kwargs):
 if input.device.type=='mps' and input.ndim==5:
  return _original_grid_sample(input.cpu(),grid.cpu(),*args,**kwargs).to(input.device)
 return _original_grid_sample(input,grid,*args,**kwargs)
F.grid_sample=metal_grid_sample
# The enhancement network is 2D and can run fully on Metal.
import gfpgan
_original_enhancer=gfpgan.GFPGANer.__init__
def metal_enhancer(self,*args,**kwargs):
 if torch.backends.mps.is_available():kwargs.setdefault('device',torch.device('mps'))
 _original_enhancer(self,*args,**kwargs)
gfpgan.GFPGANer.__init__=metal_enhancer
bin_dir=ROOT/'.local-bin';bin_dir.mkdir(exist_ok=True)
ffmpeg=bin_dir/'ffmpeg'
if not ffmpeg.exists():ffmpeg.symlink_to(imageio_ffmpeg.get_ffmpeg_exe())
os.environ['PATH']=str(bin_dir)+os.pathsep+os.environ['PATH']
sys.path.insert(0,str(ROOT));os.chdir(ROOT)
# NumPy >=1.24 rejects a ragged transform array in upstream face alignment.
from src.face3d.util import preprocess as align_preprocess
_original_pos=align_preprocess.POS
def scalar_translation(*args,**kwargs):
 t,s=_original_pos(*args,**kwargs)
 return np.asarray(t).reshape(-1),s
align_preprocess.POS=scalar_translation
sys.argv[0]=str(ROOT/'inference.py')
runpy.run_path(str(ROOT/'inference.py'),run_name='__main__')
