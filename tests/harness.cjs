// 점검용: 저장소 폴더를 가짜 주소(http://game.local/)로 열어 주는 브라우저(Playwright · 소프트웨어 WebGL)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css' };
module.exports = async function open(opts = {}) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: opts.w || 844, height: opts.h || 390 }, deviceScaleFactor: opts.dpr || 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const errors = []; p.on('pageerror', e => errors.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || (opts.warn && m.type() === 'warning')) errors.push('CONSOLE ' + m.text().slice(0, 300)); });
  const served = [];
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://game.local/')) { const f = decodeURIComponent(u.slice('http://game.local/'.length).split('?')[0]) || (opts.page || 'index.html'); served.push(f); const fp = path.join(ROOT, f);
      if (!fs.existsSync(fp)) return r.fulfill({ status: 404, body: 'not found' });
      return r.fulfill({ path: fp, contentType: MIME[path.extname(f)] || 'application/octet-stream' }); }
    return r.abort(); });
  const t0 = Date.now();
  await p.goto('http://game.local/' + (opts.page || 'index.html') + (opts.query || ''));
  await p.waitForFunction(() => window.__dbg && document.getElementById('loading').hidden, null, { timeout: 180000 }).catch(e => errors.push('TIMEOUT ' + e.message.slice(0, 80)));
  const loadMs = Date.now() - t0;
  return { b, p, errors, served, loadMs };
};
