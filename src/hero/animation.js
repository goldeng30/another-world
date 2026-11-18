// 주인공 동작 재생: Mixamo 클립 → 뼈 회전 · 살아 있는 대기 · 2번 공격(좌우 뒤집기) · 발 높이 맞춤 · 섞기 · 이어지는 공격 시간 고르기
import { T, V, DEG, bump } from '../core/math.js';
import { PIPE_Y_DEF } from './rig.js';

export function createAnimation(H) {
  const { rig, weapon, gltf, clipsSrc } = H;
  const { root, B, hips, order, W0, P0, solve, applyFrame, legIK, dir, cr, frameRot, Z } = rig;
  const { pipe, aimPipe, posePipe, LGC, TIPV } = weapon;
  const { ACTS, COMBO, LINK, LIVE_DUR, HAND } = H.acts;
  const FING = /Hand(Thumb|Index|Middle|Ring|Pinky)/;
  function makeClip(src) {
    const c = T.AnimationClip.parse(src), tracks = [];
    for (const tr of c.tracks) { const [bn, prop] = tr.name.split('.'), nm = bn.replace(/^mixamorig:?/, ''), bo = B[nm]; if (!bo || FING.test(nm)) continue; tracks.push({ bo, nm, prop, it: tr.createInterpolant(), tr }); }
    const hp = tracks.find(k => k.bo === hips && k.prop === 'position'); let start = [0, 0], drift = [0, 0];
    if (hp) { const v = hp.tr.values, n = v.length / 3; start = [v[0], v[2]]; drift = [v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 2] - v[2]]; }
    return { dur: c.duration, tracks, start, drift, dy: 0 };
  }
  // f(손가락 쥐기 등 기본 자세 프레임)에 클립 회전을 덮어쓴다. only: 이 뼈만(이름 검사 함수)
  function clipInto(C, t, f, only) { const u = t / C.dur;
    for (const k of C.tracks) { if (only && !only(k.nm)) continue; const v = k.it.evaluate(t);
      if (k.prop === 'quaternion') { const q = f.q.get(k.bo); if (q) q.set(v[0], v[1], v[2], v[3]); }
      else if (k.prop === 'position' && k.bo === hips) f.hip.set(v[0] - C.start[0] - C.drift[0] * u, v[1] + C.dy, v[2] - C.start[1] - C.drift[1] * u); }
    return f; }
  // 돌아서는 동작: 엉덩이가 가는 길(x·z)과 몸이 도는 각도(yaw)를 동작에서 빼내 둔다(부드럽게 고른 값) → 그만큼 몸 전체(root)를 옮기고 돌린다. 엉덩이엔 잔 흔들림만 남긴다
  function rootPath(src) { const hp = src.tracks.find(t => /Hips\.position$/.test(t.name)), hq = src.tracks.find(t => /Hips\.quaternion$/.test(t.name)), n = Math.min(hp.times.length, hq.times.length), raw = { x: [], z: [], yaw: [] };
    const q = new T.Quaternion(), qy = new T.Quaternion(), f = V(); let prev = 0;
    for (let i = 0; i < n; i++) { q.fromArray(hq.values, i * 4); f.set(0, 0, 1).applyQuaternion(q); let yaw = Math.atan2(f.x, f.z); while (yaw - prev > Math.PI) yaw -= 2 * Math.PI; while (yaw - prev < -Math.PI) yaw += 2 * Math.PI; prev = yaw; raw.yaw.push(yaw); raw.x.push(hp.values[i * 3]); raw.z.push(hp.values[i * 3 + 2]); }
    const sm = a => a.map((_, i) => { let s = 0, c = 0; for (let k = -4; k <= 4; k++) { const j = Math.max(0, Math.min(n - 1, i + k)); s += a[j]; c++; } return s / c; }), P = { t: Array.from(hp.times).slice(0, n), x: sm(raw.x), z: sm(raw.z), yaw: sm(raw.yaw) };
    for (let i = 0; i < n; i++) { q.fromArray(hq.values, i * 4); qy.setFromAxisAngle(V(0, 1, 0), -P.yaw[i]); q.premultiply(qy); q.toArray(hq.values, i * 4);
      const dx = raw.x[i] - P.x[i], dz = raw.z[i] - P.z[i], c = Math.cos(-P.yaw[i]), sn = Math.sin(-P.yaw[i]); hp.values[i * 3] = dx * c + dz * sn; hp.values[i * 3 + 2] = -dx * sn + dz * c; }
    return P; }
  const SRC = clipsSrc || {}, CLIP = {}, PATHS = {};
  for (const k in ACTS) { const a = ACTS[k]; if (a.turn && SRC[a.clip] && !PATHS[a.clip]) PATHS[a.clip] = rootPath(SRC[a.clip]); }
  for (const n in SRC) CLIP[n] = makeClip(SRC[n]);
  const ARMS = n => /^(Left|Right)(Shoulder|Arm|ForeArm|Hand)$/.test(n);
  const UPPER = n => /^(Spine\d?|Neck|Head|(Left|Right)(Shoulder|Arm|ForeArm|Hand))$/.test(n), LAYER = n => UPPER(n) || FING.test(n);   // 윗몸(허리 위) · 칼 빼기·넣기에 덮을 뼈(손가락까지)
  for (const k in ACTS) { const a = ACTS[k]; a.C = CLIP[a.clip]; a.A = a.arms ? CLIP[a.arms] : null; a.U = a.upper ? CLIP[a.upper] : null; a.B = a.blend ? CLIP[a.blend] : null; a.path = a.turn ? PATHS[a.clip] : null; a.dur = a.idle ? LIVE_DUR : a.B ? 1 : a.C ? a.C.dur : 1; }
  const baseOf = a => solve({ bones: {}, ...(a.pipe ? HAND.on : HAND.off), ...(a.two ? { lg: 0.92, lt: 0.8 } : {}), wy: a.wy || PIPE_Y_DEF });
  // 무기 들고 서기 = 무기 들고 걷기에서 두 발이 다 닿은 순간(IDLE_T)을 멈춰 쓴다. 보폭만 조금 좁히고(다리를 쉬는 자세 쪽으로 IDLE_K만큼) 두 발 가운데를 제자리에, 발은 바닥에
  const IDLE_T = 0.37, IDLE_K = 0.4, LEGS = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase)$/; let IDLE_FIX = null;
  function idleFrame(a) { const f = baseOf(a), rest = baseOf(a); clipInto(a.C, IDLE_T, f);
    for (const [bo, q] of f.q) { const nm = bo.name.replace(/^mixamorig:?/, ''); if (LEGS.test(nm)) q.slerp(rest.q.get(bo), IDLE_K); }
    if (!IDLE_FIX) { applyFrame(f); root.updateMatrixWorld(true); const L = B.LeftFoot.getWorldPosition(V()).sub(root.position), R = B.RightFoot.getWorldPosition(V()).sub(root.position);
      IDLE_FIX = V(-(L.x + R.x) / 2, P0.get(B.LeftFoot).y - Math.min(L.y, R.y), -(L.z + R.z) / 2); }
    f.hip.add(IDLE_FIX); return f; }
  const XC = V(1, 0, 0), YC = V(0, 1, 0), ZC = V(0, 0, 1), qT = new T.Quaternion(), qR = new T.Quaternion(), LOCO0 = { a: 1, w: 0, lean: 0 };
  const lookYaw = x => 0.42 * bump(x, 1.6, 2.5, 4.0, 4.9) - 0.32 * bump(x, 5.4, 6.2, 7.2, 8.0);   // 왼쪽 보고 → 오른쪽 보고 → 앞
  let LIVE_BASE = null;
  function liveBase(f) { applyFrame(f); root.updateMatrixWorld(true); const rqi = root.getWorldQuaternion(new T.Quaternion()).invert(), o = { ank: {}, fq: {}, yaw: {} };
    for (const sd of ['Left', 'Right']) { const an = root.worldToLocal(B[sd + 'Foot'].getWorldPosition(V())), toe = root.worldToLocal(B[sd + 'ToeBase'].getWorldPosition(V()));
      o.ank[sd] = an; o.fq[sd] = rqi.clone().multiply(B[sd + 'Foot'].getWorldQuaternion(new T.Quaternion())); o.yaw[sd] = Math.atan2(toe.x - an.x, toe.z - an.z) / DEG; }
    return o; }
  function breathe(f, t) {
    if (!LIVE_BASE) LIVE_BASE = liveBase(f);
    const x = t % LIVE_DUR, br = (1 - Math.cos(2 * Math.PI * t / 3.4)) / 2, w = Math.sin(2 * Math.PI * t / 5.1), bob = (1 - Math.cos(2 * Math.PI * t / 1.7)) / 2, lk = lookYaw(x), hf = bump(x, 8.5, 8.95, 9.35, 9.95);
    // 엉덩이: 좌우 무게, 들썩임, 숨
    f.hip.x += 2.2 * w; f.hip.y += -0.8 * bob - 0.6 * Math.abs(w) + 0.35 * br - 0.8 * hf;
    const hq = f.q.get(hips); if (hq) { qR.setFromAxisAngle(ZC, 0.04 * w); hq.premultiply(qR); qR.setFromAxisAngle(YC, 0.05 * w + 0.12 * lk); hq.premultiply(qR); }
    // 윗몸
    const moves = [['Spine', XC, -0.02 * br], ['Spine1', XC, -0.035 * br - 0.03 * hf], ['Spine2', XC, -0.055 * br - 0.05 * hf], ['Neck', XC, 0.035 * br], ['Head', XC, 0.04 * br + 0.06 * hf],
      ['LeftShoulder', ZC, 0.1 * br + 0.06 * hf], ['RightShoulder', ZC, -0.1 * br - 0.06 * hf],
      ['Spine', ZC, -0.035 * w], ['Spine1', ZC, -0.025 * w], ['Head', ZC, 0.03 * w],
      ['Spine1', YC, 0.12 * lk], ['Spine2', YC, 0.15 * lk], ['Neck', YC, 0.3 * lk], ['Head', YC, 0.45 * lk],
      ['LeftArm', XC, -0.16 * hf], ['RightArm', XC, -0.16 * hf], ['LeftForeArm', XC, -0.07 * hf], ['RightForeArm', XC, -0.07 * hf]];
    applyFrame(f); root.updateMatrixWorld(true); const rq = root.getWorldQuaternion(new T.Quaternion()), pre = new Map();
    for (const [n] of moves) if (!pre.has(n)) pre.set(n, B[n].parent.getWorldQuaternion(new T.Quaternion()));
    for (const [n, ax, ang] of moves) { const q = f.q.get(B[n]); if (!q || !ang) continue; const pq = pre.get(n); qR.setFromAxisAngle(ax.clone().applyQuaternion(rq), ang); qT.copy(pq).invert().multiply(qR).multiply(pq); q.premultiply(qT); }
    // 다리 IK: 처음 자세의 발 위치·방향 그대로
    applyFrame(f); root.updateMatrixWorld(true); const rqi = rq.clone().invert(), Hq = rqi.clone().multiply(hips.getWorldQuaternion(new T.Quaternion())), Gh = Hq.clone().multiply(W0.get(hips).clone().invert()), hp = root.worldToLocal(hips.getWorldPosition(V()));
    for (const sd of ['Left', 'Right']) { const { Gt, Gs } = legIK(sd, Gh, hp, LIVE_BASE.ank[sd].clone(), LIVE_BASE.yaw[sd], 0.08);
      const upW = Gt.clone().multiply(W0.get(B[sd + 'UpLeg'])), lgW = Gs.clone().multiply(W0.get(B[sd + 'Leg']));
      f.q.get(B[sd + 'UpLeg']).copy(Hq.clone().invert().multiply(upW)); f.q.get(B[sd + 'Leg']).copy(upW.clone().invert().multiply(lgW)); f.q.get(B[sd + 'Foot']).copy(lgW.clone().invert().multiply(LIVE_BASE.fq[sd])); }
    return f; }
  // ── 반대 방향 내려치기(2번): 골반·다리·발은 1번 그대로, 골반 위(몸통·머리·어깨)만 골반 기준 좌우로 뒤집는다
  //    손잡이는 그대로(오른손 위): 뒤집힌 파이프 줄에 오른손 위·왼손 아래로 다시 쥐게 팔 IK ──
  const qMir = q => new T.Quaternion(q.x, -q.y, -q.z, q.w);
  const bName = b => b.name.replace(/^mixamorig:?/, ''), twinOf = b => { const n = bName(b), m = /^Left/.test(n) ? n.replace(/^Left/, 'Right') : /^Right/.test(n) ? n.replace(/^Right/, 'Left') : n; return B[m] || b; };
  const ARM_L = { L1: P0.get(B.LeftForeArm).distanceTo(P0.get(B.LeftArm)), L2: P0.get(B.LeftHand).distanceTo(P0.get(B.LeftForeArm)) };
  function twistAbout(q, ax) { const p = q.x * ax.x + q.y * ax.y + q.z * ax.z, t = new T.Quaternion(ax.x * p, ax.y * p, ax.z * p, q.w); const l = Math.hypot(t.x, t.y, t.z, t.w); return l < 1e-8 ? new T.Quaternion() : t.set(t.x / l, t.y / l, t.z / l, t.w / l); }
  function mirrorFrame(a, t) {
    const f0 = baseOf(a); clipInto(a.C, t, f0); applyFrame(f0); aimPipe(a.wy); root.updateMatrixWorld(true);
    const rq = root.getWorldQuaternion(new T.Quaternion()), rqi = rq.clone().invert(), G = new Map(), Pos = b => root.worldToLocal(b.getWorldPosition(V()));
    for (const b of order) G.set(b, rqi.clone().multiply(b.getWorldQuaternion(new T.Quaternion())));
    const Ro = root.worldToLocal(pipe.localToWorld(V(0, a.wy, 0))), Lo = root.worldToLocal(B.LeftHand.localToWorld(LGC.clone())), HR = Pos(B.RightHand), HL = Pos(B.LeftHand), GR = G.get(B.RightHand).clone(), GL = G.get(B.LeftHand).clone();
    // 골반·다리·발은 1번 그대로(앞으로 숙이는 것·디딤 그대로), 골반 위(몸통·머리·어깨)만 골반 기준으로 좌우 뒤집기
    const hp0 = Pos(hips), Rh = G.get(hips).clone().multiply(W0.get(hips).clone().invert()), Rhi = Rh.clone().invert();
    const mirP = v => { const h = v.clone().sub(hp0).applyQuaternion(Rhi); h.x = -h.x; return h.applyQuaternion(Rh).add(hp0); };
    const mirD = d => Rh.clone().multiply(qMir(Rhi.clone().multiply(d)));   // 골반에 대한 상대 회전만 뒤집는다
    const G1 = new Map(), f1 = { q: new Map(f0.q), hip: f0.hip.clone() };
    for (const b of order) { const n = bName(b); if (b === hips || LEGS.test(n) || FING.test(n) || /^(Left|Right)(Arm|ForeArm|Hand)$/.test(n)) continue; const src = twinOf(b); G1.set(b, mirD(G.get(src).clone().multiply(W0.get(src).clone().invert())).multiply(W0.get(b))); }
    for (const b of order) { if (!G1.has(b)) continue; f1.q.set(b, (G1.get(b.parent) || G.get(b.parent)).clone().invert().multiply(G1.get(b))); }
    // 팔: 골반 기준으로 뒤집힌 파이프 줄에 오른손(위)·왼손(아래)
    applyFrame(f1); root.updateMatrixWorld(true);
    const Rm = mirP(Ro), Lm = mirP(Lo), po = Ro.clone().sub(Lo).normalize(), pm = Rm.clone().sub(Lm).normalize(), Rmin = new T.Quaternion().setFromUnitVectors(po, pm);
    const tgt = { Right: { grip: Rm, G: Rmin.clone().multiply(GR), off: Ro.clone().sub(HR).applyQuaternion(GR.clone().invert()) }, Left: { grip: Lm, G: Rmin.clone().multiply(GL), off: Lo.clone().sub(HL).applyQuaternion(GL.clone().invert()) } };
    for (const sd of ['Right', 'Left']) { const g = tgt[sd], W = g.grip.clone().sub(g.off.clone().applyQuaternion(g.G)), S = Pos(B[sd + 'Arm']), sg = sd === 'Left' ? 1 : -1;
      const v = W.clone().sub(S); let d = v.length(); const vd = v.clone().normalize(); d = Math.min(d, (ARM_L.L1 + ARM_L.L2) * 0.999);
      const pole = V(0.6 * sg, -1, -0.25).normalize(), perp = pole.clone().addScaledVector(vd, -vd.dot(pole)).normalize();
      const ca = Math.max(-1, Math.min(1, (ARM_L.L1 * ARM_L.L1 + d * d - ARM_L.L2 * ARM_L.L2) / (2 * ARM_L.L1 * d))), sa = Math.sqrt(1 - ca * ca);
      const E = S.clone().addScaledVector(vd, ARM_L.L1 * ca).addScaledVector(perp, ARM_L.L1 * sa), Wc = S.clone().addScaledVector(vd, d);
      const ua1 = E.clone().sub(S).normalize(), fa1 = Wc.clone().sub(E).normalize(); let hinge = V().crossVectors(ua1, fa1); if (hinge.length() < 1e-4) hinge = V().crossVectors(ua1, perp); hinge.normalize();
      const ua0 = dir(sd + 'Arm', sd + 'ForeArm'), fa0 = dir(sd + 'ForeArm', sd + 'Hand');
      const Gua = frameRot(ua0, cr(ua0, Z), ua1, hinge).multiply(W0.get(B[sd + 'Arm']));
      const Dfa0 = frameRot(fa0, cr(fa0, Z), fa1, hinge), Dh = g.G.clone().multiply(W0.get(B[sd + 'Hand']).clone().invert()), tw = twistAbout(Dh.clone().multiply(Dfa0.clone().invert()), fa1);
      const Gfa = new T.Quaternion().slerp(tw, 0.5).multiply(Dfa0).multiply(W0.get(B[sd + 'ForeArm']));
      const Gsh = G1.get(B[sd + 'Shoulder']) || G.get(B[sd + 'Shoulder']);
      f1.q.set(B[sd + 'Arm'], Gsh.clone().invert().multiply(Gua)); f1.q.set(B[sd + 'ForeArm'], Gua.clone().invert().multiply(Gfa)); f1.q.set(B[sd + 'Hand'], Gfa.clone().invert().multiply(g.G)); }
    return f1; }
  function actFrame(a, t) { if (a.mirror) return mirrorFrame(a, t); const f = baseOf(a);
    if (a.idle) return breathe(idleFrame(a), t);
    if (a.B) { const ph = ((t % 1) + 1) % 1, L = H.loco || LOCO0, w = L.w, sa = L.a; clipInto(a.C, ph * a.C.dur, f);   // 섞는 이동: t = 걸음 박자(0~1). 둘째 동작은 같은 발이 같은 때 나오게 박자를 맞춘다(phB)
      if (w > 0.001) { const g = baseOf(a); clipInto(a.B, ((ph + (a.phB || 0)) % 1 + 1) % 1 * a.B.dur, g); for (const [b, q] of f.q) { const q2 = g.q.get(b); if (q2) q.slerp(q2, w); } f.hip.lerp(g.hip, w); }
      if (sa < 0.999 && a.stand) { if (!a.S0) { a.S0 = baseOf(a); clipInto(CLIP[a.stand], 0, a.S0); }   // 느리게 걸을 땐 선 자세를 섞어 보폭을 줄인다
        for (const [b, q] of f.q) { const q2 = a.S0.q.get(b); if (q2) q.slerp(q2, 1 - sa); } f.hip.lerp(a.S0.hip, 1 - sa); }
      if (L.lean) for (const n of ['Spine', 'Spine1', 'Spine2']) { const q = f.q.get(B[n]); if (q) q.multiply(qT.setFromAxisAngle(XC, L.lean / 3)); }   // 달릴수록 윗몸을 앞으로 숙인다
      return f; }
    clipInto(a.C, a.rev ? a.C.dur - t : t, f); if (a.A) clipInto(a.A, (t / a.C.dur) * a.A.dur % a.A.dur, f, ARMS); if (a.U) clipInto(a.U, t % a.U.dur, f, UPPER); return f; }
  // 발이 바닥에 닿게: 클립 전체에서 가장 낮은 발목 높이를 쉬는 자세 발목 높이에 맞춘다
  for (const k in ACTS) { const a = ACTS[k]; if (!a.C || a.idle) continue; let lo = Infinity;
    for (let i = 0; i < 24; i++) { applyFrame(actFrame(a, a.dur * i / 24)); root.updateMatrixWorld(true); lo = Math.min(lo, B.LeftFoot.getWorldPosition(V()).y, B.RightFoot.getWorldPosition(V()).y); }
    a.C.dy += P0.get(B.LeftFoot).y - lo; }
  // ── 실행: 지금 동작(반복) + 바꿀 때 0.25초 섞기 ──
  const st = { act: 'widle', t: 0, speed: 1, fromF: null, fade: 1, fadeDur: 0.25 };
  const cloneF = f => ({ q: new Map([...f.q].map(([b, q]) => [b, q.clone()])), hip: f.hip.clone() });
    function play(name, t0 = 0, fd) { if (!ACTS[name] || !ACTS[name].C) return; if (H.lastF) st.fromF = cloneF(H.lastF);
    st.from = st.fade >= 1 && ACTS[st.act] ? { a: ACTS[st.act], t: st.t, sp: st.speed || 1 } : null;   // 섞는 중이 아니면 앞 동작을 멈추지 않고 계속 움직이며 섞는다
    st.fade = 0; st.fadeDur = fd || ACTS[name].fade || 0.25; st.act = name; st.t = t0; st.hitDone = false; st.carry = null; st.pull = 0; st.step = 0; st.warp = null; }
  // 클립 한 바퀴 동안 엉덩이가 앞으로 간 거리 / 시간 = 이동 속도 (+z가 앞)
  const SPD = n => { const C = CLIP[n]; return C ? Math.hypot(C.drift[0], C.drift[1]) / C.dur : 0; };
  function switchAct(name) { if (st.act === name) return; const a0 = ACTS[st.act], a1 = ACTS[name], ph = (st.t % a0.dur) / a0.dur;   // 걷기↔달리기는 박자 이어서
    play(name); if (a0.fwd && a1.fwd) st.t = ph * a1.dur; else if (a1.pass && !a0.stops) st.t = (a1.pass[0] + a1.dur) % a1.dur; else if (a0.idle && !a1.idle) st.t = IDLE_T / a0.C.dur * a1.dur; }   // 서 있다가 걸으면 두 발이 모인 자세부터(한 발 내딛고 닿으면 한 걸음)
  // 내려칠 때 파이프 끝이 오는 자리(몸 기준): 대각선으로 내려와 몸 정면에서 왼쪽으로 비켜 있다 → 휘두르는 동안 그만큼 틀어 겨눈다
  for (const k of COMBO) { const a = ACTS[k]; if (a.atk.aim !== undefined) continue; applyFrame(actFrame(a, a.atk.aimT || a.atk.T)); posePipe(a, a.atk.aimT || a.atk.T); const q = root.worldToLocal(pipe.localToWorld(TIPV.clone())); a.atk.aim = Math.max(-0.6, Math.min(0.6, Math.atan2(q.x, q.z))); a.atk.reach = Math.hypot(q.x, q.z); }   // 겨눔: 내려치는 순간 파이프 끝 방향(±34° 안)
  for (const k of COMBO) { const at = ACTS[k].atk; if (at.idealK !== undefined) at.ideal = at.reach + at.idealK; }
  ACTS.slash3.rmv = Math.hypot(...ACTS.slash3.C.drift) / ACTS.slash3.C.dur;   // 3번은 1.8초 동안 앞으로 61
  // 이어질 때 다음 공격의 들어 올리기(시작~내려치기 직전)를 고르게: 거의 멈춘 부분은 빨리, 빠른 부분은 살짝 늦게. 전체 시간은 그대로(+extra)
  const WARP_CACHE = {};
  function makeWarp(name, t0, extra) { const key = name + t0 + extra; if (WARP_CACHE[key]) return WARP_CACHE[key];
    const a = ACTS[name], t1 = a.atk.T - 0.1, dtc = 1 / 60, sp = [], keep = H.lastF ? cloneF(H.lastF) : null; let prev = null;
    for (let t = t0; t < t1; t += dtc) { applyFrame(actFrame(a, t)); posePipe(a, t); root.updateMatrixWorld(true); const q = root.worldToLocal(pipe.localToWorld(TIPV.clone())); sp.push(prev ? q.distanceTo(prev) / dtc : 0); prev = q; }
    if (sp.length > 1) sp[0] = sp[1];
    const med = [...sp].sort((x, y) => x - y)[Math.floor(sp.length / 2)] || 1, r = sp.map(v => Math.max(0.7, Math.min(2.4, Math.pow(med / Math.max(v, 30), 0.6))));
    const L = sp.length * dtc + extra, T0 = r.reduce((s, x) => s + dtc / x, 0), c = T0 / L; for (let i = 0; i < r.length; i++) r[i] *= c;
    if (keep) applyFrame(keep);
    return (WARP_CACHE[key] = { t0, dt: dtc, r }); }
  for (const k in LINK) for (const n in LINK[k]) makeWarp(n, LINK[k][n][1], LINK[k][n][3] || 0);   // 미리 만들어 둔다(처음 이어질 때 끊김 없게)
  // 걸음 단위: 두 발이 가장 벌어진 순간(뒤꿈치가 닿는 때)이 한 바퀴에 두 번 → 걷던 걸 멈출 때는 이 순간까지 가서 선다(stops)
  const feetAt = (a, t) => { applyFrame(actFrame(a, t)); root.updateMatrixWorld(true); return [root.worldToLocal(B.LeftFoot.getWorldPosition(V())), root.worldToLocal(B.RightFoot.getWorldPosition(V()))]; };
  const leadL = a => { let best = -Infinity, bi = 0; for (let i = 0; i < 48; i++) { const [L, R] = feetAt(a, a.dur * i / 48); if (L.z - R.z > best) { best = L.z - R.z; bi = i; } } return bi / 48; };
  if (ACTS.umove && ACTS.uwalk && ACTS.urun) ACTS.umove.phB = leadL(ACTS.urun) - leadL(ACTS.uwalk);   // 왼발이 가장 앞에 나온 때를 서로 맞춘다
  // 섞은 걸음의 한 바퀴 보폭: 디딘 발(발목이 가장 낮을 때 = 완전히 디딘 동안)이 몸 기준으로 뒤로 밀리는 빠르기를 평균 → 이만큼 몸이 나아가야 발이 안 미끄러진다
  function strideOf(a, sa, w, N = 60) { const keep = H.loco; H.loco = { a: sa, w, lean: 0 }; const z = { L: [], R: [] }, y = { L: [], R: [] };
    for (let i = 0; i < N; i++) { const [L, R] = feetAt(a, i / N); z.L.push(L.z); z.R.push(R.z); y.L.push(L.y); y.R.push(R.y); }
    const lo = Math.min(...y.L, ...y.R); let s = 0, n = 0;
    for (const k of ['L', 'R']) for (let i = 0; i < N; i++) { const i0 = (i - 1 + N) % N, i1 = (i + 1) % N; if (y[k][i] > lo + 0.8 || y[k][i0] > lo + 0.8 || y[k][i1] > lo + 0.8) continue; s += -(z[k][i1] - z[k][i0]) * N / 2; n++; }
    H.loco = keep; return n ? s / n : 0; }
  for (const k in ACTS) { const a = ACTS[k]; if (!a.step) continue; const N = 60, sep = [];
    for (let i = 0; i < N; i++) { const [L, R] = feetAt(a, a.dur * i / N); sep.push(Math.hypot(L.x - R.x, L.z - R.z)); }
    const pk = []; for (let i = 0; i < N; i++) { const p = sep[(i - 1 + N) % N], c = sep[i], n = sep[(i + 1) % N]; if (c >= p && c > n) pk.push([c, i]); }
    pk.sort((x, y) => y[0] - x[0]); a.stops = pk.length >= 2 ? pk.slice(0, 2).map(([, i]) => a.dur * i / N).sort((x, y) => x - y) : [0, a.dur / 2];
    // 두 발이 모인 순간(한 발이 다른 발을 지나가는 때): 서 있다가 걸을 땐 여기서 시작 → 다음 '닿는 순간'까지가 딱 한 걸음
    const lo = []; for (let i = 0; i < N; i++) { const p = sep[(i - 1 + N) % N], c = sep[i], n = sep[(i + 1) % N]; if (c <= p && c < n) lo.push([c, i]); }
    lo.sort((x, y) => x[0] - y[0]); a.pass = lo.length ? lo.slice(0, 2).map(([, i]) => a.dur * i / N).sort((x, y) => x - y) : [a.stops[0] - a.dur / 4]; }
  return { CLIP, st, play, switchAct, actFrame, makeWarp, cloneF, LEGS, IDLE_T, SPD, baseOf, FING, ARMS, UPPER, LAYER, strideOf, feetAt };
}
