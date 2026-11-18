// Tripo 소품: 모델(.glb) + 색·노멀 질감. 바닥 가운데로 맞춘 뒤 화면 좌표 (u,v) 자리에, 앞(+z)이 face 방향(화면 기준)을 보게
import { T, V } from '../core/math.js';
import { PATH, loadGLTF, loadPropTex } from '../core/assets.js';
import { PROPS, propTint } from '../data/props.js';
import { W2, WV, U2 } from './coords.js';

const GLB_CACHE = new Map(), SHARED = new WeakSet();   // 소품 이름 → { geo, mat } (방이 바뀌어도 다시 쓰기)
export const isSharedAsset = x => SHARED.has(x);
export function loadProp(name) { if (GLB_CACHE.has(name)) return GLB_CACHE.get(name); const info = PROPS[name] || {}, tx = PATH.props + (info.tex || name);
    const pr = (async () => {
      const [gl, bm, nm] = await Promise.all([loadGLTF(PATH.props + name + '.glb'), loadPropTex(tx + '_base.webp'), loadPropTex(tx + '_nrm.webp')]);
      bm.flipY = false; bm.encoding = T.sRGBEncoding; bm.anisotropy = 4; nm.flipY = false;
      const mat = new T.MeshStandardMaterial({ map: bm, normalMap: nm, normalMapType: T.ObjectSpaceNormalMap, roughness: 0.85, metalness: 0, side: T.DoubleSide });
      let geo = null; gl.scene.traverse(o => { if (o.isMesh && !geo) geo = o.geometry; }); geo.computeBoundingBox(); const b = geo.boundingBox; geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.computeBoundingBox();
      const tint = propTint(name); if (tint) mat.color.setRGB(...tint);
      SHARED.add(geo); SHARED.add(mat); return { geo, mat }; })().catch(e => { console.warn(e); return null; });
    GLB_CACHE.set(name, pr); return pr; }

// 바위 에셋: 모양만 받아 두고(방이 바뀌어도 다시 씀) 재질은 방의 바위 재질
const ROCK_CACHE = new Map();
export function loadRockGeo(name) { if (ROCK_CACHE.has(name)) return ROCK_CACHE.get(name);
  const pr = loadGLTF(PATH.rocks + name + '.glb').then(gl => { let geo = null; gl.scene.traverse(o => { if (o.isMesh && !geo) geo = o.geometry; }); geo.computeBoundingBox(); SHARED.add(geo); return geo; }).catch(e => { console.warn(e); return null; });
  ROCK_CACHE.set(name, pr); return pr; }

export function propTools(W) {
  const { root, colliders, KEEP } = W;
  // 바닥 높낮이 위에 놓기: 가운데와 둘레 네 곳 중 가장 낮은 바닥에 맞춘다(비탈에서 한쪽이 뜨지 않게, 높은 쪽은 살짝 묻힘)
  const groundUnder = (m, geo, s) => { const g = W.S && W.S.ground; if (!g) return 0; const b = geo.boundingBox, r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * s * 0.35, [u, v] = U2(m.position.x, m.position.z);
    let y = g(u, v); for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) y = Math.min(y, g(u + a * r, v + c * r)); return y; };
  async function prop(name, u, v, s, o = {}) { const P = await loadProp(name); if (!P) return null; const m = new T.Mesh(P.geo, P.mat); m.castShadow = true; m.receiveShadow = true;
    const [fx, fz] = W2(...(o.face || [0, -1])); m.scale.setScalar(s); m.position.copy(o.at || WV(u, v, o.y || 0)); const info = PROPS[name] || {}; m.rotation.y = Math.atan2(fx, fz) + (o.turn || 0) + (info.turn || 0); if (o.tilt) { m.rotation.order = 'YXZ'; m.rotation.x = o.tilt[0]; m.rotation.z = o.tilt[1] || 0; } m.position.y += groundUnder(m, P.geo, s); root.add(m); m.updateMatrixWorld(true);   // tilt: [앞뒤, 옆] 기울이기(라디안) — 바닥에 눕히기 · 바닥 높낮이 위에
    if (o.col) colliders.push({ x: m.position.x, z: m.position.z, r: o.col }); if (o.keep) KEEP.push([m.position.x, m.position.z, o.keep]);
    if (W.ROOM.contact) { const b = P.geo.boundingBox; (W.contactList = W.contactList || []).push({ x: m.position.x, z: m.position.z, r: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * s * 0.62 }); }   // 접촉 그림자 자리
    if (info.eyes && W.totemEyes) for (const g of [].concat(info.eyes)) W.totemEyes(m, g.pts, g.color, g.size);   // 토템이면 눈빛도 같이
    if (info.gather && W.markGather) W.markGather(m);   // 채집물이면 표시도 같이
    return m; }
  function topOf(m, frac = 0.08) {   // 소품 맨 위 부분의 가운데(세계) — 횃불 불꽃 자리
    const p = m.geometry.attributes.position, top = m.geometry.boundingBox.max.y, c = V(); let n = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > top * (1 - frac)) { c.x += p.getX(i); c.y += p.getY(i); c.z += p.getZ(i); n++; }
    return m.localToWorld(c.multiplyScalar(1 / Math.max(1, n))); }
  const lineCol = (m, n, r) => { const b = m.geometry.boundingBox, cz = (b.min.z + b.max.z) / 2; for (let i = 0; i < n; i++) { const w = m.localToWorld(V(b.min.x + (b.max.x - b.min.x) * (i + 0.5) / n, 0, cz)); colliders.push({ x: w.x, z: w.z, r }); KEEP.push([w.x, w.z, r + 80]); } };   // 긴 소품: 길이 방향으로 원 몇 개
  async function wallProp(name, tu, tv, s, y0) { const P = await loadProp(name); if (!P) return null; const h = P.geo.boundingBox.max.y * s, w = W.WL.wallSpot(tu, tv, y0 + h * 0.5, y0 + h + 40); if (!w || w.d > 170) return null; const m = new T.Mesh(P.geo, P.mat); m.scale.setScalar(s); m.castShadow = true;
    m.position.set(w.p.x + w.n.x * 8, y0, w.p.z + w.n.z * 8); m.rotation.y = Math.atan2(w.n.x, w.n.z); root.add(m); KEEP.push([w.p.x, w.p.z, 50]); return m; }
  async function wallTorch(tu, tv, light, range) { const w = W.WL.wallSpot(tu, tv, 95, 200), P = await loadProp('torchw'); if (!P || !w || w.d > 170) return; const m = new T.Mesh(P.geo, P.mat); m.scale.setScalar(100); m.castShadow = true; m.position.copy(w.p).addScaledVector(w.n, 5); m.rotation.y = Math.atan2(w.n.x, w.n.z); root.add(m); m.updateMatrixWorld(true);
    W.flame(topOf(m).add(V(0, 1.5, 0)), 6.5, light, false, range); KEEP.push([w.p.x, w.p.z, 70]); }
  // 바위 에셋 놓기: s = 가로 지름. 바닥 높낮이 위(가장 낮은 곳에 맞춰 살짝 묻힘) · 부딪힘 원은 지름의 0.42
  async function rock(name, u, v, s, o = {}) { const geo = await loadRockGeo(name); if (!geo) return null; const m = new T.Mesh(geo, o.mat === 'wall' ? W.M.rockWall : W.M.rockKit); m.castShadow = true; m.receiveShadow = true;   // mat: 'wall' 이면 벽과 같은 돌
    m.scale.setScalar(s); if (o.sy) m.scale.y *= o.sy; m.position.copy(WV(u, v, o.y || 0)); const [fx, fz] = W2(...(o.face || [0, -1])); m.rotation.y = Math.atan2(fx, fz) + (o.turn || 0);
    if (o.tilt) { m.rotation.order = 'YXZ'; m.rotation.x = o.tilt[0]; m.rotation.z = o.tilt[1] || 0; } m.position.y += groundUnder(m, geo, s); root.add(m); m.updateMatrixWorld(true);
    if (o.col !== false && s > 40) colliders.push({ x: m.position.x, z: m.position.z, r: s * (o.colK || 0.42) }); if (o.keep) KEEP.push([m.position.x, m.position.z, o.keep]);
    if (W.ROOM.contact) (W.contactList = W.contactList || []).push({ x: m.position.x, z: m.position.z, r: s * 0.62 });   // 접촉 그림자 자리
    return m; }
  return { prop, topOf, lineCol, wallProp, wallTorch, rock };
}
