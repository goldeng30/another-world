// 바위(3종 모양을 여러 개 한 번에 그리기) · 벽 밑 바위 · 석순(먼 쪽 벽 밑)
import { T, V, sstep } from '../core/math.js';
import { fbm3, n3 } from '../core/noise.js';
import { W2, U2 } from './coords.js';

export function rockTools(W) {
  const { colliders } = W, rnd = () => W.rockRnd();
  function smoothMerge(g) { const p = g.attributes.position, uv = g.attributes.uv, map = new Map(), P = [], U = [], I = [];
    for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`; let j = map.get(k); if (j === undefined) { j = P.length / 3; map.set(k, j); P.push(p.getX(i), p.getY(i), p.getZ(i)); U.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0); } I.push(j); }
    const o = new T.BufferGeometry(); o.setAttribute('position', new T.Float32BufferAttribute(P, 3)); o.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); o.setIndex(I); return o; }
  function rockGeo(seed, detail = 3) { const g = smoothMerge(new T.IcosahedronGeometry(1, detail)), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)), d = 1 + (fbm3(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4, seed, 4) - 0.5) * 0.85 + (n3(v.x * 5, v.y * 5, v.z * 5, seed + 2) - 0.5) * 0.12; v.multiplyScalar(d); if (v.y > 0.25) v.y = 0.25 + (v.y - 0.25) * 0.8; v.y = Math.max(v.y, -0.35); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g; }
  const RG = [rockGeo(1), rockGeo(2), rockGeo(3)], rockLists = [[], [], []];
  const addRock = (x, z, s, sy = 0.75) => { rockLists[Math.floor(rnd() * 3)].push({ x, z, s, sy, rot: rnd() * 6.28 }); if (s > 48) colliders.push({ x, z, r: s * 0.62 }); };
  return { RG, rockLists, addRock };
}

// 벽 밑 바위 + 석순: 소품 배치가 끝난 뒤(비워 둔 자리 KEEP 피해서)
export async function placeRocks(W, opt = {}) {
  const { root, ROOM, M, colliders, kept, prop } = W, rnd = () => W.rockRnd(), { RG, rockLists, addRock } = W.R, { WALL, H_MIN } = W.WL, { EXITS, inTunnel, pastMouth } = W.S;
  const kinds = opt.stalagmites || ['stal0', 'stal1', 'stal2', 'stal3'];
  for (const [iu, iv, ru, rv] of ROOM.islands) { const [x, z] = W2(iu, iv); addRock(x, z, 100, 1.0); for (let i = 0; i < 7; i++) { const a = i * 0.9 + rnd() * 0.4, [ox, oz] = W2(Math.cos(a) * ru * 0.8, Math.sin(a) * rv * 0.85); addRock(x + ox, z + oz, 45 + rnd() * 30, 0.75 + rnd() * 0.2); } }   // 바위 섬: 큰 바위 더미
  // 벽 밑 바위(들어오는 통로에는 없음) — 방 데이터 rocks.base: false 면 안 놓는다
  if (opt.base !== false) for (const L of WALL) L.pts.forEach((q, i) => { if (i % 3 || rnd() < 0.3 || L.h[i] < H_MIN || q.v < -250) return; const off = 25 + rnd() * 45, x = q.x + q.nx * off, z = q.z + q.nz * off; if (kept(x, z) || EXITS.some(e => inTunnel(q.u, q.v, e, 60) && pastMouth(q.u, q.v, e) > -120)) return;
    const far = sstep(0.1, -0.5, q.cf); addRock(x, z, 24 + rnd() * 20 + far * (15 + rnd() * 45), 0.5 + rnd() * 0.3 + far * 0.25); });   // 화면 위쪽(먼 쪽) 벽 밑만 큰 바위
  // (카메라 쪽 경계 안쪽 작은 바위들은 뺐다 — 경계는 어둠으로)
  // 바닥 높낮이: 바위가 바닥에 닿는 둘레(바위 크기만큼) 여덟 곳 중 가장 높은 바닥에 맞춘다(어느 쪽도 묻히지 않게)
  const groundTop = (x, z, r) => { const g = W.S.ground; if (!g) return 0; const [u, v] = U2(x, z); let y = g(u, v); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; for (const f of [0.5, 0.9]) y = Math.max(y, g(u + Math.cos(a) * r * f, v + Math.sin(a) * r * f)); } return y; };
  for (let k = 0; k < 3; k++) { const L = rockLists[k]; if (!L.length) continue; const im = new T.InstancedMesh(RG[k], M.rock, L.length), m4 = new T.Matrix4(), q = new T.Quaternion();
    L.forEach((o, i) => { q.setFromAxisAngle(V(0, 1, 0), o.rot); m4.compose(V(o.x, o.s * 0.12 + groundTop(o.x, o.z, o.s), o.z), q, V(o.s, o.s * o.sy, o.s * (0.8 + 0.3 * Math.sin(i)))); im.setMatrixAt(i, m4); }); im.receiveShadow = true; root.add(im); }
  // 석순: 먼 쪽 벽 밑 + 바위 섬 둘레(Tripo 석순 4종, 크기 여러 가지)
  { const ST = []; for (const W of WALL) W.pts.forEach((q, i) => { if (i % 5 || q.cf > -0.1 || W.h[i] < H_MIN || q.v < -250 || rnd() < 0.45 || EXITS.some(e => inTunnel(q.u, q.v, e, 60) && pastMouth(q.u, q.v, e) > -120)) return; const off = 22 + rnd() * 26, x = q.x + q.nx * off, z = q.z + q.nz * off; if (!kept(x, z) && !ST.some(o => Math.hypot(o[0] - x, o[1] - z) < 70) && !rockLists.some(R => R.some(o => Math.hypot(o.x - x, o.z - z) < o.s * 0.9 + 25))) ST.push([x, z]); });   // 바위와 안 겹치게
    for (const [iu, iv, ru, rv] of ROOM.islands) for (const a of [0.4, 2.1, 3.6]) { const [x, z] = W2(iu + Math.cos(a) * ru * 1.05, iv + Math.sin(a) * rv * 1.1); ST.push([x, z]); }
    for (const [x, z] of ST) { const k = Math.floor(rnd() * kinds.length), s = 130 + rnd() * 140; const m = await prop(kinds[k], 0, 0, s, { at: V(x, -3, z), face: [rnd() - 0.5, -1], turn: rnd() * 6 }); if (m && s > 200) colliders.push({ x, z, r: s * 0.12 }); } }
}
