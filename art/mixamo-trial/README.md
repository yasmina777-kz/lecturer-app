# Mixamo trial — Mira

`prepare.py` exports a neutral copy of the existing avatar, without changing any platform asset. Run with Blender 4.5:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/mixamo-trial/prepare.py
```

Local outputs (ignored in Git):
- `AI-Mentor-Mira-Mixamo.fbx`: existing 64-bone skeleton, 30 finger joints, 6 meshes, textures embedded, no animation. FBX round-trip validation passed.
- `AI-Mentor-Mira-AutoRig.fbx`: neutral mesh-only fallback for Mixamo auto-rigging.
- `validation.json`: local export checks. Mixamo acceptance is not yet tested.

The next step requires the user's Adobe sign-in at https://www.mixamo.com/. Upload the rigged FBX first. Save any existing Mixamo character before replacing it: Mixamo retains only the last character. Start with a neutral standing/idle animation and inspect shoulders, wrists and fingers. Download a trial as FBX, 30 fps, without skin and without keyframe reduction when those options are available. Test the downloaded clip locally before using it in the platform.

Mixamo motions are a trial for body movement, not verified RSL gestures. Do not layer arbitrary hand/arm motion over signing or replace the sign library with generic conversational gestures. Exact hand shapes, contacts and non-manual markers still need signer review.

Adobe references:
- https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html

Source character: the existing MakeHuman CC0 Mira base; see `art/mira-blender-v2/README.txt`. No Mixamo animations have been downloaded or integrated at this stage.
