// 주인공 하나 만들기: 모델 → 뼈대 → 무기 → 동작 → 공격 판정 → 조작
import { loadHeroModel } from './model.js';
import { T } from '../core/math.js';
import { createRig } from './rig.js';
import { createWeapon } from './weapon.js';
import { makeActions } from './actions.js';
import { createAnimation } from './animation.js';
import { createCombat } from './combat.js';
import { createController } from './controller.js';
import { PATH, loadJSON } from '../core/assets.js';
import { CONFIG } from '../config.js';

export async function createHero(G) {
  const [model, clipsSrc] = await Promise.all([loadHeroModel(G.ENV_K), loadJSON(PATH.hero + 'clips.json')]);
  const { gltf, root, sm } = model;
  G.scene.add(root); if (G.world && G.world.spawn) { root.position.set(G.world.spawn.x, 0, G.world.spawn.z); root.rotation.y = G.world.spawnYaw || 0; }   // 방 아래 들어온 자리에서 방 안쪽을 보고 시작
  const H = { G, gltf, clipsSrc, lastF: null, PIPE_PREV: null };
  H.rig = createRig(model);
  H.weapon = await createWeapon(H.rig);
  H.acts = makeActions();
  H.anim = createAnimation(H);
  H.combat = createCombat(H);
  H.ctrl = createController(H);
  const { st, play } = H.anim;
  // 발밑 접지 그림자: 바닥에 붙은 은은한 어둠(진짜 그림자와 같이 있어 바닥에 선 느낌)
  const blob = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.scale.set(70, 56, 1); m.renderOrder = 1; G.scene.add(m); return m; })();
  // 굴 어둠: 출구 굴 안으로 들어갈수록 주인공을 어둡게(머리 위 불빛·반사광까지 다 덮어 어둠 속으로 사라지게). 발밑 그림자도 같이
  //   재질마다 마지막 색에 (1 - 어둠)을 곱한다(안개 뒤). 모든 재질이 같은 값 하나를 본다
  const DK = { value: 0 }, seen = new Set();
  root.traverse(o => { if (!o.isMesh || !o.material) return; for (const m of [].concat(o.material)) { if (seen.has(m)) continue; seen.add(m);
    const pre = m.onBeforeCompile, key = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => { if (pre) pre.call(m, sh, r); sh.uniforms.heroDark = DK; sh.fragmentShader = 'uniform float heroDark;\n' + sh.fragmentShader.replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.rgb *= 1.0 - heroDark;'); };
    m.customProgramCacheKey = () => (key ? key.call(m) : '') + '|heroDark'; m.needsUpdate = true; } });
  const setDark = k => { if (Math.abs(k - DK.value) < 1e-3) return; DK.value = k; blob.material.opacity = 0.32 * (1 - k); };
  const face = yaw => { const c = H.ctrl.ctl; c.yaw = c.mv = yaw; root.rotation.y = yaw; };   // 보는 방향 바로 맞추기(돌아서는 동작 없이)
  const stats = { level: CONFIG.hero.level, hp: CONFIG.hero.hp, hpMax: CONFIG.hero.hp, mp: CONFIG.hero.mp, mpMax: CONFIG.hero.mp };   // 쓰러지는 처리는 아직 없음(0에서 멈춤)
  return {
    H, root, sm, rig: H.rig, weapon: H.weapon, anim: H.anim, acts: H.acts, combat: H.combat, ctl: H.ctrl.ctl,
    update(dt) { H.ctrl.update(dt); const W = G.world; root.position.y = W && W.groundY ? W.groundY(root.position.x, root.position.z) : 0; blob.position.set(root.position.x, root.position.y + 1.2, root.position.z); if (G.world && G.world.heroDark) setDark(G.world.heroDark(root.position.x, root.position.z)); },   // 발밑 그림자 따라오기 · 굴 어둠   // 한 프레임(게임 속 dt) · 발밑 그림자 따라오기
    hit: H.ctrl.hit,                // 적에게 맞음(from 위치, 넉백 거리)
    stats, hurt(d) { stats.hp = Math.max(0, stats.hp - d); if (G.onDamage) G.onDamage(() => root.position.clone().setY(root.position.y + H.rig.P0.get(H.rig.B.Head).y + 13), d, 'me'); },   // HP·MP · 체력 깎기(머리 위에 붉은 숫자)
    height: H.rig.P0.get(H.rig.B.Head).y + 13,
    start() { face(root.rotation.y); H.ctrl.disarm(); play('uidle'); st.fade = 1; },   // 처음엔 무방비(칼은 등에)
    disarm() { H.ctrl.disarm(); play('uidle', 0, 0.3); },   // 방에 들어올 때: 무방비로
    // 처음 상태로: 들어온 자리 · 처음 방향 · 하던 동작·넉백 멈춤 · HP·MP 가득
    face,
    reset(p, yaw = 0) { const c = H.ctrl.ctl; root.position.set(p.x, 0, p.z); Object.assign(c, { v: 0, buf: false, req: null, ci: 0, rec: 0, sec: null }); face(yaw); H.ctrl.KBH.v = 0; H.PIPE_PREV = null;
      H.ctrl.disarm(); play('uidle'); st.fade = 1; stats.hp = stats.hpMax; stats.mp = stats.mpMax; },
  };
}
