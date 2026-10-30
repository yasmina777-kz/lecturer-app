from pathlib import Path
import os,time,subprocess,sys
root=Path(__file__).resolve().parent
pid=75520
print('Waiting for face rendering',flush=True)
while True:
 try:os.kill(pid,0)
 except ProcessLookupError:break
 time.sleep(5)
videos=sorted((root/'render').glob('*.mp4'))
if len(videos)!=1:raise RuntimeError('Renderer did not produce exactly one finished video; see render.log')
print('Enhancing finished video',flush=True)
subprocess.run([sys.executable,str(root/'enhance_video.py'),'--input',str(videos[0]),'--audio',str(root/'kim.wav'),'--output',str(root/'female-kim-v2.mp4')],check=True)
print('Validating audio and video',flush=True)
subprocess.run([sys.executable,str(root/'finish_recording.py')],check=True)
print('READY',flush=True)
