// 렌더러 · 장면 · 카메라 · 빛 · 그림자 범위
import { T, V } from './math.js';
import { CONFIG } from '../config.js';

// 색보정(방 데이터 lighting.grade): ACES 뒤에 채도 낮추기 + 어두운 곳은 차갑게·밝은 곳은 따뜻하게 + 대비 조금 — three 의 CustomToneMapping 자리에 넣는다
T.ShaderChunk.tonemapping_pars_fragment = T.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }', `vec3 CustomToneMapping( vec3 color ) {
  vec3 c = ACESFilmicToneMapping( color ); float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( vec3( l ), c, 0.74 );
  c *= mix( vec3( 0.84, 0.95, 1.16 ), vec3( 1.07, 1.0, 0.88 ), smoothstep( 0.0, 0.16, l ) );
  return saturate( pow( c, vec3( 1.08 ) ) ); }`);

export function createRenderer(canvas) {
  const TOUCH = matchMedia('(pointer: coarse)').matches, Q = TOUCH ? CONFIG.quality.touch : CONFIG.quality.desktop;
  const rd = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
  rd.setPixelRatio(Math.min(Q.maxDpr, window.devicePixelRatio || 1)); rd.outputEncoding = T.sRGBEncoding;
  rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = CONFIG.exposure ?? 1.0;   // 전체 밝기
  rd.shadowMap.enabled = true; rd.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color('#06080b'); scene.fog = new T.Fog('#07090c', 300, 800);
  const cam = new T.PerspectiveCamera(CONFIG.camera.fov, 1, 2, 3000); cam.position.set(0, 60, 235);
  const camTarget = V(0, 55, 0);   // 카메라가 보는 점(주인공을 따라감)

  // 던전은 어둡게: 전체를 비추는 빛은 약하게 두고, 주인공 머리 위 따뜻한 불빛(HL)과 횃불·모닥불이 밝은 자리를 만든다
  const hemi = new T.HemisphereLight(0x8a9ab2, 0x241d18, 0.1); scene.add(hemi);
  const HLC = CONFIG.headLight, HL = new T.PointLight(0xffc890, HLC.i, HLC.dist, 2); HL.position.set(0, HLC.y, 0); scene.add(HL);
  const key = new T.DirectionalLight(0xffe2c4, 0.4); key.position.set(-120, 260, 190); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -110, right: 110, top: 150, bottom: -40, near: 50, far: 700 }); key.shadow.mapSize.set(Q.shadowMap, Q.shadowMap); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  scene.add(key); scene.add(key.target); const KEY_OFF = key.position.clone();
  const rim = new T.DirectionalLight(0x8fb0d8, 0.25); rim.position.set(170, 130, -210); scene.add(rim);
  // 캐릭터·배경이 같은 동굴 주변광을 같은 세기로 받는다(어두운 돌빛 + 횃불 쪽 주황, 마석 쪽 파랑)
  scene.environment = caveEnv(rd); const ENV_K = 0.3;

  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; rd.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); resize();

  // 주인공을 따라가는 빛: 그림자 빛(key)과 머리 위 불빛(HL)
  function follow(p) { key.position.copy(p).add(KEY_OFF); key.target.position.copy(p); HL.position.set(p.x, headY + (p.y || 0), p.z); }

  // 그림자 범위: 주인공과 화면에 보이는 바닥 전체(+ 가까운 적)를 감싸도록 매 프레임 맞춘다. 그림자가 떨어지는 바닥까지 깊이를 넉넉히
  const SH_NDC = [[-1.05, -1.05], [1.05, -1.05], [1.05, 1.05], [-1.05, 1.05], [0, 0]], SH_RV = V(), SH_RO = V(), SH_FAR = 720;   // SH_FAR: 카메라가 보는 점에서 이만큼까지만(화면에 실제로 밝게 보이는 곳)
  const SHC = key.shadow.camera, LM = new T.Matrix4(), LX = V(), LY = V(), LZ = V(), UPY = V(0, 1, 0), LQp = V();
  function fitShadow(heroPos, enemyPos) { const e = key.position; LM.lookAt(e, key.target.position, UPY); LM.extractBasis(LX, LY, LZ);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    const box = (c, r, h) => { for (const dx of [-r, r]) for (const dz of [-r, r]) for (const y of [0, h]) { LQp.set(c.x + dx, y, c.z + dz).sub(e); const x = LQp.dot(LX), yy = LQp.dot(LY), d = -LQp.dot(LZ);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); d0 = Math.min(d0, d); d1 = Math.max(d1, d); } };
    box(heroPos, 110, 200);
    for (const [nx, ny] of SH_NDC) { SH_RV.set(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize(); const t = SH_RV.y < -0.05 ? Math.min(1600, -cam.position.y / SH_RV.y) : 1600; SH_RO.copy(cam.position).addScaledVector(SH_RV, t);
      SH_RO.y = 0; SH_RV.copy(SH_RO).sub(camTarget).setY(0); const dl = SH_RV.length(); if (dl > SH_FAR) SH_RO.copy(camTarget).setY(0).addScaledVector(SH_RV, SH_FAR / dl); box(SH_RO, 60, 300); }   // 너무 먼 바닥(어둠)까지는 안 잡는다
    if (enemyPos && enemyPos.distanceTo(heroPos) < 1500) box(enemyPos, 95, 160);
    Object.assign(SHC, { left: x0, right: x1, bottom: y0, top: y1, near: Math.max(1, d0 - 40), far: d1 + 320 }); SHC.updateProjectionMatrix(); }

  // 안개: 카메라 거리에 맞춰 멀리 있는 것만 흐리게
  function fogFit() { const dd = cam.position.distanceTo(camTarget); scene.fog.near = dd + CONFIG.fog.near; scene.fog.far = dd + CONFIG.fog.far; }

  // 방마다 빛 세기(방 데이터 lighting). 빛 개수는 그대로 두고 세기만 바꾼다(셰이더 다시 안 만들게)
  //   headDist·headY: 머리 위 불빛 범위·높이 · headColor·keyColor: 빛 색 · exposure: 노출 · grade: 색보정 · vignette: 화면 가장자리 어둡게(0~1)
  const LIGHT0 = { hemi: 0.1, key: 0.4, rim: 0.25, head: HLC.i, headDist: HLC.dist, headY: HLC.y, headColor: 0xffc890, keyColor: 0xffe2c4, exposure: CONFIG.exposure ?? 1, grade: false, vignette: 0 };
  let headY = HLC.y, vig = null;
  function setLighting(l = {}) { const o = { ...LIGHT0, ...l }; hemi.intensity = o.hemi; key.intensity = o.key; rim.intensity = o.rim; HL.intensity = o.head;
    HL.distance = o.headDist; headY = o.headY; HL.color.set(o.headColor); key.color.set(o.keyColor); rd.toneMappingExposure = o.exposure;
    const tm = o.grade ? T.CustomToneMapping : T.ACESFilmicToneMapping; if (rd.toneMapping !== tm) { rd.toneMapping = tm; scene.traverse(x => { if (x.material) for (const m of [].concat(x.material)) m.needsUpdate = true; }); }   // 셰이더 다시
    if (o.vignette && !vig) { vig = document.createElement('div'); vig.id = 'vignette'; Object.assign(vig.style, { position: 'absolute', inset: '0', pointerEvents: 'none' }); canvas.parentNode.appendChild(vig); }
    if (vig) { vig.style.background = `radial-gradient(ellipse 75% 70% at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,${(o.vignette * 0.75).toFixed(2)}) 100%)`; vig.style.display = o.vignette ? 'block' : 'none'; } }
  return { rd, scene, cam, camTarget, TOUCH, ENV_K, lights: { hemi, key, HL, rim }, setLighting, follow, fitShadow, fogFit, resize };
}

function caveEnv(rd) { const es = new T.Scene(), sg = new T.SphereGeometry(100, 32, 16), cols = [], pa = sg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 100, c = y > 0 ? new T.Color('#403c38').lerp(new T.Color('#50525a'), y) : new T.Color('#403428').lerp(new T.Color('#18130e'), -y); cols.push(c.r, c.g, c.b); }
  sg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); es.add(new T.Mesh(sg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  for (const [x, y, z, w, col] of [[-70, 25, -40, 24, '#c88250'], [60, 20, 50, 16, '#c0703a'], [40, 30, -60, 20, '#4f86c0']]) { const pl = new T.Mesh(new T.PlaneGeometry(w, w), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide })); pl.position.set(x, y, z); pl.lookAt(0, 0, 0); es.add(pl); }
  const pm = new T.PMREMGenerator(rd), tex = pm.fromScene(es, 0.04).texture; pm.dispose(); sg.dispose(); return tex; }
