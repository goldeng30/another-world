// 방 만들기: 방 데이터(data/rooms/*.js) → 바닥 · 벽 · 소품 · 불 · 광석 · 토템 · 바위
// 모든 방 공통 순서: 자산 미리 받기(병렬) → 모양 → 표면 → 바닥 → 벽 → 배치(place 차례대로) → 바위·석순
import { T, V, makeRng } from '../core/math.js';
import { W2, U2, WV } from './coords.js';
import { createShape } from './shape.js';
import { loadSurfaces, createSurfaces } from './surfaces.js';
import { buildFloor } from './floor.js';
import { buildWalls } from './walls.js';
import { loadWallKit } from './wallkit.js';
import { createLightPool } from './lightpool.js';
import { rockTools, placeRocks } from './rocks.js';
import { buildDecals } from './decals.js';
import { buildStones } from './stones.js';
import { buildLitter } from './litter.js';
import { buildAmbience } from './ambience.js';
import { ROCK_KIT } from '../data/rocks.js';
import { flameTools } from './flame.js';
import { loadProp, propTools, isSharedAsset } from './props.js';
import { totemTools } from './totem.js';
import { oreTools } from './ore.js';
import { gatherTools } from './gather.js';
import { PATH, tryPropTex } from '../core/assets.js';
import { makeLabel } from './label.js';
import { buildSpawnArea } from './spawnArea.js';
import { PROPS } from '../data/props.js';

// 방에서 쓰는 소품 이름 모두(미리 받기용)
export function roomProps(ROOM) { const s = new Set();
  for (const p of ROOM.place) { const n = p.prop || p.ore || p.wallProp; if (n) s.add(n); if (p.wallTorches) s.add('torchw'); }
  for (const n of (ROOM.rocks && ROOM.rocks.stalagmites) || []) s.add(n);
  return [...s]; }

export async function buildRoom(G, ROOM) {
  const root = new T.Group(); root.name = 'room:' + ROOM.id; G.scene.add(root);
  const W = { G, ROOM, root, upd: [], colliders: [], KEEP: [], interactables: [], rnd: makeRng(ROOM.seed ?? 12345), rockRnd: makeRng((ROOM.seed ?? 12345) + 7919), slots: [] };   // rockRnd: 바위·석순 전용(다른 배치가 바뀌어도 바위는 그대로)
  // 자산 미리 받기: 표면 질감 · 소품 · 광석 빛 질감을 한꺼번에(병렬)
  const ores = ROOM.place.filter(p => p.ore).map(p => p.ore);
  const [PX] = await Promise.all([loadSurfaces(ROOM.surfaces), ...roomProps(ROOM).map(loadProp), ...ores.filter(n => (PROPS[n] || {}).emi !== false).map(n => tryPropTex(PATH.props + n + '_emi.webp'))]);
  W.PX = PX;
  W.S = createShape(ROOM);
  Object.assign(W, createSurfaces(W));
  buildFloor(W);
  if (ROOM.wallKit && ROOM.walls !== false) W.kitGeo = await loadWallKit();   // 벽 조각 모양 미리 받기
  W.WL = ROOM.walls === false ? { LOOPS: [], WALL: [], H_MIN: 45, wallSpot: () => null, wallOff: () => 0 } : buildWalls(W);   // 전시장 같은 방은 벽 없이
  W.R = rockTools(W);
  W.flame = flameTools(W);
  W.kept = (x, z) => W.KEEP.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r);
  const keepAt = (u, v, r) => { const [x, z] = W2(u, v); W.KEEP.push([x, z, r]); };
  Object.assign(W, propTools(W));
  W.totemEyes = totemTools(W); W.manaOre = oreTools(W); W.markGather = gatherTools(W);

  // ── 배치 ──
  for (const e of W.S.EXITS) { keepAt(e.m[0], e.m[1] - 40, e.r + 50); keepAt(e.m[0], e.m[1] + 120, e.r + 40); }   // 출구 앞은 비워 둔다
  const named = {};
  for (const p of ROOM.place) await placeOne(W, p, named);
  if (ROOM.rocks !== false) await placeRocks(W, ROOM.rocks || {});
  const ST = ROOM.stones ? await buildStones(W, ROOM.stones) : null;   // 자잘한 돌 무더기(3D)
  if (ROOM.litter) await buildLitter(W, ROOM.litter);   // 3D 잔해: 판자 · 낙엽
  if (ROOM.rim || ROOM.ceiling || ROOM.stalactites || ROOM.lights || ROOM.dust || ROOM.contact) await buildAmbience(W, ROOM);   // 분위기: 경계 바위 벽 · 종유석 · 빛 · 먼지 · 접촉 그림자
  if (ROOM.decals || (ST && ROOM.stones.grit)) {   // 바닥 디테일(평면 그림) — 돌 무더기 밑엔 아주 작은 자갈을 깔아 땅에 붙게
    const D = { ...(ROOM.decals || {}) }; if (ST && ROOM.stones.grit) D.at = [...(D.at || []), ...ST.piles.map(p => ({ k: 'grit', at: [p.u, p.v], s: p.r * 2.6 }))];
    await buildDecals(W, D); }
  const spawnArea = ROOM.gather ? buildSpawnArea(W, ROOM.gather) : null;   // 채집물이 나올 수 있는 범위
  let spawned = W.slots.length || (spawnArea && ROOM.gather.spawn) ? await spawnRandom(W, spawnArea) : null;   // 들어올 때마다 바뀌는 것: 출구 토템 · 채집물

  // 동굴은 모든 재질 주변광 세기를 같게(어둡게) 통일
  root.traverse(o => { if (o.material) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) m.envMapIntensity = G.ENV_K; });

  // 그림자 규칙: 그림자는 방 안에 서 있는 큰 물체만 만든다(높이 70 이상 또는 넓이 120 이상, 바닥에 닿아 있고 벽 밖이 아닌 것). 걸린 것·작은 것·자잘한 돌·바닥 잔해는 안 만든다(그림자 판에 두 번 그리는 양 줄이기)
  { const bb = new T.Box3(); root.traverse(o => { if (!o.isMesh || !o.castShadow) return; if (/^(stones|litter|decals|floor|wall)/.test(o.name || '')) { o.castShadow = false; return; }
      bb.setFromObject(o); const h = bb.max.y - bb.min.y, w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, [cu, cv] = U2(cx, cz);
      o.castShadow = (h >= 70 || w >= 120) && bb.min.y < W.S.ground(cu, cv) + 25 && W.S.sdfUV(cu, cv) < 30; }); }
  const LP = createLightPool(root); LP(performance.now() / 1000, WV(...ROOM.spawn));   // 불빛 모으기: 가까운 몇 개만 진짜 빛(그리기 전에 한 번 돌려 둔다)
  const { clamp, sdfUV, EXITS, heroDark, viewEdges, ground } = W.S;
  return {
    data: ROOM, lighting: ROOM.lighting || {}, spawnArea, root, colliders: W.colliders, interactables: W.interactables, exits: EXITS, clamp,
    spawn: WV(...ROOM.spawn), spawnYaw: Math.atan2(...W2(...(ROOM.spawnFace || [0, 1]))),   // 들어온 자리 · 처음 보는 방향(기본: 방 안쪽 = 화면 위)
    sdf: (x, z) => sdfUV(...U2(x, z)), uv: U2, world: W2,
    walls: W.WL, heroDark: (x, z) => heroDark(...U2(x, z)), edges: viewEdges, groundY: (x, z) => ground(...U2(x, z)),   // groundY: 그 자리 바닥 높이   // 굴 안 어둠(주인공) · 카메라 시야 막기용 경계
    update: (t, hp) => { for (const f of W.upd) f(t, hp); LP(t, hp); },
    // 채집물 다시 뽑기: 지난번에 놓은 것(모델·빛·부딪힘·표시)을 치우고 새로
    async reroll() { if (!spawned) return; spawned.clear(); spawned = await spawnRandom(W, spawnArea); },
    dispose() { root.traverse(o => { if (o.geometry && !isSharedAsset(o.geometry)) o.geometry.dispose(); if (o.material) for (const m of [].concat(o.material)) if (!isSharedAsset(m)) { if (m.userData.ownsMap && m.map) m.map.dispose(); m.dispose(); } }); G.scene.remove(root); },
  };
}

// 들어올 때마다 바뀌는 것(방 배치 난수와 따로, 매번 다르게)
//   출구 토템: 자리는 고정, 종류만 totems.pool 에서 서로 다르게 · 채집물: 범위 안에서 몸통이 다 들어가는 자리 + 다른 채집물과 minGap 이상 떨어진 자리만
async function spawnRandom(W, area) {
  const mark = { kids: new Set(W.root.children), upd: W.upd.length, col: W.colliders.length, it: W.interactables.length, emit: W.markGather.count() };
  const R = Math.random, pickOf = a => a[Math.floor(R() * a.length)], ROOM = W.ROOM;
  if (W.slots.length && ROOM.totems) { const pool = [...ROOM.totems.pool]; W.totemEyes.reset();
    for (const s of W.slots) { const name = pool.splice(Math.floor(R() * pool.length), 1)[0]; if (!name) break;
      await placeOne(W, { ...s.p, totemSlot: undefined, prop: name }, {}); const ex = W.S.EXITS[s.p.totemSlot]; if (ex) { ex.room = (PROPS[name] || {}).room; const E = W.totemEyes.list[W.totemEyes.list.length - 1]; if (E) E.exit = ex; } } }   // 출구 너머 방 = 토템이 알리는 방
  const o = ROOM.gather && ROOM.gather.spawn; if (!area || !o) return { clear: () => undoRandom(W, mark) };
  const free = []; for (let j = 0; j < area.nv; j++) for (let i = 0; i < area.nu; i++) if (area.mask[j * area.nu + i]) free.push([area.u0 + (i + 0.5) * area.cell, area.v0 + (j + 0.5) * area.cell]);
  const fits = (u, v, r) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (!area.isFree(u + Math.cos(a) * r, v + Math.sin(a) * r)) return false; } return area.isFree(u, v); };
  const taken = [];
  const spot = r => { for (let t = 0; t < 600 && free.length; t++) { const [u, v] = pickOf(free); if (!fits(u, v, r) || taken.some(([tu, tv]) => Math.hypot(tu - u, tv - v) < o.minGap)) continue; taken.push([u, v]); return [u, v]; } return null; };
  for (let i = 0; i < (o.ores || 0); i++) { const at = spot(28); if (at) await placeOne(W, { ore: pickOf(o.orePool), at }, {}); }
  for (let i = 0; i < (o.herbs || 0); i++) { const at = spot(16), name = pickOf(o.herbPool); if (!at) continue;
    const hm = await placeOne(W, { prop: name, at, fit: o.herbFit || 22, face: [R() - 0.5, -1] }, {}); W.interactables.push({ id: name, kind: 'herb', at, mesh: hm || null }); }
  return { clear: () => undoRandom(W, mark) };
}
function undoRandom(W, mark) {   // 이번에 더한 것만 되돌린다(모델·빛·부딪힘·표시·눈빛)
  for (const c of [...W.root.children]) if (!mark.kids.has(c)) { W.root.remove(c); c.traverse(o => { if (o.geometry && !isSharedAsset(o.geometry)) o.geometry.dispose(); }); }
  W.upd.length = mark.upd; W.colliders.length = mark.col; W.interactables.length = mark.it; W.markGather.reset(mark.emit); W.totemEyes.reset(); }

// 배치 한 줄: prop(바닥 소품) · ore(광석) · wallProp(벽에 거는 소품) · wallTorches(벽 횃불 한 쌍)
async function placeOne(W, p, named) {
  if (p.totemSlot !== undefined) { const [x, z] = W2(p.at[0], p.at[1]); if (p.keep) W.KEEP.push([x, z, p.keep]); W.slots.push({ p, x, z }); return; }   // 토템 자리만 잡아 둔다(바위가 안 오게) — 토템은 나중에 무작위로
  if (p.label) { const lb = makeLabel(p.label); lb.position.copy(WV(p.at[0], p.at[1] - (p.labelGap || 62), 1)); W.root.add(lb); }   // 이름표(전시장): 바닥에 눕혀서
  if (p.rock) { const K = ROCK_KIT[p.rock] || {}; await W.rock(p.rock, p.at[0], p.at[1], p.s ?? K.s ?? 100, p); return; }   // 바위 에셋
  if (p.prop) {
    let s = p.s ?? (PROPS[p.prop] || {}).s; if (p.fit) { const P = await loadProp(p.prop); if (P) { const b = P.geo.boundingBox; s = p.fit * ((PROPS[p.prop] || {}).fitK || 1) / Math.max(b.max.x - b.min.x, b.max.z - b.min.z); } }   // fit: 바닥 넓이를 이 값으로 맞춘 크기
    const m = await W.prop(p.prop, p.at[0], p.at[1], s, { face: p.face, turn: p.turn, tilt: p.tilt, y: p.y, col: p.col, keep: p.keep }); if (!m) return;
    if (p.lineCol) W.lineCol(m, ...p.lineCol);   // 긴 소품: 길이 방향으로 부딪힘 원 몇 개
    if (p.flame) { const f = p.flame, at = f.local ? m.localToWorld(V(...f.local)) : W.topOf(m).add(V(0, f.dy || 0, 0)); W.flame(at, f.size, f.light, !!f.big, f.range); }
    if (p.name) named[p.name] = m;
    return m;
  } else if (p.ore) { const O = (PROPS[p.ore] || {}).ore || {}; await W.manaOre(p.ore, p.at[0], p.at[1], p.color ?? O.color ?? 0xffffff, p.pow ?? O.pow ?? 0, p.deep ?? O.deep ?? [0.5, 0.5, 0.5], !!p.dead, { light: p.light ?? O.light ?? !O.color }); }   // 새 광석은 점광원 없이(빛 번짐·바닥 빛만)
  else if (p.wallProp) { const m = await W.wallProp(p.wallProp, p.at[0], p.at[1], p.s, p.y); if (m && p.name) named[p.name] = m; }
  else if (p.wallTorches) { const o = p.wallTorches, c = o.around && named[o.around];
    if (o.at) { for (const [tu, tv] of o.at) await W.wallTorch(tu, tv, o.light, o.range); }   // at: [[u, v], ...] 그 자리 가까운 벽에 하나씩
    else if (c) { const [cu, cv] = U2(c.position.x, c.position.z); for (const sg of [-1, 1]) await W.wallTorch(cu + sg * o.gap, cv, o.light, o.range); }
    else for (const e of W.S.EXITS) { const side = [e.d[1], -e.d[0]], out = e.m[0] < 0 ? -1 : 1, off = e.r + 110; await W.wallTorch(e.m[0] - side[0] * out * off, e.m[1] - side[1] * out * off - 15, 1.2); } }   // 기준 소품이 없으면 출구마다 바깥쪽 벽에
}
