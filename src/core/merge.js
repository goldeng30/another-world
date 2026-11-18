// 조각 합치기: 같은 재질(같은 그림·같은 설정)인 메시들을 하나로 → 그리기 호출(그림자 포함)을 줄인다
//   재질마다 다른 무늬 반복(repeat·offset)은 조각의 uv 에 미리 구워 넣고, 합친 재질은 반복 없이 쓴다
import { T } from './math.js';

const imgId = new WeakMap(); let nextId = 1;
const idOf = im => { if (!im) return 0; if (!imgId.has(im)) imgId.set(im, nextId++); return imgId.get(im); };
const MAPS = ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap'];
function keyOf(m) {
  const k = [m.type, m.side, m.vertexColors, m.transparent, m.opacity, m.color && m.color.getHex(), m.roughness, m.metalness, m.bumpScale, m.envMapIntensity, m.emissive && m.emissive.getHex(), m.flatShading];
  for (const n of MAPS) { const t = m[n]; k.push(n, t ? idOf(t.image) + ':' + t.wrapS + ':' + t.encoding : 0); }
  return k.join('|');
}

export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), drop = [];
  root.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.morphTargetInfluences) return;
    const k = keyOf(o.material); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
  const out = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const m0 = list[0].material, hasCol = !!m0.vertexColors, P = [], N = [], U = [], C = [], I = []; let base = 0;
    for (const o of list) { const g = o.geometry, M = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld), NM = new T.Matrix3().getNormalMatrix(M);
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color, t = o.material.map, v = new T.Vector3();
      const rx = t ? t.repeat.x : 1, ry = t ? t.repeat.y : 1, ox = t ? t.offset.x : 0, oy = t ? t.offset.y : 0;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(M); P.push(v.x, v.y, v.z);
        if (na) { v.fromBufferAttribute(na, i).applyMatrix3(NM).normalize(); N.push(v.x, v.y, v.z); } else N.push(0, 1, 0);
        if (ua) U.push(ua.getX(i) * rx + ox, ua.getY(i) * ry + oy); else U.push(0, 0);
        if (hasCol) { if (ca) C.push(ca.getX(i), ca.getY(i), ca.getZ(i)); else C.push(1, 1, 1); } }
      const flip = M.determinant() < 0;   // 뒤집힌 조각은 면 방향을 바로잡는다
      if (g.index) { const ix = g.index; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i) + base, b = ix.getX(i + 1) + base, c = ix.getX(i + 2) + base; if (flip) I.push(a, c, b); else I.push(a, b, c); } }
      else for (let i = 0; i < pa.count; i += 3) { if (flip) I.push(base + i, base + i + 2, base + i + 1); else I.push(base + i, base + i + 1, base + i + 2); }
      base += pa.count; drop.push(o); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    if (hasCol) geo.setAttribute('color', new T.Float32BufferAttribute(C, 3)); geo.setIndex(I); geo.computeBoundingSphere();
    const mat = m0.clone(); for (const n of MAPS) if (mat[n]) { const t = mat[n].clone(); t.repeat.set(1, 1); t.offset.set(0, 0); t.needsUpdate = true; mat[n] = t; }   // 반복은 uv 에 구웠다
    const mesh = new T.Mesh(geo, mat); mesh.castShadow = list.some(o => o.castShadow); mesh.receiveShadow = list.some(o => o.receiveShadow); mesh.name = list[0].name; out.push(mesh); }
  for (const o of drop) { o.parent.remove(o); o.geometry.dispose(); }
  for (const m of out) root.add(m);
  return root;
}
