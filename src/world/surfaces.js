// 바닥·벽·바위 표면: 사진 질감(ambientCG, CC0) · 세 방향 투영(벽·바위, 늘어짐·이음새 없이) · 축축한 곳 이끼 · 출구 굴 어둠
import { T } from '../core/math.js';
import { PATH, loadTex } from '../core/assets.js';
import { W2 } from './coords.js';

// 방 데이터의 surfaces: { floorA: 'rock062', ... } → 질감 쌍(색 c, 노멀 n). 같은 질감은 한 번만
export async function loadSurfaces(pick) { const got = {}, o = {};
  const L = (f, srgb) => loadTex(f).then(t => { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = T.sRGBEncoding; return t; }, () => null);
  const one = n => got[n] || (got[n] = Promise.all([L(PATH.textures + n + '_c.webp', true), L(PATH.textures + n + '_n.webp', false)]).then(([c, nm]) => c && nm ? { c, n: nm } : null));
  await Promise.all(Object.entries(pick).map(async ([k, n]) => { const r = await one(n); if (r) o[k] = r; })); return o; }

export function createSurfaces(W) {
  const { PX, S } = W, { EXITS, DAMP } = S;
  const M = { rock: new T.MeshStandardMaterial({ normalScale: new T.Vector2(1.4, 1.4), roughness: 0.93, metalness: 0, envMapIntensity: 0.12 }),
    wall: new T.MeshStandardMaterial({ normalScale: new T.Vector2(1.6, 1.6), roughness: 0.96, metalness: 0, vertexColors: true, envMapIntensity: 0.1 }) };
  const DAMP_W = [0, 1].map(i => { if (!DAMP[i]) return new T.Vector4(1e5, 1e5, 1, 0); const [u, v, r] = DAMP[i], [x, z] = W2(u, v); return new T.Vector4(x, z, r, 0); });   // 셰이더는 2칸 고정
  // 출구 굴 어둠(벽·바위): 세계 좌표로 굴 안 깊이를 재서 안개까지 다 검게(바닥은 dk로 같은 값)
  const EXU = { exM: { value: [0, 1].map(i => { const e = EXITS[i]; return e ? new T.Vector2(...W2(...e.m)) : new T.Vector2(1e6, 1e6); }) }, exD: { value: [0, 1].map(i => { const e = EXITS[i]; return e ? new T.Vector2(...W2(...e.d)) : new T.Vector2(0, 1); }) }, exR: { value: [0, 1].map(i => EXITS[i] ? EXITS[i].r : 0) } };
  function triplanar(mat, tile, wdk = false, vm = false) {   // vm: 바위 에셋의 꼭짓점 이끼 양(_moss)도 쓴다
    mat.customProgramCacheKey = () => 'triplanar' + (wdk ? '+wdk' : '') + (PX.moss ? '+moss' : '') + (vm ? '+vm' : '');   // 셰이더 구분 이름(벽·바위가 서로 다른 셰이더)
    mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, EXU); sh.uniforms.tpS = { value: 1 / tile }; sh.uniforms.mossMap = { value: PX.moss ? PX.moss.c : null }; sh.uniforms.dampW = { value: DAMP_W };
      sh.vertexShader = (wdk ? 'attribute float wdk;\nvarying float vWdk;\n' : '') + (vm ? 'attribute float _moss;\nvarying float vMoss;\n' : '') + 'varying vec3 vTpP;\nvarying vec3 vTpN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>${wdk ? '\nvWdk = wdk;' : ''}${vm ? '\nvMoss = _moss;' : ''}
        { vec4 tp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          tp = instanceMatrix * tp;
        #endif
          vTpP = (modelMatrix * tp).xyz; vTpN = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz); }`);
      sh.fragmentShader = (wdk ? 'varying float vWdk;\n' : '') + (vm ? 'varying float vMoss;\n' : '') + 'uniform float tpS;\nuniform sampler2D mossMap;\nuniform vec4 dampW[2];\nuniform vec2 exM[2];\nuniform vec2 exD[2];\nuniform float exR[2];\nvarying vec3 vTpP;\nvarying vec3 vTpN;\n' + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float exK = 0.0; for (int i = 0; i < 2; i++) { vec2 q = vTpP.xz - exM[i]; float al = dot(q, exD[i]), pe = abs(q.x * exD[i].y - q.y * exD[i].x); exK = max(exK, smoothstep(120.0, 300.0, al) * (1.0 - smoothstep(exR[i] + 60.0, exR[i] + 130.0, pe))); }
          if (exK > 0.999) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }${wdk ? '\n          if (vWdk < 0.004) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }' : ''}`)
        .replace('#include <fog_fragment>', `#include <fog_fragment>
          gl_FragColor.rgb *= 1.0 - exK;${wdk ? '\ngl_FragColor.rgb *= vWdk;' : ''}`)
        .replace('#include <map_fragment>', `vec3 tpN = normalize(vTpN) * (gl_FrontFacing ? 1.0 : -1.0); vec3 tpW = pow(abs(tpN), vec3(4.0)); tpW /= (tpW.x + tpW.y + tpW.z);
          vec2 tpX = vTpP.zy * tpS, tpY = vTpP.xz * tpS, tpZ = vTpP.xy * tpS;
          vec4 texelColor = texture2D(map, tpX) * tpW.x + texture2D(map, tpY) * tpW.y + texture2D(map, tpZ) * tpW.z;
          ${PX.moss ? `float dm = 0.0; for (int i = 0; i < 2; i++) dm = max(dm, 1.0 - smoothstep(dampW[i].z * 0.35, dampW[i].z, distance(vTpP.xz, dampW[i].xy)));
          vec4 ms = texture2D(mossMap, tpY * 1.4); float mw = dm * smoothstep(0.15, 0.65, tpN.y) * clamp(ms.g * 2.2 - 0.25, 0.0, 1.0);${vm ? `
          vec3 mTint = vec3(0.62, 0.66, 0.5); if (vMoss > 0.001) { vec4 mT = texture2D(mossMap, tpX * 1.4) * tpW.x + texture2D(mossMap, tpY * 1.4) * tpW.y + texture2D(mossMap, tpZ * 1.4) * tpW.z; float mv = vMoss * clamp(mT.g * 2.6 + 0.15, 0.0, 1.0); if (mv > mw) { mw = mv; ms = mT; mTint = vec3(0.7, 0.86, 0.48); } }` : ''}
          texelColor.rgb = mix(texelColor.rgb, ms.rgb * ${vm ? 'mTint' : 'vec3(0.62, 0.66, 0.5)'}, mw);` : ''}
          texelColor = mapTexelToLinear(texelColor); diffuseColor *= texelColor;`)
        .replace('#include <normal_fragment_maps>', `{ vec3 nX = texture2D(normalMap, tpX).xyz * 2.0 - 1.0, nY = texture2D(normalMap, tpY).xyz * 2.0 - 1.0, nZ = texture2D(normalMap, tpZ).xyz * 2.0 - 1.0;
          nX.xy *= normalScale; nY.xy *= normalScale; nZ.xy *= normalScale;
          nX = vec3(nX.xy + tpN.zy, abs(nX.z) * tpN.x); nY = vec3(nY.xy + tpN.xz, abs(nY.z) * tpN.y); nZ = vec3(nZ.xy + tpN.xy, abs(nZ.z) * tpN.z);
          vec3 wN = normalize(nX.zyx * tpW.x + nY.xzy * tpW.y + nZ.xyz * tpW.z); normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz); }`); }; }
  const TINT = { floor: [0.56, 0.46, 0.42], wall: [0.5, 0.44, 0.42], rock: [0.62, 0.55, 0.5] };   // 사진 밝기를 동굴 어둠에 맞춤
  M.wall.side = T.DoubleSide;   // 낮은 벽·휜 벽은 뒤에서도 보인다(뒷면도 돌로)
  if (PX.wall) { Object.assign(M.wall, { map: PX.wall.c, normalMap: PX.wall.n }); M.wall.normalScale.set(1.2, 1.2); M.wall.color.setRGB(...TINT.wall); triplanar(M.wall, 280, true); }
  if (PX.rock) { Object.assign(M.rock, { map: PX.rock.c, normalMap: PX.rock.n }); M.rock.normalScale.set(1.2, 1.2); M.rock.color.setRGB(...TINT.rock); triplanar(M.rock, 150); }
  // 바위 에셋(rocks/*.glb)용: 같은 바위 질감 + 모양에 구워 둔 밑동·틈 어둠(꼭짓점 색)
  M.rockKit = new T.MeshStandardMaterial({ normalScale: new T.Vector2(1.2, 1.2), roughness: 0.93, metalness: 0, envMapIntensity: 0.12, vertexColors: true });
  if (PX.rock) { Object.assign(M.rockKit, { map: PX.rock.c, normalMap: PX.rock.n }); M.rockKit.color.setRGB(...TINT.rock); triplanar(M.rockKit, 150, false, true); }
  // 벽과 같은 돌로 보이는 바위(경계 바위 벽 — 벽 끝과 이어 붙어도 이음매가 안 보이게)
  M.rockWall = new T.MeshStandardMaterial({ normalScale: new T.Vector2(1.2, 1.2), roughness: 0.95, metalness: 0, envMapIntensity: 0.1, vertexColors: true });
  if (PX.wall) { Object.assign(M.rockWall, { map: PX.wall.c, normalMap: PX.wall.n }); M.rockWall.color.setRGB(...TINT.wall); triplanar(M.rockWall, 230, false, true); } else M.rockWall = M.rockKit;
  return { M, TINT };
}
