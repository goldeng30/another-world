// 3D 잔해(판자·낙엽) 만들기 — 모양은 여기서 만들고 질감은 받은 사진 재질. 같은 재질끼리 한 덩어리로 합쳐 한 번에 그린다
import { T, V } from '../core/math.js';
import { PATH, loadPropTex } from '../core/assets.js';
import { LITTER as L } from '../data/litter.js';
import { W2, U2 } from './coords.js';

export const litterFiles = () => [`${PATH.textures}${L.wood.tex}_c.webp`, `${PATH.textures}${L.wood.tex}_n.webp`, `${PATH.textures}${L.leaf.tex}_c.webp`, `${PATH.textures}${L.leaf.tex}_n.webp`];
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function tex(name, srgb) { const t = await loadPropTex(PATH.textures + name); t.flipY = false; t.anisotropy = 4; if (srgb) t.encoding = T.sRGBEncoding; t.needsUpdate = true; return t; }

// 판자 한 장: 위에서 본 윤곽(부러진 끝은 톱니) → 두께만큼 세움. 윗면은 판자 재질의 한 줄(이음새 사이)을 그대로, 옆면은 어둡게
function boardGeo(R, len, w, t, brokenA, brokenB) {
  const sh = new T.Shape(), jag = () => { const pts = [], n = 4 + Math.floor(R() * 3); for (let i = 1; i < n; i++) pts.push([R() * 7 + (i % 2) * 5, w * i / n]); return pts; };
  sh.moveTo(0, 0); sh.lineTo(len, 0);
  if (brokenB) for (const [d, y] of jag()) sh.lineTo(len - d, y); sh.lineTo(len, w); sh.lineTo(0, w);
  if (brokenA) for (const [d, y] of jag().reverse()) sh.lineTo(d, w - y); sh.lineTo(0, 0);
  const g = new T.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(-len / 2, 0, w / 2);   // 윗면 y = t, 가운데 원점
  const rows = L.wood.rows, ri = Math.floor(R() * (rows.length - 1)), y0 = rows[ri] + 3, y1 = rows[ri + 1] - 3, ppu = (y1 - y0) / w, u0 = R() * Math.max(0, 1024 - len * ppu);
  g.computeVertexNormals(); const p = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + len / 2, z = w / 2 - p.getZ(i); uv.setXY(i, (u0 + x * ppu) / 1024, (y0 + z * ppu) / 1024); const k = 0.45 + 0.55 * Math.max(0, nrm.getY(i)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
  g.setAttribute('color', new T.BufferAttribute(col, 3)); return g;
}
// 잎 한 장: 잘게 나눈 네모를 말아 올림(가장자리·끝이 들림) — 잎 그림 칸 하나
function leafGeo(R, s, cell) {
  const g = new T.PlaneGeometry(s, s, 4, 3); g.rotateX(-Math.PI / 2); const p = g.attributes.position, uv = g.attributes.uv, c = L.leaf.curl, bend = (R() - 0.5) * 0.3;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / s, z = p.getZ(i) / s; p.setY(i, (x * x * 0.6 + z * z * 1.6) * c * s + x * bend * s * 0.3); uv.setXY(i, ((cell % 4) + x + 0.5) / 4, (Math.floor(cell / 4) + z + 0.5) / 4); }
  g.computeVertexNormals(); return g;
}
const place = (g, x, y, z, yaw, tx = 0, tz = 0) => { g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(tx, yaw, tz, 'YXZ'))); g.translate(x, y, z); return g; };
function merge(list) {   // 같은 재질 모양들을 하나로(색 · 법선 · uv 포함)
  const geos = list.map(g => g.index ? g.toNonIndexed() : g), n = geos.reduce((s, g) => s + g.attributes.position.count, 0), out = new T.BufferGeometry();
  for (const [name, k] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) { if (!geos.every(g => g.attributes[name])) continue; const a = new Float32Array(n * k); let o = 0; for (const g of geos) { a.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new T.BufferAttribute(a, k)); }
  return out;
}

export async function buildLitter(W, spec) {
  const { root, ROOM } = W, S = W.S, R = rng((ROOM.seed ?? 1) * 13 + 991), wood = [], leaves = [], B = L.board, rr = (a, b) => a + (b - a) * R();
  const gy = (x, z) => S.ground(...U2(x, z));
  // 데크: 받침목 둘 + 그 위 나란한 판자
  for (const d of spec.decks || []) { const [cx, cz] = W2(...d.at), rot = d.rot || 0, n = d.n || 5, len = d.len || 130, miss = 1 + Math.floor(R() * (n - 2)), ca = Math.cos(rot), sa = Math.sin(rot);
    const at = (lx, lz) => [cx + lx * ca + lz * sa, cz - lx * sa + lz * ca];   // 데크 좌표(lx 판자 길이 방향) → 세계
    let base = Infinity; for (const [lx, lz] of [[-len / 2, -n * 12], [len / 2, -n * 12], [-len / 2, n * 12], [len / 2, n * 12], [0, 0]]) base = Math.min(base, gy(...at(lx, lz)));
    for (const s of [-1, 1]) { const g = boardGeo(R, n * (B.w + 3) + 16, B.w * 0.8, B.t * 1.4, R() < 0.3, R() < 0.3), [x, z] = at(s * len * 0.32, 0); wood.push(place(g, x, base - 1.5, z, rot + Math.PI / 2 + rr(-0.05, 0.05))); }   // 받침목
    for (let i = 0; i < n; i++) { if (i === miss && R() < 0.65) continue; const l = len * rr(0.78, 1.05), off = (i - (n - 1) / 2) * (B.w + 3), [x, z] = at(rr(-6, 6), off);
      const g = boardGeo(R, l, B.w, B.t, R() < 0.35, R() < 0.5); wood.push(place(g, x, base + B.t * 1.4 - 1.5 + rr(-0.4, 0.4), z, rot + rr(-0.04, 0.04), rr(-0.02, 0.02), rr(-0.03, 0.03))); } }
  // 흩어진 판자: 바닥에 몇 장, 하나는 다른 판자에 걸쳐 비스듬히
  for (const d of spec.boards || []) { const [cx, cz] = W2(...d.at), n = d.n || 3; let prev = null;
    for (let i = 0; i < n; i++) { const l = rr(...B.len), yaw = (d.rot || 0) + rr(-1.2, 1.2), x = cx + rr(-30, 30), z = cz + rr(-30, 30), lean = prev && R() < 0.6;
      const g = boardGeo(R, l, B.w * rr(0.85, 1.1), B.t, R() < 0.5, R() < 0.6), y = gy(x, z) - 0.6 + (lean ? B.t * 2.2 : 0);
      wood.push(place(g, x, y, z, yaw, lean ? rr(-0.05, 0.05) : rr(-0.02, 0.02), lean ? rr(0.08, 0.16) * (R() < 0.5 ? -1 : 1) : rr(-0.02, 0.02))); prev = g; } }
  // 낙엽 무더기: 가운데 두껍게 겹쳐 쌓이고 가장자리로 흩어짐
  for (const d of spec.leaves || []) { const [cu, cv, r] = d.c;
    for (let i = 0; i < (d.n || 12); i++) { const a = R() * Math.PI * 2, q = r * Math.pow(R(), 0.9), u = cu + Math.cos(a) * q, v = cv + Math.sin(a) * q, [x, z] = W2(u, v), s = rr(...L.leaf.s), pile = (1 - q / r) * 3.5;
      leaves.push(place(leafGeo(R, s, Math.floor(R() * 16)), x, S.ground(u, v) + 0.4 + pile * R() + i * 0.02, z, R() * Math.PI * 2, rr(-0.18, 0.18), rr(-0.18, 0.18))); } }
  const out = [];
  if (wood.length) { const [c, n] = await Promise.all([tex(L.wood.tex + '_c.webp', true), tex(L.wood.tex + '_n.webp')]);
    const m = new T.MeshStandardMaterial({ map: c, normalMap: n, vertexColors: true, roughness: 0.92, metalness: 0 }); m.normalScale.set(1, -1); m.color.setRGB(...L.wood.tint);
    const mesh = new T.Mesh(merge(wood), m); mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'litter:wood'; root.add(mesh); out.push(mesh); }
  if (leaves.length) { const [c, n] = await Promise.all([tex(L.leaf.tex + '_c.webp', true), tex(L.leaf.tex + '_n.webp')]);
    const m = new T.MeshStandardMaterial({ map: c, normalMap: n, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.85, metalness: 0 }); m.normalScale.set(1, -1); m.color.setRGB(...L.leaf.tint);
    const sat = L.leaf.sat ?? 1; m.customProgramCacheKey = () => 'leaf-sat'; m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\ndiffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), diffuseColor.rgb, ${sat.toFixed(2)});`); };   // 채도 낮추기
    const mesh = new T.Mesh(merge(leaves), m); mesh.receiveShadow = true; mesh.name = 'litter:leaves'; root.add(mesh); out.push(mesh); }
  return out;
}
