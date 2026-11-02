"""The source and target palm frames must use the same anatomical landmarks.

Run with Blender. A fingertip-based target frame used to bias every wrist by
11.6 degrees even when the source was a perfect rotated copy of the rig.
"""
from pathlib import Path
source = Path(__file__).with_name('retarget.py')
__file__ = str(source)
exec(compile(source.read_text().split('manifest=[]')[0], str(source), 'exec'), globals())
maximum = 0
cases = 0
for side in ['Left', 'Right']:
    wrist = B(side + 'Hand').bone.head_local
    forward = (B(side + 'HandMiddle1').bone.head_local - wrist).normalized()
    across = B(side + 'HandIndex1').bone.head_local - B(side + 'HandPinky1').bone.head_local
    if side == 'Left':
        across = -across
    normal = across.cross(forward).normalized()
    # Includes identity, palm-up, side view and a non-axis-aligned motion.
    for axis, angle in [((1, 0, 0), 0), ((1, 0, 0), 1.2),
                        ((0, 0, 1), -1.5), ((1, 2, 3), 2.1)]:
        expected = Quaternion(V(axis).normalized(), angle)
        observed_forward = expected @ forward
        observed_normal = expected @ normal
        actual = orient(side, observed_forward, observed_normal)
        error = math.degrees(actual.rotation_difference(expected).angle)
        maximum = max(maximum, error)
        assert error < .05, (side, axis, error)
        assert (actual @ forward).angle(observed_forward) < .001
        cases += 1
print('PALM_FRAME', cases, 'identity/rotated cases; max error', maximum, 'degrees', flush=True)
