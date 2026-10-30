import * as THREE from "three";
import { ease, mix } from "./signingMotion";

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const skin=new THREE.MeshStandardMaterial({color:0xd9a585,roughness:.64});
const jacket=new THREE.MeshStandardMaterial({color:0x385c74,roughness:.88});
const shirt=new THREE.MeshStandardMaterial({color:0xf4ead6,roughness:.85});
const hair=new THREE.MeshStandardMaterial({color:0x352b28,roughness:.83});
const gold=new THREE.MeshStandardMaterial({color:0xc9a56a,metalness:.55,roughness:.38});
// Materials belong to each instance: disposal never affects a later remount.
export function buildMentor3D() {
  const mats={skin:skin.clone(),jacket:jacket.clone(),shirt:shirt.clone(),hair:hair.clone(),gold:gold.clone()};
  const root=new THREE.Group();
  const sphere=new THREE.SphereGeometry(1,28,20);
  function ellipsoid(parent:THREE.Object3D,material:THREE.Material,position:number[],scale:number[]) {
    const mesh=new THREE.Mesh(sphere,material);mesh.position.fromArray(position);mesh.scale.fromArray(scale);parent.add(mesh);return mesh;
  }
  function tube(parent:THREE.Object3D,points:THREE.Vector3[],radius:number,material:THREE.Material) {
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,radius,8,false),material);parent.add(mesh);
    for(const point of [points[0],points[points.length-1]])ellipsoid(parent,material,point.toArray(),[radius,radius,radius]);
    return mesh;
  }
  function segment(parent:THREE.Object3D,length:number,radius:number,material:THREE.Material,overlap=false) {
    const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,Math.max(.001,overlap?length:length-2*radius),5,12),material);mesh.position.y=length/2;parent.add(mesh);return mesh;
  }
  const torso=new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(.24,.65),new THREE.Vector2(.28,.7),new THREE.Vector2(.29,.92),
    new THREE.Vector2(.33,1.2),new THREE.Vector2(.36,1.38),new THREE.Vector2(.32,1.48),new THREE.Vector2(.12,1.54),
  ],40),mats.jacket);torso.scale.z=.62;root.add(torso);
  const profile=[[.65,.24],[.7,.28],[.92,.29],[1.2,.33],[1.38,.36],[1.48,.32],[1.54,.12]];
  function clothZ(x:number,y:number){
    const i=Math.max(1,profile.findIndex(p=>p[0]>=Math.min(1.54,y)));
    const a=profile[i-1],b=profile[i],r=mix(a[1],b[1],THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1));
    return Math.sqrt(Math.max(.001,r*r-x*x))*.62;
  }
  const clothPositions:number[]=[],clothIndices:number[]=[];
  for(let row=0;row<=32;row++)for(let col=0;col<=14;col++){
    const y=mix(.69,1.535,row/32);
    const width=y>1.39?mix(.20,.105,(y-1.39)/.145):mix(.16,.20,(y-.69)/.7);
    const x=mix(-width,width,col/14);clothPositions.push(x,y,clothZ(x,y)+.008);
    if(row<32&&col<14){const i=row*15+col;clothIndices.push(i,i+1,i+15,i+1,i+16,i+15);}
  }
  const cloth=new THREE.BufferGeometry();cloth.setAttribute("position",new THREE.Float32BufferAttribute(clothPositions,3));cloth.setIndex(clothIndices);cloth.computeVertexNormals();
  root.add(new THREE.Mesh(cloth,mats.shirt));
  const lapelMat=new THREE.MeshStandardMaterial({color:0x5b7c91,roughness:.85});
  for(const side of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(side*.12,1.52);shape.lineTo(side*.28,1.38);shape.lineTo(side*.22,1.28);shape.lineTo(side*.28,1.23);shape.lineTo(side*.10,.83);shape.closePath();
    const lapel=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:true,bevelSize:.008,bevelThickness:.005,bevelSegments:2,steps:1}),lapelMat);const vertices=lapel.geometry.attributes.position;
    for(let i=0;i<vertices.count;i++)vertices.setZ(i,vertices.getZ(i)+clothZ(vertices.getX(i),vertices.getY(i))+.015);
    lapel.geometry.computeVertexNormals();root.add(lapel);
  }
  for(const y of [.91,1.05,1.19])ellipsoid(root,mats.gold,[0,y,clothZ(0,y)+.018],[.009,.009,.006]);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.078,.096,.24,24),mats.skin);neck.position.set(0,1.61,0);root.add(neck);
  const head=new THREE.Group();head.position.set(0,1.7,0);root.add(head);
  ellipsoid(head,mats.hair,[0,.23,-.065],[.265,.35,.205]);
  const faceGeo=new THREE.SphereGeometry(1,40,32);
  const pos=faceGeo.attributes.position;
  for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setX(i,pos.getX(i)*(y<-.15?1-.2*(-y-.15):1));}faceGeo.computeVertexNormals();
  const face=new THREE.Mesh(faceGeo,mats.skin);face.scale.set(.227,.305,.21);face.position.y=.24;head.add(face);
  for(const side of [-1,1])ellipsoid(head,mats.skin,[side*.225,.22,0],[.035,.066,.035]);
  ellipsoid(head,mats.skin,[0,.235,.205],[.026,.062,.033]);
  ellipsoid(head,mats.skin,[0,.196,.237],[.035,.025,.027]);
  const eyeWhite=new THREE.MeshStandardMaterial({color:0xfbf7eb,roughness:.45});
  const irisMat=new THREE.MeshStandardMaterial({color:0x537b75,roughness:.48});
  const pupilMat=new THREE.MeshStandardMaterial({color:0x162326,roughness:.35});
  const eyes:THREE.Group[]=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.083,.29,.19);head.add(eye);eyes.push(eye);
    ellipsoid(eye,eyeWhite,[0,0,0],[.049,.020,.017]);
    ellipsoid(eye,irisMat,[0,0,.018],[.015,.017,.005]);
    ellipsoid(eye,pupilMat,[0,0,.024],[.0075,.011,.003]);
    ellipsoid(eye,eyeWhite,[-.004,.006,.028],[.004,.004,.002]);
    tube(head,[V(side*.035,.347,.194),V(side*.083,.358,.195),V(side*.13,.34,.18)],.006,mats.hair);
    const earring=new THREE.Mesh(new THREE.TorusGeometry(.025,.005,8,24),mats.gold);earring.position.set(side*.23,.115,.022);head.add(earring);
  }
  const lipMat=new THREE.MeshStandardMaterial({color:0xa7655c,roughness:.65});
  tube(head,[V(-.055,.115,.189),V(-.025,.108,.202),V(0,.11,.207),V(.025,.108,.202),V(.055,.115,.189)],.007,lipMat);
  tube(head,[V(-.048,.109,.192),V(0,.096,.204),V(.048,.109,.192)],.006,lipMat);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(1,32,20,0,Math.PI*2,0,1.16),mats.hair);cap.position.set(0,.25,0);cap.scale.set(.244,.32,.226);head.add(cap);
  for(const side of [-1,1])tube(head,[V(side*.20,.44,.08),V(side*.244,.3,.03),V(side*.246,.05,-.02),V(side*.21,-.035,-.035)],.042,mats.hair);
  tube(head,[V(-.11,.52,.06),V(-.01,.49,.19),V(.105,.42,.195),V(.19,.36,.13)],.035,mats.hair);
  const hairGlint=new THREE.MeshStandardMaterial({color:0x594335,roughness:.9});
  tube(head,[V(-.13,.515,.08),V(-.02,.505,.19),V(.10,.435,.21)],.005,hairGlint);

  function makeHand(side:number){
    const group=new THREE.Group();root.add(group);
    ellipsoid(group,mats.skin,[0,.055,0],[.048,.062,.027]);
    ellipsoid(group,mats.skin,[0,.012,0],[.03,.028,.025]);
    const fingers:{joints:THREE.Group[];tip:THREE.Object3D}[]=[];
    const lengths=[.086,.099,.092,.073];
    for(let i=0;i<4;i++){
      const x=side*[.031,.010,-.012,-.032][i];
      const base=new THREE.Group();base.position.set(x,.101-Math.abs(x)*.12,0);group.add(base);
      const joints=[base];const radius=i===3?.0085:.0105;
      lengths[i] && [lengths[i]*.44,lengths[i]*.32,lengths[i]*.24].forEach((length,n)=>{
        segment(joints[n],length,radius*(1-n*.12),mats.skin,true);
        const child=new THREE.Group();child.position.y=length;joints[n].add(child);joints.push(child);
      });
      fingers.push({joints:joints.slice(0,3),tip:joints[3]});
    }
    const thumbBase=new THREE.Group();thumbBase.position.set(side*.043,.029,.005);thumbBase.rotation.z=-side*.7;group.add(thumbBase);
    const thumbMid=new THREE.Group();thumbMid.position.y=.039;thumbBase.add(thumbMid);
    segment(thumbBase,.039,.014,mats.skin,true);segment(thumbMid,.032,.0115,mats.skin,true);
    const thumbTip=new THREE.Object3D();thumbTip.position.y=.032;thumbMid.add(thumbTip);
    function pose(shape:number,point:number,passive:boolean){
      fingers.forEach(({joints},i)=>{
        const curl=mix(mix(.14,(i===1&&!passive)?0:1,shape),i===0?0:1,point);
        joints[0].rotation.x=curl*1.12;joints[1].rotation.x=curl*1.28;joints[2].rotation.x=curl*.68;
        joints[0].rotation.z=side*(i-1.5)*.035*(1-curl);
      });
      const open=passive?shape:0;
      thumbBase.rotation.z=mix(-side*.22,-side*.7,open);
      thumbBase.rotation.x=mix(.85,0,open);thumbMid.rotation.x=mix(.85,0,open);
    }
    return {group,pose,fingers,thumbTip};
  }
  const right=makeHand(1),left=makeHand(-1);
  function makeArm(s:THREE.Vector3,side:number){
    const upper=new THREE.Group(),forearm=new THREE.Group();root.add(upper,forearm);
    segment(upper,.34,.068,mats.jacket);segment(forearm,.31,.048,mats.jacket);
    const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.036,.042,.04,20),mats.shirt);forearm.add(cuff);cuff.position.y=.296;
    function update(w:THREE.Vector3){
      const direction=w.clone().sub(s),distance=direction.length();const d=THREE.MathUtils.clamp(distance,.031,.649);direction.normalize();
      const a=(.34*.34-.31*.31+d*d)/(2*d),h=Math.sqrt(Math.max(0,.34*.34-a*a));
      const pole=V(side,-.8,-.15);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
      const elbow=s.clone().addScaledVector(direction,a).addScaledVector(pole,h);
      upper.position.copy(s);upper.quaternion.setFromUnitVectors(V(0,1,0),elbow.clone().sub(s).normalize());
      forearm.position.copy(elbow);forearm.quaternion.setFromUnitVectors(V(0,1,0),w.clone().sub(elbow).normalize());
    }
    return {update};
  }
  const armR=makeArm(V(-.355,1.46,0),-1),armL=makeArm(V(.355,1.46,0),1);
  // Quaternion interpolation preserves depth: the final index genuinely points along +Z.
  const restR=new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,0,Math.PI*.94));
  const restL=new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,0,-Math.PI*.94));
  const touchR=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-Math.PI/2));
  const touchL=new THREE.Quaternion();
  const forward=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));
  function update(t:number){
    const lift=ease((t-.35)/1.45)*(1-ease((t-6.2)/1.3));
    const point=ease((t-4.3)/.9)*(1-ease((t-6.2)/1.3));
    const leftLift=lift*(1-ease((t-4.3)/1));
    const shape=ease((t-1.1)/1)*(1-ease((t-4.2)/.7));
    const r=V(-.44,.87,.10).lerp(V(-.146,1.24,.435),lift);
    r.lerp(V(-.18,1.33,.48),point);
    const tap=ease((t-2.55)/.3)*(1-ease((t-2.95)/.3));r.x-=tap*.013;
    const l=V(.44,.87,.10).lerp(V(.16,1.15,.43),leftLift);
    right.group.position.copy(r);left.group.position.copy(l);
    right.group.quaternion.copy(restR).slerp(touchR,lift).slerp(forward,point);
    left.group.quaternion.copy(restL).slerp(touchL,leftLift);
    right.pose(shape,point,false);left.pose(leftLift,0,true);
    armR.update(r);armL.update(l);
    root.position.y=Math.sin(t*Math.PI/4)*.004;root.rotation.y=Math.sin(t*Math.PI/4)*.012;
    head.rotation.z=-lift*.025+point*.04;
    const blink=Math.max(0,1-Math.abs(t-1.05)/.13,1-Math.abs(t-6.9)/.13);
    eyes.forEach(eye=>eye.scale.y=1-.94*blink);
    root.updateMatrixWorld(true);
    return {
      contactDistance:right.fingers[1].tip.getWorldPosition(new THREE.Vector3()).distanceTo(left.thumbTip.getWorldPosition(new THREE.Vector3())),
      indexForward:right.fingers[0].tip.getWorldPosition(new THREE.Vector3()).sub(right.fingers[0].joints[0].getWorldPosition(new THREE.Vector3())).normalize().z,
    };
  }
  update(0);
  return {root,update};
}
