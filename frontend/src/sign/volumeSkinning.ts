import * as THREE from "three";

// Dual-quaternion skinning keeps joint volume under forearm/finger rotation.
// Mira's deform transforms are rigid (unit bone scales); do not use on squash/stretch rigs.
const helpers = /* glsl */ `
#ifdef USE_SKINNING
vec4 mentorQuat(mat4 b) {
  mat3 m = mat3(b);
  float tr = m[0][0] + m[1][1] + m[2][2];
  vec4 q;
  if (tr > 0.0) {
    float s = sqrt(tr + 1.0) * 2.0;
    q = vec4((m[1][2]-m[2][1])/s, (m[2][0]-m[0][2])/s, (m[0][1]-m[1][0])/s, .25*s);
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    float s = sqrt(max(.000001,1.0+m[0][0]-m[1][1]-m[2][2]))*2.0;
    q = vec4(.25*s,(m[1][0]+m[0][1])/s,(m[2][0]+m[0][2])/s,(m[1][2]-m[2][1])/s);
  } else if (m[1][1] > m[2][2]) {
    float s = sqrt(max(.000001,1.0+m[1][1]-m[0][0]-m[2][2]))*2.0;
    q = vec4((m[1][0]+m[0][1])/s,.25*s,(m[2][1]+m[1][2])/s,(m[2][0]-m[0][2])/s);
  } else {
    float s = sqrt(max(.000001,1.0+m[2][2]-m[0][0]-m[1][1]))*2.0;
    q = vec4((m[2][0]+m[0][2])/s,(m[2][1]+m[1][2])/s,.25*s,(m[0][1]-m[1][0])/s);
  }
  return normalize(q);
}
vec4 mentorDual(mat4 m, vec4 q) {
  vec3 t=m[3].xyz;
  return .5*vec4(q.w*t+cross(t,q.xyz),-dot(t,q.xyz));
}
vec3 mentorRotate(vec4 q, vec3 p) {
  return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);
}
#endif
`;
const blend = /* glsl */ `
#ifdef USE_SKINNING
vec4 mx=mentorQuat(boneMatX), my=mentorQuat(boneMatY), mz=mentorQuat(boneMatZ), mw=mentorQuat(boneMatW);
vec4 ref=mx;
float largest=skinWeight.x;
if(skinWeight.y>largest){ref=my;largest=skinWeight.y;}
if(skinWeight.z>largest){ref=mz;largest=skinWeight.z;}
if(skinWeight.w>largest){ref=mw;}
vec4 weights=skinWeight*vec4(dot(ref,mx)<0.0?-1.0:1.0,dot(ref,my)<0.0?-1.0:1.0,dot(ref,mz)<0.0?-1.0:1.0,dot(ref,mw)<0.0?-1.0:1.0);
vec4 mentorReal=mx*weights.x+my*weights.y+mz*weights.z+mw*weights.w;
vec4 mentorD=mentorDual(boneMatX,mx)*weights.x+mentorDual(boneMatY,my)*weights.y+mentorDual(boneMatZ,mz)*weights.z+mentorDual(boneMatW,mw)*weights.w;
float magnitude=max(length(mentorReal),.000001);
mentorReal/=magnitude;
mentorD/=magnitude;
mentorD-=mentorReal*dot(mentorReal,mentorD);
#endif
`;
const position = /* glsl */ `
#ifdef USE_SKINNING
vec3 mentorPosition=(bindMatrix*vec4(transformed,1.0)).xyz;
vec3 mentorTranslation=2.0*(mentorReal.w*mentorD.xyz-mentorD.w*mentorReal.xyz+cross(mentorReal.xyz,mentorD.xyz));
transformed=(bindMatrixInverse*vec4(mentorRotate(mentorReal,mentorPosition)+mentorTranslation,1.0)).xyz;
#endif
`;
const normal = /* glsl */ `
#ifdef USE_SKINNING
objectNormal=(bindMatrixInverse*vec4(mentorRotate(mentorReal,(bindMatrix*vec4(objectNormal,0.0)).xyz),0.0)).xyz;
#ifdef USE_TANGENT
objectTangent=(bindMatrixInverse*vec4(mentorRotate(mentorReal,(bindMatrix*vec4(objectTangent,0.0)).xyz),0.0)).xyz;
#endif
#endif
`;
export function volumeShader(source: string) {
  return source
    .replace(
      "#include <skinning_pars_vertex>",
      "#include <skinning_pars_vertex>\n" + helpers,
    )
    .replace(
      "#include <skinbase_vertex>",
      "#include <skinbase_vertex>\n" + blend,
    )
    .replace("#include <skinning_vertex>", position)
    .replace("#include <skinnormal_vertex>", normal);
}
function patch(material: THREE.Material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = volumeShader(shader.vertexShader);
  };
  material.customProgramCacheKey = () => "mentor-volume-skinning-v1";
}
export function preserveJointVolume(mesh: THREE.SkinnedMesh) {
  (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
    patch,
  );
  const surface = (
    Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  ) as THREE.MeshStandardMaterial;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: surface.map,
    alphaMap: surface.alphaMap,
    alphaTest: surface.alphaTest,
  });
  patch(mesh.customDepthMaterial);
}
