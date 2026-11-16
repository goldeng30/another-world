// 이세계: 도윤 보기 — Mixamo 뼈대를 직접 움직이는 동작 장치 + 버튼 + 카메라
(async function () {
  const T = THREE, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z), DEG = Math.PI / 180, PIPE_Y_DEF = 4.5;
  const $ = s => document.querySelector(s);
  const cv = $('#view');
  const rd = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: false });
  const TOUCH = matchMedia('(pointer: coarse)').matches; rd.setPixelRatio(Math.min(TOUCH ? 1.5 : 2, window.devicePixelRatio || 1)); rd.outputEncoding = T.sRGBEncoding;
  rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = 1.0;
  rd.shadowMap.enabled = true; rd.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color('#0d1015'); scene.fog = new T.Fog('#0d1015', 300, 800);
  const cam = new T.PerspectiveCamera(30, 1, 2, 3000);
  const DUN = !!window.MAKE_DUNGEON; if (DUN) { scene.background.set('#06080b'); scene.fog.color.set('#07090c'); }
  // 던전은 어둡게: 전체를 비추는 빛은 약하게 두고, 주인공 머리 위 따뜻한 불빛(HL)과 횃불·모닥불이 밝은 자리를 만든다
  scene.add(new T.HemisphereLight(DUN ? 0x8a9ab2 : 0xbfcbdc, DUN ? 0x241d18 : 0x2a2622, DUN ? 0.1 : 0.55));
  const key = new T.DirectionalLight(DUN ? 0xffe2c4 : 0xfff1e2, DUN ? 0.4 : 1.5); key.position.set(-120, 260, 190); key.castShadow = true;
  const HL = DUN ? new T.PointLight(0xffc890, 1.5, 460, 2) : null; if (HL) { HL.position.set(0, 160, 0); scene.add(HL); }
  Object.assign(key.shadow.camera, { left: -110, right: 110, top: 150, bottom: -40, near: 50, far: 700 }); key.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  scene.add(key); scene.add(key.target); const KEY_OFF = key.position.clone();
  const rim = new T.DirectionalLight(DUN ? 0x8fb0d8 : 0x6fb4ff, DUN ? 0.25 : 0.85); rim.position.set(170, 130, -210); scene.add(rim);
  const fill = new T.DirectionalLight(0xffffff, DUN ? 0.05 : 0.25); fill.position.set(160, 60, 140); scene.add(fill);
  // 던전: 캐릭터·배경이 같은 동굴 주변광을 같은 세기로 받는다(어두운 돌빛 + 횃불 쪽 주황, 마석 쪽 파랑)
  const caveEnv = () => { const es = new T.Scene(), sg = new T.SphereGeometry(100, 32, 16), cols = [], pa = sg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 100, c = y > 0 ? new T.Color('#403c38').lerp(new T.Color('#50525a'), y) : new T.Color('#403428').lerp(new T.Color('#18130e'), -y); cols.push(c.r, c.g, c.b); }
    sg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); es.add(new T.Mesh(sg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    for (const [x, y, z, w, col] of [[-70, 25, -40, 24, '#c88250'], [60, 20, 50, 16, '#c0703a'], [40, 30, -60, 20, '#4f86c0']]) { const pl = new T.Mesh(new T.PlaneGeometry(w, w), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide })); pl.position.set(x, y, z); pl.lookAt(0, 0, 0); es.add(pl); }
    return new T.PMREMGenerator(rd).fromScene(es, 0.04).texture; };
  scene.environment = DUN ? caveEnv() : MAKE_ENV(rd); const ENV_K = DUN ? 0.3 : null;   // 던전에서는 모든 재질 주변광 세기를 같게(어둡게) 통일
  // 바닥: 가운데만 밝고 가장자리는 배경으로 사라지는 원 + 옅은 게이트 고리(던전이 없을 때만)
  if (!DUN) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256); gr.addColorStop(0, '#2a313b'); gr.addColorStop(0.55, '#1c222a'); gr.addColorStop(1, 'rgba(23,28,35,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(79,176,255,0.22)'; g.lineWidth = 2; g.beginPath(); g.arc(256, 256, 118, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(79,176,255,0.08)'; g.lineWidth = 1; g.beginPath(); g.arc(256, 256, 126, 0, Math.PI * 2); g.stroke();
    const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding;
    const floor = new T.Mesh(new T.CircleGeometry(300, 72), new T.MeshStandardMaterial({ map: tx, transparent: true, roughness: 1, metalness: 0, envMapIntensity: 0.15, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.renderOrder = 1; scene.add(floor);
    // 넓은 바닥: 옅은 돌판 줄눈 (움직임이 보이게), 멀리는 안개로 사라짐
    const c2 = document.createElement('canvas'); c2.width = c2.height = 256; const g2 = c2.getContext('2d'); g2.fillStyle = '#171c23'; g2.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const v = 18 + Math.random() * 10; g2.fillStyle = `rgba(${v + 10},${v + 14},${v + 20},0.25)`; g2.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    g2.strokeStyle = 'rgba(120,150,185,0.10)'; g2.lineWidth = 2; for (const q of [1, 128]) { g2.beginPath(); g2.moveTo(q, 0); g2.lineTo(q, 256); g2.moveTo(0, q); g2.lineTo(256, q); g2.stroke(); }
    const tx2 = new T.CanvasTexture(c2); tx2.encoding = T.sRGBEncoding; tx2.wrapS = tx2.wrapT = T.RepeatWrapping; tx2.repeat.set(6000 / 120, 6000 / 120); tx2.anisotropy = 8;
    const ground = new T.Mesh(new T.PlaneGeometry(6000, 6000), new T.MeshStandardMaterial({ map: tx2, roughness: 1, metalness: 0, envMapIntensity: 0.1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  }
  const controls = new T.OrbitControls(cam, cv); controls.enabled = false;
  controls.minDistance = 22; controls.maxDistance = 650; controls.maxPolarAngle = Math.PI * 0.53; controls.target.set(0, 55, 0);
  cam.position.set(0, 60, 235);
  function resize() { const w = cv.clientWidth, h = cv.clientHeight; rd.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(cv); resize();

  // ── 모델 불러오기 ──
  const tl = new T.TextureLoader(), loadTex = u => new Promise((res, rej) => tl.load(u, res, undefined, rej));
  const DG = DUN ? await MAKE_DUNGEON(T, scene, { loadTex }) : null;   // F급 던전 첫 구역 배경
  if (DG) DG.root.traverse(o => { if (o.material) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) m.envMapIntensity = ENV_K; });
  const [gltf, baseTex, nrmTex, eyeTex] = await Promise.all([new Promise((res, rej) => { const bin = atob(window.DOYUN_GLB), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); new T.GLTFLoader().parse(u8.buffer, '', res, rej); }), loadTex('doyun_base.webp'), loadTex('doyun_nrm.webp'), loadTex('doyun_eyes.webp')]);
  baseTex.encoding = T.sRGBEncoding; baseTex.anisotropy = 8; eyeTex.encoding = T.sRGBEncoding; eyeTex.anisotropy = 8; eyeTex.wrapS = eyeTex.wrapT = T.ClampToEdgeWrapping;
  const root = gltf.scene; scene.add(root);
  let sm = null; root.traverse(o => { if (o.isSkinnedMesh && !sm) sm = o; });
  sm.material = new T.MeshStandardMaterial({ map: baseTex, normalMap: nrmTex, roughness: 0.88, metalness: 0.0, envMapIntensity: ENV_K || 0.55, skinning: true });
  // 눈: 얼굴 면(_eyew)에만 정면 투영으로 선명한 눈 그림을 얹고, 눈 뜬 자리는 반짝이게 (쉬는 자세 기준 좌표라 동작해도 따라감)
  const EYE = { SX: -0.064805, HY: 91.273994, CXR: -1.79, CXL: 1.51, CY: -1.47, XI: -0.72, YI: -0.18, XO: 1.0, YO: 0.13, UP: 0.28, LO: 0.27, PU: 0.8, MX: 0.0, MY: -4.45 };
  if (sm.geometry.attributes._eyew) sm.material.onBeforeCompile = sh => {
    sh.uniforms.eyeMap = { value: eyeTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float _eyew; varying float vEyeW; varying vec2 vFace;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n  vEyeW = _eyew; { vec4 bp = bindMatrix * vec4(position, 1.0); vFace = vec2(bp.x - (${EYE.SX.toFixed(6)}), bp.z - (${EYE.HY.toFixed(6)})); }`);
    const F = x => x.toFixed(4);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D eyeMap; varying float vEyeW; varying vec2 vFace; float eyeA = 0.0, eyeG = 0.0;
float eyeIn(vec2 q) { float t = (q.x - (${F(EYE.XI)})) / (${F(EYE.XO - EYE.XI)}); if (t <= 0.0 || t >= 1.0) return 0.0; float base = ${F(EYE.YI)} + ${F(EYE.YO - EYE.YI)} * t, sn = max(0.0, sin(3.14159265 * t));
  float yu = base + ${F(EYE.UP)} * pow(sn, ${F(EYE.PU)}), yl = base - ${F(EYE.LO)} * sn; return smoothstep(0.0, 0.03, min(yu - q.y, q.y - yl)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  { float side = vFace.x < ${F((EYE.CXR + EYE.CXL) / 2)} ? -1.0 : 1.0; vec2 q = vec2(side * (vFace.x - (side < 0.0 ? ${F(EYE.CXR)} : ${F(EYE.CXL)})), vFace.y - (${F(EYE.CY)}));
    vec2 euv = vec2(clamp((q.x + 1.1) / 2.6, 0.0, 1.0) * 0.5 + (side < 0.0 ? 0.0 : 0.5), 0.5 + 0.5 * clamp((q.y + 1.3) / 2.6, 0.0, 1.0));
    vec4 et = mapTexelToLinear(texture2D(eyeMap, euv)); float inb = step(-1.1, q.x) * step(q.x, 1.5) * step(-1.3, q.y) * step(q.y, 1.3) * vEyeW;
    eyeA = et.a * inb; diffuseColor.rgb = mix(diffuseColor.rgb, et.rgb, eyeA); eyeG = eyeIn(q) * inb;
    vec2 m = vec2(vFace.x - (${F(EYE.MX)}), vFace.y - (${F(EYE.MY)})); vec2 muv = vec2(clamp((m.x + 1.6) / 3.2, 0.0, 1.0), 0.5 * clamp((m.y + 0.8) / 1.6, 0.0, 1.0));
    vec4 mt = mapTexelToLinear(texture2D(eyeMap, muv)); float inm = step(-1.6, m.x) * step(m.x, 1.6) * step(-0.8, m.y) * step(m.y, 0.8) * vEyeW; diffuseColor.rgb = mix(diffuseColor.rgb, mt.rgb, mt.a * inm); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.2, eyeG);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(mix(normal, geometryNormal, max(eyeA, eyeG)));');
  };
  sm.frustumCulled = false; sm.castShadow = true; sm.receiveShadow = true;
  const isRig = o => /^mixamorig/.test(o.name), B = {}; root.traverse(o => { if (isRig(o)) B[o.name.replace(/^mixamorig:?/, '')] = o; });   // 끝마디(…4, _End)는 Bone이 아닌 빈 노드로 온다
  const hips = B.Hips;

  // ── 쉬는 자세(바인드) 정보: 바인드 공간은 z가 위 → 화면 공간(y 위, +z 앞, +x 캐릭터 왼쪽)으로 돌린다 ──
  sm.skeleton.pose(); root.updateMatrixWorld(true);
  const Rz2y = new T.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2);
  const skIdx = new Map(sm.skeleton.bones.map((b, i) => [b, i]));
  const WB = new Map(), PB = new Map();
  { const m = new T.Matrix4().copy(sm.skeleton.boneInverses[skIdx.get(hips)]).invert(), p = V(), q = new T.Quaternion(), s = V(); m.decompose(p, q, s); WB.set(hips, q); PB.set(hips, p); }
  const order = []; hips.traverse(b => { if (isRig(b)) order.push(b); });
  for (const b of order) if (b !== hips) { const pq = WB.get(b.parent); WB.set(b, pq.clone().multiply(b.quaternion)); PB.set(b, b.position.clone().applyQuaternion(pq).add(PB.get(b.parent))); }
  // 발바닥을 바닥(y=0)에, 엉덩이를 가운데로
  const bindBox = new T.Box3().setFromBufferAttribute(sm.geometry.attributes.position).applyMatrix4(sm.bindMatrix);
  let minY = Infinity; { const pa = sm.geometry.attributes.position, v = V(); for (let i = 0; i < pa.count; i += 3) { v.fromBufferAttribute(pa, i).applyMatrix4(sm.bindMatrix).applyQuaternion(Rz2y); if (v.y < minY) minY = v.y; } }
  const hp0 = PB.get(hips).clone().applyQuaternion(Rz2y), OFF = V(-hp0.x, -minY, -hp0.z);
  const W0 = new Map(), P0 = new Map(), LP = new Map();
  for (const b of order) { W0.set(b, Rz2y.clone().multiply(WB.get(b))); P0.set(b, PB.get(b).clone().applyQuaternion(Rz2y).add(OFF)); }
  for (const b of order) if (b !== hips) LP.set(b, W0.get(b.parent).clone().invert());
  root.updateMatrixWorld(true);
  const hipsParentInv = new T.Matrix4().copy(hips.parent.matrixWorld).invert(), hipsParentQInv = new T.Quaternion(); { const p = V(), s = V(); hipsParentInv.decompose(p, hipsParentQInv, s); }

  // ── 관절마다 이름 붙인 회전축 (화면 공간, 쉬는 자세 기준) ──
  const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
  const dir = (a, b) => P0.get(B[b]).clone().sub(P0.get(B[a])).normalize();
  const perpUp = (a, up) => up.clone().addScaledVector(a, -a.dot(up)).normalize();
  const cr = (a, b) => V().crossVectors(a, b).normalize();
  const AX = {};   // boneName → [[param, axis], …] 적용 순서: 앞의 것이 바깥(마지막에 적용)
  for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']) AX[n] = [['turn', Y], ['lean', Z], ['fwd', X]];
  for (const [s, sg] of [['Left', 1], ['Right', -1]]) {
    const lat = V(sg, 0, 0);
    const c = dir(s + 'Shoulder', s + 'Arm'); AX[s + 'Shoulder'] = [['up', cr(c, Y)], ['fwd', cr(c, Z)]];
    const a = dir(s + 'Arm', s + 'ForeArm'); AX[s + 'Arm'] = [['fwd', cr(a, Z)], ['out', cr(a, perpUp(a, Y))], ['tw', a.clone().multiplyScalar(sg)]];
    const f = dir(s + 'ForeArm', s + 'Hand'); AX[s + 'ForeArm'] = [['bend', cr(f, Z)], ['tw', f.clone().multiplyScalar(sg)]];
    const h = dir(s + 'Hand', s + 'HandMiddle1'); AX[s + 'Hand'] = [['bend', cr(h, Z)], ['side', cr(h, lat)]];
    const t = dir(s + 'UpLeg', s + 'Leg'); AX[s + 'UpLeg'] = [['fwd', cr(t, Z)], ['out', cr(t, lat)], ['tw', t]];
    const k = dir(s + 'Leg', s + 'Foot'); AX[s + 'Leg'] = [['bend', cr(k, Z.clone().negate())]];
    const fd = dir(s + 'Foot', s + 'ToeBase'); AX[s + 'Foot'] = [['up', cr(fd, Y)], ['yaw', Y]];
    for (const fg of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let j = 1; j <= 3; j++) { const d = dir(s + 'Hand' + fg + j, s + 'Hand' + fg + (j + 1)); AX[s + 'Hand' + fg + j] = [['c', cr(d, Z)]]; }
  }
  const LEN = { thigh: P0.get(B.LeftLeg).distanceTo(P0.get(B.LeftUpLeg)), shin: P0.get(B.LeftFoot).distanceTo(P0.get(B.LeftLeg)) };

  // ── 자세 풀기: 값(도) → 관절 회전 D(화면 공간 축) → 뼈 로컬 회전 ──
  const qa = new T.Quaternion();
  function dOf(name, prm) { const ax = AX[name], q = new T.Quaternion(); if (!ax || !prm) return q; for (const [k, a] of ax) { const v = prm[k]; if (v) { qa.setFromAxisAngle(a, v * DEG); q.multiply(qa); } } return q; }
  function frameRot(a1, b1, a2, b2) {   // (a1,b1) 틀을 (a2,b2) 틀로 보내는 회전
    const m1 = new T.Matrix4().makeBasis(a1, b1, V().crossVectors(a1, b1)), m2 = new T.Matrix4().makeBasis(a2, b2, V().crossVectors(a2, b2));
    return new T.Quaternion().setFromRotationMatrix(m2.multiply(m1.transpose()));
  }
  // 다리 IK: 발목 목표 → 허벅지·정강이 회전(G: 쉬는 자세 대비 세계 회전)
  function legIK(s, G_h, hipPos, ankle, footYaw, kneeOut) {
    const U = P0.get(B[s + 'UpLeg']).clone().sub(P0.get(hips)).applyQuaternion(G_h).add(hipPos);
    const L1 = LEN.thigh, L2 = LEN.shin; const v = ankle.clone().sub(U); let d = v.length(); const vd = v.clone().normalize(); d = Math.min(d, (L1 + L2) * 0.9995);
    const sg = s === 'Left' ? 1 : -1, pole = V(Math.sin(footYaw * DEG) + sg * (kneeOut || 0.08), 0, Math.cos(footYaw * DEG));
    const perp = pole.clone().addScaledVector(vd, -vd.dot(pole)).normalize();
    const ca = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))), sa = Math.sqrt(1 - ca * ca);
    const K = U.clone().addScaledVector(vd, L1 * ca).addScaledVector(perp, L1 * sa), A = U.clone().addScaledVector(vd, d);
    const t1 = K.clone().sub(U).normalize(), s1 = A.clone().sub(K).normalize(), hinge = V().crossVectors(perp, vd).normalize();
    const t0 = dir(s + 'UpLeg', s + 'Leg'), s0 = dir(s + 'Leg', s + 'Foot');
    const h0t = X.clone().addScaledVector(t0, -t0.dot(X)).normalize(), h0s = X.clone().addScaledVector(s0, -s0.dot(X)).normalize();
    // hinge 방향: 무릎이 앞으로 굽는 쪽이 +X 와 같은 뜻이 되게
    return { Gt: frameRot(t0, h0t, t1, hinge), Gs: frameRot(s0, h0s, s1, hinge) };
  }
  // 자세 하나 = { bones: {이름: {축: 도}}, hip: [x,y,z], lf/rf: [x,y,z] 발목 이동, lfy/rfy: 발 방향(도), lft/rft: 발끝 들기, rg/lg: 손 쥐기(0~1), ... }
  const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
  function solve(pose) {
    if (window.__setGrip) window.__setGrip(pose.wy || PIPE_Y_DEF);
    const D = new Map(), get = n => pose.bones[n];
    for (const n in AX) if (!/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(n) && !/UpLeg$|Leg$|Foot$/.test(n)) D.set(B[n], dOf(n, get(n)));
    // 손가락 쥐기
    for (const [s, gk, tk] of [['Left', 'lg', 'lt'], ['Right', 'rg', 'rt']]) {
      const g = pose[gk] || 0, th = pose[tk] != null ? pose[tk] : g * 0.7;
      for (const fg of FINGERS) [62, 72, 50].forEach((a, j) => { qa.setFromAxisAngle(AX[s + 'Hand' + fg + (j + 1)][0][1], a * g * DEG); D.set(B[s + 'Hand' + fg + (j + 1)], qa.clone()); });
      [14, 34, 40].forEach((a, j) => { qa.setFromAxisAngle(AX[s + 'HandThumb' + (j + 1)][0][1], a * th * DEG); D.set(B[s + 'HandThumb' + (j + 1)], qa.clone()); });
    }
    // 다리: 엉덩이 회전 + 발목 목표로 IK
    const Dh = D.get(hips), hipPos = P0.get(hips).clone().add(V(...(pose.hip || [0, 0, 0])));
    for (const [s, fk, yk, tk] of [['Left', 'lf', 'lfy', 'lft'], ['Right', 'rf', 'rfy', 'rft']]) {
      const ank = P0.get(B[s + 'Foot']).clone().add(V(...(pose[fk] || [0, 0, 0]))), yaw = pose[yk] || 0;
      const { Gt, Gs } = legIK(s, Dh, hipPos, ank, yaw, pose.kneeOut);
      D.set(B[s + 'UpLeg'], Dh.clone().invert().multiply(Gt)); D.set(B[s + 'Leg'], Gt.clone().invert().multiply(Gs));
      const Gf = new T.Quaternion().setFromAxisAngle(Y, yaw * DEG); qa.setFromAxisAngle(cr(dir(s + 'Foot', s + 'ToeBase'), Y), (pose[tk] || 0) * DEG); Gf.multiply(qa);
      D.set(B[s + 'Foot'], Gs.clone().invert().multiply(Gf));
    }
    // 뼈 로컬 회전
    const out = new Map();
    for (const b of order) { const d = D.get(b);
      if (b === hips) { out.set(b, hipsParentQInv.clone().multiply(d).multiply(W0.get(b))); continue; }
      const q = LP.get(b).clone(); if (d) q.multiply(d); q.multiply(W0.get(b)); out.set(b, q); }
    const f = { q: out, hip: hipPos.applyMatrix4(hipsParentInv) };
    return f;
  }
  function applyFrame(f) { for (const [b, q] of f.q) b.quaternion.copy(q); hips.position.copy(f.hip); }


  // ── 쇠파이프: 쥔 손가락이 그리는 원의 가운데에 파이프 축을 맞춰 오른손에 붙인다 ──
  const GRIP = { rg: 0.95, rt: 0.8 }, PIPE_S = 0.58, PIPE_Y = 9.5;
  const pipe = await MAKE_PIPE(); pipe.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  {
    applyFrame(solve({ bones: {}, rg: GRIP.rg, rt: GRIP.rt })); root.updateMatrixWorld(true);
    const w = n => B[n].getWorldPosition(V()), M = [1, 2, 4].map(j => w('RightHandMiddle' + j));
    const ab = M[1].clone().sub(M[0]), ac = M[2].clone().sub(M[0]), nn = V().crossVectors(ab, ac);
    const ctr = M[0].clone().add(V().crossVectors(nn, ab).multiplyScalar(ac.lengthSq()).add(V().crossVectors(ac, nn).multiplyScalar(ab.lengthSq())).divideScalar(2 * nn.lengthSq()));
    let ax = nn.normalize(); if (ax.dot(w('RightHandIndex1').sub(w('RightHandPinky1'))) < 0) ax.negate();
    const e = M[0].clone().sub(ctr); e.addScaledVector(ax, -e.dot(ax)).normalize();
    const Mw = new T.Matrix4().makeBasis(e, ax, V().crossVectors(e, ax)).scale(V(PIPE_S, PIPE_S, PIPE_S)); Mw.setPosition(ctr.clone().addScaledVector(ax, -PIPE_Y * PIPE_S));
    B.RightHand.add(pipe); const Ml = new T.Matrix4().copy(B.RightHand.matrixWorld).invert().multiply(Mw); Ml.decompose(pipe.position, pipe.quaternion, pipe.scale);
  }
  const pipeBase = pipe.position.clone(), pipeBaseQ = pipe.quaternion.clone(), pipeAxisH = V(0, 1, 0).applyQuaternion(pipe.quaternion).multiplyScalar(pipe.scale.y);
  const setGrip = wy => { pipe.quaternion.copy(pipeBaseQ); pipe.position.copy(pipeBase).addScaledVector(pipeAxisH, PIPE_Y - wy); }; window.__setGrip = setGrip;

  // ── 받은 동작(Mixamo) 재생: 앞으로 나아가는 거리는 빼서 제자리에서 보이게 ──
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(a, b) { const o = { ...a }; for (const k in b) o[k] = isObj(b[k]) && isObj(a[k]) ? merge(a[k], b[k]) : b[k]; return o; }
  const EASE = { io: t => t * t * (3 - 2 * t) };
  const FING = /Hand(Thumb|Index|Middle|Ring|Pinky)/;
  function makeClip(src) {
    const c = T.AnimationClip.parse(src), tracks = [];
    for (const tr of c.tracks) { const [bn, prop] = tr.name.split('.'), nm = bn.replace(/^mixamorig:?/, ''), bo = B[nm]; if (!bo || FING.test(nm)) continue; tracks.push({ bo, nm, prop, it: tr.createInterpolant(), tr }); }
    const hp = tracks.find(k => k.bo === hips && k.prop === 'position'); let start = [0, 0], drift = [0, 0];
    if (hp) { const v = hp.tr.values, n = v.length / 3; start = [v[0], v[2]]; drift = [v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 2] - v[2]]; }
    return { dur: c.duration, tracks, start, drift, dy: 0 };
  }
  // f(손가락 쥐기 등 기본 자세 프레임)에 클립 회전을 덮어쓴다. only: 이 뼈만(이름 검사 함수)
  function clipInto(C, t, f, only) { const u = t / C.dur;
    for (const k of C.tracks) { if (only && !only(k.nm)) continue; const v = k.it.evaluate(t);
      if (k.prop === 'quaternion') { const q = f.q.get(k.bo); if (q) q.set(v[0], v[1], v[2], v[3]); }
      else if (k.prop === 'position' && k.bo === hips) f.hip.set(v[0] - C.start[0] - C.drift[0] * u, v[1] + C.dy, v[2] - C.start[1] - C.drift[1] * u); }
    return f; }
  const SRC = window.CLIPS || {}, CLIP = {};
  for (const n in SRC) CLIP[n] = makeClip(SRC[n]);
  if (gltf.animations[0]) CLIP.Dodging_Right = makeClip(T.AnimationClip.toJSON(gltf.animations[0]));
  const ARMS = n => /^(Left|Right)(Shoulder|Arm|ForeArm|Hand)$/.test(n);
  // 왼손 주먹(쥔 상태)의 원 중심을 손 뼈 기준으로 → 두 손으로 쥐는 동작에서 파이프가 두 주먹을 잇는 선을 지나게
  const LGC = (() => { applyFrame(solve({ bones: {}, lg: 0.92, lt: 0.8 })); root.updateMatrixWorld(true);
    const w = n => B[n].getWorldPosition(V()), M = [1, 2, 4].map(j => w('LeftHandMiddle' + j)), ab = M[1].clone().sub(M[0]), ac = M[2].clone().sub(M[0]), nn = V().crossVectors(ab, ac);
    const ctr = M[0].clone().add(V().crossVectors(nn, ab).multiplyScalar(ac.lengthSq()).add(V().crossVectors(ac, nn).multiplyScalar(ab.lengthSq())).divideScalar(2 * nn.lengthSq()));
    return B.LeftHand.worldToLocal(ctr); })();
  function aimPipe(wy) {
    root.updateMatrixWorld(true);
    const R = pipe.localToWorld(V(0, wy, 0)), L = B.LeftHand.localToWorld(LGC.clone()), o = pipe.localToWorld(V(0, 0, 0)), ax = pipe.localToWorld(V(0, 1, 0)).sub(o).normalize();
    const d = R.clone().sub(L); if (d.length() < 1e-3) return; d.normalize();
    const q = new T.Quaternion().setFromUnitVectors(ax, d), wq = pipe.getWorldQuaternion(new T.Quaternion()), ws = pipe.getWorldScale(V());
    const nq = q.clone().multiply(wq), no = o.clone().sub(R).applyQuaternion(q).add(R);
    const M = new T.Matrix4().compose(no, nq, ws), Ml = new T.Matrix4().copy(B.RightHand.matrixWorld).invert().multiply(M); Ml.decompose(pipe.position, pipe.quaternion, V());
    pipe.updateMatrixWorld(true);
  }
  // 파이프 자세: 보통은 두 주먹을 잇는 선(aimPipe). 동작에 hand 구간이 있으면 그동안 오른손 방향(칼이 손에 붙은 것처럼)으로 섞는다
  function posePipe(a, t) { if (!a.pipe) return; if (!a.two) { setGrip(a.wy); return; }
    const w = a.hand ? sstep(a.hand[0], a.hand[1], t) * (1 - sstep(a.hand[2], a.hand[3], t)) : 0; setGrip(a.wy);
    if (w >= 1) { pipe.updateMatrixWorld(true); return; }
    const qb = pipe.quaternion.clone(), pb = pipe.position.clone(); aimPipe(a.wy); if (w <= 0) return;
    const g = V(0, a.wy * pipe.scale.y, 0), Rl = pb.clone().add(g.clone().applyQuaternion(qb)), q = pipe.quaternion.clone().slerp(qb, w);
    pipe.quaternion.copy(q); pipe.position.copy(Rl).sub(g.applyQuaternion(q)); pipe.updateMatrixWorld(true); }
  // 동작 목록: 빈손은 손을 가볍게, 무기는 쇠파이프를 쥔다. 무기 들고 달리기 = 달리기의 몸·다리 + 대검 걷기의 팔(박자 맞춤)
  const ACTS = {
    wwalk: { label: '무기 들고 걷기', clip: 'Great_Sword_Walk', pipe: true, two: true, wy: 19, fwd: true },
    wrun: { label: '무기 들고 달리기', clip: 'Standard_Run', arms: 'Great_Sword_Walk', pipe: true, two: true, wy: 19, fwd: true },
    wback: { label: '뒤로 걷기', clip: 'Great_Sword_Walk', pipe: true, two: true, wy: 19, rev: true },          // 걷기를 거꾸로 재생
    wstrR: { label: '오른쪽 옆걸음', clip: 'Great_Sword_Strafe', pipe: true, two: true, wy: 19 },               // 받은 옆걸음은 오른쪽으로 간다
    wstrL: { label: '왼쪽 옆걸음', clip: 'Great_Sword_Strafe', pipe: true, two: true, wy: 19, rev: true },      // 거꾸로 재생하면 왼쪽
    widle: { label: '무기 들고 서기', clip: 'Great_Sword_Walk', pipe: true, two: true, wy: 19, idle: true },
    jump: { label: '점프', clip: 'Great_Sword_Jump', pipe: true, two: true, wy: 19, once: true, air: true, fade: 0.12, airT: [0.13, 0.64], airRate: 0.75, lift: 15 },   // 제자리·걷다가 점프: 조금 더 높고 길게
    rjump: { label: '달리며 점프', clip: 'Great_Sword_Jump_1', pipe: true, two: true, wy: 19, once: true, air: true, fade: 0.08, airT: [0.10, 0.56], airRate: 0.7, lift: 13, boost: 1.06 },   // 공중 구간만 천천히(체공 1.7배) + 더 높이 + 더 멀리
    slash: { label: '공격 1', clip: 'Great_Sword_Slash', pipe: true, two: true, wy: 19, once: true, fade: 0.1 },
    slash2: { label: '공격 2', clip: 'Great_Sword_Slash', pipe: true, two: true, wy: 19, once: true, fade: 0.12, mirror: true },   // 2번: 1번을 반대 방향(왼쪽 위 → 오른쪽 아래)으로, 손잡이·발·숙임은 그대로
    impact: { label: '맞음', clip: 'Great_Sword_Impact', pipe: true, two: false, wy: 19, once: true, fade: 0.08, cancel: 0.8 },   // cancel: 이때부터는 움직이면 끊는다
    slash3: { label: '공격 3', clip: 'Great_Sword_Slash_3', pipe: true, two: true, wy: 19, once: true, fade: 0.12, rm: true },   // rm: 동작이 앞으로 나가는 만큼 실제로 이동(발 안 미끄러지게)
  };
  // 공격(3단 콤보 1-2-3): win 파이프가 맞을 수 있는 구간 · T 내려치는(정면 지나는) 순간 · chain 다음 공격으로 넘어가는 때 · ideal 파이프 끝이 맞는 거리 · minR 붙을 수 있는 거리
  ACTS.slash.atk = { win: [0.55, 0.8], T: 0.69, chain: 0.84, ideal: 77 };
  ACTS.slash2.atk = { win: [0.55, 0.8], T: 0.69, chain: 0.84, idealK: -5 };   // 2번(새 동작): 머리 위로 들었다가 왼쪽→앞→오른쪽 수평으로. rate: 살짝 빠르게
  ACTS.slash3.atk = { win: [0.6, 0.88], T: 0.8, aimT: 0.76, chain: 1.22, minR: 45, final: true, rate: 1.15, idealK: -3, end: 1.42 };   // end: 마지막 공격은 여기서 기본 자세로 넘어간다(후딜 줄임)   // idealK: 파이프 끝 닿는 거리(reach)에서 뺄 값으로 ideal을 정한다   // final: 마지막 공격 — 끝까지 자세를 잡고 후딜(REC)까지   // aimT: 겨누는 기준 순간(휘두른 파이프가 고블린 높이를 지날 때)
  ACTS.slash.atk.fx = ACTS.slash2.atk.fx = { sparks: 9, flash: 34 }; ACTS.slash3.atk.fx = { sparks: 64, flash: 72, spd: 1.35, life: 1.3, hs: 0.12, shk: 11, vib: 45 };
  ACTS.slash.atk.kb = ACTS.slash2.atk.kb = 14; ACTS.slash3.atk.kb = 75;   // 넉백 거리: 1·2번 살짝, 3번은 더(3번 끝나고 거리가 맞게)   // 타격 불꽃: 1·2번은 적게, 마지막 3번은 크게
  const COMBO = ['slash', 'slash2', 'slash3'];   // 3단 콤보 1 → 2 → 3
  // 이음 표: [앞 공격에서 넘어가는 때 ta, 다음 공격을 시작하는 곳 tb, 섞는 시간]
  //  맞는 간격 = 1번만 연타할 때 간격(약 1.2초)과 같게, 마지막 3번만 조금 더 길게. 재생은 원래 빠르기 그대로, 다음 공격은 들어 올리는 동작부터 다 휘두른다.
  //  그 간격 안에서 두 공격 자세가 가장 비슷한 곳끼리 붙였다(앞 동작은 계속 움직이며 섞는다)
  const LINK = { slash: { slash2: [1.15, 0.13, 0.26, 0.04] },   // 1→2: 1번이 아직 움직일 때 넘어가 2번을 처음부터
    slash2: { slash3: [1.15, 0.13, 0.24, 0.05] }, slash3: {} };   // 2→3: 2번이 아직 움직일 때 넘어가고, 앞당긴 만큼 3번 들어 올리기를 늘린다(넷째 값)
  const REC = 0.12;   // 마지막 공격 뒤 자세 잡고 나서도 못 움직이는 시간(게임 속 초)
  const LATE = 0.24;
  const BUF_EARLY = 0.1;   // 1·2번: 맞기 이만큼 전부터 다음 공격 입력을 받는다   // 넘어가는 때를 이만큼 지나 누르면 다음 공격을 처음부터
  for (const k in LINK) { const v = Object.values(LINK[k]); if (v.length) ACTS[k].atk.chain = Math.min(...v.map(x => x[0])); }
  const LIVE_DUR = 10.2;
  for (const k in ACTS) { const a = ACTS[k]; a.C = CLIP[a.clip]; a.A = a.arms ? CLIP[a.arms] : null; a.dur = a.idle ? LIVE_DUR : a.C ? a.C.dur : 1; }
  const HAND = { on: { rg: 0.95, rt: 0.8, lg: 0.45, lt: 0.3 }, off: { rg: 0.35, rt: 0.25, lg: 0.35, lt: 0.25 } };
  const baseOf = a => solve({ bones: {}, ...(a.pipe ? HAND.on : HAND.off), ...(a.two ? { lg: 0.92, lt: 0.8 } : {}), wy: a.wy || PIPE_Y_DEF });
  // 무기 들고 서기 = 무기 들고 걷기에서 두 발이 다 닿은 순간(IDLE_T)을 멈춰 쓴다. 보폭만 조금 좁히고(다리를 쉬는 자세 쪽으로 IDLE_K만큼) 두 발 가운데를 제자리에, 발은 바닥에
  const IDLE_T = 0.37, IDLE_K = 0.4, LEGS = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase)$/; let IDLE_FIX = null;
  function idleFrame(a) { const f = baseOf(a), rest = baseOf(a); clipInto(a.C, IDLE_T, f);
    for (const [bo, q] of f.q) { const nm = bo.name.replace(/^mixamorig:?/, ''); if (LEGS.test(nm)) q.slerp(rest.q.get(bo), IDLE_K); }
    if (!IDLE_FIX) { applyFrame(f); root.updateMatrixWorld(true); const L = B.LeftFoot.getWorldPosition(V()).sub(root.position), R = B.RightFoot.getWorldPosition(V()).sub(root.position);
      IDLE_FIX = V(-(L.x + R.x) / 2, P0.get(B.LeftFoot).y - Math.min(L.y, R.y), -(L.z + R.z) / 2); }
    f.hip.add(IDLE_FIX); return f; }
  // 살아 있는 대기 동작 (10.2초 한 바퀴, 겹친 주기): 숨쉬기(3.4초) · 좌우 무게 옮기기(5.1초) · 무릎 들썩임(1.7초) · 주위 둘러보기 · 쇠파이프 고쳐 쥐기
  //   윗몸은 캐릭터 기준 축(+x 왼쪽, +y 위, +z 앞)으로 돌리고, 엉덩이를 움직인 뒤 다리는 IK로 다시 풀어 발은 바닥에 그대로
  const XC = V(1, 0, 0), YC = V(0, 1, 0), ZC = V(0, 0, 1), qT = new T.Quaternion(), qR = new T.Quaternion();
  const sstep = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const bump = (x, a, b, c, d) => sstep(a, b, x) * (1 - sstep(c, d, x));
  const lookYaw = x => 0.42 * bump(x, 1.6, 2.5, 4.0, 4.9) - 0.32 * bump(x, 5.4, 6.2, 7.2, 8.0);   // 왼쪽 보고 → 오른쪽 보고 → 앞
  let LIVE_BASE = null;
  function liveBase(f) { applyFrame(f); root.updateMatrixWorld(true); const rqi = root.getWorldQuaternion(new T.Quaternion()).invert(), o = { ank: {}, fq: {}, yaw: {} };
    for (const sd of ['Left', 'Right']) { const an = root.worldToLocal(B[sd + 'Foot'].getWorldPosition(V())), toe = root.worldToLocal(B[sd + 'ToeBase'].getWorldPosition(V()));
      o.ank[sd] = an; o.fq[sd] = rqi.clone().multiply(B[sd + 'Foot'].getWorldQuaternion(new T.Quaternion())); o.yaw[sd] = Math.atan2(toe.x - an.x, toe.z - an.z) / DEG; }
    return o; }
  function breathe(f, t) {
    if (!LIVE_BASE) LIVE_BASE = liveBase(f);
    const x = t % LIVE_DUR, br = (1 - Math.cos(2 * Math.PI * t / 3.4)) / 2, w = Math.sin(2 * Math.PI * t / 5.1), bob = (1 - Math.cos(2 * Math.PI * t / 1.7)) / 2, lk = lookYaw(x), hf = bump(x, 8.5, 8.95, 9.35, 9.95);
    // 엉덩이: 좌우 무게, 들썩임, 숨
    f.hip.x += 2.2 * w; f.hip.y += -0.8 * bob - 0.6 * Math.abs(w) + 0.35 * br - 0.8 * hf;
    const hq = f.q.get(hips); if (hq) { qR.setFromAxisAngle(ZC, 0.04 * w); hq.premultiply(qR); qR.setFromAxisAngle(YC, 0.05 * w + 0.12 * lk); hq.premultiply(qR); }
    // 윗몸
    const moves = [['Spine', XC, -0.02 * br], ['Spine1', XC, -0.035 * br - 0.03 * hf], ['Spine2', XC, -0.055 * br - 0.05 * hf], ['Neck', XC, 0.035 * br], ['Head', XC, 0.04 * br + 0.06 * hf],
      ['LeftShoulder', ZC, 0.1 * br + 0.06 * hf], ['RightShoulder', ZC, -0.1 * br - 0.06 * hf],
      ['Spine', ZC, -0.035 * w], ['Spine1', ZC, -0.025 * w], ['Head', ZC, 0.03 * w],
      ['Spine1', YC, 0.12 * lk], ['Spine2', YC, 0.15 * lk], ['Neck', YC, 0.3 * lk], ['Head', YC, 0.45 * lk],
      ['LeftArm', XC, -0.16 * hf], ['RightArm', XC, -0.16 * hf], ['LeftForeArm', XC, -0.07 * hf], ['RightForeArm', XC, -0.07 * hf]];
    applyFrame(f); root.updateMatrixWorld(true); const rq = root.getWorldQuaternion(new T.Quaternion()), pre = new Map();
    for (const [n] of moves) if (!pre.has(n)) pre.set(n, B[n].parent.getWorldQuaternion(new T.Quaternion()));
    for (const [n, ax, ang] of moves) { const q = f.q.get(B[n]); if (!q || !ang) continue; const pq = pre.get(n); qR.setFromAxisAngle(ax.clone().applyQuaternion(rq), ang); qT.copy(pq).invert().multiply(qR).multiply(pq); q.premultiply(qT); }
    // 다리 IK: 처음 자세의 발 위치·방향 그대로
    applyFrame(f); root.updateMatrixWorld(true); const rqi = rq.clone().invert(), Hq = rqi.clone().multiply(hips.getWorldQuaternion(new T.Quaternion())), Gh = Hq.clone().multiply(W0.get(hips).clone().invert()), hp = root.worldToLocal(hips.getWorldPosition(V()));
    for (const sd of ['Left', 'Right']) { const { Gt, Gs } = legIK(sd, Gh, hp, LIVE_BASE.ank[sd].clone(), LIVE_BASE.yaw[sd], 0.08);
      const upW = Gt.clone().multiply(W0.get(B[sd + 'UpLeg'])), lgW = Gs.clone().multiply(W0.get(B[sd + 'Leg']));
      f.q.get(B[sd + 'UpLeg']).copy(Hq.clone().invert().multiply(upW)); f.q.get(B[sd + 'Leg']).copy(upW.clone().invert().multiply(lgW)); f.q.get(B[sd + 'Foot']).copy(lgW.clone().invert().multiply(LIVE_BASE.fq[sd])); }
    return f; }
  // ── 반대 방향 내려치기(2번): 골반·다리·발은 1번 그대로, 골반 위(몸통·머리·어깨)만 골반 기준 좌우로 뒤집는다
  //    손잡이는 그대로(오른손 위): 뒤집힌 파이프 줄에 오른손 위·왼손 아래로 다시 쥐게 팔 IK ──
  const qMir = q => new T.Quaternion(q.x, -q.y, -q.z, q.w), vMir = v => V(-v.x, v.y, v.z);
  const bName = b => b.name.replace(/^mixamorig:?/, ''), twinOf = b => { const n = bName(b), m = /^Left/.test(n) ? n.replace(/^Left/, 'Right') : /^Right/.test(n) ? n.replace(/^Right/, 'Left') : n; return B[m] || b; };
  const ARM_L = { L1: P0.get(B.LeftForeArm).distanceTo(P0.get(B.LeftArm)), L2: P0.get(B.LeftHand).distanceTo(P0.get(B.LeftForeArm)) };
  function twistAbout(q, ax) { const p = q.x * ax.x + q.y * ax.y + q.z * ax.z, t = new T.Quaternion(ax.x * p, ax.y * p, ax.z * p, q.w); const l = Math.hypot(t.x, t.y, t.z, t.w); return l < 1e-8 ? new T.Quaternion() : t.set(t.x / l, t.y / l, t.z / l, t.w / l); }
  function mirrorFrame(a, t) {
    const f0 = baseOf(a); clipInto(a.C, t, f0); applyFrame(f0); aimPipe(a.wy); root.updateMatrixWorld(true);
    const rq = root.getWorldQuaternion(new T.Quaternion()), rqi = rq.clone().invert(), G = new Map(), Pos = b => root.worldToLocal(b.getWorldPosition(V()));
    for (const b of order) G.set(b, rqi.clone().multiply(b.getWorldQuaternion(new T.Quaternion())));
    const Ro = root.worldToLocal(pipe.localToWorld(V(0, a.wy, 0))), Lo = root.worldToLocal(B.LeftHand.localToWorld(LGC.clone())), HR = Pos(B.RightHand), HL = Pos(B.LeftHand), GR = G.get(B.RightHand).clone(), GL = G.get(B.LeftHand).clone();
    // 골반·다리·발은 1번 그대로(앞으로 숙이는 것·디딤 그대로), 골반 위(몸통·머리·어깨)만 골반 기준으로 좌우 뒤집기
    const hp0 = Pos(hips), Rh = G.get(hips).clone().multiply(W0.get(hips).clone().invert()), Rhi = Rh.clone().invert();
    const mirP = v => { const h = v.clone().sub(hp0).applyQuaternion(Rhi); h.x = -h.x; return h.applyQuaternion(Rh).add(hp0); };
    const mirD = d => Rh.clone().multiply(qMir(Rhi.clone().multiply(d)));   // 골반에 대한 상대 회전만 뒤집는다
    const G1 = new Map(), f1 = { q: new Map(f0.q), hip: f0.hip.clone() };
    for (const b of order) { const n = bName(b); if (b === hips || LEGS.test(n) || FING.test(n) || /^(Left|Right)(Arm|ForeArm|Hand)$/.test(n)) continue; const src = twinOf(b); G1.set(b, mirD(G.get(src).clone().multiply(W0.get(src).clone().invert())).multiply(W0.get(b))); }
    for (const b of order) { if (!G1.has(b)) continue; f1.q.set(b, (G1.get(b.parent) || G.get(b.parent)).clone().invert().multiply(G1.get(b))); }
    // 팔: 골반 기준으로 뒤집힌 파이프 줄에 오른손(위)·왼손(아래)
    applyFrame(f1); root.updateMatrixWorld(true);
    const Rm = mirP(Ro), Lm = mirP(Lo), po = Ro.clone().sub(Lo).normalize(), pm = Rm.clone().sub(Lm).normalize(), Rmin = new T.Quaternion().setFromUnitVectors(po, pm);
    const tgt = { Right: { grip: Rm, G: Rmin.clone().multiply(GR), off: Ro.clone().sub(HR).applyQuaternion(GR.clone().invert()) }, Left: { grip: Lm, G: Rmin.clone().multiply(GL), off: Lo.clone().sub(HL).applyQuaternion(GL.clone().invert()) } };
    for (const sd of ['Right', 'Left']) { const g = tgt[sd], W = g.grip.clone().sub(g.off.clone().applyQuaternion(g.G)), S = Pos(B[sd + 'Arm']), sg = sd === 'Left' ? 1 : -1;
      const v = W.clone().sub(S); let d = v.length(); const vd = v.clone().normalize(); d = Math.min(d, (ARM_L.L1 + ARM_L.L2) * 0.999);
      const pole = V(0.6 * sg, -1, -0.25).normalize(), perp = pole.clone().addScaledVector(vd, -vd.dot(pole)).normalize();
      const ca = Math.max(-1, Math.min(1, (ARM_L.L1 * ARM_L.L1 + d * d - ARM_L.L2 * ARM_L.L2) / (2 * ARM_L.L1 * d))), sa = Math.sqrt(1 - ca * ca);
      const E = S.clone().addScaledVector(vd, ARM_L.L1 * ca).addScaledVector(perp, ARM_L.L1 * sa), Wc = S.clone().addScaledVector(vd, d);
      const ua1 = E.clone().sub(S).normalize(), fa1 = Wc.clone().sub(E).normalize(); let hinge = V().crossVectors(ua1, fa1); if (hinge.length() < 1e-4) hinge = V().crossVectors(ua1, perp); hinge.normalize();
      const ua0 = dir(sd + 'Arm', sd + 'ForeArm'), fa0 = dir(sd + 'ForeArm', sd + 'Hand');
      const Gua = frameRot(ua0, cr(ua0, Z), ua1, hinge).multiply(W0.get(B[sd + 'Arm']));
      const Dfa0 = frameRot(fa0, cr(fa0, Z), fa1, hinge), Dh = g.G.clone().multiply(W0.get(B[sd + 'Hand']).clone().invert()), tw = twistAbout(Dh.clone().multiply(Dfa0.clone().invert()), fa1);
      const Gfa = new T.Quaternion().slerp(tw, 0.5).multiply(Dfa0).multiply(W0.get(B[sd + 'ForeArm']));
      const Gsh = G1.get(B[sd + 'Shoulder']) || G.get(B[sd + 'Shoulder']);
      f1.q.set(B[sd + 'Arm'], Gsh.clone().invert().multiply(Gua)); f1.q.set(B[sd + 'ForeArm'], Gua.clone().invert().multiply(Gfa)); f1.q.set(B[sd + 'Hand'], Gfa.clone().invert().multiply(g.G)); }
    return f1; }
  function actFrame(a, t) { if (a.mirror) return mirrorFrame(a, t); const f = baseOf(a);
    if (a.idle) return breathe(idleFrame(a), t);
    clipInto(a.C, a.rev ? a.C.dur - t : t, f); if (a.A) clipInto(a.A, (t / a.C.dur) * a.A.dur % a.A.dur, f, ARMS); return f; }
  // 발이 바닥에 닿게: 클립 전체에서 가장 낮은 발목 높이를 쉬는 자세 발목 높이에 맞춘다
  for (const k in ACTS) { const a = ACTS[k]; if (!a.C || a.idle) continue; let lo = Infinity;
    for (let i = 0; i < 24; i++) { applyFrame(actFrame(a, a.dur * i / 24)); root.updateMatrixWorld(true); lo = Math.min(lo, B.LeftFoot.getWorldPosition(V()).y, B.RightFoot.getWorldPosition(V()).y); }
    a.C.dy += P0.get(B.LeftFoot).y - lo; }

  // ── 실행: 지금 동작(반복) + 바꿀 때 0.25초 섞기 ──
  const st = { act: 'widle', t: 0, speed: 1, fromF: null, fade: 1, fadeDur: 0.25 };
  const cloneF = f => ({ q: new Map([...f.q].map(([b, q]) => [b, q.clone()])), hip: f.hip.clone() });
  let lastF = null;
  function play(name, t0 = 0, fd) { if (!ACTS[name] || !ACTS[name].C) return; if (lastF) st.fromF = cloneF(lastF);
    st.from = st.fade >= 1 && ACTS[st.act] ? { a: ACTS[st.act], t: st.t, sp: st.speed || 1 } : null;   // 섞는 중이 아니면 앞 동작을 멈추지 않고 계속 움직이며 섞는다
    st.fade = 0; st.fadeDur = fd || ACTS[name].fade || 0.25; st.act = name; st.t = t0; st.hitDone = false; st.carry = null; st.pull = 0; st.warp = null; pipe.visible = ACTS[name].pipe; syncButtons(); }
  // 클립 한 바퀴 동안 엉덩이가 앞으로 간 거리 / 시간 = 이동 속도 (+z가 앞)
  const SPD = n => { const C = CLIP[n]; return C ? Math.hypot(C.drift[0], C.drift[1]) / C.dur : 0; };
  const ctl = { on: true, req: null, ci: 0, buf: false, rec: 0, soft: 0, held: false, joy: { x: 0, y: 0, id: null }, runT: false, yaw: 0, v: 0, keys: new Set(), WALK: SPD('Great_Sword_Walk'), RUN: SPD('Standard_Run'), R: 2800 };
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) ctl.req = 'jump'; } if (e.code === 'KeyF') { if (!e.repeat) ctl.req = 'slash'; ctl.held = true; } if (MOVE_KEYS.has(e.code)) { ctl.keys.add(e.code); if (!ctl.on) { ctl.on = true; controls.autoRotate = false; } } });
  window.addEventListener('keyup', e => { if (e.code === 'Space') e.preventDefault(); ctl.keys.delete(e.code); });
  window.addEventListener('keyup', e => { if (e.code === 'KeyF') ctl.held = false; });
  window.addEventListener('blur', () => { ctl.keys.clear(); ctl.held = false; });
  function switchAct(name) { if (st.act === name) return; const a0 = ACTS[st.act], a1 = ACTS[name], ph = (st.t % a0.dur) / a0.dur;   // 걷기↔달리기는 박자 이어서
    play(name); if (a0.fwd && a1.fwd) st.t = ph * a1.dur; else if (a0.idle && !a1.idle) st.t = IDLE_T / a0.C.dur * a1.dur; }
  // 몬스터가 가까이 있으면(IN 안으로 들어오면, OUT 밖으로 나가면 풀림) 늘 몬스터를 바라본다. 움직임은 바라보는 쪽 기준으로 앞·뒤·왼쪽·오른쪽 걸음을 고른다
  const GAME = { speed: 1.3 };
  const CARRY = { v: [0.2, 0.78], legs: [0.12, 0.55] };   // 달리며 공격: 속도 줄이는 구간 · 달리던 다리에서 휘두르기 다리로 넘어가는 구간(초)
  const LOCK = { on: false, IN: 380, OUT: 440, yaw: 0, RUNK: 1.8 };   // RUNK: 달리기 켠 채 옆·뒤로 갈 때 걸음 재생 배속
  const WALK_K = 1.4;   // 걸음(앞·뒤·옆) 빠르기: 동작 재생과 이동을 같은 배로 올려 발이 미끄러지지 않게
  const SEC = { f: a => Math.abs(a) < 55, b: a => Math.abs(a) > 125, l: a => a > 35 && a < 145, r: a => a < -35 && a > -145 };   // 지금 방향을 조금 더 넓게 잡아 경계에서 떨지 않게
  ACTS.wwalk.spd = ctl.WALK; ACTS.wrun.spd = ctl.RUN; ACTS.wback.spd = ctl.WALK; ACTS.wstrR.spd = ACTS.wstrL.spd = SPD('Great_Sword_Strafe'); for (const n of ['wwalk', 'wback', 'wstrR', 'wstrL']) ACTS[n].k = WALK_K; ctl.mv = 0; ctl.sec = null;
  const wrapA = d => Math.atan2(Math.sin(d), Math.cos(d)), turn = (c, to, rate, dt) => c + wrapA(to - c) * (1 - Math.exp(-dt * rate));
  function ctlFrame(dt) { if (!ctl.on) return;
    const k = ctl.keys, f = Math.max(-1, Math.min(1, (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + ctl.joy.y)), r = Math.max(-1, Math.min(1, (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + ctl.joy.x));
    const fw = controls.target.clone().sub(cam.position); fw.y = 0; if (fw.lengthSq() < 1e-6) fw.set(0, 0, -1); fw.normalize(); const rt = V(-fw.z, 0, fw.x);
    if (ctl.rec > 0) ctl.rec -= dt; const recov = ctl.rec > 0;   // 후딜 중
    const dir = fw.multiplyScalar(f).add(rt.multiplyScalar(r)), moving = !recov && dir.lengthSq() > 0.04, run = false;   // 달리기 없음
    if (GOB) { const gx = GOB.holder.position.x - root.position.x, gz = GOB.holder.position.z - root.position.z; LOCK.on = Math.hypot(gx, gz) < (LOCK.on ? LOCK.OUT : LOCK.IN); LOCK.yaw = Math.atan2(gx, gz); }
    const my = moving ? Math.atan2(dir.x, dir.z) : ctl.mv;
    let want = 'widle', rate = 1;
    if (moving) { if (!LOCK.on) { want = run ? 'wrun' : 'wwalk'; ctl.sec = null; }
      else { const a = wrapA(my - LOCK.yaw) / DEG;   // +면 몸 기준 왼쪽으로 가는 것
        if (!(ctl.sec && SEC[ctl.sec](a))) ctl.sec = Math.abs(a) <= 45 ? 'f' : Math.abs(a) >= 135 ? 'b' : a > 0 ? 'l' : 'r';
        want = ctl.sec === 'f' ? (run ? 'wrun' : 'wwalk') : ctl.sec === 'b' ? 'wback' : ctl.sec === 'l' ? 'wstrL' : 'wstrR';
        if (run && ctl.sec !== 'f') rate = LOCK.RUNK; } }   // 달리기 켠 채 옆·뒤로는 같은 걸음을 빠르게
    const cur = ACTS[st.act], busy = cur.once && st.t < (cur.atk && moving && !cur.atk.final ? cur.atk.chain + 0.18 : cur.atk && cur.atk.end ? cur.atk.end : cur.cancel && moving ? cur.cancel : cur.dur - (cur.air ? 0.08 : 0.12));   // 공격 뒤 여운은 움직이면 끊는다(마지막 공격은 못 끊음)
    // 연속기: 공격 중에 누르면 기억했다가 넘어가는 때(chain)에 다음 공격. 공격이 끝나 버리면 다음엔 처음(1)부터
    if (ctl.req === 'slash' && (cur.atk || recov)) { if (!cur.atk || (cur.atk.final ? st.t > (cur.atk.end || cur.dur) - 0.3 : st.t >= cur.atk.T - BUF_EARLY)) ctl.buf = true; ctl.req = null; }   // 다음 공격 입력은 내려치기 직전부터만 받는다(그보다 일찍 누른 건 무시). 마지막 공격은 끝나갈 때만
    if (recov && ctl.req) ctl.req = null;   // 후딜 중엔 점프도 안 된다
    if (ctl.held && cur.atk && !cur.atk.final && st.t >= cur.atk.T - BUF_EARLY) ctl.buf = true;   // 공격을 꾹 누르고 있으면 1 → 2 → 3까지 쭉(3번에서 멈춤)
    const nx = cur.atk ? COMBO[(ctl.ci + 1) % COMBO.length] : null, lk = nx && LINK[st.act] && LINK[st.act][nx];
    if (lk && ctl.buf && st.t >= lk[0]) { ctl.buf = false; ctl.ci = (ctl.ci + 1) % COMBO.length; const late = st.t > lk[0] + LATE; play(nx, late ? 0 : lk[1], late ? 0.2 : lk[2]); ctl.v = 0; if (!late) st.warp = makeWarp(nx, lk[1], lk[3] || 0); }
    else if (cur.atk && cur.atk.final && !busy) { ctl.rec = REC; ctl.soft = REC + 0.5; play('widle', 0, 0.45); }   // 마지막 공격이 끝나 자세를 잡으면 후딜(기본 자세로 천천히 섞고, 몸도 천천히 돌린다)
    else if (!recov && ctl.buf && !cur.atk) { ctl.buf = false; ctl.ci = 0; play(COMBO[0]); }   // 후딜 중 눌러 둔 공격은 끝나자마자 1번부터
    else if (!busy && ctl.req) { if (ctl.req === 'slash') { ctl.ci = 0; ctl.buf = false; }   // 달리는 중 점프는 달리기 점프
      const pa = st.act, pt = st.t, pr = st.speed; play(ctl.req === 'jump' && st.act === 'wrun' ? 'rjump' : ctl.req); if (ACTS[st.act].boost) ctl.v *= ACTS[st.act].boost;
      if (ACTS[st.act].atk && ACTS[pa].spd) { const fy = LOCK.on ? LOCK.yaw : ctl.yaw, fv = ctl.v * Math.cos(ctl.mv - fy);   // 걷거나 달리던 속도 중 앞(때리는 쪽)으로 가던 만큼만 이어서 휘두른다
        if (fv > 20) { st.carry = { act: pa, t0: pt, rate: pr, v0: fv }; ctl.mv = fy; } }
      ctl.req = null; } else if (!(cur.atk && ctl.buf)) { if (busy) ctl.req = null; if (!busy) { switchAct(want); if (!ACTS[st.act].atk && !recov) ctl.buf = false; } }
    const act = ACTS[st.act], lock = act.once && !act.air;
    st.speed = act.spd ? (rate > 1 ? LOCK.RUNK : act.k || 1) : act.atk ? act.atk.rate || 1 : 1;
    // 바라보는 쪽(yaw)과 움직이는 쪽(mv)을 따로: 몬스터가 가까우면 몸은 몬스터 쪽, 아니면 가는 쪽
    if (ctl.soft > 0) ctl.soft -= dt;
    if (LOCK.on) { let ty = LOCK.yaw, rr;   // 공격: 내려치기 전까지 겨누고(9), 내려치는 동안 고정, 내려친 뒤엔 천천히 몬스터 쪽으로 되돌린다(마지막 공격은 더 천천히)
      if (lock && act.atk) { if (st.t < act.atk.T + 0.06) { ty -= act.atk.aim; rr = st.t < act.atk.T - 0.12 ? 9 : 0; } else rr = act.atk.final ? 2.2 : 3.5; }
      else rr = lock ? 0 : act.air ? 5 : ctl.soft > 0 ? 3.5 : 12;
      ctl.yaw = turn(ctl.yaw, ty, rr, dt); }
    else if (moving && !lock) ctl.yaw = turn(ctl.yaw, my, act.air ? 4 : run ? 9 : 11, dt);
    if (moving && !lock) ctl.mv = turn(ctl.mv, my, act.air ? 4 : 14, dt);
    if (act.rm) { ctl.mv = ctl.yaw; }
    let tv = act.rm ? act.rmv * st.speed : lock ? 0 : act.air ? ctl.v : (moving ? act.spd || 0 : 0) * st.speed;
    if (!LOCK.on && !act.air) tv *= 0.35 + 0.65 * Math.max(0, Math.cos(ctl.yaw - ctl.mv));   // 돌아서는 동안은 느리게
    if (lock && st.carry) { ctl.v = st.carry.v0 * (1 - sstep(CARRY.v[0], CARRY.v[1], st.t));   // 관성: 휘두르는 동안 달리던 속도로 나가다가 내려칠 때쯤 멈춘다
      if (LOCK.on && GOB) { const gd = Math.hypot(GOB.holder.position.x - root.position.x, GOB.holder.position.z - root.position.z); ctl.v = Math.min(ctl.v, Math.max(0, gd - (act.atk.ideal || ASSIST.IDEAL)) * 7); } }   // 고블린 앞에선 파이프 끝이 맞는 거리에서 멈춘다
    else if (act.rm) ctl.v = tv;
    else ctl.v += (tv - ctl.v) * (1 - Math.exp(-dt * (lock ? 14 : 7)));
    const p = root.position, before = p.clone(); p.x += Math.sin(ctl.mv) * ctl.v * dt; p.z += Math.cos(ctl.mv) * ctl.v * dt;
    const RR = DG ? DG.RC : ctl.R, rr = Math.hypot(p.x, p.z); if (rr > RR) { p.x *= RR / rr; p.z *= RR / rr; }
    if (DG) for (const c of DG.colliders) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), mr = c.r + 16; if (d < mr && d > 1e-3) { p.x += dx / d * (mr - d); p.z += dz / d * (mr - d); } }   // 천막·모닥불·수정 등
    if (GOB) { const gx = p.x - GOB.holder.position.x, gz = p.z - GOB.holder.position.z, gd = Math.hypot(gx, gz), tR = act.atk && act.atk.minR ? Math.min(GOB.gs.R, act.atk.minR) : GOB.gs.R;   // 붙을 수 있는 거리: 줄어들 땐 바로, 늘어날 땐 천천히(3번 끝나고 순간이동하듯 밀려나지 않게)
      ctl.minR = ctl.minR == null || tR < ctl.minR ? tR : ctl.minR + (tR - ctl.minR) * (1 - Math.exp(-dt * 2.5)); const mn = ctl.minR; if (gd < mn && gd > 1e-3) { p.x += gx / gd * (mn - gd); p.z += gz / gd * (mn - gd); } }
    if (GOB && act.atk && act.atk.ideal && !st.hitDone && st.t > ASSIST.PULL_T[0] && st.t < act.atk.T - 0.05) { const gx = GOB.holder.position.x - p.x, gz = GOB.holder.position.z - p.z, gd = Math.hypot(gx, gz);   // 휘두르며 파이프 끝이 맞는 거리로: 멀면 한 걸음 붙고, 너무 붙었으면 살짝 물러선다
      if (gd < ASSIST.D + 5 && !st.carry) { const left = ASSIST.MAX - (st.pull || 0), m = Math.max(-ASSIST.BACK * dt, -left, Math.min(gd - act.atk.ideal, ASSIST.PULL * dt, left)); st.pull = (st.pull || 0) + Math.abs(m); p.x += gx / gd * m; p.z += gz / gd * m; } }
    root.rotation.y = ctl.yaw;
    key.position.copy(p).add(KEY_OFF); key.target.position.copy(p); if (HL) HL.position.set(p.x, 160, p.z); }
  function frame(dt) {
    const rdt = dt; dt *= GAME.speed;   // 게임 속 시간 빠르기: 내 공격·이동, 고블린 이동·공격이 같은 비율로
    if (HS.t > 0) { HS.t -= rdt; dt *= 0.04; }   // 맞는 순간 잠깐 멈춤(히트스톱, 실제 시간)
    ctlFrame(dt);
    const a = ACTS[st.act], inAir = a.airT && st.t > a.airT[0] && st.t < a.airT[1]; const w = st.warp, wi = w ? Math.floor((st.t - w.t0) / w.dt) : -1; st.t += dt * st.speed * (inAir ? a.airRate : 1) * (w && wi >= 0 && wi < w.r.length ? w.r[wi] : 1); const t = a.once ? Math.min(st.t, a.dur - 1e-3) : st.t % a.dur;
    const f = actFrame(a, t);
    if (st.carry && a.atk) { const ca = ACTS[st.carry.act], w = 1 - sstep(CARRY.legs[0], CARRY.legs[1], t);   // 휘두르기 앞부분은 달리던 다리 그대로
      if (w > 0) { const fc = actFrame(ca, (st.carry.t0 + st.t * st.carry.rate) % ca.dur);
        for (const [bo, q] of f.q) { if (LEGS.test(bo.name.replace(/^mixamorig:?/, ''))) q.slerp(fc.q.get(bo), w); } f.hip.y += (fc.hip.y - f.hip.y) * w; } }
    if (a.lift && t > a.airT[0] && t < a.airT[1]) { const u = (t - a.airT[0]) / (a.airT[1] - a.airT[0]); f.hip.y += a.lift * 4 * u * (1 - u); }
    if (st.fade < 1 && st.fromF) { st.fade = Math.min(1, st.fade + dt * st.speed / st.fadeDur); const k = EASE.io(st.fade); let F0 = st.fromF;
      if (st.from) { const fa = st.from.a; st.from.t += dt * st.from.sp; const ft = fa.once ? Math.min(st.from.t, fa.dur - 1e-3) : st.from.t % fa.dur; F0 = actFrame(fa, ft); }
      for (const [b, q] of f.q) { const q0 = F0.q.get(b); if (q0) q.copy(q0.clone().slerp(q, k)); } f.hip.lerpVectors(F0.hip, f.hip.clone(), k); }
    applyFrame(f); posePipe(a, t); lastF = f;   // 한 손 동작(피격)은 오른손 기본 쥐기, 두 손 동작은 두 주먹을 잇는 선(구간에 따라 오른손 방향)
    // 공격이 맞았나: 내려치는 동안 파이프(오른손~끝)가 지난 자리가 고블린 머리·몸통에 닿으면. 끝에 가까운 곳부터 본다
    if (GOB && a.atk && !st.hitDone && t > a.atk.win[0] && t < a.atk.win[1]) { let c = pipeContact(); if (!c && t >= a.atk.T) c = assistPoint(a);   // 닿았거나, 내려친 순간 사거리 안이면 맞는다
      if (c) { GOB.hit(root.position, a.atk.kb || 0); st.hitDone = true; hitFX(c, a.atk.fx); } }
    if (a.atk) PIPE_PREV = pipeSamples(); else PIPE_PREV = null;
    if (GOB) GOB.step(dt);
    FX.step(rdt); if (DG) DG.update(performance.now() / 1000);
    fitShadow();
  }
  // 그림자 범위: 주인공과 (보이는 거리 안의) 고블린을 둘 다 감싸도록 매 프레임 맞춘다. 그림자가 떨어지는 바닥까지 깊이를 넉넉히
  const SHC = key.shadow.camera, LM = new T.Matrix4(), LX = V(), LY = V(), LZ = V(), UPY = V(0, 1, 0), LQp = V();
  function fitShadow() { const e = key.position; LM.lookAt(e, key.target.position, UPY); LM.extractBasis(LX, LY, LZ);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    const box = (c, r, h) => { for (const dx of [-r, r]) for (const dz of [-r, r]) for (const y of [0, h]) { LQp.set(c.x + dx, y, c.z + dz).sub(e); const x = LQp.dot(LX), yy = LQp.dot(LY), d = -LQp.dot(LZ);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); d0 = Math.min(d0, d); d1 = Math.max(d1, d); } };
    box(root.position, 110, 200);
    if (GOB && GOB.holder.position.distanceTo(root.position) < 1500) box(GOB.holder.position, 95, 160);
    Object.assign(SHC, { left: x0, right: x1, bottom: y0, top: y1, near: Math.max(1, d0 - 40), far: d1 + 320 }); SHC.updateProjectionMatrix(); }

  // ── 카메라 ──
  const CAMS = {
    front: { tg: V(0, 52, 0), off: V(0, 8, 235) }, side: { tg: V(0, 52, 0), off: V(-235, 8, 0) }, back: { tg: V(0, 52, 0), off: V(0, 10, -235) },
    top: { tg: V(0, 30, 0), off: V(120, 270, 210) }, face: { follow: 'Head', fo: V(0, 6, 0), off: V(8, 2, 62) }, hand: { follow: 'RightHand', fo: V(0, -2, 0), off: V(-38, 16, 48) },
  };
  const camSt = { name: 'front', tw: 1, from: null, to: null };
  const fitK = () => Math.max(1, Math.pow(0.8 / cam.aspect, 0.85));
  function camGoal(c) { const tg = c.follow ? B[c.follow].getWorldPosition(V()).add(c.fo) : c.tg.clone().add(V(root.position.x, 0, root.position.z)); return { tg, pos: tg.clone().addScaledVector(c.off, c.follow ? 1 : fitK()) }; }
  function setCam(name) { camSt.name = name; camSt.from = { tg: controls.target.clone(), pos: cam.position.clone() }; camSt.tw = 0; syncButtons(); }
  function camFrame(dt) { const c = CAMS[camSt.name];
    if (camSt.tw < 1) { camSt.tw = Math.min(1, camSt.tw + dt / 0.7); const g = camGoal(c), k = EASE.io(camSt.tw); controls.target.lerpVectors(camSt.from.tg, g.tg, k); cam.position.lerpVectors(camSt.from.pos, g.pos, k); }
    else if (c.follow) { const g = camGoal(c), d = g.tg.clone().sub(controls.target); controls.target.add(d); cam.position.add(d); }
  }

  // ── 버튼 ──
  function syncButtons() {

  }
  // ── 화면 조작: 왼쪽 조이스틱 · 오른쪽 공격/점프/달리기(켜고 끄기) ──
  { const joyEl = $('#joy'), knob = $('#joy-knob'), J = ctl.joy;
    const upd = e => { const r = joyEl.getBoundingClientRect(), R = r.width * 0.36, cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`; J.x = dx / R; J.y = -dy / R; };
    joyEl.addEventListener('pointerdown', e => { e.preventDefault(); J.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); upd(e); });
    joyEl.addEventListener('pointermove', e => { if (e.pointerId === J.id) upd(e); });
    const end = e => { if (e.pointerId !== J.id) return; J.id = null; J.x = J.y = 0; knob.style.transform = ''; };
    joyEl.addEventListener('pointerup', end); joyEl.addEventListener('pointercancel', end);
    const press = (id, fn) => { const el = $(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('down'); fn(); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => el.classList.remove('down')); el.addEventListener('contextmenu', e => e.preventDefault()); };
    press('#b-atk', () => { ctl.req = 'slash'; ctl.held = true; }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#b-atk').addEventListener(ev, () => { ctl.held = false; });   // 꾹 누르고 있으면 3단까지 press('#b-jump', () => { ctl.req = 'jump'; });
  }

  // ── 겹침 검사(확인용): 피부 정점을 직접 계산 → 점이 몸 안쪽인지(가장 가까운 피부 점의 법선 뒤쪽인지)로 판정 ──
  const CHK = (() => {
    const g = sm.geometry, pa = g.attributes.position, na = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, N = pa.count, bones = sm.skeleton.bones;
    const nameOf = i => bones[i].name.replace(/^mixamorig:?/, '');
    const WS = sw.normalized ? (sw.array instanceof Uint8Array ? 255 : sw.array instanceof Uint16Array ? 65535 : 1) : 1, W = new Float32Array(sw.array.length); for (let i = 0; i < W.length; i++) W[i] = sw.array[i] / WS;   // 줄이기 도구가 무게를 0~255 정수로 저장
    const dom = new Int32Array(N); for (let i = 0; i < N; i++) { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) if (W[i * 4 + k] > bw) { bw = W[i * 4 + k]; bi = si.array[i * 4 + k]; } dom[i] = bi; }
    const dn = Array.from(dom, i => nameOf(i));
    const P3 = new Float32Array(N * 3), N3 = new Float32Array(N * 3), m = new T.Matrix4(), mm = new T.Matrix4(), v = V(), n = V(), acc = V(), nq = new T.Matrix3();
    function skinAll() {
      root.updateMatrixWorld(true); sm.skeleton.update();
      const bm = bones.map((bo, i) => new T.Matrix4().multiplyMatrices(bo.matrixWorld, sm.skeleton.boneInverses[i]));
      for (let i = 0; i < N; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(sm.bindMatrix); acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = W[i * 4 + k]; if (w) acc.addScaledVector(v.clone().applyMatrix4(bm[si.array[i * 4 + k]]), w); }
        acc.applyMatrix4(sm.bindMatrixInverse).applyMatrix4(sm.matrixWorld); P3[i * 3] = acc.x; P3[i * 3 + 1] = acc.y; P3[i * 3 + 2] = acc.z;
        n.fromBufferAttribute(na, i).transformDirection(sm.bindMatrix).transformDirection(bm[dom[i]]); N3[i * 3] = n.x; N3[i * 3 + 1] = n.y; N3[i * 3 + 2] = n.z; }
    }
    // 점 p에서 가장 가까운 피부 점(조건 filt) → 법선 방향 거리 (음수 = 몸 안)
    function signedDepth(p, filt) { let bi = -1, bd = 1e9; for (let i = 0; i < N; i += 2) { if (!filt(i)) continue; const dx = P3[i * 3] - p.x, dy = P3[i * 3 + 1] - p.y, dz = P3[i * 3 + 2] - p.z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = i; } }
      if (bi < 0 || bd > 64) return { s: 99 }; return { s: (p.x - P3[bi * 3]) * N3[bi * 3] + (p.y - P3[bi * 3 + 1]) * N3[bi * 3 + 1] + (p.z - P3[bi * 3 + 2]) * N3[bi * 3 + 2], bone: dn[bi] }; }
    const notHand = i => !/Hand/.test(dn[i]), notArm = i => !/(Fore)?Arm$|Hand/.test(dn[i]);
    window.__chkdbg = () => { skinAll(); let mn = V(1e9, 1e9, 1e9), mx = V(-1e9, -1e9, -1e9); for (let i = 0; i < N; i++) { mn.min(V(P3[i * 3], P3[i * 3 + 1], P3[i * 3 + 2])); mx.max(V(P3[i * 3], P3[i * 3 + 1], P3[i * 3 + 2])); }
      const ch = B.Spine2.getWorldPosition(V()); return { mn: mn.toArray().map(x => +x.toFixed(1)), mx: mx.toArray().map(x => +x.toFixed(1)), chest: ch.toArray().map(x => +x.toFixed(1)), dChest: signedDepth(ch, notHand), pipe0: pipe.localToWorld(V(0, 30, 0)).toArray().map(x => +x.toFixed(1)), n0: [N3[0], N3[1], N3[2]].map(x => +x.toFixed(2)) }; };
    return (pose) => {
      skinAll(); const out = { pipe: [], arm: [] }, r = 1.7 * PIPE_S;
      if (pipe.visible) { const lh = pose && pose.lhw > 0.3 ? pose.lh : null;
        for (let y = 0; y <= PIPE_DIM.LEN + 3; y += 2.5) { if (Math.abs(y - ((pose && pose.wy) || PIPE_Y_DEF)) < 6 || (lh != null && Math.abs(y - lh) < 7)) continue;
          const p = pipe.localToWorld(V(0, y, 0)), d = signedDepth(p, notHand); if (d.s < r * 0.5) out.pipe.push([y, d.bone, +d.s.toFixed(1)]); } }
      for (const side of ['Left', 'Right']) for (let i = 0; i < N; i += 6) { if (!new RegExp('^' + side + '(ForeArm|Hand)$').test(dn[i])) continue;
        const p = V(P3[i * 3], P3[i * 3 + 1], P3[i * 3 + 2]), d = signedDepth(p, notArm); if (d.s < -0.6) out.arm.push([side, dn[i], d.bone, +d.s.toFixed(1)]); }
      return out;
    };
  })();
  // ── 고블린: 오른손에 몽둥이. 가까이 오면 걸어서 다가오고(걷기), 닿으면 내려찍고(공격), 맞으면 움찔하며 밀림(맞기). 그 밖엔 숨쉬기 대기 ──
  const GOB = await (async () => {
    if (!window.GOB_GLB || !window.MAKE_CLUB) return null;
    const [gg, gBase, gNrm, club] = await Promise.all([new Promise((res, rej) => { const bin = atob(window.GOB_GLB), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); new T.GLTFLoader().parse(u8.buffer, '', res, rej); }), loadTex('gob_base.webp'), loadTex('gob_nrm.webp'), MAKE_CLUB()]);
    gBase.encoding = T.sRGBEncoding; gBase.anisotropy = 8;
    const g = gg.scene; let gsm = null; g.traverse(o => { if (o.isSkinnedMesh && !gsm) gsm = o; });
    gsm.material = new T.MeshStandardMaterial({ map: gBase, normalMap: gNrm, color: DUN ? 0xd9d9d9 : 0xffffff, roughness: 0.85, metalness: 0, envMapIntensity: ENV_K || 0.5, skinning: true });   // 던전: 밝은 피부가 튀지 않게 조금 낮춤
    gsm.frustumCulled = false; gsm.castShadow = true; gsm.receiveShadow = true;
    const GB = {}; g.traverse(o => { if (/^mixamorig/.test(o.name)) GB[o.name.replace(/^mixamorig:?/, '')] = o; });
    const holder = new T.Group(); holder.add(g); scene.add(holder);
    const w = n => GB[n].getWorldPosition(V());
    const mixer = new T.AnimationMixer(g), atkClip = gg.animations[0], GT0 = 0.05;   // 공격 동작 0초 프레임은 깨져 있어 0.05초부터
    const tmp = mixer.clipAction(atkClip); tmp.play(); tmp.paused = true; tmp.time = GT0; mixer.update(0);
    // 실제로 그려지는(피부 입힌) 정점으로 크기·바닥 맞추기: 도윤 키의 2/3, 발바닥 = 바닥
    const skinBox = () => { holder.updateMatrixWorld(true); const sk = gsm.skeleton, pa = gsm.geometry.attributes.position, si = gsm.geometry.attributes.skinIndex, sw = gsm.geometry.attributes.skinWeight, BM = sk.bones.map((bn, k) => new T.Matrix4().multiplyMatrices(bn.matrixWorld, sk.boneInverses[k])), p0 = V(), t3 = V(), acc = V(); let lo = Infinity, hi2 = -Infinity;
      for (let i = 0; i < pa.count; i += 4) { p0.fromBufferAttribute(pa, i).applyMatrix4(gsm.bindMatrix); acc.set(0, 0, 0); let ws = 0; for (let k = 0; k < 4; k++) { const wv = sw.array[i * 4 + k]; if (!wv) continue; ws += wv; acc.addScaledVector(t3.copy(p0).applyMatrix4(BM[si.array[i * 4 + k]]), wv); }
        acc.divideScalar(ws || 1).applyMatrix4(gsm.bindMatrixInverse).applyMatrix4(gsm.matrixWorld); lo = Math.min(lo, acc.y); hi2 = Math.max(hi2, acc.y); } return [lo, hi2]; };
    let [lo0, hi0] = skinBox(); const doyunH = P0.get(B.Head).y + 13; g.scale.multiplyScalar(doyunH * 0.66 / (hi0 - lo0));
    [lo0, hi0] = skinBox(); g.position.y -= lo0; holder.updateMatrixWorld(true); const height = hi0 - lo0;
    // 몽둥이: 오른 주먹 가운데(가운뎃손가락 마디로 원 맞추기), 엄지 쪽으로 머리
    { const A0 = w('RightHandMiddle1'), Bm = w('RightHandMiddle3'), C = w('RightHandMiddle4'), ab = Bm.clone().sub(A0), ac = C.clone().sub(A0), nn = V().crossVectors(ab, ac);
      let ctr = A0.clone().add(V().crossVectors(nn, ab).multiplyScalar(ac.lengthSq()).add(V().crossVectors(ac, nn).multiplyScalar(ab.lengthSq())).divideScalar(2 * nn.lengthSq()));
      if (!isFinite(ctr.x) || ctr.distanceTo(w('RightHand')) > height * 0.12) ctr = w('RightHandMiddle1').lerp(w('RightHandMiddle2'), 0.5);
      const ax = w('RightHandIndex1').sub(w('RightHandPinky1')).normalize(), q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), ax), sc = height * 0.5 / CLUB_DIM.LEN;
      const Mw = new T.Matrix4().compose(ctr.clone().sub(V(0, club.userData.grip * sc, 0).applyQuaternion(q)), q, V(sc, sc, sc)), Ml = GB.RightHand.matrixWorld.clone().invert().multiply(Mw);
      Ml.decompose(club.position, club.quaternion, club.scale); GB.RightHand.add(club); }
    // 대기 동작: 공격 동작의 첫 자세 + 숨쉬기·들썩임·고개 갸웃 (4.8초 반복) → 다른 동작과 섞어 넘어갈 수 있게 동작 파일로 만든다
    const base = new Map(); for (const k in GB) if (GB[k].isBone) base.set(GB[k], GB[k].quaternion.clone()); const hipBase = GB.Hips.position.clone(); tmp.stop();
    const IDLE_MOV = { Spine: (b, s) => [0.02 * b, 0.04 * s, 0], Spine1: (b, s) => [0.03 * b, 0.03 * s, 0], Spine2: (b, s) => [0.04 * b, 0, 0.02 * s], Neck: (b, s) => [-0.03 * b, 0.05 * s, 0], Head: (b, s, tl) => [-0.03 * b, 0.12 * s, 0.12 * tl], LeftShoulder: b => [0, 0, 0.05 * b], RightShoulder: b => [0, 0, -0.05 * b] };
    const idleClip = (() => { const D = 4.8, N = 32, tracks = [];
      for (const [bone, q0] of base) { const nm = bone.name + '.quaternion', mv = IDLE_MOV[bone.name.replace(/^mixamorig:?/, '')];
        if (!mv) { tracks.push(new T.QuaternionKeyframeTrack(nm, [0], [q0.x, q0.y, q0.z, q0.w])); continue; }
        const times = [], vals = []; for (let k = 0; k <= N; k++) { const t = D * k / N, b = Math.sin(2 * Math.PI * t / 2.4), sw2 = Math.sin(2 * Math.PI * t / 4.8), tl = Math.sin(2 * Math.PI * t / 4.8) * Math.sin(2 * Math.PI * t / 2.4), e = mv(b, sw2, tl);
          const q = q0.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(e[0], e[1], e[2]))); times.push(t); vals.push(q.x, q.y, q.z, q.w); }
        tracks.push(new T.QuaternionKeyframeTrack(nm, times, vals)); }
      tracks.push(new T.VectorKeyframeTrack(GB.Hips.name + '.position', [0], [hipBase.x, hipBase.y, hipBase.z])); return new T.AnimationClip('idle', D, tracks); })();
    // 걷기: 앞으로 가는 만큼(엉덩이 이동)을 빼서 제자리 걷기로 → 그만큼 실제로 옮긴다(발 안 미끄러지게)
    const SRCC = window.GOB_CLIPS || {}, walkClip = T.AnimationClip.parse(SRCC.walk), hitClip = T.AnimationClip.parse(SRCC.hit);
    walkClip.uuid = T.MathUtils.generateUUID(); hitClip.uuid = T.MathUtils.generateUUID();   // 파일에서 읽은 동작은 고유 번호가 없어 둘이 같은 동작으로 묶였다(걷기가 한 번만 재생, 맞기에 걷기가 나옴)
    let walkSpeed = 0; { const tr = walkClip.tracks.find(t => /Hips\.position$/.test(t.name)), v = tr.values, n = v.length / 3, dx = v[(n - 1) * 3] - v[0], dz = v[(n - 1) * 3 + 2] - v[2];
      for (let i = 0; i < n; i++) { const u = tr.times[i] / walkClip.duration; v[i * 3] -= dx * u; v[i * 3 + 2] -= dz * u; }
      walkSpeed = Math.hypot(dx, dz) * GB.Hips.parent.getWorldScale(V()).x / walkClip.duration; }
    const A = { idle: mixer.clipAction(idleClip), walk: mixer.clipAction(walkClip), atk: mixer.clipAction(atkClip), hit: mixer.clipAction(hitClip) };
    for (const k of ['atk', 'hit']) { A[k].setLoop(T.LoopOnce); A[k].clampWhenFinished = true; }
    const KB_K = 9;   // 넉백 멈추는 빠르기(속도 = 거리×KB_K, 지수로 줄어 합이 거리)
    const gs = { state: 'idle', yaw: 0, cd: 1.2, t: 0, R: height * 0.8, kb: 0, kdir: V(), ATK: height * 0.95, AGGRO: 520 };
    let cur = A.idle; cur.play();
    const GSTRIKE = 0.87;   // 고블린 공격에서 몽둥이가 앞으로 내려찍히는 때
    function go(name, fade, from = 0) { if (name === 'atk') gs.struck = false; const nx = A[name]; nx.reset(); nx.time = from; nx.setEffectiveWeight(1); nx.play(); if (cur !== nx) cur.crossFadeTo(nx, fade, false); cur = nx; gs.state = name; }
    holder.position.set(0, 0, -240); mixer.update(0);
    function hit(from, kb = 0) { if (kb > 0) { gs.kdir.set(holder.position.x - from.x, 0, holder.position.z - from.z).normalize(); gs.kb = kb * KB_K; }   // 넉백: 맞은 쪽 반대로 kb만큼 짧게 미끄러지듯
      if (gs.state === 'hit' && A.hit.time < 0.3) return false; gs.cd = Math.max(gs.cd, 0.9); go('hit', 0.06, 0); return true; }   // 맞는 동작은 그대로(옆으로 휘청)
    function step(dt) { gs.t += dt; gs.cd -= dt;
      if (DG) { const hp = holder.position, r = Math.hypot(hp.x, hp.z); if (r > DG.RC) { hp.x *= DG.RC / r; hp.z *= DG.RC / r; } for (const c of DG.colliders) { const dx = hp.x - c.x, dz = hp.z - c.z, d = Math.hypot(dx, dz), mr = c.r + 14; if (d < mr && d > 1e-3) { hp.x += dx / d * (mr - d); hp.z += dz / d * (mr - d); } } }
      if (gs.kb > 0.5) { holder.position.addScaledVector(gs.kdir, gs.kb * dt); gs.kb *= Math.exp(-dt * KB_K); } else gs.kb = 0;
      const to = root.position.clone().sub(holder.position); to.y = 0; const dist = to.length(), ty = Math.atan2(to.x, to.z); let d = ty - gs.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = rate => { gs.yaw += d * (1 - Math.exp(-dt * rate)); };
      if (gs.state === 'hit') {
        if (A.hit.time >= hitClip.duration - 0.08) go(dist < gs.AGGRO && dist > gs.ATK ? 'walk' : 'idle', 0.25); }
      else if (gs.state === 'atk') { if (A.atk.time < 0.45) turn(5);
        if (!gs.struck && A.atk.time >= GSTRIKE) { gs.struck = true; if (dist < gs.ATK + 22 && Math.abs(d) < 0.9 && api.onStrike) api.onStrike(holder.position); } if (A.atk.time >= atkClip.duration - 1e-3) { gs.cd = 1.3; go('idle', 0.3); } }
      else { turn(gs.state === 'walk' ? 4 : 5);
        if (dist < gs.ATK) { if (gs.state !== 'idle') go('idle', 0.2); if (gs.cd <= 0 && Math.abs(d) < 0.6) go('atk', 0.12, GT0); }
        else if (dist < gs.AGGRO) { if (gs.state !== 'walk') go('walk', 0.25);
          // 다리 재생 빠르기 = 실제 이동 빠르기 (문워크 안 하게). 많이 돌아야 하면 천천히 걸으며 돈다
          const k = Math.abs(d) < 0.6 ? 1 : Math.abs(d) < 1.4 ? 0.55 : 0.35, sp = walkSpeed * k; A.walk.timeScale = k;
          holder.position.x += Math.sin(gs.yaw) * sp * dt; holder.position.z += Math.cos(gs.yaw) * sp * dt; }
        else if (gs.state !== 'idle') go('idle', 0.3); }
      holder.rotation.y = gs.yaw; mixer.update(dt); }
    const api = { holder, step, hit, gs, height, GB, club, A, walkSpeed, mat: gsm.material, onStrike: null };
    return api;
  })();
  // 쿼터뷰: 45도 비스듬히, 40도 내려다보며 도윤을 가운데에 부드럽게 따라감 (화면이 좁을수록 조금 멀리)
  const QV = { yaw: 45 * DEG, pitch: 26 * DEG, dist: 560, h: 55 };
  // ── 타격 이펙트: 불꽃(꼬리 달린 빛 점) · 번쩍임 · 베인 빛줄기 · 고블린 몸 번쩍 · 히트스톱 · 화면 흔들림 · 진동 ──
  // 파이프 끝(구부러진 머리 쪽): 여러 조각이라 조각마다 위치를 넣어 파이프 기준으로 정점을 모아 잰다. 맨 끝 4% 정점들의 가운데
  const TIPV = (() => { pipe.updateMatrixWorld(true); const inv = new T.Matrix4().copy(pipe.matrixWorld).invert(), pts = [], v = V(); let lo = Infinity, hi = -Infinity;
    pipe.traverse(o => { if (!o.isMesh) return; const M = inv.clone().multiply(o.matrixWorld), a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(M); pts.push(v.clone()); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } });
    const top = pts.filter(q => q.y > hi - (hi - lo) * 0.04); return top.reduce((s, q) => s.add(q), V()).divideScalar(top.length); })();
  const PIPE_TIP = TIPV.y;
  // 파이프 위 점들(오른손 쥔 곳 → 끝)과 고블린 몸(머리 공 + 엉덩이~목 캡슐)
  const PIPE_PTS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1].map(u => V(0, 19, 0).lerp(TIPV, u)); let PIPE_PREV = null;   // 끝(1) → 오른손 쪽
  const pipeSamples = () => PIPE_PTS.map(q => pipe.localToWorld(q.clone()));
  function segSeg(p1, q1, p2, q2) {   // 두 선분 사이 가장 가까운 두 점
    const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r); let s1 = 0, t1 = 0;
    if (a < 1e-9 && e < 1e-9) return [p1.clone(), p2.clone()];
    if (a < 1e-9) t1 = Math.max(0, Math.min(1, f / e)); else { const c = d1.dot(r); if (e < 1e-9) s1 = Math.max(0, Math.min(1, -c / a)); else { const b = d1.dot(d2), den = a * e - b * b; s1 = den > 1e-9 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0; t1 = (b * s1 + f) / e; if (t1 < 0) { t1 = 0; s1 = Math.max(0, Math.min(1, -c / a)); } else if (t1 > 1) { t1 = 1; s1 = Math.max(0, Math.min(1, (b - c) / a)); } } }
    return [p1.clone().addScaledVector(d1, s1), p2.clone().addScaledVector(d2, t1)]; }
  const GOB_BODY = () => { const g = GOB.GB, h = GOB.height, w = n => g[n].getWorldPosition(V()), hd = w('Head'), top = g.HeadTop_End ? w('HeadTop_End') : hd.clone().add(V(0, h * 0.16, 0));
    return [{ a: hd.clone().lerp(top, 0.35), b: hd.clone().lerp(top, 0.35), r: h * 0.15 }, { a: w('Hips'), b: w('Neck'), r: h * 0.15 }]; };
  function pipeContact() { const cur = pipeSamples(), prev = PIPE_PREV || cur, body = GOB_BODY();
    for (let i = 0; i < cur.length; i++) for (const c of body) { const [pp, pb] = segSeg(prev[i], cur[i], c.a, c.b); if (pp.distanceTo(pb) < c.r + 4) { pipeContact.i = i; return pp; } }
    return null; }
  // 내려칠 때(0.65초) 파이프 끝이 오는 자리(몸 기준): 대각선으로 내려와 몸 정면에서 왼쪽으로 비켜 있다 → 휘두르는 동안 그만큼 틀어 겨눈다
  for (const k of COMBO) { const a = ACTS[k]; if (a.atk.aim !== undefined) continue; applyFrame(actFrame(a, a.atk.aimT || a.atk.T)); posePipe(a, a.atk.aimT || a.atk.T); const q = root.worldToLocal(pipe.localToWorld(TIPV.clone())); a.atk.aim = Math.max(-0.6, Math.min(0.6, Math.atan2(q.x, q.z))); a.atk.reach = Math.hypot(q.x, q.z); }   // 겨눔: 내려치는 순간 파이프 끝 방향(±34° 안)
  for (const k of COMBO) { const at = ACTS[k].atk; if (at.idealK !== undefined) at.ideal = at.reach + at.idealK; }
  ACTS.slash3.rmv = Math.hypot(...ACTS.slash3.C.drift) / ACTS.slash3.C.dur;   // 3번은 1.8초 동안 앞으로 61
  const STRIKE = { a: ACTS.slash.atk.aim };
  // 공격 보정: 고블린이 사거리(D) 안·앞쪽(ANG)에 있으면 내려친 순간(T) 파이프가 안 닿았어도 맞힌다. 불꽃은 고블린 몸에서 파이프 쪽 면
  const ASSIST = { D: 125, ANG: 75 * DEG, T: 0.7, IDEAL: 77, PULL: 55, BACK: 45, MAX: 16, PULL_T: [0.12, 0.62] };   // IDEAL: 파이프 끝이 맞는 거리. 휘두르는 동안 그쪽으로 천천히 다가가거나(PULL) 살짝 물러선다(BACK). 한 번 휘두를 때 최대 MAX만큼만
  function assistPoint(a) { const g = GOB.holder.position, to = V(g.x - root.position.x, 0, g.z - root.position.z), d = to.length(); if (d > ASSIST.D) return null;
    if (to.normalize().dot(V(Math.sin(ctl.yaw + a.atk.aim), 0, Math.cos(ctl.yaw + a.atk.aim))) < Math.cos(ASSIST.ANG)) return null;
    const cur = pipeSamples(), tip = cur[0], grip = cur[cur.length - 1]; let best = null;
    for (const c of GOB_BODY()) { const [pp, pb] = segSeg(grip, tip, c.a, c.b), dd = pp.distanceTo(pb); if (!best || dd - c.r < best.k) best = { k: dd - c.r, at: pb.clone().add(pp.clone().sub(pb).setLength(Math.min(c.r, dd))) }; }
    pipeContact.i = -1; return best.at; }
  // 이어질 때 다음 공격의 들어 올리기(시작~내려치기 직전)를 고르게: 거의 멈춘 부분은 빨리, 빠른 부분은 살짝 늦게. 전체 시간은 그대로(+extra)
  const WARP_CACHE = {};
  function makeWarp(name, t0, extra) { const key = name + t0 + extra; if (WARP_CACHE[key]) return WARP_CACHE[key];
    const a = ACTS[name], t1 = a.atk.T - 0.1, dtc = 1 / 60, sp = [], keep = lastF ? cloneF(lastF) : null; let prev = null;
    for (let t = t0; t < t1; t += dtc) { applyFrame(actFrame(a, t)); posePipe(a, t); root.updateMatrixWorld(true); const q = root.worldToLocal(pipe.localToWorld(TIPV.clone())); sp.push(prev ? q.distanceTo(prev) / dtc : 0); prev = q; }
    if (sp.length > 1) sp[0] = sp[1];
    const med = [...sp].sort((x, y) => x - y)[Math.floor(sp.length / 2)] || 1, r = sp.map(v => Math.max(0.7, Math.min(2.4, Math.pow(med / Math.max(v, 30), 0.6))));
    const L = sp.length * dtc + extra, T0 = r.reduce((s, x) => s + dtc / x, 0), c = T0 / L; for (let i = 0; i < r.length; i++) r[i] *= c;
    if (keep) applyFrame(keep);
    return (WARP_CACHE[key] = { t0, dt: dtc, r }); }
  const HS = { t: 0, DUR: 0.085 }, SHK = { t: 0, dur: 0.24, a: 7 };
  const FX = (() => {
    const gc = document.createElement('canvas'); gc.width = gc.height = 64; const g2 = gc.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    const glow = new T.CanvasTexture(gc);
    // 빛 점 묶음: 점마다 크기·밝기·색
    const N = 720, pos = new Float32Array(N * 3), siz = new Float32Array(N), alp = new Float32Array(N), col = new Float32Array(N * 3), P = [];
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new T.BufferAttribute(siz, 1)); geo.setAttribute('aAlpha', new T.BufferAttribute(alp, 1)); geo.setAttribute('aCol', new T.BufferAttribute(col, 3));
    const mat = new T.ShaderMaterial({ uniforms: { map: { value: glow }, uScale: { value: 500 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aCol; uniform float uScale; varying float vA; varying vec3 vC; void main(){ vA = aAlpha; vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.a * vA, 1.0); }' });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 10; scene.add(pts);
    // 빛줄기 (카메라를 보게)
    const cutM = new T.MeshBasicMaterial({ map: glow, color: 0xffffff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    const cut = new T.Mesh(new T.PlaneGeometry(1, 1), cutM); cut.visible = false; cut.renderOrder = 11; scene.add(cut);
    const HF = { t: 1 }, hurtEl = document.getElementById('hurt'), CT = { t: 1, at: V(), tilt: 0 }, FL = { t: 1 };
    const add = (p, v, life, s0, c, kind) => { if (P.length < N / 4) P.push({ p: p.clone(), v, life, age: 0, s0, c, kind }); };
    function burst(at, n, pw = {}) {   // pw: 불꽃 개수·번쩍임 크기(공격마다)
      // 번쩍임 하나 + 하얀 불꽃
      add(at, V(), pw.hero ? 0.16 : 0.11, pw.flash || 46, pw.flashCol || [1.0, 0.95, 0.85], 'flash');
      for (let i = 0; i < (pw.sparks || 26); i++) { const d = V(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().addScaledVector(n, 0.75).add(V(0, 0.35, 0)).normalize();
        add(at, d.multiplyScalar((200 + Math.random() * 260) * (pw.spd || 1)), (0.22 + Math.random() * 0.2) * (pw.life || 1), 2.6 + Math.random() * 2.2, pw.red ? [1.0, 0.16 + Math.random() * 0.22, 0.08 + Math.random() * 0.08] : [1.0, 0.86 + Math.random() * 0.12, 0.55 + Math.random() * 0.2], 'spark'); }
      if (pw.hero) { HF.t = 0; return; }   // 주인공이 맞음: 몸 붉게 번쩍 + 화면 가장자리 붉게(고블린 번쩍·빛줄기는 없음)
      CT.t = 0; CT.at.copy(at); CT.tilt = (Math.random() * 2 - 1) * 0.35 + 0.25; FL.t = 0; }
    function step(dt) {
      const bs = rd.getDrawingBufferSize(new T.Vector2()); mat.uniforms.uScale.value = bs.y / (2 * Math.tan(cam.fov * DEG / 2));
      let j = 0;
      for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; q.age += dt; if (q.age >= q.life) { P.splice(i, 1); continue; } }
      for (const q of P) { const u = q.age / q.life;
        if (q.kind !== 'flash') { q.v.multiplyScalar(Math.exp(-dt * (q.kind === 'spark' ? 3.2 : 2))); q.v.y -= dt * (q.kind === 'spark' ? 520 : 160); q.p.addScaledVector(q.v, dt); }
        const tail = q.kind === 'spark' ? 4 : 1, a0 = q.kind === 'flash' ? (1 - u) * (1 - u) : 1 - u * u, s0 = q.kind === 'flash' ? q.s0 * (0.6 + 0.9 * u) : q.s0 * (1 - 0.5 * u);
        for (let k = 0; k < tail; k++) { const pp = q.p.clone().addScaledVector(q.v, -0.011 * k); pos[j * 3] = pp.x; pos[j * 3 + 1] = pp.y; pos[j * 3 + 2] = pp.z; siz[j] = s0 * (1 - k * 0.2); alp[j] = a0 * (1 - k * 0.24); col[j * 3] = q.c[0]; col[j * 3 + 1] = q.c[1]; col[j * 3 + 2] = q.c[2]; j++; } }
      geo.setDrawRange(0, j); for (const k of ['position', 'aSize', 'aAlpha', 'aCol']) geo.attributes[k].needsUpdate = true;
      // 베인 빛줄기: 내려친 방향(세로, 살짝 기울게)으로 길게 번쩍였다가 가늘어짐
      if (CT.t < 1) { CT.t = Math.min(1, CT.t + dt / 0.14); cut.visible = true; cut.position.copy(CT.at); cut.quaternion.copy(cam.quaternion); cut.rotateZ(CT.tilt); cut.scale.set(16 * (1 - CT.t) + 2, 130 * (0.7 + 0.3 * CT.t), 1); cutM.opacity = 1 - CT.t; } else cut.visible = false;
      // 고블린 몸 하얗게 번쩍
      if (HF.t < 1) { HF.t = Math.min(1, HF.t + dt / 0.45); const k = (1 - HF.t); sm.material.emissive.setRGB(0.38 * Math.max(0, 1 - HF.t * 2.5) ** 2, 0.04 * Math.max(0, 1 - HF.t * 2.5), 0.03 * Math.max(0, 1 - HF.t * 2.5)); if (hurtEl) hurtEl.style.opacity = (k * k).toFixed(3); }
      if (GOB && FL.t < 1) { FL.t = Math.min(1, FL.t + dt / 0.13); const k = (1 - FL.t) * (1 - FL.t) * 0.55; GOB.mat.emissive.setRGB(k, k * 0.9, k * 0.78); }
    }
    return { burst, step, P };
  })();
  function hitFX(cAt, pw) {
    const g = GOB.holder.position, n = V(root.position.x - g.x, 0, root.position.z - g.z).normalize();
    const chest = GOB.GB.Spine2.getWorldPosition(V()).addScaledVector(n, GOB.gs.R * 0.3).add(V(0, 5, 0));
    const at = cAt ? cAt.clone() : chest;
    FX.burst(at, n, pw); HS.t = (pw && pw.hs) || HS.DUR; SHK.t = SHK.dur; SHK.a = (pw && pw.shk) || 7;
    if (TOUCH && navigator.vibrate && pw && pw.vib) try { navigator.vibrate(pw.vib); } catch (e) {}   // 진동은 3타에서만
  }
  function camFollow(dt, snap) { const tg = V(root.position.x, QV.h, root.position.z), k = snap ? 1 : 1 - Math.exp(-dt * 7); controls.target.lerp(tg, k);
    const d = QV.dist * Math.max(1, Math.pow(1.9 / cam.aspect, 0.6)); cam.position.copy(controls.target).add(V(Math.sin(QV.yaw) * Math.cos(QV.pitch), Math.sin(QV.pitch), Math.cos(QV.yaw) * Math.cos(QV.pitch)).multiplyScalar(d)); cam.lookAt(controls.target);
    if (SHK.t > 0) { SHK.t = Math.max(0, SHK.t - dt); const k = SHK.t / SHK.dur, a = SHK.a * k * k, w = (SHK.dur - SHK.t) * 60; cam.position.add(V(1, 0, 0).applyQuaternion(cam.quaternion).multiplyScalar(Math.sin(w * 1.3) * a * 0.6)).add(V(0, 1, 0).applyQuaternion(cam.quaternion).multiplyScalar(Math.cos(w) * a)); } }
  for (const k in LINK) for (const n in LINK[k]) makeWarp(n, LINK[k][n][1], LINK[k][n][3] || 0);   // 미리 만들어 둔다(처음 이어질 때 끊김 없게)
  // 주인공이 맞으면: 하던 동작을 끊고 피격 동작, 살짝 뒤로 밀리고 화면 조금 흔들림. 연속기는 처음부터
  function heroHit(from) { if (st.act === 'impact' && st.t < 0.35) return; play('impact', 0, 0.08); ctl.buf = false; ctl.ci = 0; ctl.rec = 0; ctl.req = null;
    ctl.mv = Math.atan2(root.position.x - from.x, root.position.z - from.z); ctl.v = 110; HS.t = 0.06; SHK.t = 0.2; SHK.a = 6;
    const n = V(from.x - root.position.x, 0, from.z - root.position.z).normalize(), at = B.Spine2.getWorldPosition(V()).addScaledVector(n, 12).add(V(0, 6, 0));   // 맞은 자리: 가슴의 고블린 쪽
    FX.burst(at, n, { hero: true, red: true, sparks: 12, flash: 42, flashCol: [1.0, 0.22, 0.16] }); if (TOUCH && navigator.vibrate) try { navigator.vibrate(60); } catch (e) {} }
  if (GOB) GOB.onStrike = heroHit;
  window.__dbg = { posePipe, DG, heroHit, ideals: () => COMBO.map(k => [k, ACTS[k].atk.reach.toFixed(0), ACTS[k].atk.ideal]), makeWarp, aims: () => ['slash', 'slash2', 'slash3'].map(k => (ACTS[k].atk.aim * 57.3).toFixed(0)), GAME, LINK, COMBO, ASSIST, assistPoint, STRIKE, pipeContact, pipeSamples, GOB_BODY, WALK_K, aimPipe, FX, HS, SHK, hitFX, CARRY, LOCK, B, P0, W0, AX, solve, applyFrame, root, sm, scene, cam, rd, controls, st, ACTS, CLIP, play, setCam, frame, camFrame, camFollow, QV, pipe, merge, CHK, actFrame, LGC, ctl, camSt, GOB };
  $('#loading').hidden = true;
  let last = performance.now();
    function fogFit() { const dd = cam.position.distanceTo(controls.target); scene.fog.near = dd + 140; scene.fog.far = dd + 720; }
  function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!window.__pause) { frame(dt); camFollow(dt); fogFit(); rd.render(scene, cam); } requestAnimationFrame(loop); }
  play('widle'); st.fade = 1; frame(0); camFollow(0, true); requestAnimationFrame(loop);
})();
