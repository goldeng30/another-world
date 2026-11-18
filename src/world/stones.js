// 자잘한 돌 무더기(3D): 작은 돌 에셋(assets/rocks/pebble*·stone*)을 여러 개 깔아 무더기를 만든다 — 방 데이터 stones:
//   at:   [{ at: [u, v], r, n, s: [최소, 최대] }]                           정해진 자리 무더기
//   edge: [{ band: [d0, d1], every, p, r: [최소, 최대], n: [최소, 최대], s }]  경계(어둠) 안쪽 띠를 따라 무더기(처음 서는 자리 둘레 · skip: [[u, v, r]] 는 비움)
//   돌은 한 번에 그린다(모양을 합쳐 한 덩어리) · 바닥 높낮이에 반쯤 묻힘 · 큰 돌은 가운데, 작은 돌은 둘레로 흩어짐 · 부딪힘 없음
//   grit: true 면 무더기 밑에 아주 작은 자갈(평면 그림 'grit')을 깔아 땅에 붙게
import { T } from '../core/math.js';
import { loadRockGeo } from './props.js';
import { W2 } from './coords.js';

const ROUND = ['pebbleA', 'pebbleB', 'pebbleC', 'pebbleD'], SHARP = ['stoneA', 'stoneB', 'stoneC', 'stoneD'];
export const stoneFiles = () => [...ROUND, ...SHARP].map(n => `assets/rocks/${n}.glb`);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function buildStones(W, spec) {
  const { root, ROOM } = W, S = W.S, R = rng((ROOM.seed ?? 1) * 17 + 4243);
  const geos = {}; await Promise.all([...ROUND, ...SHARP].map(async n => { geos[n] = await loadRockGeo(n); }));
  const piles = [], rr = (a, b) => a + (b - a) * R();
  for (const p of spec.at || []) piles.push({ u: p.at[0], v: p.at[1], r: p.r || 40, n: p.n || 20, s: p.s || [3, 12], sharp: p.sharp ?? 0.5 });
  for (const e of spec.edge || []) { const [d0, d1] = e.band || [-120, -50], gap = e.every || 150, cand = [];   // 띠 안 후보를 촘촘히 뽑아 섞은 뒤 서로 gap 이상 떨어진 것만
    for (let u = -1400; u <= 1400; u += 30) for (let v = -1400; v <= 1400; v += 30) { const ju = u + (R() - 0.5) * 30, jv = v + (R() - 0.5) * 30, dd = S.sdfUV(ju, jv); if (dd >= d0 && dd <= d1) cand.push([ju, jv, R()]); }
    cand.sort((a, b) => a[2] - b[2]);
    for (const [ju, jv] of cand) {
      if (piles.some(p => Math.hypot(p.u - ju, p.v - jv) < gap) || R() > (e.p ?? 1)) continue;
      if (S.EXITS.some(x => S.inTunnel(ju, jv, x, 40) && S.pastMouth(ju, jv, x) > -60)) continue;
      if (W.kept && W.kept(...W2(ju, jv))) continue;   // 소품 자리는 피함
      if (ROOM.spawn && Math.hypot(ju - ROOM.spawn[0], jv - ROOM.spawn[1]) < 120) continue;   // 처음 서는 자리 둘레는 비움
      if ((spec.skip || []).some(([su, sv, sr]) => Math.hypot(ju - su, jv - sv) < sr)) continue;   // skip: [[u, v, r]] 따로 비울 곳
      piles.push({ u: ju, v: jv, r: rr(...(e.r || [30, 50])), n: Math.round(rr(...(e.n || [10, 20]))), s: e.s || [3, 11], sharp: e.sharp ?? 0.5 }); } }
  if (!piles.length) return { piles };
  const P = [], N = [], C = [], I = [], M4 = new T.Matrix4(), NM = new T.Matrix3(), Q = new T.Quaternion(), E = new T.Euler(), v3 = new T.Vector3();
  for (const pl of piles) for (let i = 0; i < pl.n; i++) {
    const big = Math.pow(R(), 1.6), s = pl.s[0] + (pl.s[1] - pl.s[0]) * big;   // 작은 돌이 많고 큰 돌은 몇 개
    const a = R() * Math.PI * 2, q = pl.r * Math.pow(R(), 0.8) * (1 - 0.45 * big), u = pl.u + Math.cos(a) * q, v = pl.v + Math.sin(a) * q * 0.85;   // 큰 돌은 가운데 쪽
    const name = (R() < pl.sharp ? SHARP : ROUND)[Math.floor(R() * 4)], g = geos[name]; if (!g) continue;
    const [x, z] = W2(u, v), y = S.ground(u, v) - s * rr(0.04, 0.16);
    E.set(rr(-0.25, 0.25), R() * Math.PI * 2, rr(-0.25, 0.25), 'YXZ'); Q.setFromEuler(E); M4.compose(v3.set(x, y, z), Q, new T.Vector3(s, s * rr(0.8, 1.15), s * rr(0.85, 1.1))); NM.getNormalMatrix(M4);
    const pa = g.attributes.position, na = g.attributes.normal, ca = g.attributes.color, base = P.length / 3, tone = rr(0.95, 1.35), warm = rr(-0.03, 0.05);   // 돌마다 밝기·색 조금씩 다르게(바닥보다 살짝 밝아 무더기가 읽히게)
    for (let k = 0; k < pa.count; k++) { v3.fromBufferAttribute(pa, k).applyMatrix4(M4); P.push(v3.x, v3.y, v3.z); v3.fromBufferAttribute(na, k).applyMatrix3(NM).normalize(); N.push(v3.x, v3.y, v3.z);
      const c = ca ? ca.getX(k) : 1; C.push(c * tone * (1 + warm), c * tone, c * tone * (1 - warm)); }
    const ix = g.index.array; for (let k = 0; k < ix.length; k++) I.push(base + ix[k]); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(C, 3)); geo.setIndex(P.length / 3 > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1));
  const mesh = new T.Mesh(geo, W.M.rockKit); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'stones'; root.add(mesh);
  return { piles, mesh };
}
