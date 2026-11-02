"""Reproducible one-reference capture -> Blender bake -> exported-motion check.

Run with ml/rsl/.venv/bin/python ml/rsl/build_reference_motion.py word-f17a6060.
This adapts motion with pretrained tracking; it does not train an RSL translator.
Publish only after visual review against the source recording.
"""
import argparse, json, subprocess, tempfile
from pathlib import Path
from capture_motion import capture, entries

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('id')
parser.add_argument('--blender',default='/Applications/Blender.app/Contents/MacOS/Blender')
args=parser.parse_args()
entry=next((e for e in entries() if e['id']==args.id),None)
if entry is None:raise SystemExit('Unknown reference ID')
print(capture(entry),flush=True)
out=ROOT/'frontend/public/avatars/sign-motion'
def blender(script,*options):
 subprocess.run([args.blender,'-b','--python-exit-code','1','--python',str(ROOT/'art/sign-motion'/script),'--',*options],cwd=ROOT,check=True)
metadata=out/(args.id+'.json')
previous_stamp=metadata.stat().st_mtime_ns if metadata.exists() else None
blender('retarget.py',args.id)
if not metadata.exists() or metadata.stat().st_mtime_ns==previous_stamp:raise SystemExit('No new export; tracking coverage may not have passed the gate')
with tempfile.TemporaryDirectory(prefix='mentor-reference-') as folder:
 stage=Path(folder)
 (stage/'catalog.json').write_text(json.dumps([json.loads((out/(args.id+'.json')).read_text())]))
 for name in [args.id+'.glb',args.id+'.json','ready-idle.glb','ready-idle.json']:(stage/name).symlink_to(out/name)
 blender('clear_body.py','input='+folder,args.id)
 # The original pre-anatomy rest anchor prevents applying arm correction twice.
 blender('bake_arm_anatomy.py','input='+folder,'anchor='+str(ROOT/'art/sign-motion/retarget-rest-anchor.glb'),args.id)
report=ROOT/'ml/rsl/data/motion'/(args.id+'-verification.json')
blender('verify_body_clearance.py',args.id,'anatomy','report='+str(report))
print('Export verified. Compare visually before publishing:',report)
