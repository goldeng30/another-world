// 무기(녹슨 쇠파이프): 손에 붙이기 · 쥐는 자리 · 두 손 잡기 · 끝점(타격 판정용)
import { T, V, sstep } from '../core/math.js';
import { makePipe } from './pipe.js';

export async function createWeapon(rig) {
  const { root, B, solve, applyFrame } = rig;
  // ── 쇠파이프: 쥔 손가락이 그리는 원의 가운데에 파이프 축을 맞춰 오른손에 붙인다 ──
  const GRIP = { rg: 0.95, rt: 0.8 }, PIPE_S = 0.58, PIPE_Y = 9.5;
  const pipe = await makePipe(); pipe.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  {
    applyFrame(solve({ bones: {}, rg: GRIP.rg, rt: GRIP.rt })); root.updateMatrixWorld(true);
    const w = n => B[n].getWorldPosition(V()), M = [1, 2, 4].map(j => w('RightHandMiddle' + j));
    const ab = M[1].clone().sub(M[0]), ac = M[2].clone().sub(M[0]), nn = V().crossVectors(ab, ac);
    const ctr = M[0].clone().add(V().crossVectors(nn, ab).multiplyScalar(ac.lengthSq()).add(V().crossVectors(ac, nn).multiplyScalar(ab.lengthSq())).divideScalar(2 * nn.lengthSq()));
    let ax = nn.normalize(); if (ax.dot(w('RightHandIndex1').sub(w('RightHandPinky1'))) < 0) ax.negate();
    const e = M[0].clone().sub(ctr); e.addScaledVector(ax, -e.dot(ax)).normalize();
    const Mw = new T.Matrix4().makeBasis(e, ax, V().crossVectors(e, ax)).scale(V(PIPE_S, PIPE_S, PIPE_S)); Mw.setPosition(ctr.clone().addScaledVector(ax, -PIPE_Y * PIPE_S));
    B.RightHand.add(pipe); const Ml = new T.Matrix4().copy(B.RightHand.matrixWorld).invert().multiply(Mw); Ml.decompose(pipe.position, pipe.quaternion, pipe.scale);
  }
  const pipeBase = pipe.position.clone(), pipeBaseQ = pipe.quaternion.clone(), pipeAxisH = V(0, 1, 0).applyQuaternion(pipe.quaternion).multiplyScalar(pipe.scale.y);
  const W = { away: false };   // 칼을 넣었나(넣으면 안 보인다)
  const setGrip = wy => { if (W.away) return; pipe.quaternion.copy(pipeBaseQ); pipe.position.copy(pipeBase).addScaledVector(pipeAxisH, PIPE_Y - wy); }; rig.onGrip = setGrip;
  // 왼손 주먹(쥔 상태)의 원 중심을 손 뼈 기준으로 → 두 손으로 쥐는 동작에서 파이프가 두 주먹을 잇는 선을 지나게
  const LGC = (() => { applyFrame(solve({ bones: {}, lg: 0.92, lt: 0.8 })); root.updateMatrixWorld(true);
    const w = n => B[n].getWorldPosition(V()), M = [1, 2, 4].map(j => w('LeftHandMiddle' + j)), ab = M[1].clone().sub(M[0]), ac = M[2].clone().sub(M[0]), nn = V().crossVectors(ab, ac);
    const ctr = M[0].clone().add(V().crossVectors(nn, ab).multiplyScalar(ac.lengthSq()).add(V().crossVectors(ac, nn).multiplyScalar(ab.lengthSq())).divideScalar(2 * nn.lengthSq()));
    return B.LeftHand.worldToLocal(ctr); })();
  function aimPipe(wy) {
    root.updateMatrixWorld(true);
    const R = pipe.localToWorld(V(0, wy, 0)), L = B.LeftHand.localToWorld(LGC.clone()), o = pipe.localToWorld(V(0, 0, 0)), ax = pipe.localToWorld(V(0, 1, 0)).sub(o).normalize();
    const d = R.clone().sub(L); if (d.length() < 1e-3) return; d.normalize();
    const q = new T.Quaternion().setFromUnitVectors(ax, d), wq = pipe.getWorldQuaternion(new T.Quaternion()), ws = pipe.getWorldScale(V());
    const nq = q.clone().multiply(wq), no = o.clone().sub(R).applyQuaternion(q).add(R);
    const M = new T.Matrix4().compose(no, nq, ws), Ml = new T.Matrix4().copy(B.RightHand.matrixWorld).invert().multiply(M); Ml.decompose(pipe.position, pipe.quaternion, V());
    pipe.updateMatrixWorld(true);
  }
  // 파이프 자세: 보통은 두 주먹을 잇는 선(aimPipe). 동작에 hand 구간이 있으면 그동안 오른손 방향(칼이 손에 붙은 것처럼)으로 섞는다
  function posePipe(a, t) { if (!a.pipe || W.away) return; if (!a.two) { setGrip(a.wy); return; }
    const w = a.hand ? sstep(a.hand[0], a.hand[1], t) * (1 - sstep(a.hand[2], a.hand[3], t)) : 0; setGrip(a.wy);
    if (w >= 1) { pipe.updateMatrixWorld(true); return; }
    const qb = pipe.quaternion.clone(), pb = pipe.position.clone(); aimPipe(a.wy); if (w <= 0) return;
    const g = V(0, a.wy * pipe.scale.y, 0), Rl = pb.clone().add(g.clone().applyQuaternion(qb)), q = pipe.quaternion.clone().slerp(qb, w);
    pipe.quaternion.copy(q); pipe.position.copy(Rl).sub(g.applyQuaternion(q)); pipe.updateMatrixWorld(true); }
  // 파이프 끝(구부러진 머리 쪽): 여러 조각이라 조각마다 위치를 넣어 파이프 기준으로 정점을 모아 잰다. 맨 끝 4% 정점들의 가운데
  const TIPV = (() => { pipe.updateMatrixWorld(true); const inv = new T.Matrix4().copy(pipe.matrixWorld).invert(), pts = [], v = V(); let lo = Infinity, hi = -Infinity;
    pipe.traverse(o => { if (!o.isMesh) return; const M = inv.clone().multiply(o.matrixWorld), a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(M); pts.push(v.clone()); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } });
    const top = pts.filter(q => q.y > hi - (hi - lo) * 0.04); return top.reduce((s, q) => s.add(q), V()).divideScalar(top.length); })();
  const PIPE_TIP = TIPV.y;
  // 파이프 위 점들(오른손 쥔 곳 → 끝)
  const PIPE_PTS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1].map(u => V(0, 19, 0).lerp(TIPV, u));   // 끝(1) → 오른손 쪽
  const pipeSamples = () => PIPE_PTS.map(q => pipe.localToWorld(q.clone()));
  // 칼 넣기: 숨긴다(등에 메지 않음) · 빼기: 오른손에 다시 보인다
  function holster(away) { if (away === W.away) return; W.away = away; pipe.visible = !away; if (!away) { setGrip(19); pipe.updateMatrixWorld(true); } }
  return { W, holster, pipe, GRIP, PIPE_S, PIPE_Y, setGrip, aimPipe, posePipe, LGC, TIPV, PIPE_TIP, PIPE_PTS, pipeSamples };
}
