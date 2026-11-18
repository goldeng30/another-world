// 뼈대 풀기: 쉬는 자세(바인드) 정보 · 관절 회전축 · 다리 IK · 자세(도 단위 값) → 뼈 회전
import { T, V, DEG } from '../core/math.js';
export const PIPE_Y_DEF = 4.5;

export function createRig({ root, sm, B, hips }) {
  const rig = { onGrip: null };
  const isRig = o => /^mixamorig/.test(o.name);   // onGrip(wy): 자세마다 무기 쥐는 자리(무기 쪽에서 채움)
  // ── 쉬는 자세(바인드) 정보: 바인드 공간은 z가 위 → 화면 공간(y 위, +z 앞, +x 캐릭터 왼쪽)으로 돌린다 ──
  sm.skeleton.pose(); root.updateMatrixWorld(true);
  const Rz2y = new T.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2);
  const skIdx = new Map(sm.skeleton.bones.map((b, i) => [b, i]));
  const WB = new Map(), PB = new Map();
  { const m = new T.Matrix4().copy(sm.skeleton.boneInverses[skIdx.get(hips)]).invert(), p = V(), q = new T.Quaternion(), s = V(); m.decompose(p, q, s); WB.set(hips, q); PB.set(hips, p); }
  const order = []; hips.traverse(b => { if (isRig(b)) order.push(b); });
  for (const b of order) if (b !== hips) { const pq = WB.get(b.parent); WB.set(b, pq.clone().multiply(b.quaternion)); PB.set(b, b.position.clone().applyQuaternion(pq).add(PB.get(b.parent))); }
  // 발바닥을 바닥(y=0)에, 엉덩이를 가운데로
  let minY = Infinity; { const pa = sm.geometry.attributes.position, v = V(); for (let i = 0; i < pa.count; i += 3) { v.fromBufferAttribute(pa, i).applyMatrix4(sm.bindMatrix).applyQuaternion(Rz2y); if (v.y < minY) minY = v.y; } }
  const hp0 = PB.get(hips).clone().applyQuaternion(Rz2y), OFF = V(-hp0.x, -minY, -hp0.z);
  const W0 = new Map(), P0 = new Map(), LP = new Map();
  for (const b of order) { W0.set(b, Rz2y.clone().multiply(WB.get(b))); P0.set(b, PB.get(b).clone().applyQuaternion(Rz2y).add(OFF)); }
  for (const b of order) if (b !== hips) LP.set(b, W0.get(b.parent).clone().invert());
  root.updateMatrixWorld(true);
  const hipsParentInv = new T.Matrix4().copy(hips.parent.matrixWorld).invert(), hipsParentQInv = new T.Quaternion(); { const p = V(), s = V(); hipsParentInv.decompose(p, hipsParentQInv, s); }

  // ── 관절마다 이름 붙인 회전축 (화면 공간, 쉬는 자세 기준) ──
  const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
  const dir = (a, b) => P0.get(B[b]).clone().sub(P0.get(B[a])).normalize();
  const perpUp = (a, up) => up.clone().addScaledVector(a, -a.dot(up)).normalize();
  const cr = (a, b) => V().crossVectors(a, b).normalize();
  const AX = {};   // boneName → [[param, axis], …] 적용 순서: 앞의 것이 바깥(마지막에 적용)
  for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']) AX[n] = [['turn', Y], ['lean', Z], ['fwd', X]];
  for (const [s, sg] of [['Left', 1], ['Right', -1]]) {
    const lat = V(sg, 0, 0);
    const c = dir(s + 'Shoulder', s + 'Arm'); AX[s + 'Shoulder'] = [['up', cr(c, Y)], ['fwd', cr(c, Z)]];
    const a = dir(s + 'Arm', s + 'ForeArm'); AX[s + 'Arm'] = [['fwd', cr(a, Z)], ['out', cr(a, perpUp(a, Y))], ['tw', a.clone().multiplyScalar(sg)]];
    const f = dir(s + 'ForeArm', s + 'Hand'); AX[s + 'ForeArm'] = [['bend', cr(f, Z)], ['tw', f.clone().multiplyScalar(sg)]];
    const h = dir(s + 'Hand', s + 'HandMiddle1'); AX[s + 'Hand'] = [['bend', cr(h, Z)], ['side', cr(h, lat)]];
    const t = dir(s + 'UpLeg', s + 'Leg'); AX[s + 'UpLeg'] = [['fwd', cr(t, Z)], ['out', cr(t, lat)], ['tw', t]];
    const k = dir(s + 'Leg', s + 'Foot'); AX[s + 'Leg'] = [['bend', cr(k, Z.clone().negate())]];
    const fd = dir(s + 'Foot', s + 'ToeBase'); AX[s + 'Foot'] = [['up', cr(fd, Y)], ['yaw', Y]];
    for (const fg of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let j = 1; j <= 3; j++) { const d = dir(s + 'Hand' + fg + j, s + 'Hand' + fg + (j + 1)); AX[s + 'Hand' + fg + j] = [['c', cr(d, Z)]]; }
  }
  const LEN = { thigh: P0.get(B.LeftLeg).distanceTo(P0.get(B.LeftUpLeg)), shin: P0.get(B.LeftFoot).distanceTo(P0.get(B.LeftLeg)) };

  // ── 자세 풀기: 값(도) → 관절 회전 D(화면 공간 축) → 뼈 로컬 회전 ──
  const qa = new T.Quaternion();
  function dOf(name, prm) { const ax = AX[name], q = new T.Quaternion(); if (!ax || !prm) return q; for (const [k, a] of ax) { const v = prm[k]; if (v) { qa.setFromAxisAngle(a, v * DEG); q.multiply(qa); } } return q; }
  function frameRot(a1, b1, a2, b2) {   // (a1,b1) 틀을 (a2,b2) 틀로 보내는 회전
    const m1 = new T.Matrix4().makeBasis(a1, b1, V().crossVectors(a1, b1)), m2 = new T.Matrix4().makeBasis(a2, b2, V().crossVectors(a2, b2));
    return new T.Quaternion().setFromRotationMatrix(m2.multiply(m1.transpose()));
  }
  // 다리 IK: 발목 목표 → 허벅지·정강이 회전(G: 쉬는 자세 대비 세계 회전)
  function legIK(s, G_h, hipPos, ankle, footYaw, kneeOut) {
    const U = P0.get(B[s + 'UpLeg']).clone().sub(P0.get(hips)).applyQuaternion(G_h).add(hipPos);
    const L1 = LEN.thigh, L2 = LEN.shin; const v = ankle.clone().sub(U); let d = v.length(); const vd = v.clone().normalize(); d = Math.min(d, (L1 + L2) * 0.9995);
    const sg = s === 'Left' ? 1 : -1, pole = V(Math.sin(footYaw * DEG) + sg * (kneeOut || 0.08), 0, Math.cos(footYaw * DEG));
    const perp = pole.clone().addScaledVector(vd, -vd.dot(pole)).normalize();
    const ca = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))), sa = Math.sqrt(1 - ca * ca);
    const K = U.clone().addScaledVector(vd, L1 * ca).addScaledVector(perp, L1 * sa), A = U.clone().addScaledVector(vd, d);
    const t1 = K.clone().sub(U).normalize(), s1 = A.clone().sub(K).normalize(), hinge = V().crossVectors(perp, vd).normalize();
    const t0 = dir(s + 'UpLeg', s + 'Leg'), s0 = dir(s + 'Leg', s + 'Foot');
    const h0t = X.clone().addScaledVector(t0, -t0.dot(X)).normalize(), h0s = X.clone().addScaledVector(s0, -s0.dot(X)).normalize();
    // hinge 방향: 무릎이 앞으로 굽는 쪽이 +X 와 같은 뜻이 되게
    return { Gt: frameRot(t0, h0t, t1, hinge), Gs: frameRot(s0, h0s, s1, hinge) };
  }
  // 자세 하나 = { bones: {이름: {축: 도}}, hip: [x,y,z], lf/rf: [x,y,z] 발목 이동, lfy/rfy: 발 방향(도), lft/rft: 발끝 들기, rg/lg: 손 쥐기(0~1), ... }
  const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
  function solve(pose) {
    if (rig.onGrip) rig.onGrip(pose.wy || PIPE_Y_DEF);
    const D = new Map(), get = n => pose.bones[n];
    for (const n in AX) if (!/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(n) && !/UpLeg$|Leg$|Foot$/.test(n)) D.set(B[n], dOf(n, get(n)));
    // 손가락 쥐기
    for (const [s, gk, tk] of [['Left', 'lg', 'lt'], ['Right', 'rg', 'rt']]) {
      const g = pose[gk] || 0, th = pose[tk] != null ? pose[tk] : g * 0.7;
      for (const fg of FINGERS) [62, 72, 50].forEach((a, j) => { qa.setFromAxisAngle(AX[s + 'Hand' + fg + (j + 1)][0][1], a * g * DEG); D.set(B[s + 'Hand' + fg + (j + 1)], qa.clone()); });
      [14, 34, 40].forEach((a, j) => { qa.setFromAxisAngle(AX[s + 'HandThumb' + (j + 1)][0][1], a * th * DEG); D.set(B[s + 'HandThumb' + (j + 1)], qa.clone()); });
    }
    // 다리: 엉덩이 회전 + 발목 목표로 IK
    const Dh = D.get(hips), hipPos = P0.get(hips).clone().add(V(...(pose.hip || [0, 0, 0])));
    for (const [s, fk, yk, tk] of [['Left', 'lf', 'lfy', 'lft'], ['Right', 'rf', 'rfy', 'rft']]) {
      const ank = P0.get(B[s + 'Foot']).clone().add(V(...(pose[fk] || [0, 0, 0]))), yaw = pose[yk] || 0;
      const { Gt, Gs } = legIK(s, Dh, hipPos, ank, yaw, pose.kneeOut);
      D.set(B[s + 'UpLeg'], Dh.clone().invert().multiply(Gt)); D.set(B[s + 'Leg'], Gt.clone().invert().multiply(Gs));
      const Gf = new T.Quaternion().setFromAxisAngle(Y, yaw * DEG); qa.setFromAxisAngle(cr(dir(s + 'Foot', s + 'ToeBase'), Y), (pose[tk] || 0) * DEG); Gf.multiply(qa);
      D.set(B[s + 'Foot'], Gs.clone().invert().multiply(Gf));
    }
    // 뼈 로컬 회전
    const out = new Map();
    for (const b of order) { const d = D.get(b);
      if (b === hips) { out.set(b, hipsParentQInv.clone().multiply(d).multiply(W0.get(b))); continue; }
      const q = LP.get(b).clone(); if (d) q.multiply(d); q.multiply(W0.get(b)); out.set(b, q); }
    const f = { q: out, hip: hipPos.applyMatrix4(hipsParentInv) };
    return f;
  }
  function applyFrame(f) { for (const [b, q] of f.q) b.quaternion.copy(q); hips.position.copy(f.hip); }
  return Object.assign(rig, { root, sm, B, hips, order, W0, P0, LP, AX, LEN, X, Y, Z, dir, perpUp, cr, dOf, frameRot, legIK, solve, applyFrame, Rz2y });
}
