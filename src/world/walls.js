// 바위벽: 방 모양 경계선을 따라 세운다. 화면 위쪽(먼 쪽) 벽만 높게, 옆은 낮게, 카메라 쪽은 세우지 않음(시야 안 가림, 경계는 어둠으로)
import { T, V, sstep } from '../core/math.js';
import { fbm2, fbm3 } from '../core/noise.js';
import { W2 } from './coords.js';
import { placeWallKit } from './wallkit.js';

export function buildWalls(W) {
  const { root, M, ROOM } = W, { sdfUV, gradUV, EXITS, inTunnel, pastMouth, exitDark } = W.S;
  // ── 벽 밑선: 모양(sdf)의 경계선을 따라 닫힌 고리들(바깥 벽 + 바위 섬) ──
  function contours(f, u0, u1, v0, v1, st) {
    const nu = Math.ceil((u1 - u0) / st), nv = Math.ceil((v1 - v0) / st), val = new Float32Array((nu + 1) * (nv + 1)), at = (i, j) => val[j * (nu + 1) + i];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) val[j * (nu + 1) + i] = f(u0 + i * st, v0 + j * st);
    const ep = (i0, j0, i1, j1) => { const a = at(i0, j0), b = at(i1, j1), t = a / (a - b); return [u0 + (i0 + (i1 - i0) * t) * st, v0 + (j0 + (j1 - j0) * t) * st]; };
    const segs = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const E = [[i, j, i + 1, j], [i + 1, j, i + 1, j + 1], [i, j + 1, i + 1, j + 1], [i, j, i, j + 1]], P = [];
      for (const e of E) if ((at(e[0], e[1]) < 0) !== (at(e[2], e[3]) < 0)) P.push(ep(...e));
      if (P.length === 2) segs.push(P); else if (P.length === 4) segs.push([P[0], P[1]], [P[2], P[3]]); }
    const key = p => p[0].toFixed(1) + ',' + p[1].toFixed(1), adj = new Map();
    segs.forEach((s, k) => { for (const p of s) { const kk = key(p); if (!adj.has(kk)) adj.set(kk, []); adj.get(kk).push(k); } });
    const used = new Uint8Array(segs.length), loops = [];
    for (let s0 = 0; s0 < segs.length; s0++) { if (used[s0]) continue; used[s0] = 1; const L = [segs[s0][0], segs[s0][1]];
      for (;;) { const last = L[L.length - 1], c = (adj.get(key(last)) || []).find(k => !used[k]); if (c === undefined) break; used[c] = 1; const s = segs[c]; L.push(key(s[0]) === key(last) ? s[1] : s[0]); }
      if (L.length > 12) loops.push(L); }
    return loops; }
  function resample(L, step) { const out = [], n = L.length; let acc = 0; out.push(L[0]);
    for (let i = 1; i < n; i++) { const a = L[i - 1], b = L[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = step - acc;
      while (t <= d) { out.push([a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d]); t += step; } acc = d - (t - step); }
    for (let k = 0; k < 2; k++) for (let i = 0; i < out.length; i++) { const a = out[(i - 1 + out.length) % out.length], c = out[(i + 1) % out.length]; out[i] = [(a[0] + out[i][0] * 2 + c[0]) / 4, (a[1] + out[i][1] * 2 + c[1]) / 4]; }
    return out; }
  const LOOPS = contours(sdfUV, -1050, 950, -820, 1150, 18).map(L => resample(L, 22)).map(L => {
    const isl = ROOM.islands.some(([iu, iv, ru, rv]) => L.every(p => Math.hypot(p[0] - iu, p[1] - iv) < Math.max(ru, rv) * 1.8));   // 바위 섬 둘레 고리(모든 점이 섬 가까이)
    return { isl, pts: L.map(([u, v]) => { const [gu, gv] = gradUV(u, v), [x, z] = W2(u, v), [nx, nz] = W2(-gu, -gv); return { u, v, x, z, nx, nz, cf: -gv }; }) }; });   // cf > 0: 카메라 쪽 벽(안쪽이 화면 위를 봄)
  for (const L of LOOPS) { const n = L.pts.length, K = 7; L.pts.forEach((q, i) => { let a = 0; for (let k = -K; k <= K; k++) a += L.pts[(i + k + n) % n].cf; q.cfs = a / (2 * K + 1); q.mo = EXITS.reduce((m, e) => Math.max(m, 1 - sstep(150, 270, Math.hypot(q.u - e.m[0], q.v - e.m[1]))), 0); }); }   // cfs: 둘레를 따라 고르게 한 cf(경계가 울퉁불퉁해도 옆벽이 중간에 끊기지 않게) · mo: 출구 굴 어귀에 가까운 정도
  const MASS = ROOM.wallMass;   // 바위 덩어리(아래 설명)
  const WROWS = 9, wallOff = (q, h, f, seed) => { const y = h * f, bulge = (fbm3(q.x / 90, y / 90, q.z / 90, seed, 3) - 0.5) * 95 + (fbm3(q.x / 30, y / 30, q.z / 30, seed + 3, 2) - 0.5) * 22, lean = (-55 * f * f + 25 * Math.sin(f * Math.PI)) * (MASS ? sstep(0.15, -0.35, q.cfs ?? q.cf) * (1 - (q.mo || 0)) : 1); return (bulge + lean) * Math.min(1, 0.25 + h / 260); };   // 기울기: 먼 쪽 벽만(옆으로 선 벽은 곧게 — 옆에서 보면 얇은 날처럼 튀어나와 보여서). 출구 굴 어귀(mo)도 곧게(모서리가 굴 쪽으로 칼날처럼 튀어나오지 않게)
  // 바위 덩어리(방 데이터 wallMass): 벽은 얇은 판이라 뒤가 비어 보인다 → 벽 바깥 전체를 속이 찬 바위(높이 지도)로 채운다
  //   벽 꼭대기에는 덮개(LIP)를 달아 바깥으로 내려가며 바위 덩어리 속으로 들어가게(벽과 덩어리 사이 틈이 어디서도 안 보이게). 덮개 끝은 그 자리 덩어리 높이보다 낮게 맞춘다
  const LIP = MASS ? 2 : 0, RW = WROWS + 1 + LIP; let massAt = null;   // massAt(u, v) → [높이, 밝기, 어둠 정도] | null (벽 높이를 다 정한 뒤 채운다)
  const lipEnd = q => { if (q._lip) return q._lip; const [gu, gv] = gradUV(q.u, q.v); let bt = 40, bd = -1e9;   // 바깥으로 나가며 덩어리가 다 솟은 곳(sdf ≥ 122)까지. 바깥이 좁으면(벽 사이 쐐기) 가장 깊은 데까지만
    for (let t = 60; t <= 320; t += 12) { const d = sdfUV(q.u + gu * t, q.v + gv * t); if (d > bd) { bd = d; bt = t; } if (d >= 122) break; } return (q._lip = { t: bt, u: q.u + gu * bt, v: q.v + gv * bt }); };
  function wallStrip(pts, H, seed, closed = true, fade = null) {   // fade(i): 끝부분을 어둠으로 녹이는 정도(1 = 그대로)   // pts: [{x,z,nx,nz}], H(i): 높이, closed: 닫힌 고리
    const g = new T.BufferGeometry(), P = [], U = [], C = [], I = [], n = pts.length, cnt = closed ? n + 1 : n; let arc = 0;
    for (let i = 0; i < cnt; i++) { const q = pts[i % n]; if (i) arc += Math.hypot(q.x - pts[(i - 1) % n].x, q.z - pts[(i - 1) % n].z); const h = H(i % n), ex = q.u === undefined ? 1 : 1 - 0.98 * exitDark(q.u, q.v); let kTop = 0;
      for (let j = 0; j <= WROWS; j++) { const f = j / WROWS, y = h * f, o = wallOff(q, h, f, seed);
        P.push(q.x - q.nx * o, y, q.z - q.nz * o); U.push(arc / 230, y / 230); const ao = 0.38 + 0.62 * sstep(0, Math.min(60, h * 0.8), y), top = 1 - 0.75 * sstep(h * 0.4, h, y) * sstep(120, 280, h), k = ao * top * (0.85 + 0.3 * fbm3(q.x / 120, y / 120, q.z / 120, seed + 9, 2)) * ex; C.push(k, k, k); kTop = k; }
      if (LIP) { const oT = wallOff(q, h, 1, seed); let oE = oT, yE = h;
        if (massAt && q.u !== undefined && h > 2) { const E = lipEnd(q); let mh = 1e9, any = false; for (const [du, dv] of [[0, 0], [16, 0], [-16, 0], [0, 16], [0, -16]]) { const m = massAt(E.u + du, E.v + dv); if (m) { any = true; mh = Math.min(mh, m[0]); } else mh = Math.min(mh, 0); }   // 덮개 끝 둘레에서 가장 낮은 덩어리 높이보다 아래로
          oE = Math.max(oT + 4, E.t); yE = any ? Math.max(0, Math.min(h - 8, mh - 16)) : h - 8; }
        for (let s2 = 1; s2 <= LIP; s2++) { const t = s2 / LIP, o = oT + (oE - oT) * t; P.push(q.x - q.nx * o, h + (yE - h) * t, q.z - q.nz * o); U.push(arc / 230, (h + o) / 230); const k = kTop * (1 - 0.3 * t); C.push(k, k, k); } } }
    for (let i = 0; i < cnt - 1; i++) for (let j = 0; j < RW - 1; j++) { const a = i * RW + j, b = a + RW; I.push(a, b, a + 1, b, b + 1, a + 1); }
    { const D = []; for (let i = 0; i < cnt; i++) { const f = fade ? fade(i % n) : 1; for (let j = 0; j < RW; j++) D.push(f); } g.setAttribute('wdk', new T.Float32BufferAttribute(D, 1)); }
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    const nA = g.attributes.normal; if (nA.getX(WROWS >> 1) * pts[0].nx + nA.getZ(WROWS >> 1) * pts[0].nz < 0) { for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } g.setIndex(I); g.computeVertexNormals(); }
    const m = new T.Mesh(g, M.wall); m.receiveShadow = true; root.add(m); return m; }
  // 벽 높이: 먼 쪽(cf < 0)은 높게, 카메라 쪽(cf → 1)으로 갈수록 낮아져 끝난다. 방 데이터 wallSide = [cf 시작, cf 끝] — 기본은 옆에서 이미 낮아짐, 크게 주면 양옆 벽을 아래까지 높게 이어 세운다
  const SIDE = W.ROOM.wallSide || [-0.6, 0.15], NZ = W.ROOM.wallSide ? [SIDE[0] - 0.3, SIDE[0]] : [-0.3, 0.05];   // NZ: 꼭대기 높낮이 잡음이 사라지는 구간
  const wallH = (q, isl) => isl ? 75 + 45 * fbm2(q.u / 80 + 3, q.v / 80, 64, 59, 2) : EXITS.some(e => inTunnel(q.u, q.v, e, 90) && pastMouth(q.u, q.v, e) > -90) ? (300 + 60 * fbm2(q.u / 90 + 1, q.v / 90 + 1, 64, 61, 2)) * (1 - 0.85 * sstep(-0.45, 0.05, MASS ? q.cfs : q.cf)) : 18 + 352 * (1 - sstep(SIDE[0], SIDE[1], q.cfs)) + 80 * (fbm2(q.u / 150 + 7, q.v / 150 + 7, 64, 4, 3) - 0.5) * (1 - sstep(NZ[0], NZ[1], q.cfs));
  // 굴 벽도 먼 쪽만 높고 카메라 쪽은 낮게(굴에 들어간 주인공을 가리지 않게)
  const END = ROOM.wallEnd || { ramp: 9, fade: 12 };   // 벽 구간 끝: ramp 칸에 걸쳐 낮아지고 fade 칸에 걸쳐 어둠으로 녹는다
  const H_MIN = 45;   // 이보다 낮은 벽(카메라 쪽)은 세우지 않는다. 옆 벽은 카메라 쪽으로 갈수록 낮아지다 바닥까지 비스듬히 끝난다
  // 1) 높이 정하기: 고리마다 세울 구간(runs)과 점마다 실제 높이(hg) · 어둠으로 녹는 정도(fd) · 소품을 걸 수 있는 높이(hb)
  const smoothH = h => { const n = h.length; let a = h; for (let p2 = 0; p2 < 3; p2++) a = a.map((x, i) => (a[(i - 1 + n) % n] + 2 * x + a[(i + 1) % n]) / 4); return a; };   // 둘레 따라 고르게(높은 벽 옆에서 갑자기 낮아져 지느러미처럼 서지 않게)
  LOOPS.forEach((L, k) => { L.seed = 11 + k * 13; L.h = L.pts.map(q => wallH(q, L.isl)); if (MASS && !L.isl) L.h = smoothH(L.h); L.hb = L.h.map(() => 0); L.hg = L.h.map(() => 0); L.fd = L.h.map(() => 0); L.runs = []; if (L.isl) return;
    const n = L.pts.length, on = L.h.map(h => h >= H_MIN);
    if (on.every(Boolean)) { L.runs.push({ all: true }); L.hb = L.h.slice(); L.hg = L.h.slice(); L.fd = L.h.map(() => 1); return; }
    const s0 = on.findIndex(x => !x); for (let k2 = 1; k2 <= n; k2++) { const i = (s0 + k2) % n; if (!on[i] || on[(i - 1 + n) % n]) continue;   // 높은 구간의 시작
      const run = []; let j = (i - 1 + n) % n; run.push(j); while (on[(j + 1) % n] && run.length <= n) { j = (j + 1) % n; run.push(j); } run.push((j + 1) % n);
      const m = run.length - 1, ramp = t => sstep(0, END.ramp, t) * sstep(0, END.ramp, m - t), fade = t => sstep(1, END.fade, t) * sstep(1, END.fade, m - t);   // 구간 끝은 낮아지며 어둠으로 녹는다(잘린 단면이 안 보이게)
      if (m < 14) continue;   // 아주 짧은 구간은 거의 납작한 검은 판이 돼서 세우지 않는다
      L.runs.push({ run, ramp, fade }); run.forEach((t, j) => { L.hg[t] = L.h[t] * ramp(j); L.fd[t] = fade(j); L.hb[t] = L.hg[t] * (fade(j) > 0.8 ? 1 : 0); }); } });
  const WALL = LOOPS.filter(L => !L.isl);
  // 2) 바위 덩어리 높이: 벽 바깥(sdf > 0)에서 가까운 벽들의 실제 높이를 따라가고(벽이 낮아지면 같이 낮아짐, 벽이 없는 카메라 쪽은 없음) 바깥으로 갈수록 조금씩 솟으며 어둠으로 녹는다
  const SM = []; if (MASS) for (const L of WALL) L.pts.forEach((q, i) => SM.push(q.u, q.v, L.hg[i], L.fd[i]));
  const ext = MASS ? MASS.ext || 460 : 0;
  if (MASS && SM.length) massAt = (u, v) => { const d = sdfUV(u, v); if (d < 55 || d > ext) return null;
    let dm = 1e9; for (let k = 0; k < SM.length; k += 4) { const e = (SM[k] - u) ** 2 + (SM[k + 1] - v) ** 2; if (e < dm) dm = e; } dm = Math.sqrt(dm);
    let sw = 0, sh = 0, sf = 0; for (let k = 0; k < SM.length; k += 4) { const e = Math.hypot(SM[k] - u, SM[k + 1] - v) - dm; if (e > 150) continue; const w = Math.exp(-e / 30); sw += w; sh += w * SM[k + 2] ** 3; sf += w * SM[k + 3]; }   // 높은 벽 쪽으로 치우친 평균(세제곱 평균)
    const base = Math.cbrt(sh / sw), fd = sf / sw; if (base < 6) return null;
    const out = Math.max(0, d - 108), big = sstep(20, 110, base), lump = (fbm2(u / 120 + 3, v / 120 + 9, 64, 91, 3) - 0.5) * 80 * sstep(110, 240, d);
    const crag = (fbm2(u / 70 + 31, v / 70 + 17, 64, 97, 3) - 0.5) * 2 * (12 + 0.09 * base);   // 울퉁불퉁함(평평한 비탈이 판처럼 안 보이게)
    const H = Math.max(0, base + crag * big + ((MASS.slope ?? 0.28) * out + lump) * big) * sstep(58, 108, d);
    return [H, Math.min(0.5, 1 - 0.72 * sstep(120, 280, H)) * (1 - 0.55 * sstep(108, 330, d)) * (0.85 + 0.3 * fbm2(u / 90 + 13, v / 90 + 5, 64, 93, 2)) * (1 - 0.98 * exitDark(u, v)), fd * (1 - sstep(MASS.dark0 ?? 240, MASS.dark1 ?? 430, d))]; };
  // 3) 벽 세우기(덮개가 덩어리 높이에 맞물리게, 높이를 다 정한 뒤에)
  //    방 데이터 wallKit 이 있으면 얇은 벽 대신 미리 만든 벽 조각을 휘어 붙인다(wallkit.js · 바위 섬 둘레는 그대로)
  const KIT = ROOM.wallKit && W.kitGeo ? placeWallKit(W, W.kitGeo, LOOPS) : null;
  for (const L of LOOPS) for (const r of L.runs) { if (KIT && !L.isl) continue; if (r.all) wallStrip(L.pts, i => L.h[i], L.seed); else wallStrip(r.run.map(t => L.pts[t]), t => L.h[r.run[t]] * r.ramp(t), L.seed, false, r.fade); }
  // 4) 바위 덩어리 그물: 격자 높이 지도 — 어느 각도에서 봐도 벽 뒤는 이어진 바위면(뒷공간·빈틈 없음)
  if (massAt) { const cell = MASS.cell || 22, ground = W.S.ground || (() => 0); let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (let k = 0; k < SM.length; k += 4) { u0 = Math.min(u0, SM[k]); u1 = Math.max(u1, SM[k]); v0 = Math.min(v0, SM[k + 1]); v1 = Math.max(v1, SM[k + 1]); } u0 -= ext; u1 += ext; v0 -= ext; v1 += ext;
    const nu = Math.ceil((u1 - u0) / cell), nv = Math.ceil((v1 - v0) / cell), N = (nu + 1) * (nv + 1), Hh = new Float32Array(N), Kk = new Float32Array(N), Ff = new Float32Array(N);
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const m = massAt(u0 + i * cell, v0 + j * cell); if (!m) continue; const n = j * (nu + 1) + i; Hh[n] = m[0]; Kk[n] = m[1]; Ff[n] = m[2]; }
    // 덩이(TILE 칸)마다 따로 그물을 만든다(화면 밖 덩이는 안 그림)
    //   노멀은 전체 높이 격자에서 바로 계산(덩이 경계에서 빛이 끊겨 보이지 않게)
    const Ht = new Float32Array(N); for (let n = 0; n < N; n++) { const i = n % (nu + 1), j = (n - i) / (nu + 1); Ht[n] = ground(u0 + i * cell, v0 + j * cell) + Hh[n]; }
    const [ru, rz] = W2(1, 0), [fu, fz] = W2(0, 1), HT = (i, j) => Ht[Math.max(0, Math.min(nv, j)) * (nu + 1) + Math.max(0, Math.min(nu, i))];
    const TILE = 32; for (let tj = 0; tj < nv; tj += TILE) for (let ti = 0; ti < nu; ti += TILE) { const id = new Map(), P = [], NN = [], U = [], C = [], D = [], I = [], vid = n => { if (id.has(n)) return id.get(n); const i = n % (nu + 1), j = (n - i) / (nu + 1), u = u0 + i * cell, v = v0 + j * cell, [x, z] = W2(u, v);
      const du = (HT(i + 1, j) - HT(i - 1, j)) / (2 * cell), dv = (HT(i, j + 1) - HT(i, j - 1)) / (2 * cell), nx = -(du * ru + dv * fu), nz = -(du * rz + dv * fz), nl = Math.hypot(nx, 1, nz);
      P.push(x, Ht[n] - 2, z); NN.push(nx / nl, 1 / nl, nz / nl); U.push(u / 230, v / 230); C.push(Kk[n], Kk[n], Kk[n]); D.push(Ff[n]); id.set(n, P.length / 3 - 1); return P.length / 3 - 1; };
      for (let j = tj; j < Math.min(nv, tj + TILE); j++) for (let i = ti; i < Math.min(nu, ti + TILE); i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, e = c + 1; if (Math.max(Hh[a], Hh[b], Hh[c], Hh[e]) < 0.5) continue; I.push(vid(a), vid(b), vid(c), vid(b), vid(e), vid(c)); }
      if (!I.length) continue; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setAttribute('wdk', new T.Float32BufferAttribute(D, 1));
      g.setAttribute('normal', new T.Float32BufferAttribute(NN, 3)); g.setIndex(I); const m = new T.Mesh(g, M.wall); m.receiveShadow = true; m.name = 'wallMass'; root.add(m); } }
  function wallSpot(tu, tv, y, minH = y + 60) {   // (u,v)에 가장 가까운, 실제로 세운(높이 minH 이상) 벽의 높이 y 표면 자리와 안쪽 방향
    let best = null; for (const L of WALL) L.pts.forEach((q, i) => { if (L.hb[i] < minH) return; const d = Math.hypot(q.u - tu, q.v - tv); if (!best || d < best.d) best = { d, q, h: L.h[i], seed: L.seed, L, i }; });
    if (!best) return null; const { q, h, seed } = best;
    if (KIT) {   // 벽 조각: 둘레 앞뒤(±2점 · 약 ±44) 중 바위 면이 가장 앞으로 나온 곳에 건다(덩어리 사이 깊은 틈에 박혀 안 보이지 않게)
      const { L, i } = best, n = L.pts.length; let pick = null;
      for (let k = -2; k <= 2; k++) { const j = (i + k + n) % n, qq = L.pts[j]; if (L.hb[j] < minH) continue; const p = KIT.surface(qq, y); if (!p) continue; const out = (p.x - qq.x) * qq.nx + (p.z - qq.z) * qq.nz - Math.abs(k) * 4; if (!pick || out > pick.out) pick = { out, p, qq }; }
      if (pick) return { p: pick.p, n: V(pick.qq.nx, 0, pick.qq.nz), q: pick.qq, d: Math.hypot(pick.qq.u - tu, pick.qq.v - tv) }; }
    const o = wallOff(q, h, Math.min(1, y / h), seed); return { p: V(q.x - q.nx * o, y, q.z - q.nz * o), n: V(q.nx, 0, q.nz), q, d: best.d }; }
  return { LOOPS, WALL, H_MIN, wallSpot, wallOff, KIT };
}
