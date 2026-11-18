// 불: 노이즈로 일렁이며 위로 타오르는 셰이더 불꽃(카메라를 보는 판) 몇 겹 + 튀어 오르는 불티 + 은은한 빛 번짐 + 흔들리는 빛
import { T } from '../core/math.js';
import { glowTex as GLOW } from './textures.js';

export function flameTools(W) {
  const { root, upd, rnd } = W, glowTex = GLOW();
  const FLAME_VS = 'uniform vec2 uSz; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += vec2(position.x, position.y + 0.5) * uSz; gl_Position = projectionMatrix * mv; }';
  const FLAME_FS = `uniform float t, seed, gain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){ float y = vUv.y, x = vUv.x - 0.5;
      float n = fbm(vec2(x * 3.2 + seed, y * 2.6 - t * 2.4)), m = fbm(vec2(x * 7.0 - seed, y * 5.0 - t * 3.6));
      float xd = x + (m - 0.5) * 0.22 * y + sin(t * 2.1 + seed + y * 3.0) * 0.03 * y;   // 위로 갈수록 크게 흔들림
      float w = (0.3 - 0.24 * y) * (0.75 + 0.55 * n);   // 위로 갈수록 가늘어지는 혀 모양
      float body = smoothstep(w, w * 0.25, abs(xd)) * smoothstep(1.0, 0.3 + 0.45 * n, y) * smoothstep(0.0, 0.1, y);
      float core = smoothstep(w * 0.6, 0.0, abs(xd)) * smoothstep(0.62, 0.05, y) * smoothstep(0.0, 0.12, y);
      float heat = body * (0.55 + 0.7 * m) + core * 0.75;
      vec3 c = mix(vec3(0.55, 0.06, 0.0), vec3(1.0, 0.42, 0.04), smoothstep(0.12, 0.55, heat));
      c = mix(c, vec3(1.0, 0.86, 0.5), smoothstep(0.75, 1.25, heat));
      gl_FragColor = vec4(c * heat * gain, 1.0); }`;
  const emberTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.35, 'rgba(255,150,50,0.8)'); gr.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new T.CanvasTexture(c); })();
  function flame(at, s, light, big = false, range) { const grp = new T.Group(); grp.position.copy(at); const fl = [];
    for (const [ox, oz, w, hgt, g] of big ? [[0, 0, 2.6, 4.6, 1.0], [-0.5, 0.3, 1.8, 3.2, 0.8], [0.55, -0.2, 1.9, 3.5, 0.8]] : [[0, 0, 2.0, 3.8, 1.0], [0, 0.05, 1.3, 2.6, 0.7]]) {
      const mat = new T.ShaderMaterial({ uniforms: { t: { value: 0 }, seed: { value: rnd() * 50 }, gain: { value: g }, uSz: { value: new T.Vector2(s * w, s * hgt) } }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      const q = new T.Mesh(new T.PlaneGeometry(1, 1), mat); q.position.set(ox * s, -0.25 * s, oz * s); q.frustumCulled = false; q.renderOrder = 2; grp.add(q); fl.push(mat); }
    const gl = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xff7a2a, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })); gl.position.y = s * 1.1; gl.scale.set(s * 6, s * 6, 1); grp.add(gl);
    // 불티: 몇 개가 흔들리며 올라가다 사라진다
    const NE = big ? 16 : 7, ep = new Float32Array(NE * 3), eg = new T.BufferGeometry(), life = [], vel = []; eg.setAttribute('position', new T.BufferAttribute(ep, 3));
    const spawn = i => { ep[i * 3] = (rnd() - 0.5) * s * (big ? 1.6 : 0.6); ep[i * 3 + 1] = s * 0.3; ep[i * 3 + 2] = (rnd() - 0.5) * s * (big ? 1.6 : 0.6); life[i] = 0.6 + rnd() * 1.2; vel[i] = [(rnd() - 0.5) * s * 0.6, s * (2.2 + rnd() * 2.2)]; };
    for (let i = 0; i < NE; i++) { spawn(i); life[i] *= rnd(); }
    const em = new T.Points(eg, new T.PointsMaterial({ map: emberTex, size: s * 0.28, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xffa040 })); em.frustumCulled = false; grp.add(em);
    let L = null; if (light) { L = new T.PointLight(0xff9a4a, light, range || s * 26, 2);   /* range: 빛이 닿는 거리(없으면 크기 × 26) */ L.position.y = s * 1.0; grp.add(L); }
    const ph = rnd() * 9; let last = 0;
    upd.push(t => { const dt = Math.min(0.05, Math.max(0, t - last)); last = t; for (const m of fl) m.uniforms.t.value = t + ph;
      const k = 0.86 + 0.08 * Math.sin(t * 9.1 + ph) + 0.06 * Math.sin(t * 23.7 + ph * 2);   // 빛 흔들림(두 박자 섞음)
      gl.material.opacity = 0.26 + 0.14 * k; if (L) L.intensity = light * k;
      for (let i = 0; i < NE; i++) { life[i] -= dt; if (life[i] <= 0) spawn(i); ep[i * 3] += (vel[i][0] + Math.sin(t * 3 + i) * s * 0.4) * dt; ep[i * 3 + 1] += vel[i][1] * dt; }
      eg.attributes.position.needsUpdate = true; });
    root.add(grp); return grp; }
  return flame;
}
