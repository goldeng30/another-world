// 맵 점검기: 방 하나를 여러 자리에서 그려 보고 눈에 띄는 결함을 찾는다(맵을 고칠 때마다 돌려 보기)
//   node tests/mapcheck.cjs [방 id=cave01] [출력 폴더=tests/out/mapcheck] [--quick]
//   1) 자리: 들어온 자리 · 방 가운데 · 출구 어귀/굴 안 · 경계 안쪽(110)을 둘레 따라 220마다
//   2) 화면: 가로(844×390) · 세로(412×800) 휴대폰으로 자리마다 찍어 모아 보기(sheet_*.jpg, 낱장은 shots/)
//   3) 주인공 가림: 걸을 수 있는 곳을 30 간격으로 훑어 카메라 → 발·몸·머리 사이에 벽(벽·바위 덩어리)·바위가 끼는지(map_*.png)
//   4) 뒤 빈 곳(구멍): 배경 = 자홍, 방 밖 바닥 = 초록으로 그려 빈 곳 덩어리를 찾고, 벽·바위에 둘러싸인 것(구멍 · 화면 가장자리에 걸친 틈)만 알린다(holes/)
//   5) 뜬·묻힌 물체: 소품·바위·돌·잔해 하나하나 꼭짓점과 그 밑 바닥 높이 비교(매단 것은 벽에 붙었는지만)
//   6) report.json + 요약(PASS/WARN). 점검 도구라 늘 0으로 끝난다
const open = require('./harness.cjs'); const fs = require('fs'); const path = require('path');
const argv = process.argv.slice(2), QUICK = argv.includes('--quick'), pos = argv.filter(a => !a.startsWith('--'));
const ROOM = pos[0] || 'cave01', OUT = path.resolve(pos[1] || path.join(__dirname, 'out', 'mapcheck'));
const CFG = {
  quick: QUICK,
  hero: [6, 55, 98],                          // 발 · 몸 · 머리 높이
  walkPad: 42,                                // 주인공은 경계에서 40 안쪽
  edgeIn: 110, edgeEvery: QUICK ? 440 : 220, edgeMax: QUICK ? 8 : 30,   // 둘레 자리: 경계 안쪽 거리 · 간격 · 최대 개수(넘으면 간격을 넓힘)
  exitAt: QUICK ? [20, 150] : [20, 150, 220], // 출구: 입구선에서 굴 안쪽으로(285쯤이면 주인공이 어둠에 다 잠김)
  spotGap: 100,                               // 이보다 가까운 자리는 하나만(출구 굴 안 자리끼리는 50)
  occStep: QUICK ? 45 : 30, occMax: QUICK ? 1200 : 3000,   // 가림 훑기 간격 · 최대 점 수(넘으면 간격을 넓힘)
  voidD: 48,                                  // 방 밖 바닥(floor.js 가 검게 칠하는 경계 거리와 같게)
  holeMin: 12,                                // 이보다 작은 덩어리는 가장자리 계단 무늬로 보고 셈만
  floatTol: 3, buryFrac: 0.8, wallGapTol: 15, // 뜸 허용 · 이만큼 넘게 묻히면 경고 · 매단 것과 벽 사이 허용
};
const ASP = [{ key: 'land', name: '가로', w: 844, h: 390, cols: 4, tw: 422, per: 20 }, { key: 'port', name: '세로', w: 412, h: 800, cols: 8, tw: 206, per: 24 }];   // per: 모아 보기 한 장에 몇 자리
const T0 = Date.now(), sec = () => ((Date.now() - T0) / 1000).toFixed(0) + 's';
const log = (...a) => console.log(`[${sec()}]`, ...a);

// ── 페이지 안에서 도는 것들(window.__mc) ──
function pageLib(CFG) {
  const D = __dbg, G = D.G, T = THREE, MC = window.__mc = {};
  const Wd = () => G.world, sdfUV = (u, v) => Wd().sdf(...Wd().world(u, v));
  const mat0 = o => [].concat(o.material)[0], shown = o => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true; };
  const anc = (o, f) => { for (let a = o; a && a !== Wd().root; a = a.parent) if (f(a)) return true; return false; };
  const texSrc = m => { const im = m && m.map && m.map.image; return im ? String(im.src || im.currentSrc || '') : ''; };
  const texName = m => { const s = texSrc(m); let r = /\/props\/([^/?]+?)_base\./.exec(s); if (r) return r[1]; r = /\/textures\/([^/?]+?)_c\./.exec(s); return r ? r[1] : ''; };
  const merged = o => { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; return Math.abs(o.scale.x - 1) < 1e-6 && Math.abs(o.scale.z - 1) < 1e-6 && (b.max.x - b.min.x > 250 || b.max.z - b.min.z > 250); };   // 여러 개를 세계 좌표로 한 덩어리에 합친 것(돌 무더기 · 잔해): 크기 1 그대로인데 넓게 퍼짐
  // 종류: floor · wall(wdk 속성 또는 이름이 wall/cliff 로 시작 — 조각 벽도) · fx(빛·불꽃·글씨·바닥 그림) · prop · rock · clutter(합친 잔돌·잔해)
  function cat(o) {
    if (o.isSprite || o.isPoints || o.isLine) return 'fx'; if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return null;
    const g = o.geometry, m = mat0(o);
    if (g.attributes.dkv || anc(o, a => /^floor/i.test(a.name || ''))) return 'floor';
    if (g.attributes.wdk || anc(o, a => /^(wall|cliff)/i.test(a.name || ''))) return 'wall';
    if (!m || m.isShaderMaterial || m.isMeshBasicMaterial || (m.transparent && !m.depthWrite) || m.blending === T.AdditiveBlending || /decal/i.test(o.name)) return 'fx';
    if (/\/props\//.test(texSrc(m)) || m.normalMapType === T.ObjectSpaceNormalMap) return 'prop';   // 소품(Tripo): 물체 공간 노멀 — 휴대폰은 큰 질감을 줄여 그려서 주소가 없어질 수 있다
    if (!o.isInstancedMesh && merged(o)) return 'clutter';
    return 'rock'; }
  MC.cat = cat;
  const list = f => { const a = []; Wd().root.updateMatrixWorld(true); Wd().root.traverse(o => { const c = cat(o); if (c && shown(o) && f(c, o)) a.push(o); }); return a; };

  MC.setup = async () => { window.__pause = true; const st = document.getElementById('start'); if (st) st.hidden = true;
    // 들어올 때마다 바뀌는 것(토템·채집물)을 정해진 난수로 다시 뽑는다 → 가로·세로·다음 실행이 같은 방
    //   게임 코드(game.js)가 부를 때만 정해진 난수 — three.js 는 물체를 만들 때마다(uuid) 난수를 써서, 캐시 상태에 따라 개수가 달라진다
    let a = 20240611; const R0 = Math.random, seeded = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    Math.random = () => /game\.js/.test((new Error().stack || '').split('\n')[2] || '') ? seeded() : R0();
    if (D.reroll) await D.reroll();
    if (D.AR) { D.AR.done = true; if (Math.abs(G.rd.getPixelRatio() - D.AR.base) > 1e-3) G.rd.setPixelRatio(D.AR.base); }   // 해상도 자동 조절은 끄고 처음 해상도로(장마다 같은 크기)
    for (const e of G.enemies) G.scene.remove(e.holder); G.enemies.length = 0;   // 적은 치운다(맵만 본다)
    const n = {}; Wd().root.traverse(o => { const c = cat(o); if (c) n[c] = (n[c] || 0) + 1; });
    return { id: Wd().data.id, canvas: [G.rd.domElement.width, G.rd.domElement.height], exits: (Wd().exits || []).length, groundY: !!Wd().groundY, kinds: n }; };
  MC.walk = (u, v) => { const w = Wd(), [x, z] = w.world(u, v); if (w.sdf(x, z) > -CFG.walkPad) return false; const p = new T.Vector3(x, 0, z); w.clamp(p); if (Math.hypot(p.x - x, p.z - z) > 1) return false;
    return !(w.colliders || []).some(c => Math.hypot(x - c.x, z - c.z) < c.r + 16); };   // 부딪힘 원 안(주인공이 못 서는 곳)은 뺀다
  MC.bounds = () => { if (MC._b) return MC._b; let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (let u = -4000; u <= 4000; u += 50) for (let v = -4000; v <= 4000; v += 50) if (sdfUV(u, v) < 0) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    return (MC._b = { u0: u0 - 100, u1: u1 + 100, v0: v0 - 100, v1: v1 + 100 }); };
  // 경계선(f = 0) 닫힌 고리들(walls.js 와 같은 방식)
  function contours(f, u0, u1, v0, v1, st) {
    const nu = Math.ceil((u1 - u0) / st), nv = Math.ceil((v1 - v0) / st), val = new Float32Array((nu + 1) * (nv + 1)), at = (i, j) => val[j * (nu + 1) + i];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) val[j * (nu + 1) + i] = f(u0 + i * st, v0 + j * st);
    const ep = (i0, j0, i1, j1) => { const a = at(i0, j0), b = at(i1, j1), t = a / (a - b); return [u0 + (i0 + (i1 - i0) * t) * st, v0 + (j0 + (j1 - j0) * t) * st]; }, segs = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const P = [];
      for (const e of [[i, j, i + 1, j], [i + 1, j, i + 1, j + 1], [i, j + 1, i + 1, j + 1], [i, j, i, j + 1]]) if ((at(e[0], e[1]) < 0) !== (at(e[2], e[3]) < 0)) P.push(ep(...e));
      if (P.length === 2) segs.push(P); else if (P.length === 4) segs.push([P[0], P[1]], [P[2], P[3]]); }
    const key = p => p[0].toFixed(1) + ',' + p[1].toFixed(1), adj = new Map(); segs.forEach((s, k) => { for (const p of s) { const kk = key(p); if (!adj.has(kk)) adj.set(kk, []); adj.get(kk).push(k); } });
    const used = new Uint8Array(segs.length), loops = [];
    for (let s0 = 0; s0 < segs.length; s0++) { if (used[s0]) continue; used[s0] = 1; const L = [segs[s0][0], segs[s0][1]];
      for (;;) { const last = L[L.length - 1], c = (adj.get(key(last)) || []).find(k => !used[k]); if (c === undefined) break; used[c] = 1; const s = segs[c]; L.push(key(s[0]) === key(last) ? s[1] : s[0]); }
      if (L.length > 6) loops.push(L); }
    return loops; }
  MC.contours = contours;
  const loopLen = L => L.reduce((s, p, i) => s + Math.hypot(L[(i + 1) % L.length][0] - p[0], L[(i + 1) % L.length][1] - p[1]), 0);
  function along(L, step) {   // 아래(가장 작은 v)에서 시작해 시계 반대 방향으로 step 마다
    let a2 = 0; L.forEach((p, i) => { const q = L[(i + 1) % L.length]; a2 += p[0] * q[1] - q[0] * p[1]; }); if (a2 < 0) L = L.slice().reverse();
    let s = 0; L.forEach((p, i) => { if (p[1] < L[s][1]) s = i; }); L = L.slice(s).concat(L.slice(0, s));
    const out = [], len = loopLen(L); if (len < step) return [L[0]]; let acc = 0;
    for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); while (acc <= d) { const t = d ? acc / d : 0; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); acc += step; } acc -= d; }
    return out; }
  // 1) 자리 고르기
  MC.spots = () => { const w = Wd(), d = w.data, S = [], b = MC.bounds();
    const add = (u, v, kind, label) => { const [x, z] = w.world(u, v), p = new T.Vector3(x, 0, z); w.clamp(p); const [cu, cv] = w.uv(p.x, p.z); if (sdfUV(cu, cv) > -CFG.walkPad + 4) return;
      if (S.some(s => Math.hypot(s.u - cu, s.v - cv) < (kind === 'exit' && s.kind === 'exit' ? 50 : CFG.spotGap))) return; S.push({ i: S.length, kind, label, u: Math.round(cu), v: Math.round(cv) }); };
    if (d.spawn) add(d.spawn[0], d.spawn[1], 'spawn', 'spawn');
    { let su = 0, sv = 0; const P = []; for (let u = Math.ceil(b.u0 / 40) * 40; u <= b.u1; u += 40) for (let v = Math.ceil(b.v0 / 40) * 40; v <= b.v1; v += 40) if (MC.walk(u, v)) { su += u; sv += v; P.push([u, v]); }
      if (P.length) { const cu = su / P.length, cv = sv / P.length; let bp = P[0]; for (const p of P) if (Math.hypot(p[0] - cu, p[1] - cv) < Math.hypot(bp[0] - cu, bp[1] - cv)) bp = p; add(bp[0], bp[1], 'centre', 'centre'); } }
    (w.exits || []).forEach((e, k) => { for (const t of CFG.exitAt) add(e.m[0] + e.d[0] * t, e.m[1] + e.d[1] * t, 'exit', `exit${k} ${t === CFG.exitAt[0] ? 'mouth' : '+' + t}`); });
    const loops = contours((u, v) => sdfUV(u, v) + CFG.edgeIn, b.u0 - 40, b.u1 + 40, b.v0 - 40, b.v1 + 40, 20), tot = loops.reduce((s, L) => s + loopLen(L), 0), every = Math.max(CFG.edgeEvery, tot / CFG.edgeMax);
    let k = 0; for (const L of loops.sort((a, c) => loopLen(c) - loopLen(a))) for (const [u, v] of along(L, every)) add(u, v, 'edge', 'edge' + String(++k).padStart(2, '0'));
    return { spots: S, every: Math.round(every), outline: Math.round(tot), bounds: b }; };
  // 주인공을 (u, v)에 두고 카메라·그림자·안개를 맞춘 뒤 한 장 그린다
  MC.place = (u, v) => { const w = Wd(), [x, z] = w.world(u, v); D.root.position.set(x, 0, z); if (D.ctl) D.ctl.v = 0;
    for (let k = 0; k < 6; k++) D.step(1 / 30); D.camera.follow(0, true); G.cam.updateMatrixWorld(true); D.step(0); D.camera.follow(0, true); G.cam.updateMatrixWorld(true); G.fogFit(); D.hud.update(0); D.draw();
    const p = D.root.position, [pu, pv] = w.uv(p.x, p.z); return { u: Math.round(pu), v: Math.round(pv), y: +p.y.toFixed(1) }; };

  // 4) 뒤 빈 곳: 배경 = 자홍, 방 밖 바닥(경계 거리 ≥ voidD) = 초록으로 그린 뒤 픽셀을 읽어 덩어리로 나눈다
  const KEYM = {}; let MASK_MAT = null;
  function floorKey(f, mask) { const g = f.geometry; let at = 'dkv';   // mask: 틀 검사용(방 안 바닥 = 흰색, 방 밖 = 자홍)
    if (!g.attributes.dkv) { at = 'mcd'; if (!g.attributes.mcd) { const P = g.attributes.position, a = new Float32Array(P.count), v = new T.Vector3(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(f.matrixWorld); a[i] = Wd().sdf(v.x, v.z); } g.setAttribute('mcd', new T.BufferAttribute(a, 1)); } }   // dkv 가 없는 바닥: 꼭짓점마다 경계 거리
    const kk = at + (mask ? '+m' : ''); return KEYM[kk] || (KEYM[kk] = new T.ShaderMaterial({ vertexShader: `attribute ${at === 'dkv' ? 'vec2' : 'float'} ${at}; varying float vD; void main() { vD = ${at === 'dkv' ? 'dkv.x' : at}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vD; void main() { gl_FragColor = vD >= ${CFG.voidD.toFixed(1)} ? ${mask ? 'vec4(1.0, 0.0, 1.0, 1.0)' : 'vec4(0.0, 1.0, 0.0, 1.0)'} : ${mask ? 'vec4(1.0)' : 'vec4(0.16, 0.13, 0.11, 1.0)'}; }` })); }
  const readPx = () => { const rd = G.rd, gl = rd.getContext(), w = rd.domElement.width, h = rd.domElement.height, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return { px, w, h }; };
  const GAP = ['hole', 'notch', 'side'];   // 경고할 덩어리
  function regions(px, W, H) {   // key: 1 자홍(배경) · 2 초록(방 밖 바닥). 4방향 이웃으로 덩어리
    const N = W * H, key = new Uint8Array(N), lab = new Int32Array(N).fill(-1), stack = new Int32Array(N), list = [];
    for (let y = 0; y < H; y++) { const row = (H - 1 - y) * W * 4; for (let x = 0; x < W; x++) { const o = row + x * 4, r = px[o], g = px[o + 1], b = px[o + 2]; key[y * W + x] = r > 170 && b > 170 && g < 90 ? 1 : g > 170 && r < 90 && b < 90 ? 2 : 0; } }
    for (let s = 0; s < N; s++) { if (!key[s] || lab[s] >= 0) continue; const R = { id: list.length, area: 0, mag: 0, grn: 0, x0: W, x1: -1, y0: H, y1: -1, sx: 0, sy: 0, T: 0, B: 0, L: 0, Rr: 0 }; let sp = 0; stack[sp++] = s; lab[s] = R.id;
      while (sp) { const q = stack[--sp], x = q % W, y = (q - x) / W; R.area++; if (key[q] === 1) R.mag++; else R.grn++; R.sx += x; R.sy += y;
        if (x < R.x0) R.x0 = x; if (x > R.x1) R.x1 = x; if (y < R.y0) R.y0 = y; if (y > R.y1) R.y1 = y; if (!y) R.T = 1; if (y === H - 1) R.B = 1; if (!x) R.L = 1; if (x === W - 1) R.Rr = 1;
        if (x > 0 && key[q - 1] && lab[q - 1] < 0) { lab[q - 1] = R.id; stack[sp++] = q - 1; } if (x < W - 1 && key[q + 1] && lab[q + 1] < 0) { lab[q + 1] = R.id; stack[sp++] = q + 1; }
        if (y > 0 && key[q - W] && lab[q - W] < 0) { lab[q - W] = R.id; stack[sp++] = q - W; } if (y < H - 1 && key[q + W] && lab[q + W] < 0) { lab[q + W] = R.id; stack[sp++] = q + W; } }
      // 가장자리에 안 닿음 = 구멍(hole) · 위에 닿고 옆·아래에도 닿거나 화면 반 넘게 넓음 = 먼 쪽 빈 곳(far, 괜찮음) · 위에만 좁게 닿음 = 위 틈(notch: 높은 벽에 난 구멍이 화면 위로 잘린 것)
      //   아래(또는 아래 절반의 옆)에 닿음 = 카메라 쪽 경계 어둠(camera, 일부러) · 위 절반의 옆에만 닿음 = 옆 틈(side)
      R.cls = !R.T && !R.B && !R.L && !R.Rr ? 'hole' : R.T ? (R.L || R.Rr || R.B || R.x1 - R.x0 >= W * 0.5 ? 'far' : 'notch') : R.B || R.y1 >= H * 0.5 ? 'camera' : 'side';
      if (GAP.includes(R.cls) && R.area < CFG.holeMin) R.cls = 'speck';
      list.push(R); }
    return { list, lab, key }; }
  function markImage(px, R, W, H) {   // 보통 화면 위에 구멍(자홍 칠 · 빨간 테두리) · 가장자리 틈(주황)을 표시
    const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d'), id = cx.createImageData(W, H);
    for (let y = 0; y < H; y++) id.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    const bad = new Map(R.list.filter(r => GAP.includes(r.cls)).map(r => [r.id, r]));
    for (let q = 0; q < W * H; q++) { const r = bad.get(R.lab[q]); if (r) { const o = q * 4; id.data[o] = 255; id.data[o + 1] = r.cls === 'hole' ? 0 : 150; id.data[o + 2] = r.cls === 'hole' ? 255 : 0; } }
    cx.putImageData(id, 0, 0); cx.lineWidth = 2; cx.font = 'bold 12px sans-serif';
    for (const r of bad.values()) { const p = 7; cx.strokeStyle = r.cls === 'hole' ? '#ff2a2a' : '#ffa000'; cx.strokeRect(r.x0 - p, r.y0 - p, r.x1 - r.x0 + 2 * p, r.y1 - r.y0 + 2 * p);
      const t = `${r.cls} ${r.area}px${r.at ? ` (${r.at[0]},${r.at[1]})` : ''}`; cx.fillStyle = 'rgba(0,0,0,.7)'; const ty = r.y0 - p - 4 < 12 ? r.y1 + p + 14 : r.y0 - p - 4; cx.fillRect(r.x0 - p, ty - 11, cx.measureText(t).width + 6, 14); cx.fillStyle = '#fff'; cx.fillText(t, r.x0 - p + 3, ty); }
    return c.toDataURL('image/jpeg', 0.88); }
  MC.keyed = () => { const sc = G.scene, bg = sc.background, floors = list(c => c === 'floor'), saved = floors.map(f => f.material);
    sc.background = new T.Color(1, 0, 1); floors.forEach(f => { f.material = floorKey(f); });
    let K; try { G.rd.render(sc, G.cam); K = readPx(); } finally { floors.forEach((f, k) => { f.material = saved[k]; }); sc.background = bg; }
    const R = regions(K.px, K.w, K.h); let bad = R.list.filter(r => GAP.includes(r.cls)), open = 0; const RC = new T.Raycaster();
    if (bad.length) {   // 틀 검사: 벽·바위·방 안 바닥만 흰색으로 다시 그려(소품·주인공·효과는 숨김) 틈이 이어지는 빈 곳이 벽에 둘러싸였는지 본다
      //   이어진 빈 곳이 아래 가장자리에 닿거나 · 위와 옆 가장자리에 함께 닿거나 · 화면 반 넘게 넓으면 소품 사이로 보이는 열린 빈 곳(벽 없는 방 등) → 괜찮음
      const keep = new Set(list(c => c === 'wall' || c === 'rock')), hid = [], mats = new Map(); let M;
      if (!MASK_MAT) MASK_MAT = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, fog: false });
      sc.traverse(o => { if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine) || !o.visible) return; if (keep.has(o)) { mats.set(o, o.material); o.material = MASK_MAT; } else if (floors.includes(o)) { mats.set(o, o.material); o.material = floorKey(o, true); } else { o.visible = false; hid.push(o); } });
      sc.background = new T.Color(1, 0, 1);
      try { G.rd.render(sc, G.cam); M = readPx(); } finally { hid.forEach(o => { o.visible = true; }); mats.forEach((m, o) => { o.material = m; }); sc.background = bg; }
      const N = K.w * K.h, k2 = new Uint8Array(N), l2 = new Int32Array(N).fill(-1), st2 = new Int32Array(N), C2 = [];
      for (let y = 0; y < K.h; y++) for (let x = 0; x < K.w; x++) { const o = ((K.h - 1 - y) * K.w + x) * 4; k2[y * K.w + x] = M.px[o] > 170 && M.px[o + 2] > 170 && M.px[o + 1] < 90 ? 1 : 0; }
      const comp = s0 => { if (l2[s0] >= 0) return C2[l2[s0]]; const c = { T: 0, B: 0, L: 0, Rr: 0, x0: K.w, x1: -1 }, id = C2.length; C2.push(c); let sp = 0; st2[sp++] = s0; l2[s0] = id;
        while (sp) { const q = st2[--sp], x = q % K.w, y = (q - x) / K.w; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (!y) c.T = 1; if (y === K.h - 1) c.B = 1; if (!x) c.L = 1; if (x === K.w - 1) c.Rr = 1;
          for (const nq of [x > 0 ? q - 1 : -1, x < K.w - 1 ? q + 1 : -1, y > 0 ? q - K.w : -1, y < K.h - 1 ? q + K.w : -1]) if (nq >= 0 && k2[nq] && l2[nq] < 0) { l2[nq] = id; st2[sp++] = nq; } }
        return c; };
      for (const r of bad) { let opened = false;
        for (let q = r.y0 * K.w; q < (r.y1 + 1) * K.w && !opened; q++) { if (R.lab[q] !== r.id || !k2[q]) continue; const c = comp(q); if (c.B || (c.T && (c.L || c.Rr)) || c.x1 - c.x0 >= K.w * 0.5) opened = true; }
        if (opened) { r.cls = 'open'; open++; } }
      bad = bad.filter(r => r.cls !== 'open'); }
    for (const r of bad) { const cx = Math.round(r.sx / r.area), cy = Math.round(r.sy / r.area); let q = cy * K.w + cx;   // 덩어리 안 한 점으로 그 너머 바닥 자리(u, v)
      if (R.lab[q] !== r.id) for (let x = r.x0; x <= r.x1 && R.lab[q] !== r.id; x++) q = cy * K.w + x;
      const x = q % K.w, y = (q - x) / K.w; RC.setFromCamera(new T.Vector2((x + 0.5) / K.w * 2 - 1, 1 - (y + 0.5) / K.h * 2), G.cam); const h = RC.intersectObjects(floors, false)[0];
      if (h) { const [u, v] = Wd().uv(h.point.x, h.point.z); r.at = [Math.round(u), Math.round(v)]; } }
    let img = null; if (bad.length) { G.rd.render(sc, G.cam); const P = readPx(); img = markImage(P.px, R, P.w, P.h); }
    const sum = c => R.list.filter(r => r.cls === c).reduce((s, r) => s + r.area, 0);
    return { w: K.w, h: K.h, holes: bad.map(r => ({ cls: r.cls, area: r.area, bg: r.mag, floor: r.grn, box: [r.x0, r.y0, r.x1, r.y1], at: r.at || null })).sort((a, b) => b.area - a.area),
      specks: R.list.filter(r => r.cls === 'speck').length, open, farPx: sum('far'), cameraPx: sum('camera'), img }; };

  // 3) 주인공 가림: 카메라 → 발·몸·머리. 벽(wall)·바위(rock)·소품(prop) 따로 센다
  MC.occlusion = () => { const w = Wd(), b = MC.bounds(), RC = new T.Raycaster(), grp = { wall: list(c => c === 'wall'), rock: list(c => c === 'rock'), prop: list(c => c === 'prop') };
    let st = CFG.occStep; const cnt = s => { let n = 0; for (let u = Math.ceil(b.u0 / s) * s; u <= b.u1; u += s) for (let v = Math.ceil(b.v0 / s) * s; v <= b.v1; v += s) if (sdfUV(u, v) <= -CFG.walkPad) n++; return n; };
    while (cnt(st) > CFG.occMax) st += 5;
    const pts = [], to = new T.Vector3(), dir = new T.Vector3();
    const test = (u, v, ring) => { const [x, z] = w.world(u, v); D.root.position.set(x, 0, z); D.step(0); D.camera.follow(0, true); G.cam.updateMatrixWorld(true); const hp = D.root.position, o = G.cam.position;
      const r = { u: Math.round(u), v: Math.round(v) }; if (ring) r.ring = 1;
      for (const [g, objs] of Object.entries(grp)) r[g] = CFG.hero.map(y => { if (!objs.length) return 0; to.set(hp.x, hp.y + y, hp.z); dir.copy(to).sub(o); const len = dir.length(); RC.set(o, dir.normalize()); RC.near = 0; RC.far = len - 3; return RC.intersectObjects(objs, false).length ? 1 : 0; });
      pts.push(r); };
    for (let u = Math.ceil(b.u0 / st) * st; u <= b.u1; u += st) for (let v = Math.ceil(b.v0 / st) * st; v <= b.v1; v += st) if (MC.walk(u, v)) test(u, v);
    // 벽에 바짝 붙은 길(가림이 잘 생기는 곳): 걸을 수 있는 경계 바로 안쪽 고리를 20마다 — 격자 사이로 빠지는 좁은 띠도 잡게
    const ring = CFG.quick ? [5] : [5, 30], every = CFG.quick ? 40 : 20; let nr = 0;
    for (const off of ring) for (const L of contours((u, v) => sdfUV(u, v) + CFG.walkPad + off, b.u0, b.u1, b.v0, b.v1, 12)) for (const [u, v] of along(L, every)) if (MC.walk(u, v)) { test(u, v, true); nr++; }
    return { step: st, n: pts.length, grid: pts.length - nr, ring: nr, occluders: { wall: grp.wall.length, rock: grp.rock.length, prop: grp.prop.length }, pts }; };

  // 5) 뜬·묻힌 물체
  function comps(g) {   // 합친 덩어리를 이어진 조각(돌 하나 · 판자 하나 · 잎 하나)으로
    const P = g.attributes.position, n = P.count, par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
    const f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, un = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
    if (g.index) { const I = g.index.array; for (let k = 0; k + 2 < I.length; k += 3) { un(I[k], I[k + 1]); un(I[k + 1], I[k + 2]); } } else for (let k = 0; k + 2 < n; k += 3) { un(k, k + 1); un(k + 1, k + 2); }
    const seen = new Map(); for (let i = 0; i < n; i++) { const kk = Math.round(P.getX(i) * 100) + ',' + Math.round(P.getY(i) * 100) + ',' + Math.round(P.getZ(i) * 100), j = seen.get(kk); if (j === undefined) seen.set(kk, i); else un(i, j); }
    const id = new Int32Array(n), map = new Map(), L = []; for (let i = 0; i < n; i++) { const r = f(i); let c = map.get(r); if (c === undefined) { c = L.length; map.set(r, c); L.push([]); } id[i] = c; L[c].push(i); }
    return { id, list: L }; }
  MC.objects = () => { const w = Wd(), d = w.data, place = d.place || [], RC = new T.Raycaster();
    const gcache = new Map(), floors = list(c => c === 'floor'), gy = w.groundY ? (x, z) => w.groundY(x, z) : (x, z) => {   // 바닥 높이 함수가 없으면 바닥에 광선
      const k = Math.round(x / 6) + ',' + Math.round(z / 6); if (gcache.has(k)) return gcache.get(k); RC.set(new T.Vector3(x, 3000, z), new T.Vector3(0, -1, 0)); RC.far = 6000; const h = RC.intersectObjects(floors, false)[0], y = h ? h.point.y : 0; gcache.set(k, y); return y; };
    const ents = place.map((p, i) => { if (!p.at) return null; const kind = p.prop ? 'prop' : p.rock ? 'rock' : p.ore ? 'ore' : p.totemSlot !== undefined ? 'totem' : p.wallProp ? 'wallProp' : null; if (!kind) return null; const [x, z] = w.world(p.at[0], p.at[1]); return { i, kind, name: p.prop || p.rock || p.ore || p.wallProp || 'slot' + p.totemSlot, x, z }; }).filter(Boolean);
    const near = (x, z) => { let best = null, bd = 4; for (const e of ents) { const dd = Math.hypot(e.x - x, e.z - z); if (dd < bd) { bd = dd; best = e; } } return best; };
    const wallNames = new Set(place.filter(p => p.wallProp).map(p => p.wallProp)); if (place.some(p => p.wallTorches)) wallNames.add('torchw');
    const pools = new Set([...(((d.gather || {}).spawn || {}).orePool || []), ...(((d.gather || {}).spawn || {}).herbPool || [])]);
    const solid = list(c => c === 'prop' || c === 'rock' || c === 'clutter'), walls = list(c => c === 'wall'), units = [], CC = new Map();
    for (const o of solid) { const c = cat(o), m = mat0(o), tn = texName(m); if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (o.isInstancedMesh) { for (let k = 0; k < o.count; k++) { const M = new T.Matrix4(); o.getMatrixAt(k, M); M.premultiply(o.matrixWorld); units.push({ o, c, inst: k, M, name: `rock(instanced ${k})` }); } continue; }
      if (c === 'clutter') { const C = comps(o.geometry); CC.set(o, C); C.list.forEach((vids, k) => units.push({ o, c, comp: k, vids, M: o.matrixWorld, name: `${o.name || 'merged'}#${k}` })); continue; }
      const e = near(o.position.x, o.position.z), gb = o.geometry.boundingBox, hgt = gb.max.y - gb.min.y;
      const hang = gb.max.y <= 0.05 * hgt ? 'origin-top' : o.matrixWorld.elements[5] < 0 ? 'upside-down' : c === 'prop' && wallNames.has(tn) ? 'wall-prop' : '';   // 매단 것: 원점이 윗면인 에셋 · 거꾸로 · 벽 소품
      const auto = () => d.rocks && d.rocks.stalagmites && w.sdf(o.position.x, o.position.z) > -150 ? 'stalagmite(auto)' : pools.size ? 'gather(random)' : 'prop(auto)';   // 질감 이름도 없을 때(휴대폰은 큰 질감을 줄여서 주소가 없다)
      const name = e ? `${e.kind}:${e.name}${e.kind === 'totem' && tn ? '=' + tn : ''}` : c === 'prop' ? (!tn ? auto() : wallNames.has(tn) ? `wallProp:${tn}` : pools.has(tn) ? `gather:${tn}` : /^stal/.test(tn) ? `stalagmite:${tn}` : `prop:${tn}`)
        : hang === 'origin-top' ? 'stalactite' : hang === 'upside-down' ? 'ceiling rock' : d.rim && d.surfaces && tn === d.surfaces.wall ? 'rim rock' : `rock(${tn || '?'})`;
      units.push({ o, c, M: o.matrixWorld, name, entry: e ? e.i : null, hang }); }
    const v3 = new T.Vector3(), out = [];
    for (const U of units) { const P = U.o.geometry.attributes.position, idx = U.vids, n = idx ? idx.length : P.count, stride = Math.max(1, Math.floor(n / 5000));
      let minGap = 1e9, below = 0, cnt = 0, y0 = 1e9, y1 = -1e9, sx = 0, sz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let k = 0; k < n; k += stride) { const i = idx ? idx[k] : k; v3.fromBufferAttribute(P, i).applyMatrix4(U.M); const gap = v3.y - gy(v3.x, v3.z); cnt++; sx += v3.x; sz += v3.z;
        if (gap < minGap) minGap = gap; if (gap < -0.5) below++; y0 = Math.min(y0, v3.y); y1 = Math.max(y1, v3.y); x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x); z0 = Math.min(z0, v3.z); z1 = Math.max(z1, v3.z); }
      const [u, v] = w.uv(sx / cnt, sz / cnt);
      out.push({ U, name: U.name, kind: U.c, entry: U.entry ?? null, uv: [Math.round(u), Math.round(v)], size: Math.round(Math.max(x1 - x0, z1 - z0, y1 - y0) * 10) / 10, minGap: Math.round(minGap * 10) / 10, buried: Math.round(below / cnt * 100) / 100, hang: U.hang || '' }); }
    const sides = new Map(), all = [...solid, ...walls], hold = [...walls, ...list(c => c === 'rock')]; for (const o of all) { const m = mat0(o); if (!sides.has(m)) { sides.set(m, m.side); m.side = T.DoubleSide; } }   // 광선이 뒷면도 맞게(잠깐)
    const self = (U, h) => h.object === U.o && (U.o.isInstancedMesh ? h.instanceId === U.inst : U.vids ? CC.get(U.o).id[h.face.a] === U.comp : true);
    const owner = h => out.find(q => q.U.o === h.object && (h.object.isInstancedMesh ? q.U.inst === h.instanceId : q.U.vids ? CC.get(h.object).id[h.face.a] === q.U.comp : true));
    try { for (const r of out) { if (r.hang || r.minGap <= CFG.floatTol) continue;   // 떠 보이는 것: 가장 낮은 꼭짓점들 밑으로 광선 — 다른 물체 위에 얹혀 있으면(3 안) 받쳐진 것
        const U = r.U, P = U.o.geometry.attributes.position, idx = U.vids, n = idx ? idx.length : P.count, low = [];
        for (let k = 0; k < n; k++) { const i = idx ? idx[k] : k; v3.fromBufferAttribute(P, i).applyMatrix4(U.M); const gap = v3.y - gy(v3.x, v3.z); if (gap <= r.minGap + 1.5) low.push([v3.x, v3.y, v3.z, gap]); }
        low.sort((a, b) => a[3] - b[3]); const step = Math.max(1, Math.floor(low.length / 12));
        for (let k = 0; k < low.length && !r.on; k += step) { const [x, y, z] = low[k]; RC.set(new T.Vector3(x, y + 0.05, z), new T.Vector3(0, -1, 0)); RC.near = 0; RC.far = CFG.floatTol + 0.05;
          const h = RC.intersectObjects(all, false).find(h => !self(U, h)); if (h) { const o = owner(h); r.on = o ? o.name : cat(h.object) || 'other'; } } }
      // 벽에 붙었는지: 꼭짓점 160개쯤에서 옆 8방향 광선, 가장 가까운 벽(바위)까지 — 매단 것 · 받침 없이 뜬 것
      for (const r of out) { if (!r.hang && (r.minGap <= CFG.floatTol || r.on)) continue; const U = r.U, P = U.o.geometry.attributes.position, idx = U.vids, n = idx ? idx.length : P.count, step = Math.max(1, Math.floor(n / 160)); let best = 1e9;
        for (let k = 0; k < n; k += step) { v3.fromBufferAttribute(P, idx ? idx[k] : k).applyMatrix4(U.M); for (let a = 0; a < 8; a++) { RC.set(v3, new T.Vector3(Math.cos(a * Math.PI / 4), 0, Math.sin(a * Math.PI / 4))); RC.near = 0; RC.far = 80;
          const h = RC.intersectObjects(hold, false).find(h => !self(U, h)); if (h && h.distance < best) best = h.distance; } }
        r.wallGap = best > 1e8 ? null : Math.round(best * 10) / 10;
        if (!r.hang && r.minGap > 20 && r.wallGap != null && r.wallGap <= CFG.wallGapTol) r.hang = 'on-wall'; }   // 바닥에서 한참 위인데 벽에 붙어 있으면 벽에 건 것
    } finally { for (const [m, s] of sides) m.side = s; }
    return out.map(({ U, ...r }) => r); };

  // 위에서 본 지도: 걸을 수 있는 점(가림 결과 색) · 방 경계 · 자리 번호 · 뜬 물체
  MC.map = (occ, spots, objs, title) => { const b = MC.bounds(), S = Math.min(1100 / (b.u1 - b.u0), 900 / (b.v1 - b.v0)), W = Math.ceil((b.u1 - b.u0) * S) + 20, H = Math.ceil((b.v1 - b.v0) * S) + 60;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), X = u => 10 + (u - b.u0) * S, Y = v => 50 + (b.v1 - v) * S;
    g.fillStyle = '#121418'; g.fillRect(0, 0, W, H); const cs = Math.max(2, occ.step * S * 0.9);
    for (const p of occ.pts.slice().sort((a, c) => (a.ring || 0) - (c.ring || 0))) { const wr = Math.max(p.wall[1], p.wall[2], p.rock[1], p.rock[2]), ft = p.wall[0] || p.rock[0], pr = Math.max(...p.prop), z = p.ring ? Math.max(3, cs * 0.45) : cs;   // 고리 점은 작게
      g.fillStyle = wr ? '#e53935' : ft ? '#d4b020' : pr ? '#7a5cc8' : p.ring ? '#4f8a5a' : '#2f5d3a'; g.fillRect(X(p.u) - z / 2, Y(p.v) - z / 2, z, z); }
    g.strokeStyle = '#cfd8dc'; g.lineWidth = 1.5; for (const L of contours((u, v) => sdfUV(u, v), b.u0, b.u1, b.v0, b.v1, 15)) { g.beginPath(); L.forEach(([u, v], i) => i ? g.lineTo(X(u), Y(v)) : g.moveTo(X(u), Y(v))); g.closePath(); g.stroke(); }
    for (const r of objs) { if (!(r.minGap > CFG.floatTol && !r.on && !r.hang) && !(r.buried > CFG.buryFrac)) continue; g.strokeStyle = r.minGap > CFG.floatTol ? '#ff40ff' : '#c08040'; g.lineWidth = 2; const x = X(r.uv[0]), y = Y(r.uv[1]); g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke(); }
    g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s of spots) { g.fillStyle = s.kind === 'spawn' ? '#4fc3f7' : s.kind === 'exit' ? '#ffb74d' : '#eceff1'; g.beginPath(); g.arc(X(s.u), Y(s.v), 8, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillText(String(s.i), X(s.u), Y(s.v)); }
    g.textAlign = 'left'; g.font = '13px sans-serif'; g.fillStyle = '#fff'; g.fillText(title, 10, 14);
    let lx = 10; for (const [col, t] of [['#2f5d3a', '보임'], ['#d4b020', '발만 가림(벽·바위)'], ['#e53935', '몸·머리 가림(벽·바위)'], ['#7a5cc8', '소품만 가림'], ['#ff40ff', '× 뜬 물체'], ['#c08040', '× 많이 묻힘']]) { g.fillStyle = col; g.fillRect(lx, 28, 12, 12); g.fillStyle = '#ddd'; g.fillText(t, lx + 16, 35); lx += g.measureText(t).width + 34; }
    return c.toDataURL('image/png'); };
}

// ── 노드 쪽 ──
const b64 = u => Buffer.from(u.split(',')[1], 'base64');
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
async function sheet(browser, A, items, title, file) {   // 모아 보기: 썸네일 + 자리 이름·(u,v) · 구멍 있으면 빨간 테두리
  const th = Math.round(A.tw * A.h / A.w), cols = Math.min(A.cols, items.length);
  const html = `<html><body style="margin:0;background:#16181c;font:12px/1.3 sans-serif;color:#e8e8e8"><div style="padding:6px 8px;font-size:14px">${esc(title)}</div>
    <div style="display:grid;grid-template-columns:repeat(${cols},${A.tw}px);gap:6px;padding:0 6px 6px">${items.map(it => `<div style="outline:${it.bad ? '3px solid #ff3030' : '1px solid #333'}">
    <img src="data:image/jpeg;base64,${fs.readFileSync(it.file).toString('base64')}" style="width:${A.tw}px;height:${th}px;display:block">
    <div style="padding:2px 4px;background:#000;white-space:nowrap;overflow:hidden"><b>#${it.i}</b> ${esc(it.label)} <span style="color:#9cf">(${it.u},${it.v})</span>${it.bad ? ` <b style="color:#ff5050">${esc(it.bad)}</b>` : ''}</div></div>`).join('')}</div></body></html>`;
  const pg = await browser.newPage({ viewport: { width: cols * (A.tw + 6) + 6, height: 200 } });
  try { await pg.setContent(html, { timeout: 120000 }); await pg.screenshot({ path: file, type: 'jpeg', quality: 82, fullPage: true, timeout: 120000 }); } finally { await pg.close(); } }
function clusters(pts, step) {   // 가린 점들을 가까운 것끼리(격자 대각선 거리 안) 묶기
  const seen = new Set(), out = [], R = step * 1.5;
  for (const p of pts) { if (seen.has(p)) continue; const C = [], q = [p]; seen.add(p);
    while (q.length) { const a = q.pop(); C.push(a); for (const b of pts) if (!seen.has(b) && Math.hypot(a.u - b.u, a.v - b.v) <= R) { seen.add(b); q.push(b); } }
    const by = new Set(); let feet = 0, body = 0, head = 0; for (const c of C) { for (const g of ['wall', 'rock']) if (c[g][1] || c[g][2]) by.add(g); if (c.wall[0] || c.rock[0]) feet++; if (c.wall[1] || c.rock[1]) body++; if (c.wall[2] || c.rock[2]) head++; }
    out.push({ n: C.length, u: [Math.min(...C.map(c => c.u)), Math.max(...C.map(c => c.u))], v: [Math.min(...C.map(c => c.v)), Math.max(...C.map(c => c.v))], by: [...by], feet, body, head }); }
  return out.sort((a, b) => b.n - a.n); }
const occSummary = o => { const has = (p, g, k) => p[g][k], wr = p => has(p, 'wall', 1) || has(p, 'wall', 2) || has(p, 'rock', 1) || has(p, 'rock', 2);
  const bad = o.pts.filter(wr), feet = o.pts.filter(p => !wr(p) && (has(p, 'wall', 0) || has(p, 'rock', 0))), prop = o.pts.filter(p => !wr(p) && p.prop.some(Boolean));
  return { step: o.step, points: o.n, grid: o.grid, ring: o.ring, occluders: o.occluders, hidden: { wall: { feet: o.pts.filter(p => p.wall[0]).length, body: o.pts.filter(p => p.wall[1]).length, head: o.pts.filter(p => p.wall[2]).length }, rock: { feet: o.pts.filter(p => p.rock[0]).length, body: o.pts.filter(p => p.rock[1]).length, head: o.pts.filter(p => p.rock[2]).length }, prop: { feet: o.pts.filter(p => p.prop[0]).length, body: o.pts.filter(p => p.prop[1]).length, head: o.pts.filter(p => p.prop[2]).length } },
    bodyHead: bad.map(p => ({ u: p.u, v: p.v, wall: p.wall, rock: p.rock })), clusters: clusters(bad, o.step), feetOnly: clusters(feet, o.step).map(c => ({ n: c.n, u: c.u, v: c.v })), propOnly: prop.length }; };
const fmtR = a => a[0] === a[1] ? `${a[0]}` : `${a[0]}..${a[1]}`;

async function main() {
  for (const f of ['report.json', 'map_land.png', 'map_port.png']) fs.rmSync(path.join(OUT, f), { force: true });
  for (const d of ['shots', 'holes']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (/^sheet_.*\.jpg$/.test(f)) fs.rmSync(path.join(OUT, f));
  for (const d of ['shots/land', 'shots/port', 'holes']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const rel = f => path.relative(process.cwd(), f) || f, report = { room: ROOM, quick: QUICK, date: new Date().toISOString(), cfg: CFG, errors: [] };
  const game = path.join(__dirname, '..', 'dist', 'game.js'); if (fs.existsSync(game)) report.build = { file: 'dist/game.js', mtime: fs.statSync(game).mtime.toISOString() };
  log(`방 ${ROOM}${QUICK ? ' (--quick)' : ''} → ${rel(OUT)}`);
  const S = await Promise.all(ASP.map(A => open({ w: A.w, h: A.h, mobile: true, query: '?room=' + encodeURIComponent(ROOM) })));
  try {
    const info = [];
    for (const s of S) { s.p.setDefaultTimeout(600000); await s.p.evaluate(pageLib, CFG); info.push(await s.p.evaluate(() => __mc.setup())); }
    if (info[0].id !== ROOM) { console.log(`FAIL 방 '${ROOM}' 을 열지 못함(열린 방: ${info[0].id}) — src/data/rooms/index.js 의 id 확인`); report.errors.push('room not found'); fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); return; }
    log(`불러옴 ${S.map(s => (s.loadMs / 1000).toFixed(1) + 's').join(' / ')} · 화면 ${info.map(i => i.canvas.join('×')).join(' / ')} · 종류 ${JSON.stringify(info[0].kinds)}`);
    report.notes = []; if (!info[0].groundY) report.notes.push('G.world.groundY 없음 → 바닥 높이는 바닥에 광선으로 잼');
    const SP = await S[0].p.evaluate(() => __mc.spots()); const spots = SP.spots; report.spots = spots; report.spotPick = { outline: SP.outline, every: SP.every, bounds: SP.bounds };
    log(`자리 ${spots.length}곳 (둘레 ${SP.outline} · ${SP.every}마다)`);
    // 2) · 4) 자리마다: 보통 화면 찍기 → 키 색 화면으로 구멍 찾기(두 화면비를 동시에)
    const per = await Promise.all(ASP.map(async (A, k) => { const { p } = S[k], res = [];
      for (const s of spots) { const at = await p.evaluate(([u, v]) => __mc.place(u, v), [s.u, s.v]); const shot = path.join(OUT, 'shots', A.key, `${String(s.i).padStart(2, '0')}_${s.u}_${s.v}.jpg`);
        await p.screenshot({ path: shot, type: 'jpeg', quality: 80, timeout: 120000 });
        const K = await p.evaluate(() => __mc.keyed()); let mark = null;
        if (K.img) { mark = path.join(OUT, 'holes', `${A.key}_${String(s.i).padStart(2, '0')}_${s.u}_${s.v}.jpg`); fs.writeFileSync(mark, b64(K.img)); }
        res.push({ i: s.i, hero: at, shot, mark, holes: K.holes, specks: K.specks, open: K.open, farPx: K.farPx, cameraPx: K.cameraPx }); }
      log(`${A.name} 화면 ${res.length}장 끝`); return res; }));
    // 3) 주인공 가림(두 화면비 동시에)
    const occ = await Promise.all(S.map(s => s.p.evaluate(() => __mc.occlusion())));
    log(`가림 훑기 끝 (${occ.map(o => `격자 ${o.grid}점(${o.step} 간격) + 벽 쪽 고리 ${o.ring}점`).join(' / ')})`);
    // 5) 뜬·묻힌 물체(한 번만)
    const objs = await S[0].p.evaluate(() => __mc.objects());
    log(`물체 ${objs.length}개 검사 끝`);
    // 지도 · 모아 보기
    const maps = [];
    for (const [k, A] of ASP.entries()) { const f = path.join(OUT, `map_${A.key}.png`); fs.writeFileSync(f, b64(await S[k].p.evaluate(([o, sp, ob, t]) => __mc.map(o, sp, ob, t), [occ[k], spots, objs, `${ROOM} · ${A.name} ${A.w}×${A.h} · 주인공 가림(${occ[k].step} 간격) · 자리 번호`]))); maps.push(f); }
    const sheets = [];
    await Promise.all(ASP.map(async (A, k) => { const items = per[k].map(r => { const s = spots[r.i], h = r.holes.filter(x => x.cls === 'hole').length, sd = r.holes.length - h; return { ...s, file: r.shot, bad: [h && `구멍 ${h}`, sd && `틈 ${sd}`].filter(Boolean).join(' · ') }; });
      for (let j = 0; j * A.per < items.length; j++) { const f = path.join(OUT, `sheet_${A.key}_${j + 1}.jpg`); await sheet(S[k].b, A, items.slice(j * A.per, (j + 1) * A.per), `${ROOM} · ${A.name} ${A.w}×${A.h} · ${j + 1}/${Math.ceil(items.length / A.per)}`, f); sheets.push(f); } }));
    sheets.sort();

    // ── 보고 ──
    const occS = ASP.map((A, k) => ({ aspect: A.key, ...occSummary(occ[k]) }));
    const holeList = []; ASP.forEach((A, k) => per[k].forEach(r => { for (const h of r.holes) holeList.push({ aspect: A.key, spot: r.i, label: spots[r.i].label, uv: [spots[r.i].u, spots[r.i].v], ...h, image: r.mark && rel(r.mark) }); }));
    const holes = holeList.filter(h => h.cls === 'hole'), edge = holeList.filter(h => h.cls !== 'hole');
    const floating = objs.filter(o => !o.hang && o.minGap > CFG.floatTol && !o.on).sort((a, b) => b.minGap - a.minGap), resting = objs.filter(o => !o.hang && o.minGap > CFG.floatTol && o.on);
    const buried = objs.filter(o => !o.hang && o.buried > CFG.buryFrac).sort((a, b) => b.buried - a.buried), hanging = objs.filter(o => o.hang), loose = hanging.filter(o => o.wallGap == null || o.wallGap > CFG.wallGapTol);
    Object.assign(report, { runtimeSec: Math.round((Date.now() - T0) / 1000), loadMs: S.map(s => s.loadMs), contactSheets: sheets.map(rel), maps: maps.map(rel),
      shots: ASP.map((A, k) => ({ aspect: A.key, list: per[k].map(r => ({ spot: r.i, hero: r.hero, file: rel(r.shot), farPx: r.farPx, cameraPx: r.cameraPx, specks: r.specks })) })),
      occlusion: occS, holes: { holes, edge, specks: per.flat().reduce((s, r) => s + r.specks, 0), open: per.flat().reduce((s, r) => s + r.open, 0), farShots: per.flat().filter(r => r.farPx > 0).length },
      objects: { checked: objs.length, byKind: objs.reduce((m, o) => (m[o.kind] = (m[o.kind] || 0) + 1, m), {}), floating, resting, buried, hanging, loose, all: objs } });
    report.errors.push(...S.flatMap((s, k) => s.errors.map(e => ASP[k].key + ': ' + e)));
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));

    const L = [], line = (ok, s) => L.push(`${ok === true ? 'PASS' : ok === false ? 'WARN' : 'INFO'}  ${s}`);
    L.push('', `── 맵 점검: ${ROOM}${QUICK ? ' (--quick)' : ''} · 자리 ${spots.length}곳 · ${report.runtimeSec}s ──`);
    for (const o of occS) { const A = ASP.find(a => a.key === o.aspect), n = o.bodyHead.length;
      line(!n, `주인공 가림(${A.name}): 몸·머리가 벽·바위에 가림 ${n}/${o.points}점 (벽 몸${o.hidden.wall.body}·머리${o.hidden.wall.head} · 바위 몸${o.hidden.rock.body}·머리${o.hidden.rock.head})`);
      for (const c of o.clusters.slice(0, 6)) L.push(`        ${c.n}점  u ${fmtR(c.u)}  v ${fmtR(c.v)}  [${c.by.join('+')}] 몸${c.body} 머리${c.head} 발${c.feet}`);
      if (o.feetOnly.length) line(null, `  발만 가림 ${o.feetOnly.reduce((s, c) => s + c.n, 0)}점: ${o.feetOnly.slice(0, 5).map(c => `u ${fmtR(c.u)} v ${fmtR(c.v)} (${c.n})`).join(' · ')}`);
      if (o.propOnly) line(null, `  소품만 가림(몸·머리·발) ${o.propOnly}점 — 소품 뒤는 보통 괜찮음`); }
    line(!holes.length, `뒤 빈 곳(벽·바위에 둘러싸인 구멍): ${holes.length}개${holes.length ? ` · ${[...new Set(holes.map(h => h.aspect + '#' + h.spot))].length}장` : ''} (작은 점 ${report.holes.specks}개 · 벽 없이 열린 빈 곳 ${report.holes.open}개는 뺌)`);
    for (const h of holes.slice(0, 8)) L.push(`        ${h.aspect} #${h.spot} ${h.label}(${h.uv}) ${h.area}px 화면[${h.box}]${h.at ? ` → 너머 바닥 (${h.at})` : ''}  ${h.image}`);
    line(!edge.length, `가장자리에 걸친 틈(위에만 좁게 · 위쪽 옆에만 닿는 빈 곳): ${edge.length}개${edge.length ? ' — 그림 확인' : ''}`); for (const h of edge.slice(0, 6)) L.push(`        ${h.cls} ${h.aspect} #${h.spot} ${h.label}(${h.uv}) ${h.area}px 화면[${h.box}]${h.at ? ` → 너머 바닥 (${h.at})` : ''}  ${h.image}`);
    if (report.holes.farShots) line(null, `  화면 위쪽 가장자리까지 빈 곳이 보이는 장: ${report.holes.farShots}/${per.flat().length} (벽 없는 방·낮은 벽이면 정상, 높은 벽 방이면 확인)`);
    line(!floating.length, `뜬 물체(바닥에서 ${CFG.floatTol} 넘게 뜸, 받침 없음): ${floating.length}개 / ${objs.length - hanging.length}`);
    for (const o of floating.slice(0, 8)) L.push(`        ${o.name}  (${o.uv})  ${o.minGap} 뜸  크기 ${o.size}`);
    if (resting.length) line(null, `  다른 물체 위에 얹힘 ${resting.length}개(괜찮음): ${resting.slice(0, 4).map(o => `${o.name}→${o.on}`).join(' · ')}`);
    line(!buried.length, `많이 묻힌 물체(꼭짓점 ${Math.round(CFG.buryFrac * 100)}% 넘게 바닥 아래): ${buried.length}개`);
    for (const o of buried.slice(0, 6)) L.push(`        ${o.name}  (${o.uv})  ${Math.round(o.buried * 100)}% 묻힘  크기 ${o.size}`);
    line(!loose.length, `매단 것(벽 소품·종유석) ${hanging.length}개 중 벽에서 ${CFG.wallGapTol} 넘게 떨어짐: ${loose.length}개`);
    for (const o of loose.slice(0, 6)) L.push(`        ${o.name}  (${o.uv})  벽까지 ${o.wallGap ?? '80+'}`);
    for (const n of report.notes) line(null, n);
    line(!report.errors.length, `페이지 오류 ${report.errors.length}개${report.errors.length ? ': ' + report.errors.slice(0, 3).join(' | ') : ''}`);
    L.push(`모아 보기: ${sheets.map(rel).join('  ')}`, `지도: ${maps.map(rel).join('  ')}${holes.length + edge.length ? `  · 구멍 그림: ${rel(path.join(OUT, 'holes'))}/` : ''}`, `보고서: ${rel(path.join(OUT, 'report.json'))}`);
    console.log(L.join('\n'));
  } catch (e) { console.log('FAIL 점검 중 오류: ' + (e.stack || e)); report.errors.push(String(e)); try { fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); } catch (_) {} }
  finally { await Promise.all(S.map(s => s.b.close().catch(() => {}))); process.exitCode = 0; }
}
module.exports = { pageLib, CFG };   // 다른 점검에서 페이지 안 도구만 가져다 쓸 수 있게
if (require.main === module) main().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exitCode = 0; });
