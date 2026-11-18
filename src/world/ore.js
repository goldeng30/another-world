// 광석(캘 수 있는 자리): 바닥 넓이를 같게 맞추고, 결정 부분(_emi 질감에서 고른 자리)이 숨 쉬듯 제 색으로 빛난다 + 위로 은은한 빛 번짐 + 작은 빛 + 바닥 빛
// dead: 캐고 난 뒤(부서진 모습, 빛 없음). 만든 광석은 W.interactables 에 들어간다(채굴 상호작용용)
import { T, V } from '../core/math.js';
import { PATH, tryPropTex } from '../core/assets.js';
import { loadProp } from './props.js';
import { PROPS } from '../data/props.js';
import { glowTex as GLOW } from './textures.js';

export function oreTools(W) {
  const { root, upd, rnd, prop } = W, glowTex = GLOW();
  async function manaOre(name, u, v, col, pow, deep, dead = false, opt = {}) { const ore = { id: name, kind: 'ore', dead, mesh: null }; const P = await loadProp(name); if (!P) return null; const b = P.geo.boundingBox, s = 46 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);   // 바닥 넓이 46으로 통일
    const em = (PROPS[name] || {}).emi === false ? null : await tryPropTex(PATH.props + name + '_emi.webp'); if (em) { em.flipY = false; P.mat.emissiveMap = em; P.mat.emissive = new T.Color(col); P.mat.onBeforeCompile = sh => { sh.uniforms.uOre = { value: new T.Color(...deep) }; sh.fragmentShader = 'uniform vec3 uOre;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n{ float em = texture2D(emissiveMap, vUv).r, lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, uOre * (0.25 + 0.75 * lu), em); }'); }; P.mat.customProgramCacheKey = () => 'ore-glow'; P.mat.needsUpdate = true; }   // 결정 부분은 바탕을 어둡게 해서 빛이 하얗게 뜨지 않고 제 색으로 빛나게 P.mat.color.setRGB(0.66, 0.64, 0.62);
    const m = await prop(name, u, v, s, { face: [rnd() - 0.5, -1], col: 20, keep: 50 }); if (!m) return null; ore.mesh = m; W.interactables.push(ore); if (dead) { P.mat.emissiveIntensity = 0; return ore; }
    const top = b.max.y * s, halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false })); halo.position.copy(m.position).add(V(0, top * 0.6, 0)); halo.scale.set(75 * pow, 75 * pow, 1); root.add(halo);
    const L = opt.light === false ? null : new T.PointLight(col, 0.5 * pow, 95, 1.6); if (L) { L.position.copy(m.position).add(V(0, top + 14, 0)); root.add(L); } const ph = rnd() * 6;
    // 바닥에 은은하게 번지는 빛(제 색)
    const pool = new T.Mesh(new T.CircleGeometry(1, 40), new T.MeshBasicMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(m.position.x, 1.2, m.position.z); pool.scale.setScalar(62 * pow); pool.renderOrder = 1; root.add(pool);
    upd.push(t => { const w = 0.5 + 0.5 * Math.sin(t * 1.1 + ph), k = w * w * (3 - 2 * w);   // 은은하게 빛났다가 줄었다가(약 5.7초 한 번)
      P.mat.emissiveIntensity = (0.22 + 0.3 * k) * pow; halo.material.opacity = (0.03 + 0.07 * k) * pow; if (L) L.intensity = (0.35 + 0.55 * k) * pow; pool.material.opacity = (0.16 + 0.2 * k) * pow; }); Object.assign(ore, { halo, light: L, pool }); return ore; }
  return manaOre;
}
