// 방 분위기(방 데이터에 있을 때만): 경계 바위 벽(rim) · 천장 종유석(ceiling) · 더 놓는 빛(lights) · 떠다니는 먼지(dust) · 소품 밑 접촉 그림자(contact)
//   rim:     { every, band: [d0, d1], kinds: { 이름: 비율 }, s: [최소, 최대], low: { below: v, kinds, s } , skip: [[u, v, r]], lo }  경계를 따라 바위를 둘러 동굴 벽처럼(가벼운 판 _lo 로 · lo: false 면 촘촘한 판)
//   ceiling: [{ at: [u, v], y, s, rock }]   거꾸로 매단 바위(종유석)
//   lights:  [{ at: [u, v], y, color, i, dist }]   점광원(출구 굴에서 새는 차가운 빛 등)
//   dust:    [{ at: [u, v], r, h, n }]   빛 속 먼지
//   contact: 소품·바위 밑에 부드러운 접촉 그림자(바닥과 닿는 곳이 어둡게)
import { T, V } from '../core/math.js';
import { W2, U2 } from './coords.js';
import { loadRockGeo } from './props.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const softTex = (inner = 0.0, a0 = 1) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(0,0,0,${a0})`); gr.addColorStop(Math.max(0.01, inner), `rgba(0,0,0,${a0})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); };

export async function buildAmbience(W, R) {
  const { root } = W, S = W.S, rnd = rng((R.seed ?? 1) * 7 + 3301), rr = (a, b) => a + (b - a) * rnd();
  // 경계 바위 벽: 띠 안 후보를 섞어 서로 every 이상 떨어진 자리마다 바위 하나(아래쪽은 낮은 바위만 — 카메라 쪽을 가리지 않게)
  if (R.rim) { const o = R.rim, [d0, d1] = o.band || [-10, 40], gap = o.every || 110, cand = [], placed = [];
    for (let u = -1400; u <= 1400; u += 24) for (let v = -1400; v <= 1400; v += 24) { const ju = u + (rnd() - 0.5) * 24, jv = v + (rnd() - 0.5) * 24, d = S.sdfUV(ju, jv); if (d >= d0 && d <= d1) cand.push([ju, jv, rnd()]); }
    cand.sort((a, b) => a[2] - b[2]);
    const pickKind = ks => { const e = Object.entries(ks), t = e.reduce((s, [, w]) => s + w, 0); let x = rnd() * t; for (const [k, w] of e) { if ((x -= w) <= 0) return k; } return e[0][0]; };
    const wallAt = (u, v) => { let best = 0, bd = 1e9; for (const L of W.WL.WALL) L.pts.forEach((q, i) => { const d = (q.u - u) ** 2 + (q.v - v) ** 2; if (d < bd) { bd = d; best = L.hg[i]; } }); return best; };   // 가장 가까운 벽의 실제 높이
    for (const [u, v] of cand) {
      if (o.top != null && v > o.top) continue;
      if (wallAt(u, v) > (o.wallMax ?? 40)) continue;   // 벽이 서 있는 곳은 벽과 바위 덩어리가 막는다 — 벽이 없는 카메라 쪽 경계에만
      if (S.EXITS.some(e => S.inTunnel(u, v, e, 60) && S.pastMouth(u, v, e) > -140)) continue;
      if ((o.skip || []).some(([cu, cv, r]) => Math.hypot(u - cu, v - cv) < r)) continue;
      if (placed.some(([pu, pv]) => Math.hypot(u - pu, v - pv) < gap)) continue;
      const low = o.low && v < o.low.below, ks = low ? o.low.kinds : o.kinds, sr = low ? o.low.s : o.s;
      placed.push([u, v]); await W.rock(pickKind(ks) + (o.lo === false ? '' : '_lo'), u, v, rr(...sr), { turn: rnd() * 6.28, col: false, sy: rr(0.85, 1.25), face: [rnd() - 0.5, rnd() - 0.5], mat: o.mat }); } }
  // 천장 종유석: 바위를 뒤집어 매단다
  for (const c of R.ceiling || []) { const geo = await loadRockGeo(c.rock || 'spireA'); if (!geo) continue; const m = new T.Mesh(geo, W.M.rockKit); m.castShadow = true;
    m.scale.set(c.s, c.s * (c.sy || 1), c.s); m.rotation.set(Math.PI + rr(-0.12, 0.12), rnd() * 6.28, rr(-0.12, 0.12)); m.position.copy(V(...((([x, z]) => [x, c.y, z])(W2(...c.at))))); root.add(m); }
  // 매달린 돌(종유석 에셋, 원점 = 윗면): 먼 쪽 벽(카메라를 보는 벽) 위쪽에 붙여 매단다 — 출구 굴 어귀는 비움(주인공을 가리지 않게)
  if (R.stalactites) { const o = R.stalactites, WL = W.WL, spots = [];
    for (const L of WL.WALL) L.pts.forEach((q, i) => { if (i % (o.step || 3) || q.cf > (o.cf ?? -0.2) || L.hb[i] < (o.minH || 140)) return;
      if (S.EXITS.some(e => S.inTunnel(q.u, q.v, e, o.exitPad ?? 120) && S.pastMouth(q.u, q.v, e) > -220)) return;
      if (rnd() <= (o.p ?? 0.5)) spots.push([q, L.hb[i]]); });
    for (const [q, h] of spots) { const name = o.kinds[Math.floor(rnd() * o.kinds.length)], geo = await loadRockGeo(name); if (!geo) continue;
      const yTop = h * rr(...(o.top || [0.62, 0.78])), len = h * rr(...(o.len || [0.3, 0.55])), s = len / Math.max(1, -geo.boundingBox.min.y), w = WL.wallSpot(q.u, q.v, yTop, 0); if (!w) continue;
      const m = new T.Mesh(geo, W.M.rockKit); m.scale.setScalar(s); m.position.copy(w.p).addScaledVector(w.n, s * 0.3); m.position.y = yTop; m.rotation.set(rr(-0.05, 0.05), rnd() * 6.28, rr(-0.05, 0.05)); root.add(m); } }
  // 더 놓는 빛
  for (const l of R.lights || []) { const L = new T.PointLight(l.color ?? 0x8fb4ff, l.i ?? 1, l.dist ?? 400, 2), [x, z] = W2(...l.at); L.position.set(x, l.y ?? 120, z); root.add(L); }
  // 떠다니는 먼지(빛 받은 곳에서만 보이게 더하기 섞기)
  if (R.dust && R.dust.length) { const P = [], base = []; for (const d of R.dust) for (let i = 0; i < (d.n || 40); i++) { const a = rnd() * 6.28, q = Math.sqrt(rnd()) * d.r, [x, z] = W2(d.at[0] + Math.cos(a) * q, d.at[1] + Math.sin(a) * q), y = rr(20, d.h || 180); P.push(x, y, z); base.push([x, y, z, rnd() * 6.28, rr(0.4, 1)]); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); const c = document.createElement('canvas'); c.width = c.height = 32; const cx = c.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,230,190,0.9)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
    const pts = new T.Points(g, new T.PointsMaterial({ map: new T.CanvasTexture(c), size: 2.4, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xffd8a8, opacity: 0.55 })); pts.frustumCulled = false; root.add(pts);
    W.upd.push(t => { const a = g.attributes.position; for (let i = 0; i < base.length; i++) { const [x, y, z, ph, sp] = base[i]; a.setXYZ(i, x + Math.sin(t * 0.21 * sp + ph) * 14, y + Math.sin(t * 0.13 * sp + ph * 2) * 10, z + Math.cos(t * 0.17 * sp + ph) * 14); } a.needsUpdate = true; }); }
  // 접촉 그림자: 소품·바위 밑(바닥 높낮이 따라 휘는 납작한 원)
  if (R.contact && W.contactList && W.contactList.length) { const Pp = [], UV = [], I = [], n = 4;
    for (const c of W.contactList) { const base = Pp.length / 3; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const a = (i / n - 0.5) * 2 * c.r, b = (j / n - 0.5) * 2 * c.r, x = c.x + a, z = c.z + b; Pp.push(x, S.ground(...U2(x, z)) + 0.6, z); UV.push(i / n, j / n); }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = base + j * (n + 1) + i; I.push(q, q + n + 1, q + 1, q + 1, q + n + 1, q + n + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(Pp, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: softTex(0.25), transparent: true, opacity: R.contact.k ?? 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })); m.renderOrder = 1; root.add(m); }
}
