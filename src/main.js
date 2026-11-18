// 이세계 — 시작점: 화면 · 렌더러 → 방 → 주인공 → 적 → 효과 → 카메라 → 루프
import { CONFIG } from './config.js';
import { setupScreen } from './ui/screen.js';
import { createRenderer } from './core/renderer.js';
import { onProgress } from './core/assets.js';
import { createCameraFollow } from './core/camera.js';
import { createAutoRes, startLoop } from './core/loop.js';
import { createStats } from './core/debug.js';
import { ROOMS, ROOM_CYCLE } from './data/rooms/index.js';
import { buildRoom } from './world/room.js';
import { createHero } from './hero/index.js';
import { spawnEnemy, stepEnemies } from './enemies/index.js';
import { createFX } from './fx/hitfx.js';
import { createHUD } from './ui/hud.js';
import { createSelector } from './world/select.js';

const $ = s => document.querySelector(s);
setupScreen($);

(async function main() {
  const bar = $('#loading-bar'); onProgress((d, t) => { if (bar) bar.style.transform = `scaleX(${(d / t).toFixed(3)})`; });
  // G: 게임 전체가 함께 쓰는 것들(렌더러·장면·카메라·빛 + 방·주인공·적·효과)
  const G = createRenderer($('#view'));
  G.enemies = [];
  Object.defineProperty(G, 'enemy', { get: () => G.enemies.find(e => !e.dead) || null });   // 지금 상대하는 적(살아 있는 적 중 가장 먼저 나온 적)

  const q = new URLSearchParams(location.search).get('room'), first = ROOMS[q] ? q : CONFIG.startRoom;   // 주소 끝 ?room=gallery 로 바로 전시장
  G.world = await buildRoom(G, ROOMS[first]); G.setLighting(G.world.lighting);
  G.hero = await createHero(G);
  for (const spec of G.world.data.enemies || []) G.enemies.push(await spawnEnemy(G, spec));
  G.fx = createFX(G);
  const camera = createCameraFollow(G);
  const hud = createHUD(G, $);
  const sel = createSelector(G);   // 가까운 광석·식물·시체를 골라 그 물체를 밝혀 표시(G.selected) — 싸우는 중엔 꺼짐
  G.onDamage = (at, amount, kind) => hud.popDamage(at, amount, kind);   // 맞으면 머리 위에 데미지 숫자

  // 방 바꾸기: 지금 방·적을 치우고 새 방을 만든 뒤 주인공을 들어온 자리로(그동안 루프는 쉰다)
  let switching = false;
  async function goRoom(id) { if (switching || !ROOMS[id] || G.world.data.id === id) return; switching = true; $('#loading').hidden = false;
    try {
      sel.clear(); for (const e of G.enemies) G.scene.remove(e.holder); G.enemies.length = 0;
      G.world.dispose(); G.world = await buildRoom(G, ROOMS[id]); G.setLighting(G.world.lighting);
      const r = G.hero.root, c = G.hero.ctl; r.position.set(G.world.spawn.x, 0, G.world.spawn.z); c.v = 0; c.buf = false; c.req = null; G.hero.face(G.world.spawnYaw); G.hero.disarm();
      for (const spec of G.world.data.enemies || []) G.enemies.push(await spawnEnemy(G, spec));
      step(0); camera.follow(0, true); G.fogFit(); hud.update(0); G.rd.compile(G.scene, G.cam);
    } catch (e) { console.error(e); }
    $('#loading').hidden = true; switching = false; }
  // 방 바꾸는 버튼(오른쪽 위) · G 키: 전투방 ↔ 전시장(ROOM_CYCLE 순서)
  const other = () => { const i = ROOM_CYCLE.indexOf(G.world.data.id); return ROOM_CYCLE[(i + 1) % ROOM_CYCLE.length]; };
  const rb = $('#b-room'); if (rb) rb.addEventListener('click', () => goRoom(other()));
  window.addEventListener('keydown', e => { if (e.code === 'KeyG' && !e.repeat) goRoom(other()); });
  // 새로고침(오른쪽 위 버튼 · R 키): 토템·광석·식물 다시 뽑기 + 적(시체 포함) 치우고 처음처럼 다시 + 주인공은 들어온 자리로, HP·MP 가득
  const reroll = async () => { if (switching) return; switching = true;
    try {
      sel.clear(); if (G.world.reroll) await G.world.reroll();
      for (const e of G.enemies) G.scene.remove(e.holder); G.enemies.length = 0;
      for (const spec of G.world.data.enemies || []) G.enemies.push(await spawnEnemy(G, spec));
      G.hero.reset(G.world.spawn, G.world.spawnYaw);
      step(0); camera.follow(0, true); G.fogFit(); hud.update(0); G.rd.compile(G.scene, G.cam);
    } catch (e) { console.error(e); }
    switching = false; };
  const rr = $('#b-reroll'); if (rr) rr.addEventListener('click', reroll);
  window.addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat) reroll(); });

  // 한 프레임: 게임 속 시간(배속·히트스톱) → 주인공 → 적 → 효과 → 방(불·광석·토템) → 그림자 범위 → 카메라 → 안개 → 화면 위 정보(HUD)
  function step(dt) { const rdt = dt; dt *= CONFIG.game.speed;
    const HS = G.fx.HS; if (HS.t > 0) { HS.t -= rdt; dt *= 0.04; }   // 맞는 순간 잠깐 멈춤(히트스톱, 실제 시간)
    G.hero.update(dt);
    stepEnemies(G, dt);   // 적 움직임 · 쓰러짐
    G.fx.step(rdt); G.world.update(performance.now() / 1000, G.hero.root.position);
    G.fitShadow(G.hero.root.position, G.enemy ? G.enemy.holder.position : null);
  }
  const draw = () => G.rd.render(G.scene, G.cam);

  window.__dbg = { G, CONFIG, step, draw, goRoom, reroll, camera, hud, sel, scene: G.scene, rd: G.rd, cam: G.cam, get DG() { return G.world; }, hero: G.hero, root: G.hero.root, ctl: G.hero.ctl, st: G.hero.anim.st, ACTS: G.hero.acts.ACTS, spawnEnemy: spec => spawnEnemy(G, spec).then(e => (G.enemies.push(e), e)) };
  $('#loading').hidden = true;
  G.hero.start(); step(0); camera.follow(0, true); G.fogFit(); hud.update(0);
  G.rd.compile(G.scene, G.cam);   // 셰이더를 미리 다 만들어 둔다(처음 보이는 순간 멈칫 없게)
  const autoRes = createAutoRes(G.rd); window.__dbg.AR = autoRes.AR; window.__dbg.autoRes = autoRes.feed;
  startLoop(dt => { if (switching) return; step(dt); camera.follow(dt); G.fogFit(); hud.update(dt); sel.update(dt); }, () => { if (!switching) draw(); }, autoRes, createStats(G.rd));
})().catch(e => { console.error(e); const el = $('#loading'); if (el) { el.hidden = false; el.textContent = '불러오지 못했어요'; } });
