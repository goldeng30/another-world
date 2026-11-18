// 바닥: 방 둘레만 덮는 판(덩이로 나눠 화면 밖은 안 그림). 방 밖은 질감·빛 계산 없이 완전히 검게(못 가는 곳), 다섯 겹 섞기(바위 · 회색 바위 · 다진 흙 · 이끼 낀 흙 · 자갈) + 모닥불 둘레 생활 자리
import { T, sstep } from '../core/math.js';
import { fbm2 } from '../core/noise.js';
import { U2, W2 } from './coords.js';

export function buildFloor(W) {
  const { root, PX, ROOM, TINT } = W, { sdfUV, sdfRooms, tunnelFade, dampAt, exitDark, ground: groundH } = W.S;
  // 바닥판: 방 둘레(경계 밖 OUT 까지)만 화면 기준 격자로 덮고, TILE 칸씩 덩이로 나눠 따로 그린다(화면 밖 덩이는 안 그림 · 어둠 속 빈 바닥은 아예 없음)
  const S = 3800, CELL = ROOM.floorCell || 20, TILE = 32, OUT = 70, tiles = [];
  { let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (let v = -S / 2; v <= S / 2; v += 40) for (let u = -S / 2; u <= S / 2; u += 40) if (sdfUV(u, v) < OUT + 40) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    u0 -= 40; v0 -= 40; const nu = Math.ceil((u1 + 40 - u0) / CELL), nv = Math.ceil((v1 + 40 - v0) / CELL), D = new Float32Array((nu + 1) * (nv + 1));
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) D[j * (nu + 1) + i] = sdfUV(u0 + i * CELL, v0 + j * CELL);
    const hAt = (x, z) => groundH(...U2(x, z));
    for (let tj = 0; tj < nv; tj += TILE) for (let ti = 0; ti < nu; ti += TILE) { const id = new Map(), P = [], N = [], UV = [], I = [];
      const vid = (i, j) => { const k = j * (nu + 1) + i; if (id.has(k)) return id.get(k); const u = u0 + i * CELL, v = v0 + j * CELL, [x, z] = W2(u, v), e = 6, nx = -(hAt(x + e, z) - hAt(x - e, z)) / (2 * e), nz = -(hAt(x, z + e) - hAt(x, z - e)) / (2 * e), nl = Math.hypot(nx, 1, nz);
        P.push(x, groundH(u, v), z); N.push(nx / nl, 1 / nl, nz / nl); UV.push((x + S / 2) / S, (S / 2 - z) / S); id.set(k, P.length / 3 - 1); return P.length / 3 - 1; };
      for (let j = tj; j < Math.min(nv, tj + TILE); j++) for (let i = ti; i < Math.min(nu, ti + TILE); i++) { const a = j * (nu + 1) + i; if (Math.min(D[a], D[a + 1], D[a + nu + 1], D[a + nu + 2]) >= OUT) continue;
        const A = vid(i, j), B = vid(i + 1, j), C = vid(i, j + 1), E = vid(i + 1, j + 1); I.push(A, B, C, B, E, C); }
      if (!I.length) continue; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); tiles.push(g); } }
  for (const g of tiles) { const pos = g.attributes.position, col = new Float32Array(pos.count * 3), wts = new Float32Array(pos.count * 4), dk = new Float32Array(pos.count * 2), ash = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), [u, v] = U2(x, z), d = sdfUV(u, v), dRoom = sdfRooms(u, v); pos.setY(i, groundH(u, v));   // 바닥 높낮이
      let k = 1 - 0.85 * tunnelFade(u, v); k *= 0.92 + 0.16 * fbm2(x / 260 + 30, z / 260 + 30, 64, 5, 3); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
      const wB = sstep(0.42, 0.6, fbm2(x / 380 + 40, z / 380 + 40, 64, 17, 4));
      let wDirt = 0; for (const [cu, cv, r] of ROOM.dirt) wDirt = Math.max(wDirt, 1 - sstep(r * 0.2, r * 1.1 + 110 * fbm2(u / 150 + 9, v / 150 + 9, 64, 29, 3), Math.hypot(u - cu, v - cv)));   // 고블린이 밟아 다진 흙
      const wD = wDirt * (0.75 + 0.25 * fbm2(x / 90 + 12, z / 90 + 12, 64, 31, 2));
      const wM = Math.min(1, dampAt(u, v) * (0.55 + 0.7 * fbm2(u / 110 + 4, v / 110 + 4, 64, 53, 3)));
      const wG = !ROOM.edgeGravel ? 0 : Math.min(1, sstep(-125, -25, d) * (0.5 + 0.7 * fbm2(x / 140 + 5, z / 140 + 9, 64, 37, 3)) + (d > 0 ? 1 : 0));   // 경계 자갈 띠: 방 데이터 edgeGravel: true 일 때만(기본은 주변 바닥이 경계까지 그대로 이어짐)
      wts.set([wB, wD, wG, wM], i * 4); dk[i * 2] = dRoom; dk[i * 2 + 1] = exitDark(u, v);   // 어둠은 픽셀마다 계산(점 사이를 거리로 이어 경계가 계단·체크무늬로 안 보이게)
      if (ROOM.camp) { const [cu, cv, r] = ROOM.camp, dc = Math.hypot(u - cu, v - cv); ash[i * 2] = 1 - sstep(r * 0.35, r + 80 * fbm2(u / 120 + 3, v / 120 + 3, 64, 71, 3), dc); ash[i * 2 + 1] = (1 - sstep(45, 140, dc)) * (0.6 + 0.4 * fbm2(x / 50 + 8, z / 50 + 8, 64, 73, 2)); } }   // 생활 자리 무게 · 재   // dk: 방 밖은 질감·반사·안개까지 완전히 검게(못 가는 곳)
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('wts', new T.BufferAttribute(wts, 4)); g.setAttribute('dkv', new T.BufferAttribute(dk, 2)); g.setAttribute('cmp', new T.BufferAttribute(ash, 2)); }
  // 1단계 회색 격자 바닥(방 데이터 blockout): 질감 없이 회색 + 100마다 가는 선 · 500마다 굵은 선(화면 기준 u·v) — 넓이·동선 보기용. 방 밖 어둠은 같게
  if (ROOM.blockout) { const bm = new T.MeshStandardMaterial({ color: 0x5a5754, vertexColors: true, roughness: 0.95, metalness: 0 }); bm.customProgramCacheKey = () => 'floor-blockout';
    bm.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec2 dkv;\nvarying vec2 vDkv;\nvarying vec2 vGU;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDkv = dkv; vGU = vec2(position.x - position.z, -position.x - position.z) * 0.70710678;');
      sh.fragmentShader = 'varying vec2 vDkv;\nvarying vec2 vGU;\nconst vec3 BG = vec3(0.0235, 0.0314, 0.0431);\n' + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vDkv.x >= 48.0 || vDkv.y >= 1.0) { gl_FragColor = vec4(BG, 1.0); return; }')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 g1 = abs(fract(vGU / 100.0 - 0.5) - 0.5) * 100.0, g5 = abs(fract(vGU / 500.0 - 0.5) - 0.5) * 500.0;
          diffuseColor.rgb *= 1.0 - 0.28 * (1.0 - smoothstep(1.0, 2.6, min(g1.x, g1.y))) - 0.42 * (1.0 - smoothstep(2.0, 4.5, min(g5.x, g5.y)));`)
        .replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.rgb = mix(BG, gl_FragColor.rgb, (1.0 - smoothstep(-70.0, 36.0, vDkv.x)) * (1.0 - vDkv.y));'); };   // 경계 어둠: 잘리는 곳(48)보다 먼저 배경색(BG = 장면 배경 #06080b)으로 — 바닥 없는 바깥과 이어져 계단이 안 보이게
    for (const g of tiles) { const m = new T.Mesh(g, bm); m.receiveShadow = true; m.name = 'floor'; root.add(m); } return; }
  {
    const gm = new T.MeshStandardMaterial({ normalScale: new T.Vector2(1.2, 1.2), vertexColors: true, roughness: 0.97, metalness: 0, envMapIntensity: 0.08 });
    const A = PX.floorA, Bt = PX.floorB, D = PX.floorD, G = PX.floorG, Mo = PX.floorM, Cp = PX.floorC || PX.floorD;
    if (A) { const rp = S / 200; A.c.repeat.set(rp, rp); A.n.repeat.set(rp, rp); Object.assign(gm, { map: A.c, normalMap: A.n }); gm.normalScale.set(1, 1); gm.color.setRGB(...TINT.floor); }
    // 섞는 겹(방 데이터 floorUse): B 회색 바위 얼룩 · D 다진 흙(dirt) · G 경계 자갈(edgeGravel) · M 이끼 낀 흙(damp) · C 생활 자리(camp) — 쓰는 겹만 셰이더가 읽는다(질감 읽기 줄이기)
    const USE = (ROOM.floorUse || ['B', 'D', 'G', 'M', 'C']).filter(k => ({ B: Bt, D, G, M: Mo, C: Cp })[k]);
    gm.customProgramCacheKey = () => 'floor-' + USE.join('');
    if (A) gm.onBeforeCompile = sh => { Object.assign(sh.uniforms, { mapB: { value: Bt && Bt.c }, nrmB: { value: Bt && Bt.n }, mapD: { value: D && D.c }, nrmD: { value: D && D.n }, mapG: { value: G && G.c }, nrmG: { value: G && G.n }, mapM: { value: Mo && Mo.c }, nrmM: { value: Mo && Mo.n }, mapC: { value: Cp && Cp.c }, nrmC: { value: Cp && Cp.n } });
      sh.vertexShader = 'attribute vec4 wts;\nattribute vec2 dkv;\nattribute vec2 cmp;\nvarying vec4 vW;\nvarying vec2 vDkv;\nvarying vec2 vCmp;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvW = wts; vDkv = dkv; vCmp = cmp;');
      sh.fragmentShader = USE.map(k => '#define L_' + k + '\n').join('') + 'uniform sampler2D mapB, nrmB, mapD, nrmD, mapG, nrmG, mapM, nrmM, mapC, nrmC;\nvarying vec4 vW;\nvarying vec2 vDkv;\nvarying vec2 vCmp;\nconst vec3 BG = vec3(0.0235, 0.0314, 0.0431);\n' + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vDkv.x >= 48.0 || vDkv.y >= 1.0) { gl_FragColor = vec4(BG, 1.0); return; }')
        .replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.rgb = mix(BG, gl_FragColor.rgb, (1.0 - 0.97 * smoothstep(-55.0, 48.0, vDkv.x)) * min(1.0 - smoothstep(-40.0, 36.0, vDkv.x), 1.0 - vDkv.y));   // 경계 어둠: 안쪽은 그대로, 바깥쪽으로 넓게 번지며 배경색(BG = 장면 배경)으로 — 바닥 없는 바깥과 이어져 계단이 안 보이게')
        .replace('#include <map_fragment>', `const vec3 LUM = vec3(0.3, 0.59, 0.11); vec4 texelColor = texture2D(map, vUv); float fB = 0.0, fD = 0.0, fG = 0.0, fM = 0.0, fC = 0.0; vec2 uvB, uvD, uvG, uvM, uvC;
#ifdef L_B
          uvB = vUv * 0.77 + vec2(0.37, 0.61); vec4 cB = texture2D(mapB, uvB); fB = clamp((vW.x - 0.5) * 2.5 + 0.5 + (dot(cB.rgb, LUM) - 0.35) * 1.2, 0.0, 1.0); texelColor = mix(texelColor, cB, fB);
#endif
#ifdef L_D
          uvD = vUv * 1.25 + vec2(0.13, 0.71); vec4 cD = texture2D(mapD, uvD); fD = clamp((vW.y - 0.5) * 2.5 + 0.5 + (dot(cD.rgb, LUM) - 0.38) * 1.4, 0.0, 1.0); texelColor = mix(texelColor, vec4(cD.rgb * 0.82, 1.0), fD);
#endif
#ifdef L_M
          uvM = vUv * 1.1 + vec2(0.71, 0.17); vec4 cM = texture2D(mapM, uvM); fM = clamp((vW.w - 0.5) * 2.5 + 0.5 + (cM.g - 0.45) * 1.6, 0.0, 1.0); texelColor = mix(texelColor, vec4(cM.rgb * vec3(0.5, 0.52, 0.42), 1.0), fM);
#endif
#ifdef L_G
          uvG = vUv * 1.55 + vec2(0.52, 0.29); vec4 cG = texture2D(mapG, uvG); fG = clamp((vW.z - 0.5) * 2.5 + 0.5 + (dot(cG.rgb, LUM) - 0.3) * 1.4, 0.0, 1.0); texelColor = mix(texelColor, cG, fG);
#endif
#ifdef L_C
          uvC = vUv * 1.3 + vec2(0.27, 0.43); vec4 cC = texture2D(mapC, uvC); fC = clamp((vCmp.x - 0.5) * 2.5 + 0.5 + (dot(cC.rgb, LUM) - 0.4) * 1.2, 0.0, 1.0);
          texelColor = mix(texelColor, vec4(cC.rgb * vec3(1.0, 0.82, 0.64) * 0.85, 1.0), fC); texelColor.rgb = mix(texelColor.rgb, vec3(dot(texelColor.rgb, LUM)) * vec3(0.5, 0.48, 0.46), clamp(vCmp.y, 0.0, 1.0));
#endif
          texelColor = mapTexelToLinear(texelColor); diffuseColor *= texelColor;`)
        .replace('#include <normal_fragment_maps>', T.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vUv ).xyz', `vec4 nT = texture2D( normalMap, vUv );
#ifdef L_B
          nT = mix(nT, texture2D( nrmB, uvB ), fB);
#endif
#ifdef L_D
          nT = mix(nT, texture2D( nrmD, uvD ), fD);
#endif
#ifdef L_M
          nT = mix(nT, texture2D( nrmM, uvM ), fM);
#endif
#ifdef L_G
          nT = mix(nT, texture2D( nrmG, uvG ), fG);
#endif
#ifdef L_C
          nT = mix(nT, texture2D( nrmC, uvC ), fC);
#endif
          vec3 mapN = nT.xyz`)); };
    for (const g of tiles) { const m = new T.Mesh(g, gm); m.receiveShadow = true; m.name = 'floor'; root.add(m); } }
}
