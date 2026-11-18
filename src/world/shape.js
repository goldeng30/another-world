// 방 모양(부호 거리 sdf): 타원·캡슐을 부드럽게 합친 동굴 + 출구 굴 + 바위 섬. 움직일 수 있는 곳 · 어둠 · 축축한 곳
import { sstep } from '../core/math.js';
import { fbm2 } from '../core/noise.js';
import { W2, U2 } from './coords.js';

export const ell = (cu, cv, ru, rv) => (u, v) => (Math.hypot((u - cu) / ru, (v - cv) / rv) - 1) * Math.min(ru, rv);
export const cap = (au, av, bu, bv, r) => (u, v) => { const du = bu - au, dv = bv - av, t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / (du * du + dv * dv))); return Math.hypot(u - au - du * t, v - av - dv * t) - r; };
// 넓어지는 굴(tcap): a 쪽 반지름 ra → b 쪽 반지름 rb (방 쪽을 넓게 두면 멀리 갈수록 좁아 보이는 원근을 메운다)
export const tcap = (au, av, bu, bv, ra, rb) => (u, v) => { const du = bu - au, dv = bv - av, t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / (du * du + dv * dv))); return Math.hypot(u - au - du * t, v - av - dv * t) - (ra + (rb - ra) * t); };
export const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };

export function createShape(ROOM) {
  const EXITS = ROOM.exits.map(e => { const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], l = Math.hypot(dx, dy), d = [dx / l, dy / l], t = (e.mouth - e.a[1]) / d[1]; return { ...e, d, m: [e.a[0] + d[0] * t, e.a[1] + d[1] * t], open: false }; });
  const SHAPES = ROOM.shapes.map(([k, ...a]) => k === 'ell' ? ell(...a) : k === 'tcap' ? tcap(...a) : cap(...a)).concat(EXITS.map(e => cap(...e.a, ...e.b, e.r))), ISLANDS = ROOM.islands.map(([u, v, ru, rv]) => ell(u, v, ru, rv));
  // 경계 울퉁불퉁함(잡음): 방 데이터 calm = { below: v, k, grow } 이면 그 아래(들어온 쪽)는 k 배로 잔잔하게 + 바깥으로 grow 만큼 넓힌다(파인 곳을 메워 좁아지지 않게)
  const CALM = ROOM.calm, calmK = v => CALM ? 1 + (CALM.k - 1) * sstep(CALM.below, CALM.below - 140, v) : 1;
  // 깎기(trim): 방 데이터 trim = [[가운데 u, v, 반지름, 시작 v, 다 깎는 v]] — 큰 원 밖은 깎아 낸다(둥근 경계 그대로). 시작 v 아래로 갈수록 서서히 적용(위쪽 굴·출구는 그대로)
  const TRIMS = ROOM.trim || [], trim = (d, u, v) => { for (const [cu, cv, r, v0, v1] of TRIMS) { const w = sstep(v0, v1, v); if (w > 0) d += (-smin(-d, -(Math.hypot(u - cu, v - cv) - r), 60) - d) * w; } return d; };
  const sdfRooms = (u, v) => { let d = 1e9; for (const f of SHAPES) d = smin(d, f(u, v), 70); const c = calmK(v); return trim(d + (fbm2(u / 170 + 50, v / 170 + 50, 64, 41, 3) - 0.5) * 60 * c - (CALM ? (CALM.grow || 0) * (1 - c) / (1 - CALM.k) : 0), u, v); };
  const sdfUV = (u, v) => { let d = sdfRooms(u, v); for (const f of ISLANDS) d = Math.max(d, -(f(u, v) + (fbm2(u / 60 + 20, v / 60 + 20, 64, 43, 2) - 0.5) * 24)); return d; };
  const inTunnel = (u, v, e, pad = 0) => { const pu = u - e.a[0], pv = v - e.a[1]; return Math.abs(-pu * e.d[1] + pv * e.d[0]) < e.r + pad && pu * e.d[0] + pv * e.d[1] > -20; };
  const pastMouth = (u, v, e) => (u - e.m[0]) * e.d[0] + (v - e.m[1]) * e.d[1];   // 출구 입구선 너머(+)
  const EXIT_IN = 320, exitDark = (u, v) => { let k = 0; for (const e of EXITS) if (inTunnel(u, v, e, 90)) k = Math.max(k, sstep(120, 300, pastMouth(u, v, e))); return k; };   // 출구 굴: 120쯤 들어가면 어두워지기 시작해 300이면 깜깜
  function clamp(p, m = 40) {   // 움직일 수 있는 곳 안으로 밀어 넣기(벽에서 m 만큼), 닫힌 출구와 들어온 굴 아래로는 못 감
    for (let it = 0; it < 2; it++) { const [u, v] = U2(p.x, p.z), d = sdfUV(u, v) + m; if (d <= 0) break; const e = 4, gu = (sdfUV(u + e, v) - sdfUV(u - e, v)) / (2 * e), gv = (sdfUV(u, v + e) - sdfUV(u, v - e)) / (2 * e), gl = Math.hypot(gu, gv) || 1, [dx, dz] = W2(-gu / gl * d, -gv / gl * d); p.x += dx; p.z += dz; }
    for (const e of EXITS) { if (e.open) continue; const [u, v] = U2(p.x, p.z); if (!inTunnel(u, v, e, 40)) continue; const g = pastMouth(u, v, e) - EXIT_IN + m * 0.5; if (g > 0) { const [dx, dz] = W2(-e.d[0] * g, -e.d[1] * g); p.x += dx; p.z += dz; } }   // 닫힌 출구도 어둠 속까지(EXIT_IN)는 들어갈 수 있다
    if (ROOM.entry) { const v = U2(p.x, p.z)[1], g = ROOM.entry.stop - v; if (g > 0) { const [dx, dz] = W2(0, g); p.x += dx; p.z += dz; } } return p; }   // entry(들어온 굴)는 없어도 된다
  const DAMP = ROOM.damp;   // 축축한 곳(이끼)
  const dampAt = (u, v) => { let d = 0; for (const [cu, cv, r] of DAMP) d = Math.max(d, 1 - sstep(r * 0.35, r, Math.hypot(u - cu, v - cv))); return d; };
  const tunnelFade = (u, v) => { let k = 0; for (const e of EXITS) if (inTunnel(u, v, e, 60)) k = Math.max(k, sstep(0, 320, pastMouth(u, v, e))); const E = ROOM.entry; if (E && Math.abs(u - E.a[0]) < E.r + 60) k = Math.max(k, sstep(E.stop, E.stop - 260, v)); return k; };   // 굴 안쪽은 어둠으로
  const gradUV = (u, v) => { const e = 4, gu = (sdfUV(u + e, v) - sdfUV(u - e, v)) / (2 * e), gv = (sdfUV(u, v + e) - sdfUV(u, v - e)) / (2 * e), l = Math.hypot(gu, gv) || 1; return [gu / l, gv / l]; };
  // 주인공이 출구 굴 안으로 들어갈수록 어둠에 잠긴다(바닥 어둠과 같이, 막힌 끝에서는 완전히 깜깜)
  const HERO_DK = [90, 285], heroDark = (u, v) => { let k = 0; for (const e of EXITS) if (inTunnel(u, v, e, 40)) k = Math.max(k, sstep(HERO_DK[0], HERO_DK[1], pastMouth(u, v, e))); return k; };
  // 카메라 시야 막기용: 잡음 없는 매끈한 방 모양에서 (u, v)부터 왼쪽·오른쪽·아래 경계(어둠 시작)까지 → 그 끝 좌표
  const sdfSmooth = (u, v) => { let d = 1e9; for (const f of SHAPES) d = smin(d, f(u, v), 70); return trim(CALM ? d - (CALM.grow || 0) * (1 - calmK(v)) / (1 - CALM.k) : d, u, v); };
  const reach = (u, v, du, dv) => { let t = 0; for (let i = 0; i < 64 && t < 2500; i++) { const d = sdfSmooth(u + du * t, v + dv * t); if (d >= 0) break; t += Math.max(6, -d); } return t; };
  //   w: 경계 막기를 얼마나 쓸지(출구 굴 가까이·안에서는 0 → 카메라는 굴 방향으로 맞추지 않고 그냥 주인공을 따라간다)
  const freeNear = (u, v) => { let f = 0; for (const e of EXITS) { const pu = u - e.a[0], pv = v - e.a[1], side = Math.abs(-pu * e.d[1] + pv * e.d[0]); f = Math.max(f, sstep(-260, -120, pastMouth(u, v, e)) * (1 - sstep(e.r + 80, e.r + 220, side))); } return f; };
  const viewEdges = (u, v) => ({ L: u - reach(u, v, -1, 0), R: u + reach(u, v, 1, 0), B: v - reach(u, v, 0, -1), w: 1 - freeNear(u, v) });
  // 바닥 높낮이(살짝): 방 데이터 relief = { amp, bump, edge } — 넓게 굽이치는 기복(±amp) + 작은 둔덕(±bump) + 경계(어둠) 쪽으로 edge 만큼 살짝 올라감. 없으면 평평(0)
  const RL = ROOM.relief, ground = !RL ? () => 0 : (u, v) => RL.amp * (fbm2(u / 300 + 70, v / 300 + 70, 64, 81, 3) - 0.5) * 2 + RL.bump * (fbm2(u / 150 + 11, v / 150 + 11, 64, 83, 1) - 0.5) * 2 + RL.edge * sstep(-170, 30, sdfRooms(u, v));
  return { EXITS, SHAPES, ISLANDS, sdfRooms, sdfUV, inTunnel, pastMouth, EXIT_IN, exitDark, heroDark, viewEdges, ground, clamp, DAMP, dampAt, tunnelFade, gradUV };
}
