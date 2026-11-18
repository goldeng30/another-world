// GLB 여러 개를 같은 각도·조명으로 나란히 그려 비교 (쿼터뷰 비슷한 각도 + 가까이)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const SP = path.join(__dirname, '..');
const NM = path.join(SP, 'viewer/node_modules/three'); const files = process.argv.slice(3), OUT = process.argv[2];
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1500, height: 520 } }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.startsWith('http://p.local/three/')) return r.fulfill({ path: path.join(NM, u.slice(21)), contentType: 'application/javascript' });
    if (u.startsWith('http://p.local/f/')) return r.fulfill({ path: path.resolve(SP, decodeURIComponent(u.slice(17))) });
    if (u === 'http://p.local/') return r.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#222"><script src="/three/build/three.min.js"></script><script src="/three/examples/js/loaders/GLTFLoader.js"></script></body>' });
    return r.abort(); });
  await p.goto('http://p.local/'); await p.waitForFunction(() => window.THREE && THREE.GLTFLoader);
  const res = await p.evaluate(async files => { const T = THREE, W = 1500, H = 520, n = files.length; const rd = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); rd.setSize(W, H); rd.outputEncoding = T.sRGBEncoding; rd.toneMapping = T.ACESFilmicToneMapping; document.body.appendChild(rd.domElement); rd.setScissorTest(true); const info = [];
    const gs = []; for (let i = 0; i < n; i++) { const g = await new Promise((res, rej) => new T.GLTFLoader().load('/f/' + encodeURIComponent(files[i]), res, undefined, rej));
      if (!/tripo_convert/.test(files[i]) && files[i].endsWith('.glb') && !/_lo|_0\./.test(files[i])) { const base = files[i].replace(/\.glb$/, ''); const tl = new T.TextureLoader(); const ld = u => new Promise(r => tl.load('/f/' + encodeURIComponent(u), r, undefined, () => r(null)));
        const [bm, nm] = await Promise.all([ld(base + '_base.webp'), ld(base + '_nrm.webp')]); if (bm) { bm.flipY = false; bm.encoding = T.sRGBEncoding; if (nm) nm.flipY = false;
          g.scene.traverse(o => { if (o.isMesh) o.material = new T.MeshStandardMaterial({ map: bm, normalMap: nm || null, normalMapType: T.ObjectSpaceNormalMap, roughness: 0.85, metalness: 0, side: T.DoubleSide }); }); } }
      gs.push(g); }
    for (let i = 0; i < n; i++) { const g = gs[i]; const sc = new T.Scene(); sc.background = new T.Color('#2a2e35');
      sc.add(new T.HemisphereLight(0xdde6f0, 0x2a2622, 0.9)); const k = new T.DirectionalLight(0xfff1e2, 1.6); k.position.set(-1, 2, 1.5); sc.add(k); sc.add(g.scene);
      const bb = new T.Box3().setFromObject(g.scene), c = bb.getCenter(new T.Vector3()), s = bb.getSize(new T.Vector3()).length(); const cam = new T.PerspectiveCamera(30, (W / n) / H, s / 100, s * 10);
      cam.position.copy(c).add(new T.Vector3(0.75, 0.62, 1.0).normalize().multiplyScalar(s * 1.55)); cam.lookAt(c);
      rd.setViewport(i * W / n, 0, W / n, H); rd.setScissor(i * W / n, 0, W / n, H); rd.render(sc, cam); let tri = 0; g.scene.traverse(o => { if (o.isMesh) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); info.push(Math.round(tri)); }
    return info; }, files);
  await p.screenshot({ path: OUT }); console.log('삼각형', res.join(' / ')); await b.close(); })();
