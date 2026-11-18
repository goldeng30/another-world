// 한 파일 앱 점검: dist/single/이세계.html 을 인터넷 없이(file://) 열어 오류·외부 요청이 없는지
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 420, height: 194 } }); const errors = [], ext = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await p.route(/^https?:/, r => { const u = r.request().url(); if (u.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' }); ext.push(u.slice(0, 100)); r.abort(); });   // 글꼴만 빈 응답
  const t0 = Date.now(); await p.goto('file://' + path.resolve(__dirname, '../dist/single/이세계.html'));
  await p.waitForFunction(() => window.__dbg && document.getElementById('loading').hidden, null, { timeout: 180000 }).catch(e => errors.push('timeout'));
  console.log(JSON.stringify({ ms: Date.now() - t0, 외부요청: ext, 오류: errors })); await b.close(); process.exit(errors.length || ext.length ? 1 : 0); })();
