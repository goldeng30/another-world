// 적 점검: 늑대를 불러 싸워 보기(오류 없음 · 늑대가 다가오고 · 공격이 오가는지). node tests/enemy.cjs
const open = require('./harness.cjs'); const fs = require('fs'); const path = require('path');
(async () => { const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
  const { b, p, errors } = await open({ w: 420, h: 194 });
  await p.evaluate(() => __dbg.spawnEnemy({ type: 'wolf', at: [0, 120], skin: 'grey' }));
  const r = await p.evaluate(() => { const d = __dbg; window.__pause = true; const ctl = d.ctl, dt = 1 / 60, log = { states: {}, heroHit: 0, wolfHit: 0 };
    const e = d.G.enemy; e.hp = e.hpMax = 1e6; const hit0 = e.hit; e.hit = (...a) => { log.wolfHit++; return hit0(...a); };
    const hh = d.G.hero.hit; e.onStrike = (from, kb) => { log.heroHit++; hh(from, kb); };
    let minD = 1e9;
    for (let i = 0; i < 1500; i++) { ctl.keys.clear(); ctl.held = false;
      const dx = e.holder.position.x - d.root.position.x, dz = e.holder.position.z - d.root.position.z, dist = Math.hypot(dx, dz); minD = Math.min(minD, dist);
      if (i % 50 === 0) ctl.req = 'slash'; if (dist > 150 && i % 50 > 5) ctl.keys.add('KeyW');
      d.step(dt); d.camera.follow(dt); log.states[e.gs.state] = (log.states[e.gs.state] || 0) + 1; }
    d.draw(); log.minDist = +minD.toFixed(0); log.url = d.rd.domElement.toDataURL('image/png'); return log; });
  fs.writeFileSync(path.join(OUT, 'enemy.png'), Buffer.from(r.url.split(',')[1], 'base64')); delete r.url;
  console.log(JSON.stringify({ ...r, 오류: errors })); await b.close(); process.exit(errors.length ? 1 : 0); })();
