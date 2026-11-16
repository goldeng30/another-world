// 녹슨 쇠파이프 만들기 (단위 cm): MAKE_PIPE() → Group, 원점 = 아래 끝, +y = 위(꺾인 이음쇠)
(function () {
// 녹슨 쇠파이프: 곧은 관(단위 cm) + 위쪽 90도 꺾인 이음쇠(나사산 입구) + 아래쪽 청테이프 X자 감기 + 아래 끝 이음 고리
var T = THREE, V3 = (x, y, z) => new T.Vector3(x, y, z);
const R_PIPE = 1.7, R_IN = 1.4, R_FIT = 2.05, R_COL = 2.3, LEN = 78, BEND = 3.3, TAPE0 = 2.6, TAPE1 = 33;
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
// 녹 사진에서 거칠기·금속 정도 지도 만들기: 주황 녹은 거칠고 금속감 없음, 회색 맨 쇠는 덜 거칠고 금속
function mapsFrom(im) {
  const n = 512, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, n, n);
  const src = g.getImageData(0, 0, n, n), rough = g.createImageData(n, n), metal = g.createImageData(n, n), bump = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const r = src.data[i * 4], gg = src.data[i * 4 + 1], b = src.data[i * 4 + 2]; const rust = Math.max(0, Math.min(1, (r - b - 25) / 70)), lum = (r + gg + b) / 765;
    const ro = 150 + rust * 95, me = 150 * (1 - rust), bu = 255 * Math.min(1, lum * 1.4 + rust * 0.25);
    rough.data.set([ro, ro, ro, 255], i * 4); metal.data.set([me, me, me, 255], i * 4); bump.data.set([bu, bu, bu, 255], i * 4); }
  const mk = d => { const c = document.createElement('canvas'); c.width = c.height = n; c.getContext('2d').putImageData(d, 0, 0); return c; };
  return { rough: mk(rough), metal: mk(metal), bump: mk(bump) };
}
// 청테이프 질감: 은회색 바탕 + 천 결 + 얼룩 + 주름
function tapeCanvas(img) {
  if (img) { const c = document.createElement('canvas'); c.width = c.height = 1024; c.getContext('2d').drawImage(img, 0, 0, 1024, 1024); return c; }
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
  let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#8a8d91'; g.fillRect(0, 0, n, n);
  // 큰 밝기 얼룩 (은박이 고르지 않게)
  for (let k = 0; k < 30; k++) { const x = rnd() * n, y = rnd() * n, r = 30 + rnd() * 90, l = rnd() < 0.5; for (const [ox, oy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, l ? 'rgba(170,174,180,0.18)' : 'rgba(70,72,76,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); } }
  // 천 결: 4px 격자마다 작은 밝은 점, 틈은 어둡게
  const im = g.getImageData(0, 0, n, n), d = im.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const cx = (x % 4) - 1.5, cy = (y % 4) - 1.5 + ((x >> 2) % 2) * 0.5, r2 = cx * cx + cy * cy, f = r2 < 2.2 ? 1.08 : 0.86; const i = (y * n + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; }
  g.putImageData(im, 0, 0);
  // 주름: 대부분 가로, 조금 기운 꺾인 선 — 위는 밝은 능선, 아래는 그림자
  const crease = (pts, w) => { for (const [ox, oy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n], [n, n], [-n, -n], [n, -n], [-n, n]]) {
      for (const [col, dy, lw] of [['rgba(35,36,40,0.28)', 2.2, w + 1.5], ['rgba(225,228,232,0.45)', 0, w]]) { g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x + ox, y + oy + dy) : g.moveTo(x + ox, y + oy + dy)); g.stroke(); } } };
  g.filter = 'blur(0.8px)';
  for (let k = 0; k < 26; k++) { let x = rnd() * n, y = rnd() * n; const pts = [[x, y]], seg = 2 + Math.floor(rnd() * 4), ang0 = (rnd() - 0.5) * 0.5;
    for (let j = 0; j < seg; j++) { const a = ang0 + (rnd() - 0.5) * 0.7, l = 30 + rnd() * 90; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
    crease(pts, 0.8 + rnd() * 1.4); }
  g.filter = 'none';
  // 갈색 때 얼룩
  for (let k = 0; k < 12; k++) { const x = rnd() * n, y = rnd() * n, r = 8 + rnd() * 18; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(80,66,52,${0.25 + rnd() * 0.2})`); gr.addColorStop(1, 'rgba(80,66,52,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  return c;
}
// 감는 테이프 띠: 나선을 따라가는 얇은 띠, 가장자리는 바탕으로 살짝 내려앉는다
function helixBand(r0, y0, y1, turns, a0, width, tk, segL = 220, segW = 6) {
  const pos = [], uv = [], idx = [], col = [], L = y1 - y0;
  const dir = turns >= 0 ? 1 : -1, pitch = L / Math.abs(turns), ang = Math.atan2(pitch, 2 * Math.PI * r0);   // 띠 진행 방향 기울기
  for (let i = 0; i <= segL; i++) { const t = i / segL, th = a0 + dir * t * Math.abs(turns) * 2 * Math.PI, y = y0 + t * L;
    for (let j = 0; j <= segW; j++) { const s = j / segW - 0.5, off = s * width;
      // 띠 너비 방향: 진행 방향에 수직 (원기둥 면 위) → 각도·높이 성분으로 나눔
      const dth = -off * Math.sin(ang) / r0, dy = off * Math.cos(ang) * dir;
      const rr = r0 + tk * (1 - Math.pow(2 * Math.abs(s), 3));
      const a = th + dth; pos.push(Math.cos(a) * rr, y + dy, Math.sin(a) * rr); uv.push(j / segW, t * L / 6); const e = Math.max(0, (Math.abs(s) - 0.3) / 0.2), k = 1 - 0.6 * e * e; col.push(k, k, k); } }
  for (let i = 0; i < segL; i++) for (let j = 0; j < segW; j++) { const a = i * (segW + 1) + j, b = a + segW + 1; if (dir < 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
// 고리(이음쇠 띠): 바깥 반지름, 안 반지름, 길이, 모서리 깎임
function ringGeo(ro, ri, h, bev = 0.18, seg = 48) {
  const p = [V3(ri, 0, 0), V3(ro - bev, 0, 0), V3(ro, bev, 0), V3(ro, h - bev, 0), V3(ro - bev, h, 0), V3(ri, h, 0)].map(v => new T.Vector2(v.x, v.y));
  return new T.LatheGeometry(p, seg);
}
// 나사산 입구: 안쪽에 홈이 파인 짧은 관
function threadedSocket(ro, ri, h, seg = 48) {
  const p = [new T.Vector2(ri + 0.05, h), new T.Vector2(ro - 0.2, h), new T.Vector2(ro, h - 0.2), new T.Vector2(ro, 0.2), new T.Vector2(ro - 0.1, 0)];
  const inner = []; const nT = 7; for (let k = 0; k <= nT * 2; k++) { const y = h - (k / (nT * 2)) * (h - 0.1); inner.push(new T.Vector2(ri + (k % 2 ? 0.12 : 0), y)); }
  return new T.LatheGeometry([...p.reverse(), ...inner, new T.Vector2(ri, 0), new T.Vector2(ro - 0.1, 0)], seg);
}
window.PIPE_DIM = { R_PIPE, LEN, TAPE0, TAPE1, BEND };
window.MAKE_ENV = (rd) => {
  { const es = new T.Scene(), sg = new T.SphereGeometry(100, 32, 16), cols = []; const pa = sg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 100, c = y > 0 ? new T.Color('#9aa0a8').lerp(new T.Color('#e6e9ee'), y) : new T.Color('#8a8680').lerp(new T.Color('#2e2a26'), -y); cols.push(c.r, c.g, c.b); }
    sg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); es.add(new T.Mesh(sg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    for (const [x, y, z, w] of [[-60, 50, 40, 50], [70, 20, -30, 30]]) { const pl = new T.Mesh(new T.PlaneGeometry(w, w), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide })); pl.position.set(x, y, z); pl.lookAt(0, 0, 0); es.add(pl); }
    const pm = new T.PMREMGenerator(rd); return pm.fromScene(es, 0.04).texture; }
};
window.MAKE_PIPE = async () => {
  const im = await loadImg('rust.webp'), mp = mapsFrom(im); let tapeImg = null; try { tapeImg = await loadImg('tape.webp'); } catch (e) {}
  const rustC = (() => { const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 1024, 1024); const d = g.getImageData(0, 0, 1024, 1024), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const l = a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11; for (let k = 0; k < 3; k++) a[i + k] = a[i + k] * 0.75 + l * 0.25; } g.putImageData(d, 0, 0); return c; })();
  const rustMat = (rx, ry, ox = 0, oy = 0) => { const mk = (src, enc) => { const t = new T.Texture(src); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.offset.set(ox, oy); t.anisotropy = 8; if (enc) t.encoding = T.sRGBEncoding; t.needsUpdate = true; return t; };
    return new T.MeshStandardMaterial({ map: mk(rustC, true), roughnessMap: mk(mp.rough), metalnessMap: mk(mp.metal), bumpMap: mk(mp.bump), bumpScale: 0.08, roughness: 1, metalness: 1, color: 0xd8d2cc }); };
  const bandC = (() => { const c = tapeCanvas(tapeImg), g = c.getContext('2d'), n = c.width; for (const [x0, x1] of [[0, 0.16], [1, 0.84]]) { const gr = g.createLinearGradient(x0 * n, 0, x1 * n, 0); gr.addColorStop(0, 'rgba(25,26,30,0.75)'); gr.addColorStop(1, 'rgba(25,26,30,0)'); g.fillStyle = gr; g.fillRect(Math.min(x0, x1) * n, 0, 0.16 * n, n); } return c; })();
  const bandTex = new T.CanvasTexture(bandC); bandTex.wrapS = bandTex.wrapT = T.RepeatWrapping; bandTex.encoding = T.sRGBEncoding; bandTex.anisotropy = 8;
  const tapeTex = new T.CanvasTexture(tapeCanvas(tapeImg)); tapeTex.wrapS = tapeTex.wrapT = T.RepeatWrapping; tapeTex.encoding = T.sRGBEncoding; tapeTex.anisotropy = 8;
  const tapeMat = (rx, ry, edge) => { const t = tapeTex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return new T.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.06, color: 0x9c9fa3, roughness: 0.45, metalness: 0.45, vertexColors: !!edge, side: edge ? T.DoubleSide : T.FrontSide }); };
  const darkIn = new T.MeshStandardMaterial({ color: 0x1a1512, roughness: 1, metalness: 0, side: T.BackSide });
  const pipe = new T.Group();
  // 곧은 관 (바깥 + 안쪽 어두운 면)
  const body = new T.Mesh(new T.CylinderGeometry(R_PIPE, R_PIPE, LEN, 48, 1, true), rustMat(1, LEN / 11, 0.1, 0.3)); body.position.y = LEN / 2; pipe.add(body);
  const inner = new T.Mesh(new T.CylinderGeometry(R_IN, R_IN, LEN, 32, 1, true), darkIn); inner.position.y = LEN / 2; pipe.add(inner);
  // 위 꺾인 이음쇠 (관보다 굵다)
  const elbow = new T.Mesh(new T.TorusGeometry(BEND, R_FIT, 32, 40, Math.PI / 2), rustMat(0.5, 1.2, 0.55, 0.1)); elbow.rotation.z = Math.PI / 2; elbow.position.set(BEND, LEN, 0); pipe.add(elbow);
  // 이음쇠와 관이 만나는 고리 · 이음쇠 아래 소켓
  const sock = new T.Mesh(ringGeo(R_FIT + 0.05, R_PIPE - 0.02, 2.2, 0.15), rustMat(1, 0.25, 0.3, 0.7)); sock.position.y = LEN - 2.2; pipe.add(sock);
  const col1 = new T.Mesh(ringGeo(R_COL, R_PIPE, 1.1, 0.2), rustMat(1.3, 0.12, 0.8, 0.2)); col1.position.y = LEN - 2.6; pipe.add(col1);
  // 옆으로 뚫린 나사산 입구
  const mouth = new T.Group(); mouth.position.set(BEND - 0.7, LEN + BEND, 0); mouth.rotation.z = -Math.PI / 2; pipe.add(mouth);
  const ms = new T.Mesh(threadedSocket(R_COL + 0.1, R_IN + 0.05, 3.0), rustMat(1.3, 0.7, 0.2, 0.5)); ms.material.side = T.DoubleSide; mouth.add(ms);
  const hole = new T.Mesh(new T.CircleGeometry(R_IN + 0.1, 32), new T.MeshBasicMaterial({ color: 0x0d0a08 })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.9; mouth.add(hole);
  // 아래 끝 이음 고리 + 안쪽 어둠
  const col0 = new T.Mesh(ringGeo(R_COL - 0.1, R_IN, 1.6, 0.2), rustMat(1.3, 0.15, 0.4, 0.9)); col0.position.y = -0.3; pipe.add(col0);
  const capIn = new T.Mesh(new T.CircleGeometry(R_IN, 32), new T.MeshBasicMaterial({ color: 0x0d0a08 })); capIn.rotation.x = Math.PI / 2; capIn.position.y = 1.0; pipe.add(capIn);
  // 청테이프: 바탕 감기 + 양쪽 나선 띠(X자) + 위아래 마감 띠
  const tl = TAPE1 - TAPE0, base = new T.Mesh(new T.CylinderGeometry(R_PIPE + 0.06, R_PIPE + 0.06, tl, 48, 1, true), tapeMat(1.2, tl / 8)); base.position.y = (TAPE0 + TAPE1) / 2; pipe.add(base);
  const turns = tl / 9.5;
  for (const [tn, a0] of [[turns, 0], [turns, Math.PI], [-turns, 0.4], [-turns, Math.PI + 0.4]]) pipe.add(new T.Mesh(helixBand(R_PIPE + 0.07, TAPE0 + 0.4, TAPE1 - 0.4, tn, a0, 1.9, 0.1), tapeMat(0.28, 1, true)));
  for (const y of [TAPE0 + 0.6, TAPE1 - 0.6]) { const bd = new T.Mesh(new T.CylinderGeometry(R_PIPE + 0.19, R_PIPE + 0.19, 1.4, 48, 1, true), tapeMat(1.5, 0.25)); bd.position.y = y; pipe.add(bd); }
  return pipe;
};
})();
