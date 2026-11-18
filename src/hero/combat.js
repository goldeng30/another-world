// 주인공 공격 판정: 파이프가 지난 자리 ↔ 적 몸(공·캡슐) 닿기 · 사거리 보정 · 타격 효과
import { V, DEG } from '../core/math.js';

export function createCombat(H) {
  const { G, rig, weapon } = H;
  const { root } = rig;
  const { pipeSamples } = weapon;
  function segSeg(p1, q1, p2, q2) {   // 두 선분 사이 가장 가까운 두 점
    const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r); let s1 = 0, t1 = 0;
    if (a < 1e-9 && e < 1e-9) return [p1.clone(), p2.clone()];
    if (a < 1e-9) t1 = Math.max(0, Math.min(1, f / e)); else { const c = d1.dot(r); if (e < 1e-9) s1 = Math.max(0, Math.min(1, -c / a)); else { const b = d1.dot(d2), den = a * e - b * b; s1 = den > 1e-9 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0; t1 = (b * s1 + f) / e; if (t1 < 0) { t1 = 0; s1 = Math.max(0, Math.min(1, -c / a)); } else if (t1 > 1) { t1 = 1; s1 = Math.max(0, Math.min(1, (b - c) / a)); } } }
    return [p1.clone().addScaledVector(d1, s1), p2.clone().addScaledVector(d2, t1)]; }
  const GOB_BODY = () => { const GOB = G.enemy; if (GOB.body) return GOB.body(); const g = GOB.GB, h = GOB.height, w = n => g[n].getWorldPosition(V()), hd = w('Head'), top = g.HeadTop_End ? w('HeadTop_End') : hd.clone().add(V(0, h * 0.16, 0));
    return [{ a: hd.clone().lerp(top, 0.35), b: hd.clone().lerp(top, 0.35), r: h * 0.15 }, { a: w('Hips'), b: w('Neck'), r: h * 0.15 }]; };
  function pipeContact() { const cur = pipeSamples(), prev = H.PIPE_PREV || cur, body = GOB_BODY();
    for (let i = 0; i < cur.length; i++) for (const c of body) { const [pp, pb] = segSeg(prev[i], cur[i], c.a, c.b); if (pp.distanceTo(pb) < c.r + 4) { pipeContact.i = i; return pp; } }
    return null; }
  const STEP_FWD = 24;   // 1·2타 혼자 휘두를 때 앞으로 내딛는 거리
  const ASSIST = { D: 125, ANG: 75 * DEG, T: 0.7, IDEAL: 77, PULL: 55, BACK: 45, MAX: 16, PULL_T: [0.12, 0.62] };   // IDEAL: 파이프 끝이 맞는 거리. 휘두르는 동안 그쪽으로 천천히 다가가거나(PULL) 살짝 물러선다(BACK). 한 번 휘두를 때 최대 MAX만큼만
  function assistPoint(a) { const GOB = G.enemy, ctl = H.ctl; const g = GOB.holder.position, to = V(g.x - root.position.x, 0, g.z - root.position.z), d = to.length(); if (d > ASSIST.D) return null;
    if (to.normalize().dot(V(Math.sin(ctl.yaw + a.atk.aim), 0, Math.cos(ctl.yaw + a.atk.aim))) < Math.cos(ASSIST.ANG)) return null;
    const cur = pipeSamples(), tip = cur[0], grip = cur[cur.length - 1]; let best = null;
    for (const c of GOB_BODY()) { const [pp, pb] = segSeg(grip, tip, c.a, c.b), dd = pp.distanceTo(pb); if (!best || dd - c.r < best.k) best = { k: dd - c.r, at: pb.clone().add(pp.clone().sub(pb).setLength(Math.min(c.r, dd))) }; }
    pipeContact.i = -1; return best.at; }
  function hitFX(cAt, pw) { const GOB = G.enemy, { FX, HS, SHK } = G.fx;
    const g = GOB.holder.position, n = V(root.position.x - g.x, 0, root.position.z - g.z).normalize();
    const chest = GOB.GB.Spine2.getWorldPosition(V()).addScaledVector(n, GOB.gs.R * 0.3).add(V(0, 5, 0));
    const at = cAt ? cAt.clone() : chest;
    FX.burst(at, n, pw); HS.t = (pw && pw.hs) || HS.DUR; SHK.t = SHK.dur; SHK.a = (pw && pw.shk) || 7;
    if (G.TOUCH && navigator.vibrate && pw && pw.vib) try { navigator.vibrate(pw.vib); } catch (e) {}   // 진동은 3타에서만
  }
  return { segSeg, GOB_BODY, pipeContact, assistPoint, hitFX, ASSIST, STEP_FWD };
}
