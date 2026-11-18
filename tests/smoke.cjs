// 기본 점검: 불러오기 · 오류 없음 · 걷기 · 공격 · 화면 한 장(tests/out/smoke.png)
const open = require('./harness.cjs'); const fs = require('fs'); const path = require('path');
(async () => { const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
  const { b, p, errors, loadMs } = await open({ mobile: true });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => { const { G } = __dbg; let pl = 0, dl = 0; G.scene.traverse(o => { if (o.isPointLight) pl++; if (o.isDirectionalLight) dl++; }); return { 점광원: pl, 방향광: dl, 셰이더: G.rd.info.programs.length, 충돌원: G.world.colliders.length, 상호작용: G.world.interactables.length }; });
  const p0 = await p.evaluate(() => __dbg.root.position.toArray().map(v => +v.toFixed(1)));
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); await p.keyboard.up('KeyW');
  await p.keyboard.down('KeyF'); await p.waitForTimeout(2500); await p.keyboard.up('KeyF');
  const p1 = await p.evaluate(() => __dbg.root.position.toArray().map(v => +v.toFixed(1)));
  await p.screenshot({ path: path.join(OUT, 'smoke.png') });
  console.log(JSON.stringify({ loadMs, ...info, 시작: p0, 이동후: p1, 오류: errors }));
  await b.close(); process.exit(errors.length ? 1 : 0); })();
