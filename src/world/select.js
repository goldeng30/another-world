// 상호작용 대상 고르기 · 선택 표시: 광석 · 식물(채집물) · 다 쓰러진 시체(뒤지기)
//   싸우는 중(칼을 뺀 상태)이 아닐 때, 주인공 가까이(SEL.range 안) 있는 것 중 가장 가까운 하나를 고른다(G.selected)
//   표시는 그 물체 자체의 색: 고른 동안 따뜻하게 밝아지며 천천히 숨 쉬듯 깜빡인다(다른 같은 물체엔 번지지 않게 고른 것만 재질을 따로 쓴다)
//   + 얇은 테두리(바깥 윤곽만): 고른 물체가 그려진 자리를 표시(stencil)해 두고, 화면 쪽으로 조금 부풀린 같은 모양을 그 표시 밖에만 그린다
//     → 안쪽 경계(겹친 부분·패인 곳)엔 선이 안 생긴다. 물체 크기와 상관없이 같은 두께, 뼈대로 움직이는 시체도
import { T } from '../core/math.js';

export const SEL = { outline: { w: 0.85, col: 0x6e5430, op: 0.7 }, range: 75, size: { ore: 34, herb: 20, corpse: 46 }, lift: 0.2, liftEmi: 0.5, pulse: 0.08, glow: 0x0a0704, fade: 0.2 };   // lift: 색 밝히는 정도(빛나는 무늬가 따로 있는 광석은 liftEmi) · glow: 따뜻하게 더하는 빛

// 테두리 재질: 정점을 법선 쪽으로 화면 공간에서 w 만큼 밀어 뒷면만 그린다(두 가지: 일반 · 뼈대)
function outlineMat(skinning) { const m = new T.MeshBasicMaterial({ color: SEL.outline.col, side: T.FrontSide, skinning, transparent: true, opacity: 0, depthWrite: false,
    stencilWrite: true, stencilRef: 1, stencilFunc: T.NotEqualStencilFunc, stencilFail: T.KeepStencilOp, stencilZFail: T.KeepStencilOp, stencilZPass: T.KeepStencilOp }); m.userData.u = { value: SEL.outline.w };   // 물체 자리(1) 밖에만
  m.onBeforeCompile = sh => { sh.uniforms.uOut = m.userData.u; sh.vertexShader = 'uniform float uOut;\n' + sh.vertexShader.replace('#include <project_vertex>',
    '#ifdef USE_SKINNING\n mat4 sm = mat4( 0.0 ); sm += skinWeight.x * boneMatX; sm += skinWeight.y * boneMatY; sm += skinWeight.z * boneMatZ; sm += skinWeight.w * boneMatW; sm = bindMatrixInverse * sm * bindMatrix;\n vec3 oN = ( sm * vec4( normal, 0.0 ) ).xyz;\n#else\n vec3 oN = normal;\n#endif\n vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 ); mvPosition.xyz += normalize( normalMatrix * oN ) * uOut; gl_Position = projectionMatrix * mvPosition;'); };
  m.customProgramCacheKey = () => 'selOutline' + (skinning ? 'S' : ''); return m; }

export function createSelector(G) {
  const OUT = outlineMat(false), OUT_S = outlineMat(true);
  // 셰이더를 시작 때 미리 만들어 두려고 잠깐 보이는 곳 아래에 두 가지를 하나씩 둔다(처음 고를 때 멈칫 없게) → 첫 프레임에 치운다
  const warm = (() => { const g = new T.BoxGeometry(1, 1, 1), n = g.attributes.position.count; g.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Array(n * 4).fill(0), 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => i % 4 ? 0 : 1), 4));
    const a = new T.Mesh(g, OUT), b = new T.SkinnedMesh(g, OUT_S), bone = new T.Bone(); b.add(bone); b.bind(new T.Skeleton([bone])); for (const o of [a, b]) { o.position.y = -3000; o.frustumCulled = false; G.scene.add(o); } return [a, b]; })();
  let warmed = false, rim = [];
  const addRims = ms => { for (const m of ms) { let o; if (m.isSkinnedMesh) { o = new T.SkinnedMesh(m.geometry, OUT_S); o.bind(m.skeleton, m.bindMatrix); o.bindMode = m.bindMode; } else o = new T.Mesh(m.geometry, OUT);
    o.frustumCulled = false; o.castShadow = o.receiveShadow = false; o.renderOrder = -1; m.add(o); rim.push(o); } };
  const dropRims = () => { for (const o of rim) if (o.parent) o.parent.remove(o); rim = []; };
  const HI = new WeakMap();   // 메시 → { orig(원래 재질), hi(밝힌 재질) }
  const meshesOf = root => { const out = []; if (root) root.traverse(o => { if (o.isMesh && !o.isSprite && o.material && !Array.isArray(o.material)) out.push(o); }); return out; };
  function lit(m) { let h = HI.get(m); if (!h || h.orig !== m.material && h.hi !== m.material) { const o = m.material, c = o.clone(); c.onBeforeCompile = o.onBeforeCompile; c.customProgramCacheKey = o.customProgramCacheKey;   // 같은 셰이더를 그대로(멈칫 없게)
      Object.assign(c, { stencilWrite: true, stencilRef: 1, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.ReplaceStencilOp, stencilZFail: T.ReplaceStencilOp });   // 고른 물체 자리를 1로 표시(바닥에 묻혀 가려진 곳도 — 그래야 몸 안쪽에 선이 안 생긴다)
      h = { orig: o, hi: c, col: o.color ? o.color.clone() : null, em: o.emissive ? o.emissive.clone() : null }; HI.set(m, h); } return h; }
  const S = { cur: null, ms: [], k: 0, t: 0 };
  function setOn(root) { off(); S.cur = root; S.ms = meshesOf(root); for (const m of S.ms) { const h = lit(m); m.material = h.hi; } addRims(S.ms); }
  function off() { dropRims(); for (const m of S.ms) { const h = HI.get(m); if (h && m.material === h.hi) m.material = h.orig; } S.ms = []; S.cur = null; }
  function candidates() { const out = [], W = G.world;
    for (const it of W.interactables || []) { if (it.dead || !it.mesh) continue; out.push({ obj: it, root: it.mesh, kind: it.kind, pos: it.mesh.getWorldPosition(new T.Vector3()) }); }
    for (const e of G.enemies) if (e.dead && e.die && e.gs.done) { const h = (e.GB.Hips || e.holder).getWorldPosition(new T.Vector3()); out.push({ obj: e, root: e.holder, kind: 'corpse', pos: h }); }
    return out; }
  function update(dt) { if (!warmed) { warmed = true; for (const o of warm) G.scene.remove(o); }
    const hp = G.hero.root.position, C = G.hero.H.ctrl, fight = C.ctl.armed || C.DR.mode === 'draw'; let best = null, bd = Infinity;
    if (!fight) for (const c of candidates()) { const d = Math.hypot(c.pos.x - hp.x, c.pos.z - hp.z) - (SEL.size[c.kind] || 30) * 0.6; if (d < SEL.range && d < bd) { bd = d; best = c; } }   // 싸우는 중엔 고르지 않는다
    G.selected = best ? best.obj : null;
    const want = best ? best.root : null;
    if (want !== S.cur) { if (S.k > 0 && S.cur) { S.k = Math.max(0, S.k - dt / SEL.fade); if (S.k <= 0) { off(); if (want) setOn(want); } } else { off(); if (want) setOn(want); } }   // 바뀌면 먼저 원래 색으로 돌아간 뒤 새 대상을 밝힌다
    else if (S.cur) S.k = Math.min(1, S.k + dt / SEL.fade);
    if (!S.cur) return; S.t += dt; const pz = SEL.pulse * Math.sin(S.t * 3.2), g = new T.Color(SEL.glow); OUT.opacity = OUT_S.opacity = S.k * SEL.outline.op * (1 + 0.25 * pz / SEL.pulse);   // 테두리도 같이 나타나고 숨 쉰다
    for (const m of S.ms) { const h = HI.get(m); if (!h) continue; const emi = !!h.hi.emissiveMap, k = S.k * ((emi ? SEL.liftEmi : SEL.lift) + pz);   // 빛나는 무늬가 있으면 더하는 빛이 무늬에만 들어가니 색을 더 밝힌다
      if (h.col) h.hi.color.copy(h.col).multiplyScalar(1 + k); if (h.em && !emi) h.hi.emissive.copy(h.em).add(g.clone().multiplyScalar(S.k)); } }
  return { update, SEL, clear: off };
}
