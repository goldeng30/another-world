// 채집물이 나올 수 있는 범위: 방 바닥을 칸으로 나눠, 벽·물건(소품·바위·석순)·출구 굴·들어온 통로·시작 자리 근처를 빼고 남은 칸
// 방 데이터 gather: { show: true(바닥에 표시), wall: 벽·어둠 경계에서 띄울 거리, gap: 물건에서 띄울 거리, exitBack: 출구 굴 입구 앞으로 비울 거리,
//   exclude: [[u, v, 반지름], …] 따로 뺄 자리, smooth: 가늘게 삐져나온 곳을 지우는 정도(칸), cell: 칸 크기 }
import { T } from '../core/math.js';
import { W2, U2, WV } from './coords.js';
import { isSharedAsset } from './props.js';

export function buildSpawnArea(W, opt = {}) {
  const { ROOM, root } = W, { sdfUV, EXITS, inTunnel, pastMouth } = W.S;
  const wall = opt.wall ?? 45, gap = opt.gap ?? 22, cell = opt.cell ?? 6, startR = opt.start ?? 150, exitBack = opt.exitBack ?? 70, exclude = opt.exclude || [], smooth = opt.smooth ?? 3;
  // 물건 자리(바닥 원): 소품은 모델 바닥 크기, 바위는 크기, 부딪힘 원도 함께
  const blocks = [];
  root.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !isSharedAsset(o.geometry)) return; const b = o.geometry.boundingBox, s = o.scale.x;
    if (b) blocks.push([o.position.x, o.position.z, 0.5 * Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * s]); });
  for (const L of (W.R && W.R.rockLists) || []) for (const r of L) blocks.push([r.x, r.z, r.s * 0.95]);
  for (const c of W.colliders) blocks.push([c.x, c.z, c.r]);
  for (const s of W.slots || []) blocks.push([s.x, s.z, (s.p.col || 20) + 30]);   // 무작위 토템이 설 자리
  const [su, sv] = ROOM.spawn, E = ROOM.entry;
  const ok = (u, v) => { if (sdfUV(u, v) > -wall) return false;
    if (Math.hypot(u - su, v - sv) < startR) return false;                                   // 시작 자리
    if (E && Math.abs(u - E.a[0]) < E.r + 40 && v < E.a[1] + 40) return false;               // 들어온 통로
    for (const e of EXITS) { const side = Math.abs(-(u - e.m[0]) * e.d[1] + (v - e.m[1]) * e.d[0]); if (side < e.r + 60 && pastMouth(u, v, e) > -exitBack) return false; }   // 출구 굴과 그 앞(들어가는 길)
    for (const [eu, ev, er] of exclude) if (Math.hypot(u - eu, v - ev) < er) return false;              // 따로 뺀 자리
    const [x, z] = W2(u, v); for (const [bx, bz, br] of blocks) if (Math.hypot(x - bx, z - bz) < br + gap) return false;
    return true; };
  // 범위: 방 모양이 있는 사각형(u, v)
  const u0 = -900, u1 = 900, v0 = -560, v1 = 560, nu = Math.ceil((u1 - u0) / cell), nv = Math.ceil((v1 - v0) / cell), mask = new Uint8Array(nu * nv);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) if (ok(u0 + (i + 0.5) * cell, v0 + (j + 0.5) * cell)) mask[j * nu + i] = 1;
  // 가늘게 삐져나온 곳 지우기: 깎았다가(침식) 다시 불리기(팽창) — smooth 칸보다 좁은 띠는 사라진다
  const morph = (src, keep) => { const out = new Uint8Array(src.length); for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { let all = true, any = false;
      for (let dj = -smooth; dj <= smooth; dj++) for (let di = -smooth; di <= smooth; di++) { if (di * di + dj * dj > smooth * smooth) continue; const ii = i + di, jj = j + dj, val = ii >= 0 && jj >= 0 && ii < nu && jj < nv ? src[jj * nu + ii] : 0; if (val) any = true; else all = false; }
      out[j * nu + i] = keep === 'erode' ? (all ? 1 : 0) : (any ? 1 : 0); } return out; };
  if (smooth > 0) { const o2 = morph(morph(mask, 'erode'), 'dilate'); for (let k = 0; k < mask.length; k++) mask[k] = mask[k] & o2[k]; }
  let n = 0; for (let k = 0; k < mask.length; k++) n += mask[k];
  const area = { cell, u0, v0, nu, nv, mask, count: n, isFree: (u, v) => { const i = Math.floor((u - u0) / cell), j = Math.floor((v - v0) / cell); return i >= 0 && j >= 0 && i < nu && j < nv && !!mask[j * nu + i]; } };
  if (opt.show) area.mesh = showArea(area, root, opt.color ?? 0x5dff8a);
  return area;
}

// 바닥 위에 반투명하게 칠해 보이기(가장자리는 진하게)
function showArea(A, root, color) { const { nu, nv, mask } = A, data = new Uint8Array(nu * nv * 4), c = new T.Color(color);
  const at = (i, j) => i >= 0 && j >= 0 && i < nu && j < nv ? mask[j * nu + i] : 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { if (!at(i, j)) continue; const edge = !(at(i - 1, j) && at(i + 1, j) && at(i, j - 1) && at(i, j + 1)), k = (j * nu + i) * 4;
    data[k] = c.r * 255; data[k + 1] = c.g * 255; data[k + 2] = c.b * 255; data[k + 3] = edge ? 230 : 38; }
  const tex = new T.DataTexture(data, nu, nv, T.RGBAFormat); tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter; tex.needsUpdate = true;
  const geo = new T.PlaneGeometry(nu * A.cell, nv * A.cell); geo.rotateX(-Math.PI / 2);
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }); mat.userData.ownsMap = true;
  const m = new T.Mesh(geo, mat); m.rotation.y = Math.PI / 4; m.position.copy(WV(A.u0 + nu * A.cell / 2, A.v0 + nv * A.cell / 2, 2)); m.renderOrder = 1; root.add(m); return m; }
