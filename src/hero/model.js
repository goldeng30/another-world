// 주인공(한도윤) 모델: Tripo 모델 + Mixamo 뼈대 · 피부 질감 · 눈(얼굴 면에만 눈 그림 투영)
import { T } from '../core/math.js';
import { CONFIG } from '../config.js';
import { PATH, loadGLTF, loadTex } from '../core/assets.js';

export async function loadHeroModel(ENV_K) {
  const [gltf, baseTex, nrmTex, eyeTex] = await Promise.all([loadGLTF(PATH.hero + 'doyun.glb'), loadTex(PATH.hero + 'doyun_base.webp'), loadTex(PATH.hero + 'doyun_nrm.webp'), loadTex(PATH.hero + 'doyun_eyes.webp')]);
  baseTex.encoding = T.sRGBEncoding; baseTex.anisotropy = 8; eyeTex.encoding = T.sRGBEncoding; eyeTex.anisotropy = 8; eyeTex.wrapS = eyeTex.wrapT = T.ClampToEdgeWrapping;
  const root = gltf.scene;
  let sm = null; root.traverse(o => { if (o.isSkinnedMesh && !sm) sm = o; });
  sm.material = new T.MeshStandardMaterial({ map: baseTex, normalMap: nrmTex, color: new T.Color(...CONFIG.heroTint), roughness: 0.88, metalness: 0.0, envMapIntensity: (ENV_K || 0.3) * 2, skinning: true });   // 동굴 톤 색 · 주변 환경빛은 소품과 비슷하게
  // 눈: 얼굴 면(_eyew)에만 정면 투영으로 선명한 눈 그림을 얹고, 눈 뜬 자리는 반짝이게 (쉬는 자세 기준 좌표라 동작해도 따라감)
  const EYE = { SX: -0.064805, HY: 91.273994, CXR: -1.79, CXL: 1.51, CY: -1.47, XI: -0.72, YI: -0.18, XO: 1.0, YO: 0.13, UP: 0.28, LO: 0.27, PU: 0.8, MX: 0.0, MY: -4.45 };
  sm.material.customProgramCacheKey = () => 'hero-eyes';
  if (sm.geometry.attributes._eyew) sm.material.onBeforeCompile = sh => {
    sh.uniforms.eyeMap = { value: eyeTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float _eyew; varying float vEyeW; varying vec2 vFace;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n  vEyeW = _eyew; { vec4 bp = bindMatrix * vec4(position, 1.0); vFace = vec2(bp.x - (${EYE.SX.toFixed(6)}), bp.z - (${EYE.HY.toFixed(6)})); }`);
    const F = x => x.toFixed(4);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D eyeMap; varying float vEyeW; varying vec2 vFace; float eyeA = 0.0, eyeG = 0.0;
float eyeIn(vec2 q) { float t = (q.x - (${F(EYE.XI)})) / (${F(EYE.XO - EYE.XI)}); if (t <= 0.0 || t >= 1.0) return 0.0; float base = ${F(EYE.YI)} + ${F(EYE.YO - EYE.YI)} * t, sn = max(0.0, sin(3.14159265 * t));
  float yu = base + ${F(EYE.UP)} * pow(sn, ${F(EYE.PU)}), yl = base - ${F(EYE.LO)} * sn; return smoothstep(0.0, 0.03, min(yu - q.y, q.y - yl)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  { float side = vFace.x < ${F((EYE.CXR + EYE.CXL) / 2)} ? -1.0 : 1.0; vec2 q = vec2(side * (vFace.x - (side < 0.0 ? ${F(EYE.CXR)} : ${F(EYE.CXL)})), vFace.y - (${F(EYE.CY)}));
    vec2 euv = vec2(clamp((q.x + 1.1) / 2.6, 0.0, 1.0) * 0.5 + (side < 0.0 ? 0.0 : 0.5), 0.5 + 0.5 * clamp((q.y + 1.3) / 2.6, 0.0, 1.0));
    vec4 et = mapTexelToLinear(texture2D(eyeMap, euv)); float inb = step(-1.1, q.x) * step(q.x, 1.5) * step(-1.3, q.y) * step(q.y, 1.3) * vEyeW;
    eyeA = et.a * inb; diffuseColor.rgb = mix(diffuseColor.rgb, et.rgb, eyeA); eyeG = eyeIn(q) * inb;
    vec2 m = vec2(vFace.x - (${F(EYE.MX)}), vFace.y - (${F(EYE.MY)})); vec2 muv = vec2(clamp((m.x + 1.6) / 3.2, 0.0, 1.0), 0.5 * clamp((m.y + 0.8) / 1.6, 0.0, 1.0));
    vec4 mt = mapTexelToLinear(texture2D(eyeMap, muv)); float inm = step(-1.6, m.x) * step(m.x, 1.6) * step(-0.8, m.y) * step(m.y, 0.8) * vEyeW; diffuseColor.rgb = mix(diffuseColor.rgb, mt.rgb, mt.a * inm); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.2, eyeG);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(mix(normal, geometryNormal, max(eyeA, eyeG)));');
  };
  sm.frustumCulled = false; sm.castShadow = true; sm.receiveShadow = true;
  const isRig = o => /^mixamorig/.test(o.name), B = {}; root.traverse(o => { if (isRig(o)) B[o.name.replace(/^mixamorig:?/, '')] = o; });   // 끝마디(…4, _End)는 Bone이 아닌 빈 노드로 온다
  const hips = B.Hips;
  return { gltf, root, sm, B, hips };
}
