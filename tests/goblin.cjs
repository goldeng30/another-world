// 고블린 점검: 방에 있는 고블린이 다가오기 · 옆걸음(간 보기) · 뒤로 물러나기 · 공격 · 맞기를 다 하는지, 주인공이 가만히 있을 때와 싸울 때
const open = require('./harness.cjs'); const fs = require('fs'); const path = require('path');
(async () => { const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
  const { b, p, errors } = await open({ w: 420, h: 194 });
  await p.evaluate(async () => { if (!__dbg.G.enemies.length) await __dbg.spawnEnemy({ type: 'goblin', at: [0, 100] }); });   // 적이 없는 방이면 하나 세운다
  const r = await p.evaluate(() => { const d = __dbg, e = d.G.enemy, ctl = d.ctl, dt = 1 / 60; window.__pause = true; e.hp = e.hpMax = 1e6; d.root.position.set(e.holder.position.x + 140, 0, e.holder.position.z + 140);   // 움직임만 보므로 쓰러지지 않게 · 고블린이 알아챌 거리(300) 안에서 시작
    const log = { kind: e.kind, speeds: [e.walkSpeed, e.backSpeed, e.sideSpeed].map(v => +v.toFixed(0)), states: {}, seq: [], heroHit: 0, gobHit: 0, shots: {} };
    const hh = d.G.hero.hit; e.onStrike = (f, kb) => { log.heroHit++; hh(f, kb); }; const eh = e.hit; e.hit = (...a) => { log.gobHit++; return eh(...a); };
    let last = null;
    const run = (n, attack) => { for (let i = 0; i < n; i++) { ctl.keys.clear(); ctl.held = false;
      if (attack) { const dist = Math.hypot(e.holder.position.x - d.root.position.x, e.holder.position.z - d.root.position.z); if (dist < 160 && i % 45 === 0) ctl.req = 'slash'; }
      d.step(dt); d.camera.follow(dt); const s = e.gs.state; log.states[s] = (log.states[s] || 0) + 1;
      if (s !== last) { log.seq.push(s === 'pause' ? '·' : s); last = s; if (!log.shots[s] && (s === 'sideL' || s === 'sideR' || s === 'back')) { for (let k = 0; k < 14; k++) { d.step(dt); d.camera.follow(dt); } d.G.fogFit(); d.draw(); log.shots[s] = d.rd.domElement.toDataURL('image/png'); } } } };
    run(2400, false); log.seqIdle = log.seq.slice(); log.seq = []; run(1500, true); log.mood = +e.gs.mood.toFixed(2);
    return log; });
  for (const [k, u] of Object.entries(r.shots)) fs.writeFileSync(path.join(OUT, `goblin_${k}.png`), Buffer.from(u.split(',')[1], 'base64')); delete r.shots;
  console.log(JSON.stringify({ ...r, seqIdle: r.seqIdle.slice(0, 70).join(' '), seq: r.seq.slice(0, 50).join(' '), 오류: errors })); await b.close(); process.exit(errors.length ? 1 : 0); })();
