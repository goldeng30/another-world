// 카메라: 쿼터뷰로 주인공을 부드럽게 따라가기 + 맞을 때 흔들림
import { V, DEG } from './math.js';
import { CONFIG } from '../config.js';

export function createCameraFollow(G) {
  const C = CONFIG.camera, QV = { yaw: C.yawDeg * DEG, pitch: C.pitchDeg * DEG, dist: C.dist, h: C.h };
  // 방 경계 쪽으로 가면 카메라는 주인공을 가운데 두지 않고 덜 따라가 어둠(빈 곳)을 조금만 보인다: 왼쪽·오른쪽·아래
  //   보이는 넓이(화면 반폭 · 아래로 보이는 거리)에서 edge 만큼만 경계 밖이 보이게 카메라 중심을 막고, 막히기 직전 soft 만큼은 부드럽게 늦춘다
  const softLo = (x, lo, s) => s < 1 ? Math.max(x, lo) : x >= lo + s ? x : lo + s * Math.exp((x - lo - s) / s);
  const soft2 = (x, lo, hi, s) => { if (hi <= lo) return (lo + hi) / 2; s = Math.min(s, (hi - lo) / 2); return -softLo(-softLo(x, lo, s), -hi, s); };
  function bounded(x, z, d) { const W = G.world, E = C.edge; if (!E || !W || !W.edges) return [x, z];
    const [u, v] = W.uv(x, z), e = W.edges(u, v), hf = G.cam.fov * DEG / 2, hw = d * Math.tan(hf) * G.cam.aspect, below = d * Math.cos(QV.pitch) - d * Math.sin(QV.pitch) / Math.tan(QV.pitch + hf);
    if (e.w <= 0) return [x, z]; const tu = soft2(u, e.L + hw - E.side, e.R - hw + E.side, E.soft), tv = softLo(v, e.B + below - E.below, E.soft);
    return W.world(u + (tu - u) * e.w, v + (tv - v) * e.w); }   // 출구 굴 가까이에선 막기를 서서히 풀어 그냥 따라간다
  function camFollow(dt, snap) { const root = G.hero.root, cam = G.cam, SHK = G.fx.SHK, controls = { target: G.camTarget };
    const RC = (G.world && G.world.data.camera) || {}; QV.pitch = (RC.pitchDeg ?? C.pitchDeg) * DEG; QV.dist = RC.dist ?? C.dist;   // 방마다 카메라 각도·거리(방 데이터 camera)
    const d = QV.dist * Math.max(1, Math.pow(1.9 / cam.aspect, 0.6)), [bx, bz] = bounded(root.position.x, root.position.z, d);
    const tg = V(bx, QV.h + root.position.y, bz), k = snap ? 1 : 1 - Math.exp(-dt * C.follow); controls.target.lerp(tg, k); cam.position.copy(controls.target).add(V(Math.sin(QV.yaw) * Math.cos(QV.pitch), Math.sin(QV.pitch), Math.cos(QV.yaw) * Math.cos(QV.pitch)).multiplyScalar(d)); cam.lookAt(controls.target);
    if (SHK.t > 0) { SHK.t = Math.max(0, SHK.t - dt); const k = SHK.t / SHK.dur, a = SHK.a * k * k, w = (SHK.dur - SHK.t) * 60; cam.position.add(V(1, 0, 0).applyQuaternion(cam.quaternion).multiplyScalar(Math.sin(w * 1.3) * a * 0.6)).add(V(0, 1, 0).applyQuaternion(cam.quaternion).multiplyScalar(Math.cos(w) * a)); } }
  return { QV, follow: camFollow };
}
