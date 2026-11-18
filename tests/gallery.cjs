// 전시장 점검: ?room=gallery 로 열어 줄마다 몇 곳을 찍고(tests/out/gallery_*.jpg), 토템은 눈빛 켜진 채로 하나씩, 전투방으로 갔다가 다시 오기
const open = require('./harness.cjs'); const fs = require('fs'); const path = require('path');
(async () => { const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
  const { b, p, errors, loadMs } = await open({ w: 844, h: 390, query: '?room=gallery' });
  const r = await p.evaluate(() => { const d = __dbg, shots = {}; window.__pause = true;
    const snap = (name, u, v, t = 10) => { const [x, z] = d.DG.world(u, v); d.root.position.set(x, 0, z); d.step(0); d.camera.follow(0, true); const hp = d.root.position.clone(); for (let i = 0; i < 90; i++) d.DG.update(t, hp); d.G.fogFit(); d.draw(); shots[name] = d.rd.domElement.toDataURL('image/jpeg', 0.88); };
    const rows = {}; for (const e of d.DG.data.place) (rows[e.at[1]] = rows[e.at[1]] || []).push(e);
    for (const [v, list] of Object.entries(rows)) { const us = list.map(e => e.at[0]); for (let k = 0; k < 3; k++) snap(`row${v}_${k}`, us[0] + (us[us.length - 1] - us[0]) * (k + 0.5) / 3, +v - 160); }
    for (const e of d.DG.data.place.filter(e => /^tot/.test(e.prop))) snap('tot_' + e.prop, e.at[0], e.at[1] - 150);
    return { shots, n: d.DG.data.place.length, colliders: d.DG.colliders.length }; });
  for (const [k, u] of Object.entries(r.shots)) fs.writeFileSync(path.join(OUT, `gallery_${k}.jpg`), Buffer.from(u.split(',')[1], 'base64'));
  await p.evaluate(() => { window.__pause = false; }); await p.evaluate(() => __dbg.goRoom('cave01')); const back = await p.evaluate(() => ({ room: __dbg.DG.data.id, enemies: __dbg.G.enemies.length }));
  await p.evaluate(() => __dbg.goRoom('gallery')); const again = await p.evaluate(() => ({ room: __dbg.DG.data.id, enemies: __dbg.G.enemies.length }));
  console.log(JSON.stringify({ loadMs, 사진: Object.keys(r.shots).length, 놓은것: r.n, 충돌원: r.colliders, 전투방으로: back, 다시전시장: again, 오류: errors })); await b.close(); process.exit(errors.length ? 1 : 0); })();
