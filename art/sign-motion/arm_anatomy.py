"""Align elbow hinge and forearm pronation to the actual arm plane.
Executed in the Blender rig namespace. Finger poses are retained; elbow paths and wrist orientation are constrained.
"""
def arm_frame(direction,normal):
 y=direction.normalized();z=(normal-y*normal.dot(y)).normalized();x=y.cross(z).normalized()
 return Matrix((x,y,z)).transposed().to_quaternion()

def arm_anatomy(side,apply=False,roll_hint=None,depth=0,solve=False):
 upper=B(side+'Arm');fore=B(side+'ForeArm');hand=B(side+'Hand')
 shoulder=upper.head.copy();elbow=fore.head.copy();wrist=hand.head.copy();target=hand.matrix.to_quaternion()
 # Keep the elbow below/outside the shoulder-to-wrist line. Captured depth
 # can put it on the opposite side of that line (a backwards chicken-wing).
 # A bounded blend cannot switch branches at an antipodal captured pole.
 if apply or solve:
  source_elbow=elbow.copy();wrist.y-=depth;delta=wrist-shoulder;distance=max(abs(upper.bone.length-fore.bone.length)+.02,min(delta.length,upper.bone.length+fore.bone.length-.012));axis=delta.normalized();wrist=shoulder+axis*distance
  preferred=V((.65 if side=='Left' else -.65,.08,-1));preferred-=axis*preferred.dot(axis);preferred.normalize()
  captured=source_elbow-shoulder;captured-=axis*captured.dot(axis)
  pole=preferred.lerp(captured.normalized(),.2).normalized() if captured.length>.001 else preferred
  along=(upper.bone.length**2-fore.bone.length**2+distance**2)/(2*distance)
  elbow=shoulder+axis*along+pole*math.sqrt(max(0,upper.bone.length**2-along**2))
 u=(elbow-shoulder).normalized();f=(wrist-elbow).normalized();normal=u.cross(f)
 ur=(upper.bone.tail_local-upper.bone.head_local).normalized();fr=(fore.bone.tail_local-fore.bone.head_local).normalized();nr=ur.cross(fr).normalized()
 if normal.length<.01:
  normal=upper.matrix.to_quaternion()@upper.bone.matrix_local.to_quaternion().inverted()@nr
 normal.normalize()
 uq=arm_frame(u,normal)@arm_frame(ur,nr).inverted()@upper.bone.matrix_local.to_quaternion()
 fq=arm_frame(f,normal)@arm_frame(fr,nr).inverted()@fore.bone.matrix_local.to_quaternion()
 neutral=fq@fore.bone.matrix_local.to_quaternion().inverted()@hand.bone.matrix_local.to_quaternion()
 axis=neutral.inverted()@f;relative=neutral.inverted()@target
 if relative.w<0:relative.negate()
 vector=V((relative.x,relative.y,relative.z));twist=Quaternion((relative.w,*(axis*vector.dot(axis))))
 if twist.magnitude<1e-7:twist=Quaternion()
 else:twist.normalize()
 roll=2*math.atan2(V((twist.x,twist.y,twist.z)).dot(axis),twist.w)
 roll=(roll+math.pi)%(2*math.pi)-math.pi
 if roll_hint is not None:roll=roll_hint+(roll-roll_hint+math.pi)%(2*math.pi)-math.pi
 swing=relative@twist.inverted()
 if swing.w<0:swing.negate()
 # Limits are relative to this rig's anatomical rest plane, never to a noisy
 # first sample. Retiming alone cannot repair an impossible wrist orientation.
 limited_roll=max(-math.radians(85),min(math.radians(85),roll))
 # Wrist flexion and sideways deviation are different degrees of freedom.
 # Measure in the already-pronated forearm frame, not the unrolled arm plane.
 # A circular 65-degree cone allowed an equally large sideways wrist kink.
 applied_twist=Quaternion(axis,limited_roll)
 wrist_swing=applied_twist.inverted()@swing@applied_twist
 across=hand.bone.matrix_local.to_quaternion().inverted()@(B(side+'HandIndex1').bone.head_local-B(side+'HandPinky1').bone.head_local)
 across=(across-axis*across.dot(axis)).normalized();lateral=axis.cross(across).normalized()
 vector=wrist_swing.axis*wrist_swing.angle
 flexion=vector.dot(across);deviation=vector.dot(lateral)
 envelope=math.sqrt((flexion/math.radians(60))**2+(deviation/math.radians(25))**2)
 limited_local=Quaternion().slerp(wrist_swing,min(1,1/max(envelope,1e-8)))
 limited_swing=applied_twist@limited_local@applied_twist.inverted()
 upper_error=math.degrees(upper.matrix.to_quaternion().rotation_difference(uq).angle)
 if upper_error>180:upper_error=360-upper_error
 reach=(wrist-shoulder).normalized();actual_pole=elbow-shoulder;actual_pole-=reach*actual_pole.dot(reach);preferred_pole=V((.65 if side=='Left' else -.65,.08,-1));preferred_pole-=reach*preferred_pole.dot(reach)
 pole_error=math.degrees(actual_pole.angle(preferred_pole))
 result={'elbowPoleDeviationDegrees':pole_error,'upperPlaneErrorDegrees':upper_error,'forearmRollDegrees':math.degrees(roll),'wristSwingDegrees':math.degrees(swing.angle),'wristFlexionDegrees':math.degrees(flexion),'wristDeviationDegrees':math.degrees(deviation),'wristEnvelope':envelope}
 if apply:
  put(upper,shoulder,uq)
  put(fore,elbow,Quaternion(f,limited_roll)@fq)
  for k,fraction in enumerate([0,.48,1]):put(B(side+'ForearmRoll'+str(k)),elbow,Quaternion(f,limited_roll*fraction)@fq)
  put(hand,wrist,neutral@limited_swing@Quaternion(axis,limited_roll))
 return result
