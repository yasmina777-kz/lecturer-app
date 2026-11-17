# «Артём» — male signing avatar (built from scratch)

`build.py` generates the whole character in Blender from code: body, limbs and
every finger phalanx as skin-modifier tubes along the bones, a solid palm
(convex hull over the knuckles and wrist), head with eyes, brows, nose, ears,
mouth and short hair, and T-shirt / jeans / shoes / skin materials.

Only the **skeleton** is reused from `frontend/public/avatars/hand-workshop/mira-rig.glb`
(70 Mixamo-named bones, identical rest pose), so all 208 existing sign clips
play on Артём unchanged. Skinning weights come from distance to bone segments,
restricted per finger chain (fingers never pull neighbours), with a rigid palm
blended at the knuckles and torso skin bound to spine/collar bones only.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/male-avatar/build.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/male-avatar/render_preview.py -- /tmp/renders
```

Output `frontend/public/avatars/male/artyom.glb` (~1.2 MB vs 20 MB for Mira).
Stylized, not photoreal; no facial animation (Jaw/Eye bones are not skinned).
Hand clearance against the new body has not been re-run through the Mira
clearance pipeline (`art/sign-motion`), which still validates Mira.
