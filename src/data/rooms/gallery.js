// 전시장: 흙바닥에 세 줄로 — 뒤 토템 · 가운데 광석 · 앞 채집물. 같은 종류끼리 한 줄(화면 가로), 이름표는 앞에
// 새 자산을 보려면 아래 목록에 한 줄 더하면 된다(광석 빛·토템 눈빛·크기는 data/props.js 의 소품 정보대로)
import { PROPS } from '../props.js';
import { ROCK_KIT } from '../rocks.js';
import { FLOOR_DECALS } from '../decals.js';

const ORES = [
  { ore: 'mana4', color: 0x1f5cff, pow: 0.8, deep: [0.12, 0.3, 0.85], label: '마석 하급' },
  { ore: 'mana5', color: 0x1f5cff, deep: [0.12, 0.3, 0.85], dead: true, label: '마석 하급 · 캔 뒤' },
  { ore: 'mana0', color: 0x0aa88a, pow: 1.0, deep: [0.04, 0.5, 0.42], label: '마석 중급' },
  { ore: 'mana1', color: 0x0aa88a, deep: [0.04, 0.5, 0.42], dead: true, label: '마석 중급 · 캔 뒤' },
  { ore: 'mana2', color: 0x5a18d0, pow: 1.1, deep: [0.36, 0.1, 0.72], label: '마석 상급' },
  { ore: 'mana3', color: 0x5a18d0, deep: [0.36, 0.1, 0.72], dead: true, label: '마석 상급 · 캔 뒤' },
  ...[['blackiron', '흑철석'], ['bluesteel', '청강석'], ['meteor', '운철'], ['bloodstone', '혈석'], ['ambereye', '호박안'], ['jade', '녹옥']]
    .flatMap(([n, k]) => [{ ore: n, label: k }, { ore: n + '_m', dead: true, label: k + ' · 캔 뒤' }]),
];
const HERBS = [   // 회복약 재료 → 버프 물약 재료
  { prop: 'mush1', label: '잿갓' }, { prop: 'dimmoss', label: '흡광이끼' }, { prop: 'stonebud', label: '석아초' }, { prop: 'mush3', label: '삼두갓' },
  { prop: 'darkbloom', label: '무광화' }, { prop: 'scalecap', label: '용린갓' }, { prop: 'veinroot', label: '지맥근' }, { prop: 'bloodroot', label: '혈맥근' },
  { prop: 'mush0', label: '층암균 · 방어' }, { prop: 'ironleaf', label: '철엽초 · 방어' }, { prop: 'mush2', label: '실대갓 · 이동 속도' }, { prop: 'bloodspot', label: '혈흔균 · 공격력' },
  { prop: 'lanterncap', label: '청등갓 · 치명타' }, { prop: 'moonorchid', label: '벽월란 · 지속 회복' }, { prop: 'huskstalk', label: '시충초 · 공격 속도' }, { prop: 'puffball', label: '숨포균' },
];
const TOTEMS = ['totB3', 'totB0', 'totB2', 'totB1', 'totA3', 'totA2', 'totA0', 'totA1'].map(n => ({ prop: n, y: -22, label: PROPS[n].room + '방' }));

const ROCKS = Object.entries(ROCK_KIT).map(([n, k]) => ({ rock: n, label: k.label, col: false }));
const DECAL_NAMES = { gravel: '돌밭', grit: '잔돌', straw: '짚', moss: '이끼', dirt: '맨흙', leaves: '낙엽 무더기', leaf: '낙엽', planks: '판자 데크', plank: '흩어진 판자', soot: '그을음' };
const DECALS = Object.keys(FLOOR_DECALS.kinds).map(k => ({ label: DECAL_NAMES[k] || k, decal: k }));   // 바닥 그림: 이름표만 place 로, 그림은 decals.at 으로

// 한 줄씩: v(앞뒤 자리) · 간격 · 공통 설정. 줄마다 가운데를 맞춘다. 이름표는 앞뒤로 엇갈려 안 겹치게
const ROWS = [
  { list: TOTEMS, v: 300, gap: 190, labelGap: [80, 80] },
  { list: ORES, v: 0, gap: 115, labelGap: [58, 92] },
  { list: HERBS, v: -290, gap: 95, labelGap: [50, 80], extra: { fit: 22 } },   // 채집물: 바닥 넓이 22로 작게(통과 가능, 부딪힘 없음)
  { list: ROCKS, v: -560, gap: 170, labelGap: [95, 125] },   // 바위 에셋
  { list: DECALS, v: -800, gap: 150, labelGap: [85, 110] },   // 바닥 그림 에셋
];
const place = [];
for (const R of ROWS) { const u0 = -(R.list.length - 1) * R.gap / 2;
  R.list.forEach((it, i) => place.push({ ...it, ...(R.extra || {}), at: [u0 + i * R.gap, R.v], face: [0, -1], labelGap: R.labelGap[i % 2] })); }
const HALF = Math.max(...ROWS.map(R => (R.list.length - 1) * R.gap / 2));
place.push({ label: '판자 데크(3D)', at: [-300, -1010], labelGap: 95 }, { label: '흩어진 판자(3D)', at: [0, -1010], labelGap: 95 }, { label: '낙엽(3D)', at: [260, -1010], labelGap: 95 });
const decalsAt = place.filter(p => p.decal).map(p => ({ k: p.decal, at: p.at, rot: 0, s: FLOOR_DECALS.kinds[p.decal].s * 1.6 }));   // 전시장은 크게

export default {
  id: 'gallery',
  kind: 'gallery',
  seed: 7,
  walls: false, rocks: false,
  shapes: [['cap', -HALF + 380, -200, HALF - 380, -200, 960]],   // 넓은 흙바닥(바깥은 어둠)
  exits: [], entry: { a: [0, -1e5], b: [0, -1e5], r: 0, stop: -1e5 },
  spawn: [-HALF + 120, -430],
  decals: { at: decalsAt, tint: [0.9, 0.82, 0.76] },
  litter: { decks: [{ at: [-300, -1010], rot: 0, n: 5, len: 130 }], boards: [{ at: [0, -1010], n: 3 }], leaves: [{ c: [260, -1010, 45], n: 24 }] },   // 3D 판자·낙엽
  islands: [], damp: [], dirt: [[0, 0, HALF + 500]],
  floorSize: 4600, floorSeg: 160,
  surfaces: { floorA: 'ground110', floorB: 'gravel043', floorD: 'ground110', floorG: 'gravel024', floorM: 'ground110', floorC: 'gravel043', rock: 'rock050', moss: 'moss002' },   // 흙·자갈만(이끼 낀 흙은 빼고)
  lighting: { hemi: 0.55, key: 0.9, rim: 0.4, head: 1.2 },   // 자산이 잘 보이게 밝게
  place,
  enemies: [],
};
