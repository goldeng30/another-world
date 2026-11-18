// 벽 조각 배치(방 데이터 wallKit): 벽 밑선을 따라 미리 만든 바위 벽 조각(assets/rocks/cliff*.glb, 규격은 tools/walls/KIT_SPEC.md)을 휘어 이어 붙인다
//   높이·끝 처리(어디에 세우고 어디서 낮아지나)는 walls.js 가 정한 그대로 쓰고, 그 높이에 맞춰 조각을 늘이거나 줄인다
//   wallKit = { len: 한 칸 길이(230), tall: 높은 조각을 쓰는 높이(230), mid: 중간 조각 높이(120), pillars: 굴 입구 양옆 기둥(기본 켬) }
import { T, V, sstep } from '../core/math.js';
import { fbm2 } from '../core/noise.js';
import { U2 } from './coords.js';
import { loadRockGeo } from './props.js';
import { WALL_KIT } from '../data/wallkit.js';

// 조각 모양 미리 받기(방을 만들기 전에): 이름 → 조각 정보(꼭짓점·색·면 + 앞면 깊이표)
export async function loadWallKit() {
  const out = {};
  await Promise.all(Object.entries(WALL_KIT).map(async ([name, info]) => { const g = await loadRockGeo(name); if (!g) return;
    const p = g.attributes.position, c = g.attributes.color, I = g.index ? g.index.array : null;
    const P = Float32Array.from(p.array), C = c ? Float32Array.from(c.array.length === p.count * 3 ? c.array : Array.from({ length: p.count * 3 }, (_, k) => c.array[Math.floor(k / 3) * c.itemSize + k % 3])) : new Float32Array(p.count * 3).fill(0.8);
    const F = I ? Uint32Array.from(I) : Uint32Array.from({ length: p.count }, (_, k) => k);
    // 앞면 깊이표: x(24칸) × 높이(16칸)마다 가장 앞(+z)으로 나온 곳 — 벽에 거는 소품 자리(wallSpot)용
    const NX = 24, NY = 16, hN = info.h, front = new Float32Array(NX * NY).fill(-9);
    for (let k = 0; k < p.count; k++) { const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2], i = Math.floor((x + 0.62) / 1.24 * NX), j = Math.floor(y / (hN * 1.05) * NY); if (i < 0 || i >= NX || j < 0 || j >= NY) continue; const n = j * NX + i; if (z > front[n]) front[n] = z; }
    for (let n = 0; n < NX * NY; n++) if (front[n] < -8) { let best = -0.1, bd = 1e9; for (let m = 0; m < NX * NY; m++) if (front[m] > -8) { const d = (m % NX - n % NX) ** 2 + (Math.floor(m / NX) - Math.floor(n / NX)) ** 2; if (d < bd) { bd = d; best = front[m]; } } front[n] = best; }
    out[name] = { ...info, P, C, F, front, NX, NY }; }));
  return out;
}

export function placeWallKit(W, KIT, LOOPS) {
  const { root, M, ROOM } = W, { exitDark, EXITS } = W.S, ground = W.S.ground || (() => 0), O = ROOM.wallKit, Lm = O.len || 230;
  const kinds = {}; for (const [n, k] of Object.entries(KIT)) (kinds[k.kind] = kinds[k.kind] || []).push(n);
  let seed = 1234567; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let P, C, D, U, I; const meshes = []; let nV = 0, nT = 0;   // 조각 몇 개씩 한 그물로(덩이마다 따로 그려 화면 밖은 안 그림)
  const reset = () => { P = []; C = []; D = []; U = []; I = []; }; reset();
  const flush = () => { if (!I.length) return; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setAttribute('wdk', new T.Float32BufferAttribute(D, 1)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    g.setIndex(P.length / 3 > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1)); g.computeVertexNormals(); const m = new T.Mesh(g, M.wall); m.receiveShadow = true; m.name = 'wallKit'; root.add(m); meshes.push(m); nV += P.length / 3; nT += I.length / 3; reset(); };
  const paths = [];   // 벽 구간마다 { pts, S, H, F, closed, mods, sgn } — wallSpot 이 다시 찾아 쓴다
  // 구간(점 목록) → 길이 따라 위치·안쪽 방향·높이·어둠 정도를 꺼내는 함수
  function makePath(L, idx, H, F, closed) {
    const pts = idx.map(i => L.pts[i]), n = pts.length, S = new Float32Array(n + (closed ? 1 : 0)); for (let k = 1; k < S.length; k++) { const a = pts[k - 1], b = pts[k % n]; S[k] = S[k - 1] + Math.hypot(b.x - a.x, b.z - a.z); }
    const total = S[S.length - 1], t0 = [pts[1].x - pts[0].x, pts[1].z - pts[0].z], sgn = Math.sign(-t0[1] * pts[0].nx + t0[0] * pts[0].nz) || 1;   // sgn: 길이 방향 × 위 = 안쪽이면 +1(뒤집힌 배치면 면 순서를 뒤집는다)
    const at = s => { if (closed) s = ((s % total) + total) % total; const sc = Math.max(0, Math.min(total, s)); let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= sc) lo = m; else hi = m; }
      const a = pts[lo % n], b = pts[hi % n], t = (sc - S[lo]) / Math.max(1e-6, S[hi] - S[lo]), ex = s - sc;   // ex: 열린 구간 끝 너머(끝 방향으로 곧게 늘인다)
      let nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const tx = (b.x - a.x) / Math.max(1e-6, S[hi] - S[lo]), tz = (b.z - a.z) / Math.max(1e-6, S[hi] - S[lo]);
      return { x: a.x + (b.x - a.x) * t + tx * ex, z: a.z + (b.z - a.z) * t + tz * ex, nx, nz, h: H[lo % n] + (H[hi % n] - H[lo % n]) * t, f: F[lo % n] + (F[hi % n] - F[lo % n]) * t }; };
    return { L, idx, pts, S, total, closed, at, sgn, mods: [] };
  }
  const TALL = O.tall ?? 230, MID = O.mid ?? 120;
  function addPiece(name, xform, tone) {   // xform(x, y, z) → [X, Y, Z, 높이, 어둠 정도] · tone: 색 곱
    const K = KIT[name], base = P.length / 3, n = K.P.length / 3;
    for (let k = 0; k < n; k++) { const r = xform(K.P[k * 3], K.P[k * 3 + 1], K.P[k * 3 + 2]), [X, Y, Z, h, f] = r, [u, v] = U2(X, Z), yl = Y - r[5];
      const top = 1 - 0.75 * sstep(h * 0.4, h, yl) * sstep(120, 280, h), ex = 1 - 0.98 * exitDark(u, v), kk = top * ex * tone * (0.88 + 0.24 * fbm2(u / 140 + 5, v / 140 + 3, 64, 77, 2));
      P.push(X, Y, Z); C.push(K.C[k * 3] * kk, K.C[k * 3 + 1] * kk, K.C[k * 3 + 2] * kk); D.push(f); U.push((u + v) / 230, Y / 230); }
    return { base, F: K.F };
  }
  function pushFaces(base, F, flip) { for (let k = 0; k < F.length; k += 3) { if (flip) I.push(base + F[k], base + F[k + 2], base + F[k + 1]); else I.push(base + F[k], base + F[k + 1], base + F[k + 2]); } }
  // 1) 벽 구간마다 조각을 고르게 나눠 붙이기
  for (const L of LOOPS) { if (L.isl) continue;
    for (const r of L.runs) { const idx = r.all ? L.pts.map((_, i) => i) : r.run, H = r.all ? L.h.slice() : r.run.map(t => L.hg[t]), F = r.all ? L.h.map(() => 1) : r.run.map(t => L.fd[t]);
      const path = makePath(L, idx, H, F, !!r.all); paths.push(path); const cnt = Math.max(1, Math.round(path.total / Lm)), len = path.total / cnt; let prev = '';
      for (let m = 0; m < cnt; m++) { const s0 = m * len; let hm = 0; for (let k = 1; k < 8; k++) hm = Math.max(hm, path.at(s0 + len * k / 8).h);
        if (hm < 8) continue;   // 거의 납작한 끝은 건너뛴다
        const kind = hm >= TALL ? 'tall' : hm >= MID ? 'mid' : 'low', list = (kinds[kind] || kinds.tall || []).filter(nm => nm !== prev), name = list[Math.floor(rnd() * list.length)] || prev; if (!name) continue; prev = name;
        const K = KIT[name], hN = K.h, mir = rnd() < 0.5 ? -1 : 1;
        const xf = (x, y, z) => { const a = path.at(s0 + (x * mir + 0.5) * len), hs = Math.max(0, a.h), rk = Math.min(1, hs / (hN * Lm)), zk = 0.55 + 0.45 * rk, zz = z * Lm * zk, g = ground(...U2(a.x, a.z));
          return [a.x + a.nx * zz, g + y / hN * hs, a.z + a.nz * zz, hs, a.f, g]; };
        const { base, F: FF } = addPiece(name, xf, 1); pushFaces(base, FF, (path.sgn * mir) < 0);
        path.mods.push({ s0, len, name, mir }); if (P.length / 3 > 14000) flush(); } } }
  // 2) 굴 입구 양옆: 큰 바위 기둥(휘지 않고 통째로) — 벽이 굴 쪽으로 꺾이는 모서리를 덮는다
  if (O.pillars !== false && kinds.pillar) for (const e of EXITS) { const side = [e.d[1], -e.d[0]];
    for (const sg of [-1, 1]) { const cu = e.m[0] + side[0] * sg * (e.r + 15), cv = e.m[1] + side[1] * sg * (e.r + 15); let best = null, bd = 140 * 140;
      for (const L of LOOPS) { if (L.isl) continue; L.pts.forEach((q, i) => { const d = (q.u - cu) ** 2 + (q.v - cv) ** 2; if (d < bd && L.hg[i] > 60) { bd = d; best = { q, h: L.hg[i] }; } }); }
      if (!best) continue; const { q } = best, name = kinds.pillar[Math.floor(rnd() * kinds.pillar.length)], K = KIT[name], hT = Math.max(220, best.h) * (O.pillarH ?? 1.0), sc = hT / K.h, rot = rnd() * 6.28, cs = Math.cos(rot), sn = Math.sin(rot);
      const px = q.x - q.nx * sc * 0.12, pz = q.z - q.nz * sc * 0.12, g = ground(...U2(px, pz));
      const { base, F: FF } = addPiece(name, (x, y, z) => [px + (x * cs - z * sn) * sc, g + y * sc, pz + (x * sn + z * cs) * sc, hT, 1, g], 0.95); pushFaces(base, FF, false); } }
  flush(); if (!meshes.length) return null;
  // 벽 조각이 실제로 차지하는 곳 막기: 방 모양 경계선보다 안쪽으로 튀어나온 바위·기둥(바닥보다 30 넘게 높은 꼭짓점이 걸을 수 있는 쪽에 있는 곳)을 작은 부딪힘 원으로 — 주인공·적이 벽 속으로 못 들어가게
  { const CELL = 14, cells = new Map(), sdf = W.S.sdfUV;
    for (const m of meshes) { const pa = m.geometry.attributes.position.array;
      for (let k = 0; k < pa.length; k += 3) { const x = pa[k], y = pa[k + 1], z = pa[k + 2], [u, v] = U2(x, z); if (y - ground(u, v) < 30) continue; const d = sdf(u, v); if (d > -14) continue;
        const key = Math.floor(u / CELL) + ',' + Math.floor(v / CELL), c = cells.get(key); if (!c || d < c.d) cells.set(key, { x, z, d }); } }
    for (const c of cells.values()) W.colliders.push({ x: c.x, z: c.z, r: 10, wall: true }); }
  // 벽에 거는 소품 자리: 벽 밑선 점(q) → 그 점이 속한 구간·조각 → 앞면 깊이표에서 그 높이의 앞면까지
  const where = new Map(); for (const pa of paths) pa.idx.forEach((i, k) => where.set(pa.pts[k], { pa, s: pa.S[k] }));
  function surface(q, y) { const w = where.get(q); if (!w) return null; const { pa, s } = w, md = pa.mods.find(m => s >= m.s0 && s < m.s0 + m.len) || pa.mods[pa.mods.length - 1]; if (!md) return null;
    const K = KIT[md.name], a = pa.at(s), hs = Math.max(1, a.h), x = ((s - md.s0) / md.len - 0.5) * md.mir, yl = y / hs * K.h, i = Math.max(0, Math.min(K.NX - 1, Math.floor((x + 0.62) / 1.24 * K.NX))), j = Math.max(0, Math.min(K.NY - 1, Math.floor(yl / (K.h * 1.05) * K.NY)));
    const zk = 0.55 + 0.45 * Math.min(1, hs / (K.h * Lm)), off = K.front[j * K.NX + i] * Lm * zk; return V(a.x + a.nx * off, y, a.z + a.nz * off); }
  return { meshes, surface, verts: nV, tris: nT };
}
