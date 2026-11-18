// HUD 점검: 내 발밑 HP·MP 막대 · 적 머리 위 막대(맞으면 줄고 나타남) · 보스 막대 · 쓰러지면 막대가 사라지고 시체가 남는지 · 새로고침(시체 치움·고블린 다시·처음 자리·HP 가득). node tests/hud.cjs
const open = require('./harness.cjs');
(async () => {
  const { b, p, errors } = await open({ w: 844, h: 390 });
  const run = n => p.evaluate(n => { const d = __dbg, dt = 1 / 60; window.__pause = true;
    for (let i = 0; i < n; i++) { d.ctl.keys.clear(); d.step(dt); d.camera.follow(dt); d.G.fogFit(); d.hud.update(dt); }
    const sc = el => { const m = /scaleX\(([\d.]+)\)/.exec(el ? el.style.transform : ''); return m ? +m[1] : null; };
    return { hp: d.G.hero.stats.hp, hpBar: sc(document.querySelector('#hud-self .hp .fill')), mpBar: sc(document.querySelector('#hud-self .mp .fill')), selfAt: document.getElementById('hud-self').style.transform,
      foes: d.G.enemies.length, alive: !!d.G.enemy, foeBar: sc(document.querySelector('.foe .fill')), foeOn: document.querySelectorAll('.foe.on').length, boss: document.getElementById('hud-boss').classList.contains('on'), bossBar: sc(document.querySelector('#hud-boss .fill')) }; }, n);
  // 적이 없는 방이면 고블린 하나를 방 데이터에 넣고 세운다(새로고침도 다시 세우게)
  await p.evaluate(async () => { const G = __dbg.G; if (G.enemies.length) return; const spec = { type: 'goblin', at: [0, 100] }; G.world.data.enemies = [spec]; await __dbg.spawnEnemy(spec); });
  const log = {}, bad = [];
  log.start = await run(2);
  if (log.start.boss) bad.push('보스 막대(보스가 없으면 안 보여야)');
  await p.evaluate(() => { __dbg.G.hero.hurt(30); __dbg.G.enemy.hurt(15); }); log.hurt = await run(30);
  if (Math.abs(log.hurt.hpBar - 0.7) > 0.01 || log.hurt.mpBar !== 1 || !/translate/.test(log.hurt.selfAt)) bad.push('내 HP 막대'); if (Math.abs(log.hurt.foeBar - 0.75) > 0.01 || !log.hurt.foeOn) bad.push('적 막대');
  await p.evaluate(() => { const e = __dbg.G.enemy; e.boss = true; e.name = '보스'; e.hpMax = 300; e.hp = 150; }); log.boss = await run(10);
  if (!log.boss.boss || Math.abs(log.boss.bossBar - 0.5) > 0.01) bad.push('보스 막대');
  await p.evaluate(() => { for (const e of __dbg.G.enemies) { e.boss = false; e.hurt(1e6); } }); log.dead = await run(240);   // 방의 적을 모두 쓰러뜨린다(적이 여럿인 방도)
  log.corpse = await p.evaluate(() => { const e = __dbg.G.enemies[0]; return { act: e.gs.deadAct, done: e.gs.done, inScene: !!e.holder.parent }; });
  if (log.dead.alive || log.dead.foes !== log.start.foes || log.dead.foeOn || !log.corpse.done || !log.corpse.inScene) bad.push('쓰러짐·시체');
  // 새로고침: 시체 치우고 고블린 다시 · 주인공 처음 자리 · HP 가득
  const corpse = await p.evaluate(() => { const d = __dbg; window.__corpse = d.G.enemies[0].holder; d.root.position.x += 120; d.root.position.z -= 80; return 1; });
  await p.evaluate(() => __dbg.reroll()); log.reroll = await run(2);
  log.after = await p.evaluate(() => { const d = __dbg, s = d.G.world.spawn; return { corpseGone: !window.__corpse.parent, atSpawn: Math.hypot(d.root.position.x - s.x, d.root.position.z - s.z) < 1, hp: d.G.hero.stats.hp }; });
  if (!log.after.corpseGone || !log.after.atSpawn || log.after.hp !== 100 || !log.reroll.alive || log.reroll.foes !== log.start.foes || log.reroll.hpBar !== 1) bad.push('새로고침');
  console.log(JSON.stringify({ ...log, 문제: bad, 오류: errors })); await b.close(); process.exit(errors.length || bad.length ? 1 : 0); })();
