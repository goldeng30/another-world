// 타격 효과: 불꽃(꼬리 달린 빛 점) · 번쩍임 · 베인 빛줄기 · 적 몸 번쩍 · 주인공 맞으면 붉게 · 히트스톱(HS) · 화면 흔들림(SHK)
import { T, V, DEG } from '../core/math.js';

export function createFX(G) {
  const { scene, rd, cam } = G, sm = G.hero.sm;
  const HS = { t: 0, DUR: 0.085 }, SHK = { t: 0, dur: 0.24, a: 7 };
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
      CT.t = 0; CT.at.copy(at); CT.tilt = (Math.random() * 2 - 1) * 0.35 + 0.25; FL.t = 0; FL.e = G.enemy; }   // 번쩍일 적은 맞은 그 적(쓰러져 목록에서 빠져도)
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
      const GOB = FL.e; if (GOB && FL.t < 1) { FL.t = Math.min(1, FL.t + dt / 0.13); const k = (1 - FL.t) * (1 - FL.t) * 0.55; GOB.mat.emissive.setRGB(k, k * 0.9, k * 0.78); }
    }
    const FX = { burst, step, P };
  return { FX, HS, SHK, step: FX.step, burst: FX.burst };
}
