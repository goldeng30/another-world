// 가벼운 고블린: goblin.orig.glb(삼각형 1만 4천) → goblin.glb(목표 삼각형 수). 뼈대·피부 가중치·UV·동작은 그대로
//   필요: npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4 meshoptimizer  (package.json 은 안 바꿈)
//   사용: node tools/asset-pipeline/lite_goblin.mjs [목표삼각형=5500] [입력=assets/enemies/goblin.orig.glb] [출력=assets/enemies/goblin.glb]
// 줄이는 법: meshoptimizer simplifyWithAttributes — 위치 + 법선 + UV + "뼈 자리"(피부 가중치로 섞은 관절 위치)를 함께 보고 모서리를 접는다
//   → 다른 뼈에 붙은 점끼리(겨드랑이·손가락 사이·다리 사이) 합쳐져 움직일 때 찢어지는 것을 막는다
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { compactPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [TARGET = '5500', IN = 'assets/enemies/goblin.orig.glb', OUT = 'assets/enemies/goblin.glb'] = process.argv.slice(2);
const W = { nrm: 0.35, uv: 0.6, bone: 1.2 };   // 속성 무게: 법선 · UV · 뼈 자리

const SMOOTH = 60;   // 같은 자리 점들의 법선이 이 각도(도) 안이면 평균 내어 하나로(원본은 거의 모든 점이 법선만 조금 달라 갈라져 있어 줄이기가 막힌다)

await MeshoptSimplifier.ready;
const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);   // 속성을 따로따로(게임 코드가 skinIndex.array 를 바로 읽음 — 섞어 쓰면(기본값) 깨짐)
const doc = await io.read(path.resolve(ROOT, IN));
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) smoothSplitNormals(prim, SMOOTH);
await doc.transform(weld());   // 똑같은 점 합치기(법선을 맞춘 뒤라 UV 이음매만 남는다)
const skin = doc.getRoot().listSkins()[0], ibm = skin.getInverseBindMatrices().getArray();
// 관절 위치(메시 바인드 공간) = 역바인드 행렬의 역행렬의 이동 성분
const jpos = []; for (let k = 0; k < skin.listJoints().length; k++) jpos.push(jointPos(ibm.subarray(k * 16, k * 16 + 16)));
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const P = prim.getAttribute('POSITION').getArray(), N = prim.getAttribute('NORMAL').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray();
  const J = prim.getAttribute('JOINTS_0'), Wt = prim.getAttribute('WEIGHTS_0'), n = P.length / 3, idx = new Uint32Array(prim.getIndices().getArray());
  // 크기(대각선)로 뼈 자리를 나눠 위치와 같은 단위로
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], P[i * 3 + c]); hi[c] = Math.max(hi[c], P[i * 3 + c]); }
  const ext = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const A = new Float32Array(n * 8), j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) { J.getElement(i, j4); Wt.getElement(i, w4); let ws = 0, e = [0, 0, 0];
    for (let k = 0; k < 4; k++) { ws += w4[k]; for (let c = 0; c < 3; c++) e[c] += w4[k] * jpos[j4[k]][c]; }
    A.set([N[i * 3], N[i * 3 + 1], N[i * 3 + 2], UV[i * 2], UV[i * 2 + 1], e[0] / ws / ext, e[1] / ws / ext, e[2] / ws / ext], i * 8); }
  const target = Math.floor(+TARGET) * 3;
  const [dst, err] = MeshoptSimplifier.simplifyWithAttributes(idx, new Float32Array(P), 3, A, 8, [W.nrm, W.nrm, W.nrm, W.uv, W.uv, W.bone, W.bone, W.bone], null, target, 1, []);
  const src = prim.getIndices(); prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(dst)).setBuffer(src.getBuffer())); src.dispose();
  compactPrimitive(prim); prim.getIndices().setArray(new Uint16Array(prim.getIndices().getArray()));
  console.log(`삼각형 ${idx.length / 3} → ${dst.length / 3} · 정점 ${n} → ${prim.getAttribute('POSITION').getCount()} · 오차 ${err.toFixed(4)}`);
}
await io.write(path.resolve(ROOT, OUT), doc);
console.log('저장', OUT);

// 같은 자리에 겹친 점들: 법선이 maxDeg 안으로 비슷한 것끼리 묶어 평균 법선으로(날카로운 모서리는 그대로 갈라 둔다)
function smoothSplitNormals(prim, maxDeg) { const P = prim.getAttribute('POSITION').getArray(), na = prim.getAttribute('NORMAL'), N = na.getArray().slice(), n = P.length / 3, cmin = Math.cos(maxDeg * Math.PI / 180);
  const groups = new Map(); for (let i = 0; i < n; i++) { const k = P[i * 3] + ',' + P[i * 3 + 1] + ',' + P[i * 3 + 2]; (groups.get(k) || groups.set(k, []).get(k)).push(i); }
  let merged = 0; for (const g of groups.values()) { if (g.length < 2) continue; const used = new Set();
    for (const a of g) { if (used.has(a)) continue; const cl = g.filter(b => !used.has(b) && N[a * 3] * N[b * 3] + N[a * 3 + 1] * N[b * 3 + 1] + N[a * 3 + 2] * N[b * 3 + 2] >= cmin); cl.forEach(b => used.add(b));
      let x = 0, y = 0, z = 0; for (const b of cl) { x += N[b * 3]; y += N[b * 3 + 1]; z += N[b * 3 + 2]; } const l = Math.hypot(x, y, z) || 1;
      for (const b of cl) na.setElement(b, [x / l, y / l, z / l]); merged += cl.length - 1; } }
  console.log(`법선 맞춤: ${merged}개 점`); }

// 4x4(열 우선) 역행렬의 이동 성분(크기가 들어 있어도 맞게 일반 역행렬로)
function jointPos(m) { const a = m, inv = new Float64Array(16);
  inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  const det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
  return [inv[12] / det, inv[13] / det, inv[14] / det]; }
