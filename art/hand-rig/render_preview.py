"""Render an actual baked grasp test, not generated video."""
from pathlib import Path
import bpy,json,math
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'art/hand-rig'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Mira-Hand-Workshop.blend'));sc=bpy.context.scene;rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
meta=json.loads((ROOT/'frontend/public/avatars/hand-workshop/grasp.json').read_text());rig.animation_data.action=bpy.data.actions['TEST • '+meta['label']];rig['controls_enabled']=0
ball=bpy.data.objects['QA • grasp sphere'];ball.hide_render=False;ball.hide_viewport=False
sc.frame_start=1;sc.frame_end=round(meta['duration']*30)+1;sc.render.fps=30
sc.camera.location=(-.1,-1.9,1.45);sc.camera.rotation_euler=(Vector((0,-.12,1.3))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=55
sc.render.resolution_x=720;sc.render.resolution_y=640;sc.render.resolution_percentage=100
sc.render.engine='CYCLES';sc.cycles.samples=4;sc.cycles.use_denoising=True
sc.render.image_settings.file_format='FFMPEG';sc.render.ffmpeg.format='MPEG4';sc.render.ffmpeg.codec='H264';sc.render.ffmpeg.constant_rate_factor='HIGH'
sc.render.filepath=str(OUT/'grasp-preview.mp4');bpy.ops.render.render(animation=True)
