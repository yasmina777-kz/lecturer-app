"""Local Russian lecture video renderer; audio and lip animation share one MP4 timeline."""
import argparse,os,re,subprocess,sys,json,wave,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent
TOOLS=Path.home()/'Documents/Codex/tools'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--avatar',required=True,choices=['female','male'])
parser.add_argument('--text-file',type=Path,help='UTF-8 Russian lecture text')
parser.add_argument('--audio',type=Path,help='Prepared WAV, up to 30 seconds; text synthesis is skipped')
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--enhance',action='store_true',help='GFPGAN enhancement; slower and may alter fine facial detail')
a=parser.parse_args()
if bool(a.text_file)==bool(a.audio):parser.error('Provide exactly one of --text-file and --audio')
sadtalker=Path(os.environ.get('AI_MENTOR_SADTALKER',str(TOOLS/'SadTalker')))
python=sadtalker/'.venv/bin/python'
if not python.exists():parser.error('SadTalker runtime is not installed; see README.txt')
out=a.output.expanduser().resolve()
if out.exists():parser.error('Output exists; use a new filename to keep previous work')
out.parent.mkdir(parents=True,exist_ok=True)
# Keep upstream ffmpeg paths free from spaces and shell metacharacters.
import tempfile
job=Path(tempfile.mkdtemp(prefix='lecture_',dir=ROOT));segments=[]
portrait=job/'portrait.png'
# Standard video raster preparation; keep framing and the original PNG intact.
subprocess.run([str(python),'-c',"from PIL import Image;import sys;im=Image.open(sys.argv[1]);w=min(720,im.width);im.resize((w,round(im.height*w/im.width)),Image.Resampling.LANCZOS).save(sys.argv[2])",str(ROOT/f'{a.avatar}-portrait.png'),str(portrait)],check=True)
if a.audio:
 with wave.open(str(a.audio.resolve())) as w:
  if w.getnframes()/w.getframerate()>30:parser.error('WAV is longer than 30 s; use text mode or split it into sections')
 chunks=[None]
else:
 text=a.text_file.read_text(encoding='utf-8').strip()
 if not text:parser.error('Text is empty')
 sentences=re.split(r'(?<=[.!?])\s+',text);chunks=[];chunk=''
 for sentence in sentences:
  words=sentence.split()
  for word in words:
   if len(chunk)+len(word)+1>260 and chunk:chunks.append(chunk);chunk=''
   chunk=(chunk+' '+word).strip()
  if len(chunk)>140:chunks.append(chunk);chunk=''
 if chunk:chunks.append(chunk)
for i,text in enumerate(chunks):
 clip=job/f'part_{i:03d}';clip.mkdir();wav=clip/'speech.wav'
 if a.audio:shutil.copyfile(a.audio.resolve(),wav)
 else:
  txt=clip/'speech.txt';txt.write_text(text,encoding='utf-8')
  if a.avatar=='female':cmd=['say','-v','Milena','-r','165','-f',str(txt),'-o',str(wav),'--file-format=WAVE','--data-format=LEI16@24000']
  else:
   piper=TOOLS/'piper-runtime'
   cmd=[str(piper/'bin/python'),'-m','piper','-m',str(piper/'voices/ru_RU-denis-medium.onnx'),'-i',str(txt),'-f',str(wav),'--length-scale','1.05','--sentence-silence','0.18']
  subprocess.run(cmd,check=True)
 cmd=[str(python),str(ROOT/'run_sadtalker.py'),'--driven_audio',str(wav),'--source_image',str(portrait),'--result_dir',str(clip/'render'),'--preprocess','full','--still','--size','256','--batch_size','1']
 print(f'Rendering {i+1}/{len(chunks)}',flush=True);subprocess.run(cmd,check=True)
 videos=sorted((clip/'render').glob('*.mp4'))
 if len(videos)!=1:raise RuntimeError('Expected one rendered video per section')
 if a.enhance:
  enhanced=clip/'enhanced.mp4'
  subprocess.run([str(python),str(ROOT/'enhance_video.py'),'--input',str(videos[0]),'--audio',str(wav),'--output',str(enhanced)],check=True)
  videos=[enhanced]
 with wave.open(str(wav)) as w:duration=w.getnframes()/w.getframerate()
 segments.append({'video':str(videos[0]),'text':text,'audioSeconds':duration})
ffmpeg=sadtalker/'.local-bin/ffmpeg'
concat=job/'concat.txt';concat.write_text(''.join("file '"+s['video']+"'\n" for s in segments))
subprocess.run([str(ffmpeg),'-v','error','-f','concat','-safe','0','-i',str(concat),'-vf','scale=720:-2','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(out)],check=True)
out.with_suffix('.json').write_text(json.dumps({'avatar':a.avatar,'type':'audio-driven portrait video','sourcePortrait':f'{a.avatar}-portrait.png','generator':'SadTalker','voice':('provided audio' if a.audio else ('macOS Milena' if a.avatar=='female' else 'Piper Denis')),'segments':segments,'language':'ru' if not a.audio else 'from audio'},ensure_ascii=False,indent=2))
print('Saved:',out)
