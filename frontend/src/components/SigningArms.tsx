import { mix, signingPose, solveArm, type Point } from "./signingMotion";
export { SIGN_DURATION, signEnvelope } from "./signingMotion";

const radians=(n:number)=>n*Math.PI/180;
const next=(p:Point,length:number,angle:number):Point=>({x:p.x+Math.sin(radians(angle))*length,y:p.y-Math.cos(radians(angle))*length});

/** Every finger has three joints. Their geometry bends continuously, never dissolves between images. */
function Hand({skin,shape,thumb,point=0,mirror=1,closed=false,guides=false}:{skin:string;shape:number;thumb:number;point?:number;mirror?:number;closed?:boolean;guides?:boolean}) {
  const fingers=[[-13,30,8],[-4,36,8.6],[5,33,8],[13,25,7]];
  const drawFinger = ([x,length,width]:number[],i:number) => {
      const isMiddle=i===1,isIndex=i===0;
      const curl=mix(mix(.12,isMiddle&&!closed?0:.92,shape),isIndex?0:.95,point);
      const foreshorten=mix(1,.42,curl)*(isIndex?mix(1,.42,point):1);
      const base={x:isIndex?mix(x,0,point):x,y:-33+Math.abs(x)*.15};
      const spread=mix((i-1.5)*mix(3,1,shape),180,isIndex?point:0);
      const p1=next(base,length*.43*foreshorten,spread+curl*25);
      const p2=next(p1,length*.33*foreshorten,spread+curl*110);
      const p3=next(p2,length*.24*foreshorten,spread+curl*165);
      const d=`M${base.x} ${base.y} Q${p1.x} ${p1.y} ${(p1.x+p2.x)/2} ${(p1.y+p2.y)/2} Q${p2.x} ${p2.y} ${p3.x} ${p3.y}`;
      return <g key={i}>
        <path d={d} fill="none" stroke="#b58167" strokeWidth={width+1.8}/>
        <path d={d} fill="none" stroke={guides && !closed && ((isMiddle && shape>.8) || (isIndex && point>.8)) ? "#4196ba" : skin} strokeWidth={width}/>
        <path d={`M${p1.x-2} ${p1.y+1}l4 .5`} fill="none" stroke="#b58167" strokeWidth=".8" opacity=".65"/>
        <ellipse cx={p3.x} cy={p3.y} rx={width*mix(.27,.64,isIndex?point:0)} ry={mix(Math.max(1.6,3*(1-curl)),5,isIndex?point:0)} fill={guides && isIndex && point>.8 ? "#82c6df" : "#f5cfb6"} stroke="#b58167" strokeWidth={isIndex?point*.8:0} opacity=".9"/>
      </g>;
    };
  // As the index turns towards the viewer it occludes the palm rather than pointing upwards.
  const indexInFront = point>.25;
  return <g transform={`scale(${mirror*.85} .85)`} strokeLinecap="round" strokeLinejoin="round">
    {fingers.map((finger,i)=>indexInFront && i===0 ? null : drawFinger(finger,i))}
    <path d="M-12 6Q-15-5-18-19L-17-31Q-4-37 16-31L18-16Q18-5 12 6Z" fill={skin} stroke="#b58167" strokeWidth="1.2"/>
    {/* Thumb has its own two joints and opens separately from the fingers. */}
    <path d={`M-12-9Q${mix(-26,-28,thumb)} ${mix(-15,-26,thumb)} ${mix(-16,-31,thumb)} ${mix(-27,-40,thumb)}`} fill="none" stroke="#b58167" strokeWidth="11"/>
    <path d={`M-12-9Q${mix(-26,-28,thumb)} ${mix(-15,-26,thumb)} ${mix(-16,-31,thumb)} ${mix(-27,-40,thumb)}`} fill="none" stroke={guides && closed && thumb>.8 ? "#b17a2f" : skin} strokeWidth="8.6"/>
    <path d="M-8-14Q-3-22 9-19M-7-4Q1-9 10-7" fill="none" stroke="#be8d72" strokeWidth="1" opacity=".55"/>
    {indexInFront && drawFinger(fingers[0],0)}
  </g>;
}

/** VOG «Поговорим», 00:18–00:20. A slowed 2D study, still requiring RSL signer review.
 * https://www.youtube.com/watch?v=XhfuzmNWmGA&t=17s
 */
export function SigningArms({time,skin,jacket,guides=false}:{time:number;skin:string;jacket:string;guides?:boolean}) {
  const p=signingPose(time);
  const arm=(s:Point,w:Point,bend:1|-1)=>{
    const e=solveArm(s,w,bend),dx=w.x-e.x,dy=w.y-e.y,length=Math.hypot(dx,dy);
    const ux=dx/length,uy=dy/length,angle=Math.atan2(dy,dx)*180/Math.PI;
    return <g strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${s.x} ${s.y}L${e.x} ${e.y}`} fill="none" stroke="#263f54" strokeWidth="44"/>
      <path d={`M${s.x} ${s.y}L${e.x} ${e.y}`} fill="none" stroke={jacket} strokeWidth="40"/>
      <path d={`M${e.x} ${e.y}L${w.x-ux*8} ${w.y-uy*8}`} fill="none" stroke="#263f54" strokeWidth="36"/>
      <path d={`M${e.x} ${e.y}L${w.x-ux*8} ${w.y-uy*8}`} fill="none" stroke={jacket} strokeWidth="32"/>
      <path d={`M${e.x-uy*9} ${e.y+ux*9}L${w.x-ux*28-uy*7} ${w.y-uy*28+ux*7}`} fill="none" stroke="#9cb4c3" strokeWidth="1.3" opacity=".25"/>
      <g transform={`translate(${w.x} ${w.y}) rotate(${angle})`}>
        <path d="M-19-14L-3-12 4-10V10L-3 12-19 14Z" fill="#fff2dc"/>
        <path d="M-3-10H9V10H-3Z" fill={skin}/>
        <circle cx="-28" cy="-7" r="2" fill="#d9bc81"/>
      </g>
    </g>;
  };
  return <g>
    {arm({x:335,y:385},{x:p.lx,y:p.ly},-1)}
    <g transform={`translate(${p.lx} ${p.ly}) rotate(${p.la})`}><Hand skin={skin} shape={p.thumb} thumb={p.thumb} closed guides={guides}/></g>
    {arm({x:178,y:385},{x:p.rx,y:p.ry},1)}
    <g transform={`translate(${p.rx} ${p.ry}) rotate(${p.ra}) scale(${1+p.point*.12})`}><Hand skin={skin} shape={p.shape} thumb={0} point={p.point} guides={guides}/></g>
    {guides && p.shape>.8 && <g strokeLinecap="round">
      <path d="M204 413L242 453M316 415L291 459" fill="none" stroke="#fff9ec" strokeWidth="3"/>
      <path d="M204 413L242 453" fill="none" stroke="#287da2" strokeWidth="1.3"/>
      <path d="M316 415L291 459" fill="none" stroke="#9c6420" strokeWidth="1.3"/>
      <circle cx="204" cy="413" r="10" fill="#287da2" stroke="#fff9ec" strokeWidth="1.5"/>
      <circle cx="316" cy="415" r="10" fill="#9c6420" stroke="#fff9ec" strokeWidth="1.5"/>
      <text x="204" y="416.7" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">1</text>
      <text x="316" y="418.7" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">2</text>
    </g>}
    {guides && p.point>.8 && <g>
      <path d="M264 376L222 408" fill="none" stroke="#287da2" strokeWidth="1.5"/>
      <circle cx="264" cy="376" r="10" fill="#287da2" stroke="#fff9ec" strokeWidth="1.5"/>
      <text x="264" y="379.7" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">1</text>
    </g>}
  </g>;
}
