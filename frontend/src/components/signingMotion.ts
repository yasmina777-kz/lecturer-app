export const SIGN_DURATION = 8;
export type Point = { x:number; y:number };
export const mix = (a:number,b:number,t:number) => a+(b-a)*t;
export const ease = (n:number) => { const t=Math.max(0,Math.min(1,n)); return t*t*t*(10+t*(-15+6*t)); };
export const signEnvelope = (t:number) => ease((t-.35)/1.4)*(1-ease((t-6.2)/1.45));
export type SignPose = { rx:number; ry:number; lx:number; ly:number; ra:number; la:number; shape:number; thumb:number; point:number };
const rest:SignPose = {rx:157,ry:600,lx:352,ly:600,ra:168,la:172,shape:0,thumb:0,point:0};
const contact:SignPose = {rx:221,ry:473,lx:307,ly:480,ra:68,la:-7,shape:1,thumb:1,point:0};
// Holds separate the meaningful poses; continuous joint movement replaces hand-image crossfades.
const frames: {t:number;p:SignPose}[] = [
  {t:0,p:rest},{t:.35,p:rest},
  {t:1.7,p:{...contact,rx:192,ry:482,lx:316,ly:487,ra:50,shape:.65}},
  {t:2.5,p:contact},
  {t:2.85,p:{...contact,rx:211,ry:478}},
  {t:3.2,p:contact},{t:3.8,p:contact},
  {t:4.35,p:{...contact,rx:200,ry:468,lx:325,ly:503,ra:45,shape:.5,thumb:.75}},
  {t:5.2,p:{...rest,rx:222,ry:426,ra:0,point:1}},
  {t:5.95,p:{...rest,rx:222,ry:426,ra:0,point:1}},
  {t:7.5,p:rest},{t:8,p:rest},
];
export function signingPose(time:number):SignPose {
  const t=Math.max(0,Math.min(SIGN_DURATION,time));
  const i=frames.findIndex(f=>f.t>=t);
  if(i<=0) return {...frames[0].p};
  const a=frames[i-1],b=frames[i],weight=ease((t-a.t)/(b.t-a.t));
  const pose = Object.fromEntries(Object.keys(a.p).map(key=>[key,mix(a.p[key as keyof SignPose],b.p[key as keyof SignPose],weight)])) as SignPose;
  // A shallow outward arc gives the wrist room to turn before the next held pose.
  for (const side of ["r", "l"] as const) {
    const x = `${side}x` as "rx"|"lx", y = `${side}y` as "ry"|"ly";
    const dx=b.p[x]-a.p[x],dy=b.p[y]-a.p[y],distance=Math.hypot(dx,dy);
    if(distance>25) {
      const arc=Math.sin(Math.PI*weight)*Math.min(10,distance*.06)*(side==="r"?-1:1);
      pose[x]-=dy/distance*arc;pose[y]+=dx/distance*arc;
    }
  }
  return pose;
}
/** Two-bone inverse kinematics: sleeve length stays fixed as the wrist follows its arc. */
export function solveArm(shoulder:Point,wrist:Point,bend:1|-1) {
  const upper=140,lower=94,dx=wrist.x-shoulder.x,dy=wrist.y-shoulder.y;
  const distance=Math.hypot(dx,dy),d=Math.max(Math.abs(upper-lower)+.01,Math.min(upper+lower-.01,distance));
  const ux=distance>0?dx/distance:0,uy=distance>0?dy/distance:1;
  const along=(upper*upper-lower*lower+d*d)/(2*d);
  const perpendicular=Math.sqrt(Math.max(0,upper*upper-along*along));
  return {x:shoulder.x+along*ux-bend*perpendicular*uy,y:shoulder.y+along*uy+bend*perpendicular*ux};
}
