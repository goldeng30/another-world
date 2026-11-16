// F급 고블린 던전 — 첫 구역(동굴 공동) 배경. 바닥·바위벽·바위·석순·마석·횃불·모닥불·입구 게이트 + Tripo 소품(헌터 유골·고블린 문·토템·약탈품)
// 바닥·벽·바위는 사진 돌 질감(tx_*.webp), 없으면 코드로 그린 질감. 나머지 질감은 코드로 그린다. 각도 θ: x = r·sinθ, z = r·cosθ. 카메라는 θ=45° 쪽에서 내려다본다
window.MAKE_DUNGEON = async function (T, scene, opt) {
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z), DEG = Math.PI / 180;
  const R = 600, RC = 500, CAM_T = 45 * DEG, EXIT_T = 225 * DEG, GAP = 12 * DEG;   // 공동 반지름 · 움직일 수 있는 반지름 · 카메라 쪽 · 나가는 길 · 길 폭(각)
  const root = new T.Group(); scene.add(root); const upd = [], colliders = [];
  const pol = (r, t, y = 0) => V(r * Math.sin(t), y, r * Math.cos(t));
  const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const sstep = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  // ── 잡음(값 잡음, 주기 있게 → 질감이 이어진다) ──
  const hash = (x, y, z, s) => { let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca77); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967295; };
  const sm = t => t * t * (3 - 2 * t), md = (a, p) => ((a % p) + p) % p;
  const n2 = (x, y, p, s) => { const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi), X0 = md(xi, p), X1 = md(xi + 1, p), Y0 = md(yi, p), Y1 = md(yi + 1, p);
    const a = hash(X0, Y0, 0, s), b = hash(X1, Y0, 0, s), c = hash(X0, Y1, 0, s), d = hash(X1, Y1, 0, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm2 = (x, y, p, s, o = 4) => { let v = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { v += a * n2(x * f, y * f, p * f, s + i * 13); t += a; a *= 0.5; f *= 2; } return v / t; };
  const n3 = (x, y, z, s) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm(x - xi), v = sm(y - yi), w = sm(z - zi); let r = 0;
    for (let k = 0; k < 8; k++) { const dx = k & 1, dy = (k >> 1) & 1, dz = k >> 2; r += hash(xi + dx, yi + dy, zi + dz, s) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); } return r; };
  const fbm3 = (x, y, z, s, o = 3) => { let v = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { v += a * n3(x * f, y * f, z * f, s + i * 7); t += a; a *= 0.5; f *= 2; } return v / t; };

  // ── 질감 그리기 ──
  // 높이(h)와 색을 같이 그리고, 높이에서 노멀맵을 만든다(빛 받으면 굴곡이 보이게)
  function texPair(S, fn, strength) { const H = new Float32Array(S * S), cc = document.createElement('canvas'); cc.width = cc.height = S; const g = cc.getContext('2d'), im = g.createImageData(S, S), d = im.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const [r, gg, b, h] = fn(x / S, y / S); const i = y * S + x; H[i] = h; d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); const cn = document.createElement('canvas'); cn.width = cn.height = S; const gn = cn.getContext('2d'), nm = gn.createImageData(S, S), nd = nm.data, at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
      nd[i] = (-dx / l * 0.5 + 0.5) * 255; nd[i + 1] = (dy / l * 0.5 + 0.5) * 255; nd[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd[i + 3] = 255; }
    gn.putImageData(nm, 0, 0); const mk = (c, srgb) => { const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 4; t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
    return [mk(cc, true), mk(cn, false)]; }
  function canvasTex(S, fn, repeat = true) { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const [r, gg, b] = fn(x / S, y / S, x, y); const i = (y * S + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
    g.putImageData(im, 0, 0); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; return t; }
  const mix = (a, b, k) => a + (b - a) * k;
  // 동굴 바닥: 어두운 흙 + 박힌 자갈(굴곡) + 얕은 홈
  const [groundTex, groundNrm] = texPair(512, (u, v) => { const n = fbm2(u * 8, v * 8, 8, 1, 5), m = fbm2(u * 3, v * 3, 3, 9, 3), gv = n2(u * 48, v * 48, 48, 33), g2 = n2(u * 110, v * 110, 110, 34), gr = Math.abs(fbm2(u * 5, v * 5, 5, 21, 4) - 0.5);
    const peb = sstep(0.68, 0.8, gv), fine = sstep(0.6, 0.9, g2); let k = 0.5 + 0.55 * (n - 0.5) + 0.3 * (m - 0.5) + 0.18 * peb + 0.08 * fine - 0.18 * (1 - sstep(0, 0.05, gr));
    const h = 0.5 * n + 0.6 * peb + 0.25 * fine - 0.3 * (1 - sstep(0, 0.05, gr));
    return [mix(30, 72, k) | 0, mix(26, 62, k) | 0, mix(23, 54, k) | 0, h]; }, 6);
  // 바위: 회갈색 결 + 거친 굴곡 + 옅은 이끼 (헌터 유골의 바위 색에 맞춤)
  const [rockTex, rockNrm] = texPair(512, (u, v) => { const n = fbm2(u * 6, v * 6, 6, 3, 6), n2_ = fbm2(u * 18, v * 18, 18, 8, 3), st = Math.sin((v * 6 + fbm2(u * 4, v * 4, 4, 5, 3) * 2.6) * Math.PI * 2) * 0.5 + 0.5, cr = Math.abs(fbm2(u * 4, v * 4, 4, 41, 5) - 0.5), ms = fbm2(u * 3, v * 3, 3, 77, 3);
    const crev = (1 - sstep(0.0, 0.1, cr)) * sstep(0.5, 0.7, fbm2(u * 2, v * 2, 2, 55, 3)) * 0.8; let k = 0.5 + 0.6 * (n - 0.5) + 0.25 * (n2_ - 0.5) + 0.1 * (st - 0.5) - 0.3 * crev; const mo = sstep(0.62, 0.78, ms) * 0.22;
    const h = n * 0.7 + n2_ * 0.35 + st * 0.12 - crev * 0.45;
    return [mix(mix(46, 112, k), 66, mo) | 0, mix(mix(42, 104, k), 80, mo) | 0, mix(mix(38, 94, k), 50, mo) | 0, h]; }, 9);
  const woodTex = canvasTex(256, (u, v) => { const g = fbm2(u * 3, v * 24, 3, 11, 4), k = 0.45 + 0.7 * (g - 0.5) + 0.15 * Math.sin(u * 60 + g * 8); return [mix(52, 120, k) | 0, mix(38, 88, k) | 0, mix(26, 60, k) | 0]; });
  const hideTex = canvasTex(256, (u, v) => { const n = fbm2(u * 5, v * 5, 5, 61, 4), bl = fbm2(u * 2, v * 2, 2, 71, 3), cell = n2(u * 3, v * 2, 3, 81), pu = (u * 3) % 1, pv = (v * 2) % 1;
    const patch = cell > 0.62 ? 1 : 0, edge = patch && (pu < 0.04 || pu > 0.96 || pv < 0.05 || pv > 0.95) ? 1 : 0, seam = Math.min(Math.abs(u * 4 - Math.round(u * 4)), 1) < 0.01 ? 1 : 0;
    const k = 0.5 + 0.5 * (n - 0.5) - 0.3 * sstep(0.55, 0.75, bl) - 0.18 * patch - 0.3 * edge - 0.22 * seam; return [mix(56, 128, k) | 0, mix(46, 104, k) | 0, mix(36, 82, k) | 0]; });
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const flameTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 92, 2, 32, 80, 52);
    gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,190,90,0.95)'); gr.addColorStop(0.6, 'rgba(255,110,30,0.55)'); gr.addColorStop(1, 'rgba(160,40,10,0)'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(54, 50, 60, 84, 52, 108); g.quadraticCurveTo(32, 128, 12, 108); g.bezierCurveTo(4, 84, 10, 50, 32, 4); g.fill(); return new T.CanvasTexture(c); })();

  const M = { rock: new T.MeshStandardMaterial({ map: rockTex, normalMap: rockNrm, normalScale: new T.Vector2(1.4, 1.4), roughness: 0.93, metalness: 0, envMapIntensity: 0.12 }),
    wall: new T.MeshStandardMaterial({ map: rockTex, normalMap: rockNrm, normalScale: new T.Vector2(1.6, 1.6), roughness: 0.96, metalness: 0, vertexColors: true, envMapIntensity: 0.1 }),
    wood: new T.MeshStandardMaterial({ map: woodTex, roughness: 0.9, metalness: 0, envMapIntensity: 0.15 }),
    hide: new T.MeshStandardMaterial({ map: hideTex, color: 0x7a6c5e, roughness: 0.95, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.12 }),
    bone: new T.MeshStandardMaterial({ color: 0x9c907a, roughness: 0.8, metalness: 0, envMapIntensity: 0.2 }) };

  // ── 사진 돌 질감(ambientCG, CC0, 1K): 파일이 있으면 바닥·벽·바위에 씌운다(없으면 위의 코드 질감) ──
  //    바닥은 두 장을 큰 얼룩으로 섞어 반복 무늬를 숨기고, 벽·바위는 세 방향에서 세계 좌표로 투영(늘어짐·이음새 없게)
  const PX = await (async () => { if (!opt.loadTex) return {}; const pick = { floorA: 'rock062', floorB: 'rock050', wall: 'rocks016', rock: 'rock050' }, got = {}, o = {};
    const L = (f, srgb) => opt.loadTex(f).then(t => { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = T.sRGBEncoding; return t; }, () => null);
    const one = n => got[n] || (got[n] = Promise.all([L(`tx_${n}_c.webp`, true), L(`tx_${n}_n.webp`, false)]).then(([c, nm]) => c && nm ? { c, n: nm } : null));
    await Promise.all(Object.entries(pick).map(async ([k, n]) => { const r = await one(n); if (r) o[k] = r; })); return o; })();
  function triplanar(mat, tile) {   // 세 방향 투영(구 모양 UV의 늘어짐·이음새 없이) — 노멀도 세 방향을 섞는다
    mat.onBeforeCompile = sh => { sh.uniforms.tpS = { value: 1 / tile };
      sh.vertexShader = 'varying vec3 vTpP;\nvarying vec3 vTpN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        { vec4 tp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          tp = instanceMatrix * tp;
        #endif
          vTpP = (modelMatrix * tp).xyz; vTpN = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz); }`);
      sh.fragmentShader = 'uniform float tpS;\nvarying vec3 vTpP;\nvarying vec3 vTpN;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `vec3 tpN = normalize(vTpN); vec3 tpW = pow(abs(tpN), vec3(4.0)); tpW /= (tpW.x + tpW.y + tpW.z);
          vec2 tpX = vTpP.zy * tpS, tpY = vTpP.xz * tpS, tpZ = vTpP.xy * tpS;
          vec4 texelColor = texture2D(map, tpX) * tpW.x + texture2D(map, tpY) * tpW.y + texture2D(map, tpZ) * tpW.z; texelColor = mapTexelToLinear(texelColor); diffuseColor *= texelColor;`)
        .replace('#include <normal_fragment_maps>', `{ vec3 nX = texture2D(normalMap, tpX).xyz * 2.0 - 1.0, nY = texture2D(normalMap, tpY).xyz * 2.0 - 1.0, nZ = texture2D(normalMap, tpZ).xyz * 2.0 - 1.0;
          nX.xy *= normalScale; nY.xy *= normalScale; nZ.xy *= normalScale;
          nX = vec3(nX.xy + tpN.zy, abs(nX.z) * tpN.x); nY = vec3(nY.xy + tpN.xz, abs(nY.z) * tpN.y); nZ = vec3(nZ.xy + tpN.xy, abs(nZ.z) * tpN.z);
          vec3 wN = normalize(nX.zyx * tpW.x + nY.xzy * tpW.y + nZ.xyz * tpW.z); normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz); }`); }; }
  const TINT = { floor: [0.56, 0.46, 0.42], wall: [0.5, 0.44, 0.42], rock: [0.62, 0.55, 0.5] };   // 사진 밝기를 동굴 어둠에 맞춤
  if (PX.wall) { Object.assign(M.wall, { map: PX.wall.c, normalMap: PX.wall.n }); M.wall.normalScale.set(1.2, 1.2); M.wall.color.setRGB(...TINT.wall); triplanar(M.wall, 280); }
  if (PX.rock) { Object.assign(M.rock, { map: PX.rock.c, normalMap: PX.rock.n }); M.rock.normalScale.set(1.2, 1.2); M.rock.color.setRGB(...TINT.rock); triplanar(M.rock, 150); }

  // ── 바닥: 넓은 판, 공동 밖은 어둡게(나가는 길만 조금 밝게) ──
  { const S = 3400, n = 72, g = new T.PlaneGeometry(S, S, n, n); g.rotateX(-Math.PI / 2); const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const ex = Math.sin(EXIT_T), ez = Math.cos(EXIT_T);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z), along = x * ex + z * ez, lat = Math.abs(-x * ez + z * ex);
      let k = 1 - sstep(R - 40, R + 160, r) * 0.88; if (along > 0 && lat < 150) k = Math.max(k, 0.85 - sstep(R, R + 700, along) * 0.75); k *= 0.92 + 0.16 * fbm2(x / 260, z / 260, 64, 5, 3);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); groundTex.repeat.set(S / 170, S / 170);
    groundNrm.repeat.copy(groundTex.repeat); const gm = new T.MeshStandardMaterial({ map: groundTex, normalMap: groundNrm, normalScale: new T.Vector2(1.2, 1.2), vertexColors: true, roughness: 0.97, metalness: 0, envMapIntensity: 0.08 });
    if (PX.floorA) { const A = PX.floorA, Bt = PX.floorB, rp = S / 200; A.c.repeat.set(rp, rp); A.n.repeat.set(rp, rp); Object.assign(gm, { map: A.c, normalMap: A.n }); gm.normalScale.set(1, 1); gm.color.setRGB(...TINT.floor);
      if (Bt) { const bl = new Float32Array(pos.count); for (let i = 0; i < pos.count; i++) bl[i] = sstep(0.42, 0.6, fbm2(pos.getX(i) / 380 + 40, pos.getZ(i) / 380 + 40, 64, 17, 4)); g.setAttribute('blend', new T.BufferAttribute(bl, 1));
        gm.onBeforeCompile = sh => { sh.uniforms.map2 = { value: Bt.c }; sh.uniforms.nrm2 = { value: Bt.n };   // 두 번째 돌: 크기·자리를 어긋나게 깔고 얼룩(blend)으로 섞는다
          sh.vertexShader = 'attribute float blend;\nvarying float vBl;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvBl = blend;');
          sh.fragmentShader = 'uniform sampler2D map2;\nuniform sampler2D nrm2;\nvarying float vBl;\n' + sh.fragmentShader
            .replace('#include <map_fragment>', 'vec2 uvB = vUv * 0.77 + vec2(0.37, 0.61);\nvec4 texelColor = mix(texture2D(map, vUv), texture2D(map2, uvB), vBl); texelColor = mapTexelToLinear(texelColor); diffuseColor *= texelColor;')
            .replace('#include <normal_fragment_maps>', T.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vUv ).xyz', 'vec3 mapN = mix(texture2D( normalMap, vUv ), texture2D( nrm2, uvB ), vBl).xyz')); }; } }
    const ground = new T.Mesh(g, gm); ground.receiveShadow = true; root.add(ground); }

  // ── 바위벽: 공동을 두르는 벽(카메라 쪽은 낮게 → 시야 안 가림), 나가는 길 자리는 비움 + 통로 양옆 벽 ──
  function wallStrip(pts, H, seed) {   // pts: [{x,z,nx,nz}] 벽 밑선(안쪽 법선), H(i): 높이
    const rows = 9, g = new T.BufferGeometry(), P = [], U = [], C = [], I = []; let arc = 0;
    for (let i = 0; i < pts.length; i++) { const q = pts[i]; if (i) arc += Math.hypot(q.x - pts[i - 1].x, q.z - pts[i - 1].z); const h = H(i);
      for (let j = 0; j <= rows; j++) { const f = j / rows, y = h * f, bulge = (fbm3(q.x / 90, y / 90, q.z / 90, seed, 3) - 0.5) * 95 + (fbm3(q.x / 30, y / 30, q.z / 30, seed + 3, 2) - 0.5) * 22, lean = -55 * f * f + 25 * Math.sin(f * Math.PI);
        P.push(q.x - q.nx * (bulge + lean), y, q.z - q.nz * (bulge + lean)); U.push(arc / 230, y / 230); const ao = 0.38 + 0.62 * sstep(0, 60, y), top = 1 - 0.75 * sstep(h * 0.4, h, y); const k = ao * top * (0.85 + 0.3 * fbm3(q.x / 120, y / 120, q.z / 120, seed + 9, 2)); C.push(k, k, k); } }
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < rows; j++) { const a = i * (rows + 1) + j, b = a + rows + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    // 안쪽을 보게(아니면 뒤집기)
    const nA = g.attributes.normal; if (nA.getX(rows >> 1) * pts[0].nx + nA.getZ(rows >> 1) * pts[0].nz < 0) { for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } g.setIndex(I); g.computeVertexNormals(); }
    const m = new T.Mesh(g, M.wall); m.receiveShadow = true; root.add(m); return m; }
  { const pts = [], N = 200, t0 = EXIT_T + GAP, span = Math.PI * 2 - 2 * GAP; const hs = [];
    for (let i = 0; i <= N; i++) { const t = t0 + span * i / N, r = R + (fbm2(t * 3, 0.5, 64, 2, 3) - 0.5) * 90; pts.push({ x: r * Math.sin(t), z: r * Math.cos(t), nx: -Math.sin(t), nz: -Math.cos(t) });
      const k = sstep(55 * DEG, 105 * DEG, angDist(t, CAM_T)); hs.push(40 + 300 * k + 70 * k * (fbm2(t * 5, 1.5, 64, 4, 3) - 0.5)); }
    wallStrip(pts, i => hs[i], 11);
    // 나가는 길 양옆 벽(통로)
    const ex = Math.sin(EXIT_T), ez = Math.cos(EXIT_T), lx = -ez, lz = ex, W = 2 * R * Math.sin(GAP) * 0.5;
    for (const sd of [1, -1]) { const p2 = []; for (let i = 0; i <= 30; i++) { const s = R * Math.cos(GAP) - 20 + i * 22, w = W + 18 * Math.sin(i * 0.7) + 25 * sstep(0, 30, i); p2.push({ x: ex * s + lx * w * sd, z: ez * s + lz * w * sd, nx: -lx * sd, nz: -lz * sd }); }
      wallStrip(p2, i => 300 + 40 * Math.sin(i * 1.3), 31 + (sd > 0 ? 0 : 5)); } }

  // ── 바위 조각들(3종, 같은 모양 여러 개를 한 번에 그림) ──
  function smoothMerge(g) {   // 같은 자리 꼭짓점을 합쳐 부드러운 법선
    const p = g.attributes.position, uv = g.attributes.uv, map = new Map(), P = [], U = [], I = [];
    for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`; let j = map.get(k); if (j === undefined) { j = P.length / 3; map.set(k, j); P.push(p.getX(i), p.getY(i), p.getZ(i)); U.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0); } I.push(j); }
    const o = new T.BufferGeometry(); o.setAttribute('position', new T.Float32BufferAttribute(P, 3)); o.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); o.setIndex(I); return o; }
  function rockGeo(seed, detail = 3) { const g = smoothMerge(new T.IcosahedronGeometry(1, detail)), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)), d = 1 + (fbm3(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4, seed, 4) - 0.5) * 0.85 + (n3(v.x * 5, v.y * 5, v.z * 5, seed + 2) - 0.5) * 0.12; v.multiplyScalar(d); if (v.y > 0.25) v.y = 0.25 + (v.y - 0.25) * 0.8; v.y = Math.max(v.y, -0.35); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g; }
  const HUNTER_T = 150 * DEG;   // 헌터 유골 자리(오른쪽 위 벽)
  const RG = [rockGeo(1), rockGeo(2), rockGeo(3)], rockLists = [[], [], []];
  const addRock = (x, z, s, sy = 0.75, rot = Math.random() * 6.28) => rockLists[Math.floor(Math.random() * 3)].push({ x, z, s, sy, rot });
  let rs = 12345; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < Math.PI * 2; t += 7 * DEG) { if (angDist(t, EXIT_T) < GAP * 1.3 || angDist(t, HUNTER_T) < 9 * DEG) continue; const far = sstep(55 * DEG, 105 * DEG, angDist(t, CAM_T)); const r = R - 40 - rnd() * 70; addRock(r * Math.sin(t), r * Math.cos(t), (35 + rnd() * (far ? 70 : 35)), 0.6 + rnd() * 0.5); }
  for (let i = 0; i < 14; i++) { const t = rnd() * 6.28; if (angDist(t, EXIT_T) < GAP * 1.5) continue; const r = R - 120 - rnd() * 60; addRock(r * Math.sin(t), r * Math.cos(t), 12 + rnd() * 18, 0.7); }
  for (let k = 0; k < 3; k++) { const L = rockLists[k]; if (!L.length) continue; const im = new T.InstancedMesh(RG[k], M.rock, L.length), m4 = new T.Matrix4(), q = new T.Quaternion();
    L.forEach((o, i) => { q.setFromAxisAngle(V(0, 1, 0), o.rot); m4.compose(V(o.x, o.s * 0.12, o.z), q, V(o.s, o.s * o.sy, o.s * (0.8 + 0.3 * Math.sin(i)))); im.setMatrixAt(i, m4); }); im.receiveShadow = true; root.add(im); }
  // 석순(벽 밑)
  { const g = new T.ConeGeometry(1, 1, 7, 5, true), p = g.attributes.position; g.translate(0, 0.5, 0);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + (n3(x * 3, y * 4, z * 3, 5) - 0.5) * 0.6; p.setXYZ(i, x * d, y, z * d); } g.computeVertexNormals();
    const L = []; for (let t = 0; t < Math.PI * 2; t += 11 * DEG) { if (angDist(t, EXIT_T) < GAP * 1.4 || angDist(t, CAM_T) < 95 * DEG || angDist(t, HUNTER_T) < 12 * DEG || rnd() < 0.35) continue; const r = R - 35 - rnd() * 30; L.push([r * Math.sin(t), r * Math.cos(t), 12 + rnd() * 12, 40 + rnd() * 70]); }
    const im = new T.InstancedMesh(smoothMerge(g), M.rock, L.length), m4 = new T.Matrix4(), q = new T.Quaternion(); im.geometry.computeVertexNormals(); L.forEach((o, i) => { q.setFromEuler(new T.Euler((rnd() - 0.5) * 0.15, rnd() * 6, (rnd() - 0.5) * 0.15)); m4.compose(V(o[0], -4, o[1]), q, V(o[2], o[3], o[2])); im.setMatrixAt(i, m4); }); root.add(im); }

  // ── 마석(빛나는 수정 무더기) ──
  function crystalCluster(x, z, s, faceT) { const grp = new T.Group(); grp.position.set(x, 0, z); grp.rotation.y = faceT;
    const mat = new T.MeshStandardMaterial({ color: 0x5fd6ff, emissive: 0x1d9cff, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0.1, flatShading: true });
    for (let i = 0; i < 7; i++) { const g = new T.OctahedronGeometry(1, 0); g.scale(0.32, 1.4, 0.32); const m = new T.Mesh(g, mat), a = (i / 7) * 6.28 + rnd() * 0.5, h = s * (0.5 + rnd() * 0.7);
      m.scale.setScalar(h * 0.55); m.position.set(Math.sin(a) * s * 0.28 * (i ? 1 : 0), h * 0.45, Math.cos(a) * s * 0.28 * (i ? 1 : 0)); m.rotation.set(Math.cos(a) * 0.45 * (i ? 1 : 0.1), rnd() * 3, -Math.sin(a) * 0.45 * (i ? 1 : 0.1)); grp.add(m); }
    const gl = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0x3fb8ff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false })); gl.scale.set(s * 2.6, s * 2.6, 1); gl.position.y = s * 0.45; grp.add(gl);
    const ph = rnd() * 6; upd.push(t => { gl.material.opacity = 0.42 + 0.14 * Math.sin(t * 1.7 + ph); mat.emissiveIntensity = 1.1 + 0.25 * Math.sin(t * 1.7 + ph); });
    root.add(grp); colliders.push({ x, z, r: s * 0.55 }); return grp; }
  crystalCluster(...pol(R - 95, 300 * DEG).toArray().filter((_, i) => i !== 1), 85, 300 * DEG + Math.PI);
  crystalCluster(...pol(R - 80, 330 * DEG).toArray().filter((_, i) => i !== 1), 55, 330 * DEG + Math.PI);

  // ── 불: 흔들리는 불꽃(빛 점) + 따뜻한 빛 ──
  function flame(at, s, light) { const grp = new T.Group(); grp.position.copy(at);
    const f1 = new T.Sprite(new T.SpriteMaterial({ map: flameTex, color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false })), f2 = f1.clone(); f2.material = f1.material.clone(); f2.material.color.set(0xff9a50);
    const gl = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xff8a3a, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false })); gl.scale.set(s * 5, s * 5, 1);
    grp.add(gl, f2, f1); let L = null; if (light) { L = new T.PointLight(0xff9a4a, light, s * 26, 2); L.position.y = s * 0.8; grp.add(L); }
    const ph = rnd() * 9; upd.push(t => { const k = 0.85 + 0.15 * Math.sin(t * 13 + ph) * Math.sin(t * 7.3 + ph * 2); f1.scale.set(s * 0.9 * k, s * 1.9 * k, 1); f1.position.y = s * 0.85 * k; f2.scale.set(s * 1.3, s * 2.4 * (2 - k), 1); f2.position.y = s * 1.0; f2.material.opacity = 0.55 + 0.25 * k; gl.material.opacity = 0.32 + 0.18 * k; if (L) L.intensity = light * (0.82 + 0.25 * k); });
    root.add(grp); return grp; }
  function torch(t, light) { const r = R - 18, base = pol(r, t, 0); const grp = new T.Group(); grp.position.copy(base); grp.lookAt(0, 0, 0);
    const stick = new T.Mesh(new T.CylinderGeometry(3.2, 2.4, 70, 6), M.wood); stick.position.set(0, 140, 14); stick.rotation.x = 0.45; grp.add(stick);
    const head = new T.Mesh(new T.CylinderGeometry(6, 4, 14, 7), M.hide); head.position.set(0, 172, 28); head.rotation.x = 0.45; grp.add(head); root.add(grp);
    flame(grp.localToWorld(V(0, 178, 31)), 14, light); }
  root.updateMatrixWorld(true);
  torch(205 * DEG, 1.5); torch(250 * DEG, 0); torch(168 * DEG, 1.3);

  // ── 고블린 진지: 모닥불 ──
  { const c = pol(330, 280 * DEG); const grp = new T.Group(); grp.position.copy(c); root.add(grp);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, st = new T.Mesh(RG[i % 3], M.rock); st.scale.set(9, 7, 9); st.position.set(Math.sin(a) * 26, 2, Math.cos(a) * 26); st.rotation.y = a; grp.add(st); }
    for (let i = 0; i < 3; i++) { const lg = new T.Mesh(new T.CylinderGeometry(4.5, 4.5, 46, 7), M.wood); lg.rotation.z = Math.PI / 2 - 0.35; lg.rotation.y = i * 2.1; lg.position.y = 8; grp.add(lg); }
    const ember = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xff5a1a, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false })); ember.scale.set(50, 50, 1); ember.position.y = 6; grp.add(ember);
    flame(V(c.x, 6, c.z), 22, 1.9); colliders.push({ x: c.x, z: c.z, r: 34 }); }

  // ── 들어온 게이트(파란 고리, 카메라 쪽) ──
  { const c = pol(R - 70, CAM_T), grp = new T.Group(); grp.position.copy(c); grp.lookAt(0, 0, 0);
    const ring = new T.Mesh(new T.TorusGeometry(78, 5, 10, 48), new T.MeshBasicMaterial({ color: 0x6cc8ff })); ring.position.y = 88; grp.add(ring);
    const disc = new T.Mesh(new T.CircleGeometry(76, 48), new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float t; varying vec2 vU; void main(){ vec2 p = vU * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x); float sw = sin(a * 3.0 + r * 9.0 - t * 2.2) * 0.5 + 0.5; float k = (1.0 - smoothstep(0.55, 1.0, r)) * (0.35 + 0.65 * sw) + smoothstep(0.85, 1.0, r) * (1.0 - smoothstep(1.0, 1.02, r)) * 0.8; gl_FragColor = vec4(vec3(0.25, 0.62, 1.0) * k * 0.9, 1.0); }' }));
    disc.position.y = 88; grp.add(disc); const gl = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0x3a9cff, transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false })); gl.scale.set(300, 300, 1); gl.position.y = 88; grp.add(gl);
    upd.push(t => { disc.material.uniforms.t.value = t; ring.rotation.z = t * 0.2; }); root.add(grp); colliders.push({ x: c.x, z: c.z, r: 50 }); }

  // ── Tripo 소품(줄여서 질감 옮겨 그린 모델): 헌터 유골 · 고블린 문(나가는 길) · 토템 · 약탈품 더미 ──
  //    pol(r, t) 자리에 앞(+z)이 공동 가운데를 보게 세운다. 얇은 천은 양면으로
  async function prop(name, r, t, s, colR, turn = 0) { const b64 = window[name.toUpperCase() + '_GLB']; if (!b64 || !opt.loadTex) return null;
    const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const [gl, bm, nm] = await Promise.all([new Promise((res, rej) => new T.GLTFLoader().parse(u8.buffer, '', res, rej)), opt.loadTex(name + '_base.webp'), opt.loadTex(name + '_nrm.webp')]);
    bm.flipY = false; bm.encoding = T.sRGBEncoding; bm.anisotropy = 4; nm.flipY = false;
    const mat = new T.MeshStandardMaterial({ map: bm, normalMap: nm, normalMapType: T.ObjectSpaceNormalMap, roughness: 0.85, metalness: 0, side: T.DoubleSide });
    const g = gl.scene; g.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = true; } });
    const c = pol(r, t); g.scale.setScalar(s); g.position.copy(c); g.rotation.y = t + Math.PI + turn; root.add(g); if (colR) colliders.push({ x: c.x, z: c.z, r: colR }); return g; }
  await Promise.all([
    prop('hunter', R - 120, HUNTER_T, 92, 52),
    prop('gate', R * Math.cos(GAP) - 12, EXIT_T, 262, 0),          // 나가는 길 입구를 가로질러(폭 ≈ 통로 폭)
    prop('totem', 430, 262 * DEG, 155, 22, -0.25),                 // 고블린 진지 표시(모닥불 옆)
    prop('loot', 455, 290 * DEG, 130, 55, 0.3) ]);                  // 진지 안쪽 마석 옆 약탈품 더미

  return { R, RC, colliders, root, update: t => { for (const f of upd) f(t); } };
};
