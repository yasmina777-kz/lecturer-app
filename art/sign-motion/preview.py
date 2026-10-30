"""Neutral avatar thumbnail; it does not depict any dictionary sign."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];source=ROOT/'art/mira-blender-v3/animate.py';scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nface=bpy.data.objects')[0],str(source),'exec'),scope)
globals().update({k:v for k,v in scope.items() if not k.startswith('__')})
pose(0);sc.camera.location=(0,-2.0,1.40);sc.camera.rotation_euler=(V((0,-.1,1.36))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=65
sc.render.resolution_x=480;sc.render.resolution_y=360;sc.render.resolution_percentage=100;sc.render.film_transparent=True;sc.render.filepath=str(ROOT/'frontend/public/avatars/sign-motion/preview.png');bpy.ops.render.render(write_still=True)
