// 채집물 표시: 배경 소품과 구분되게 — 가장자리가 은은하게 숨 쉬듯 빛나고(테두리 빛), 발밑에 옅은 빛 고리, 작은 빛 알갱이 몇 개가 천천히 피어오른다
// 소품 정보(data/props.js)에 gather: true 인 소품은 놓을 때 저절로 붙는다
import { T } from '../core/math.js';
import { glowTex as GLOW } from './textures.js';

export const GATHER = { rimColor: 0xd6ffd0, rim: [0.22, 0.45], pulse: 1.6, ring: [0.1, 0.2], ringK: 1.6, motes: 2, moteColor: 0xe6ffd8, moteSize: 9, rise: 9, life: [1.6, 2.8] };
const RIM = { value: GATHER.rim[0] }, PATCHED = new WeakSet();

// 테두리 빛: 보는 방향과 면이 비스듬할수록(가장자리) 빛을 더한다. 같은 소품끼리 재질을 같이 쓰니 한 번만
function patch(mat) { if (PATCHED.has(mat)) return; PATCHED.add(mat);
  mat.onBeforeCompile = sh => { sh.uniforms.uRim = RIM; sh.uniforms.uRimCol = { value: new T.Color(GATHER.rimColor) };
    sh.fragmentShader = 'uniform float uRim;\nuniform vec3 uRimCol;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float fr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition))); totalEmissiveRadiance += uRimCol * uRim * fr * fr; }'); };
  mat.customProgramCacheKey = () => 'gather-rim'; mat.needsUpdate = true; }

export function gatherTools(W) {
  const { root, upd } = W, emit = []; let pts = null, geo = null, M = null, last = 0;
  const rr = (a, b) => a + Math.random() * (b - a);   // 방 배치 난수(W.rnd)는 건드리지 않는다(배치가 바뀌지 않게)
  function spawn(q, first) { const e = emit[q.e]; q.ox = rr(-e.r, e.r); q.oz = rr(-e.r, e.r); q.y = e.h * rr(0.2, 0.7); q.life = rr(...GATHER.life); q.age = first ? rr(0, q.life) : 0; }
  function build() { const n = emit.length * GATHER.motes; M = []; for (let e = 0; e < emit.length; e++) for (let k = 0; k < GATHER.motes; k++) { const q = { e }; spawn(q, true); M.push(q); }
    geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3));
    pts = new T.Points(geo, new T.PointsMaterial({ map: GLOW(), size: GATHER.moteSize, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    pts.frustumCulled = false; pts.renderOrder = 3; root.add(pts); }
  const base = new T.Color(GATHER.moteColor);
  // 발밑 빛 고리: 모든 채집물이 같은 모양·재질을 같이 쓴다(세기도 한꺼번에)
  const ringGeo = new T.CircleGeometry(1, 32), ringMat = new T.MeshBasicMaterial({ map: GLOW(), color: GATHER.rimColor, transparent: true, opacity: GATHER.ring[0], blending: T.AdditiveBlending, depthWrite: false }); ringGeo.rotateX(-Math.PI / 2);
  upd.push(t => { const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
    const w = 0.5 + 0.5 * Math.sin(t * GATHER.pulse), k = w * w * (3 - 2 * w); RIM.value = GATHER.rim[0] + (GATHER.rim[1] - GATHER.rim[0]) * k; ringMat.opacity = GATHER.ring[0] + (GATHER.ring[1] - GATHER.ring[0]) * k;
    if (!emit.length) return; if (!pts) build();
    const P = geo.attributes.position.array, C = geo.attributes.color.array;
    M.forEach((q, i) => { q.age += dt; if (q.age >= q.life) spawn(q, false); const e = emit[q.e], u = q.age / q.life, a = Math.sin(Math.PI * u);   // 피어올랐다 사라짐
      P[i * 3] = e.x + q.ox; P[i * 3 + 1] = q.y + GATHER.rise * q.age; P[i * 3 + 2] = e.z + q.oz; C[i * 3] = base.r * a; C[i * 3 + 1] = base.g * a; C[i * 3 + 2] = base.b * a; });
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; });
  // 채집물로 표시: 재질에 테두리 빛, 위치에 빛 알갱이
  function markGather(m) { patch(m.material); const b = m.geometry.boundingBox, s = m.scale.x, fw = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * s;
    const ring = new T.Mesh(ringGeo, ringMat); ring.position.set(m.position.x, 1.4, m.position.z); ring.scale.setScalar(fw * 0.5 * GATHER.ringK + 6); ring.renderOrder = 1; root.add(ring);
    emit.push({ x: m.position.x, z: m.position.z, r: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * s * 0.4, h: (b.max.y - b.min.y) * s + m.position.y }); }
  markGather.count = () => emit.length;
  markGather.reset = n => { emit.length = n; if (pts) { root.remove(pts); geo.dispose(); pts.material.dispose(); pts = null; } };   // n개만 남기고 빛 알갱이는 다시 만든다
  return markGather;
}
