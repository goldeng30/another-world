// 바닥 디테일(평면 그림)을 바닥 높낮이에 붙여 한 번에 그리기 — 방 데이터 decals:
//   at:      [{ k: 'planks', at: [u, v], s, rot }]                       정해진 자리
//   around:  [{ k: 'leaves', c: [u, v, r], n, s: [최소, 최대] }]         동그라미 안에 n 개
//   edge:    [{ k: 'gravel', band: [d0, d1], every, s: [최소, 최대], p }] 경계(어둠) 안쪽 띠를 따라(every 간격, p 확률)
//   tint: [r, g, b] 밝기 맞춤(바닥 사진과 같은 동굴 톤)
//   경계·출구 굴 어둠은 바닥과 같게 꼭짓점 색으로 어둡게 · 가운데 싸움 자리처럼 비워 둘 곳은 clear: [[u, v, r]]
import { T, sstep } from '../core/math.js';
import { PATH, loadPropTex } from '../core/assets.js';
import { FLOOR_DECALS as FD } from '../data/decals.js';
import { W2, U2 } from './coords.js';

export const decalFiles = () => [FD.file + '_c.webp', FD.file + '_n.webp'];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function buildDecals(W, spec) {
  const { root, ROOM } = W, S = W.S, R = rng((ROOM.seed ?? 1) * 31 + 977);
  const [cm, nm] = await Promise.all(decalFiles().map(f => loadPropTex(f)));
  for (const t of [cm, nm]) { t.flipY = false; t.anisotropy = 4; t.needsUpdate = true; } cm.encoding = T.sRGBEncoding;
  const list = [], pick = a => a[Math.floor(R() * a.length)], rr = (a, b) => a + (b - a) * R();
  const clear = spec.clear || [], blocked = (u, v) => clear.some(([cu, cv, r]) => Math.hypot(u - cu, v - cv) < r);
  const add = (k, u, v, s, rot) => { const K = FD.kinds[k]; if (!K || blocked(u, v)) return; list.push({ cell: pick(K.cells), u, v, s: s || K.s, rot: rot ?? (K.rot === false ? 0 : R() * Math.PI * 2) }); };
  for (const d of spec.at || []) add(d.k, d.at[0], d.at[1], d.s, d.rot);
  for (const d of spec.path || []) { const s = d.s || [FD.kinds[d.k].s * 0.9, FD.kinds[d.k].s * 1.15];   // 길: 점들을 잇는 선을 따라 every 간격으로 겹쳐 깔기
    for (let i = 0; i < d.pts.length - 1; i++) { const [a, b] = [d.pts[i], d.pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / (d.every || 60)));
      for (let k = 0; k < n; k++) { const t = (k + R()) / n; add(d.k, a[0] + (b[0] - a[0]) * t + (R() - 0.5) * (d.jit || 20), a[1] + (b[1] - a[1]) * t + (R() - 0.5) * (d.jit || 20), rr(...s)); } } }
  for (const d of spec.around || []) { const [cu, cv, r] = d.c, s = d.s || [FD.kinds[d.k].s * 0.8, FD.kinds[d.k].s * 1.2];
    for (let i = 0; i < d.n; i++) { const a = R() * Math.PI * 2, q = Math.sqrt(R()) * r; add(d.k, cu + Math.cos(a) * q, cv + Math.sin(a) * q, rr(...s)); } }
  for (const d of spec.edge || []) { const step = d.every || 120, s = d.s || [FD.kinds[d.k].s * 0.8, FD.kinds[d.k].s * 1.2], [d0, d1] = d.band || [-110, -40];
    for (let u = -1400; u <= 1400; u += step) for (let v = -1400; v <= 1400; v += step) {
      const ju = u + (R() - 0.5) * step, jv = v + (R() - 0.5) * step, dd = S.sdfUV(ju, jv);
      if (dd < d0 || dd > d1 || R() > (d.p ?? 1)) continue;
      if (S.EXITS.some(e => S.inTunnel(ju, jv, e, 40) && S.pastMouth(ju, jv, e) > -60)) continue;   // 출구 굴 바닥은 비워 둔다
      add(d.k, ju, jv, rr(...s)); } }
  if (!list.length) return null;
  // 한 장 = 잘게 나눈 네모(바닥 높낮이를 따라 휨) · 꼭짓점 색 = 경계·굴 어둠
  const P = [], UV = [], C = [], I = [], g = FD.grid, lift = spec.lift ?? 1.0, ground = S.ground;
  const dark = (u, v) => { const d = S.sdfRooms(u, v); return (1 - 0.97 * sstep(-55, 48, d)) * Math.min(1 - sstep(-40, 36, d), 1 - S.exitDark(u, v)) * (1 - 0.85 * S.tunnelFade(u, v)); };
  for (const D of list) { const n = D.s > 80 ? 6 : 4, cu = (D.cell % g) / g, cv = Math.floor(D.cell / g) / g, ca = Math.cos(D.rot), sa = Math.sin(D.rot), base = P.length / 3;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const a = i / n - 0.5, b = j / n - 0.5, lu = (a * ca - b * sa) * D.s, lv = (a * sa + b * ca) * D.s, u = D.u + lu, v = D.v - lv;   // 그림 아래쪽 = 화면 아래(v -)
      const [x, z] = W2(u, v); P.push(x, ground(u, v) + lift, z); UV.push(cu + (i / n) / g, cv + (j / n) / g); const k = dark(u, v); C.push(k, k, k); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = base + j * (n + 1) + i; I.push(q, q + n + 1, q + 1, q + 1, q + n + 1, q + n + 2); } }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(C, 3)); geo.setIndex(I); geo.computeVertexNormals();
  const mat = new T.MeshStandardMaterial({ map: cm, normalMap: nm, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.01, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  mat.color.setRGB(...(spec.tint || [0.62, 0.55, 0.5]));   // 노멀은 그림 줄(v) 방향 기준으로 만들어 둠(flipY 없음 → 그대로)
  const mesh = new T.Mesh(geo, mat); mesh.receiveShadow = true; mesh.renderOrder = 1; mesh.name = 'decals'; root.add(mesh);
  return mesh;
}
