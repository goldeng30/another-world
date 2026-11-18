// 토템 눈: 주인공이 가까이 오면 눈구멍이 빛난다(눈 자리는 모델 기준 좌표)
// 출구를 알리는 토템(E.exit)은 그 출구 굴로 들어가는 동안엔 범위를 벗어나도 계속 켜 둔다(왼쪽 굴 → 왼쪽 토템)
// 방에 살아 있는 몬스터가 남아 있으면 어느 토템도 반응하지 않는다
// 눈빛이 바닥·토템을 비추는 점광원은 하나만 두고, 더 가까운 토템 쪽으로 옮겨 그 색으로 켠다(점광원 수 = 화면 전체 계산량)
import { T, sstep } from '../core/math.js';
import { glowTex as GLOW } from './textures.js';
import { U2 } from './coords.js';

export function totemTools(W) {
  const { root, upd, rnd } = W, glowTex = GLOW();
  const TE = { L: null, list: [] };
  const rc = new T.Raycaster(), RC_MAT = new T.MeshBasicMaterial({ side: T.DoubleSide });
  // 눈 자리 [x, y(, z)]: z를 안 적었으면 앞(+z)에서 쏴서 닿는 면의 깊이(눈구멍 안쪽)
  const eyeZ = (m, x, y) => { rc.set(new T.Vector3(x, y, 2), new T.Vector3(0, 0, -1)); const g = new T.Mesh(m.geometry, RC_MAT), h = rc.intersectObject(g)[0]; return h ? h.point.z : 0.05; };
  function totemEyes(m, eyes, col, size = 1) { if (!m) return; const sp = []; eyes = eyes.map(([x, y, z]) => [x, y, z ?? eyeZ(m, x, y)]);
    if (!TE.L) { TE.L = new T.PointLight(col, 0, 200, 2); root.add(TE.L);
      upd.push(() => { let b = null; for (const e of TE.list) if (!b || e.k > b.k) b = e; if (b) { TE.L.position.copy(b.lp); TE.L.color.setHex(b.col); TE.L.intensity = 1.8 * b.k; } }); }
    m.updateWorldMatrix(true, false); const wp = m.getWorldPosition(new T.Vector3()), E = { k: 0, col, lp: m.localToWorld(new T.Vector3(0, eyes[0][1], 0.09)) }; TE.list.push(E);
    for (const [x, y, z] of eyes) for (const [sz0, op] of [[0.042, 1], [0.12, 0.55]]) { const sz = sz0 * size; const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); s.position.set(x, y, z + 0.006); s.scale.set(sz, sz, 1); s.userData.op = op; m.add(s); sp.push(s); }
    rnd();   // 예전 깜빡임 위상 자리: 뒤에 놓는 소품의 무작위 배치가 바뀌지 않게 그대로 하나 뽑는다
    upd.push((t, hp) => { let near = hp ? 1 - sstep(80, 190, Math.hypot(hp.x - wp.x, hp.z - wp.z)) : 0;
      if (W.G && W.G.enemies && W.G.enemies.some(e => !e.dead)) near = 0;   // 방에 살아 있는 몬스터가 있으면 반응하지 않는다(다 잡아야 길을 알려 준다)
      if (hp && E.exit && W.S) { const [u, v] = U2(hp.x, hp.z); if (W.S.inTunnel(u, v, E.exit, 60) && W.S.pastMouth(u, v, E.exit) > -40) near = 1; }   // 이 토템의 출구 굴 안(입구 조금 앞부터)이면 계속 켬
      E.k += (near - E.k) * 0.08;
      for (const s of sp) s.material.opacity = s.userData.op * E.k; }); }
  totemEyes.list = TE.list;   // 마지막에 놓은 토템의 눈빛(출구 이어 붙이기용)
  totemEyes.reset = () => { TE.L = null; TE.list.length = 0; };   // 토템을 다시 뽑을 때: 눈빛 목록·공용 빛을 처음 상태로
  return totemEyes;
}
