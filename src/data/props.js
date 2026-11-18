// 소품 목록 정보(이름 = assets/props/이름.glb). 적어 두지 않은 소품은 기본값으로 불러온다
//   tex: 다른 소품의 질감을 같이 쓴다(같은 원본에서 떼어 낸 조각) · tint: 밝은 소품이 어두운 동굴에서 튀지 않게 색을 낮춘다
//   turn: 모델이 정면을 안 보고 있으면 돌려 맞춘다(라디안) · s: 크기를 따로 안 주면 쓰는 크기
//   eyes: 토템 눈빛(주인공이 가까이 오면 켜짐) — pts 눈 자리(모델 기준), color 빛 색, size 크기. 눈이 여러 쌍이면 배열로 · room: 이 토템이 알리는 방
//   ore: 광석 빛 — color 빛 색, deep 결정 바탕색, pow 세기, light 작은 점광원까지 둘지(성능상 기본은 안 둠)
export const PROPS = {
  rskull: { tex: 'rack' },
  pillar: { tint: [0.72, 0.69, 0.64] },   // 흰 석회암 기둥
  // 토템: B = 전투·정예·휴식·보상, A = 미지·함정·보스·제단 (A는 원래 키가 작아 크게). 크기 B 265 · A 315
  totB3: { room: '전투', s: 265, turn: -0.2, eyes: { pts: [[-0.008, 0.542, 0.05], [0.030, 0.542, 0.048]], color: 0xff4fae, size: 0.7 } },
  totB0: { room: '정예', s: 265, eyes: { pts: [[-0.033, 0.554, 0.048], [0.034, 0.554, 0.048]], color: 0xff2a1a } },
  totB2: { room: '휴식', s: 265, eyes: { pts: [[-0.026, 0.539], [0.014, 0.539]], color: 0x0fd23c, size: 0.55 } },
  totB1: { room: '보상', s: 265, eyes: { pts: [[-0.034, 0.565], [0.024, 0.565]], color: 0xffcc33, size: 0.95 } },
  totA3: { room: '미지', s: 315, eyes: { pts: [[-0.012, 0.495], [0.0155, 0.495]], color: 0x9b30ff, size: 1.0 } },
  totA2: { room: '함정', s: 315, eyes: { pts: [[-0.008, 0.497], [0.023, 0.497]], color: 0xff5a00, size: 0.75 } },
  totA0: { room: '보스', s: 315, eyes: [{ pts: [[-0.025, 0.502], [0.027, 0.502]], color: 0xff1040, size: 0.85 },   // 꼭대기 짐승 해골의 눈구멍: 붉은빛
    { pts: [[-0.023, 0.417], [0.022, 0.418]], color: 0xeef3ff, size: 0.45 }] },                                       // 그 아래 큰 얼굴의 눈: 흰빛
  totA1: { room: '제단', s: 315, eyes: { pts: [[-0.018, 0.4955], [0.018, 0.4955]], color: 0x5aa0ff, size: 0.85 } },
  // 광석(캐기 전). 캔 뒤 모습(_m)은 빛이 없다
  mana4: { ore: { color: 0x1f5cff, deep: [0.12, 0.3, 0.85], pow: 0.8, light: true } },    // 마석 하급: 푸른빛
  mana0: { ore: { color: 0x0aa88a, deep: [0.04, 0.5, 0.42], pow: 1.0, light: true } },    // 마석 중급: 청록
  mana2: { ore: { color: 0x5a18d0, deep: [0.36, 0.1, 0.72], pow: 1.1, light: true } },    // 마석 상급: 보랏빛
  blackiron: { ore: { color: 0x6f8fc4, deep: [0.28, 0.36, 0.5], pow: 0.75 } },    // 흑철석: 차가운 쇳빛
  bluesteel: { ore: { color: 0x3a9cff, deep: [0.2, 0.45, 0.85], pow: 0.9 } },     // 청강석: 푸른빛
  meteor: { ore: { color: 0xbcc8ff, deep: [0.5, 0.54, 0.7], pow: 1.0 } },        // 운철: 희푸른 별빛
  bloodstone: { ore: { color: 0xff2030, deep: [0.6, 0.05, 0.08], pow: 0.9 } },    // 혈석: 붉은빛
  ambereye: { ore: { color: 0xffa020, deep: [0.75, 0.42, 0.05], pow: 0.85 } },    // 호박안: 호박빛
  jade: { ore: { color: 0x20d070, deep: [0.08, 0.5, 0.25], pow: 0.85 } },         // 녹옥: 초록빛
};
// 채집물(뜯는 버섯·약초): 놓으면 채집물 표시(테두리 빛 + 빛 알갱이)가 붙는다. fitK: 바닥 넓이 맞춤에서 이만큼 더 작게
for (const n of ['mush0', 'mush1', 'mush2', 'mush3', 'dimmoss', 'stonebud', 'scalecap', 'darkbloom', 'bloodroot', 'veinroot', 'ironleaf', 'bloodspot', 'huskstalk', 'puffball', 'lanterncap', 'moonorchid']) PROPS[n] = { ...(PROPS[n] || {}), gather: true };
PROPS.puffball.fitK = 0.72; PROPS.mush2.fitK = 0.75;
// 캔 뒤 모습(_m)은 빛 마스크(_emi)가 없다
for (const n of ['blackiron', 'bluesteel', 'meteor', 'bloodstone', 'ambereye', 'jade']) PROPS[n + '_m'] = { emi: false };
// 이름 앞부분으로 정하는 색 낮춤: 석순 · 버섯 · 뼈 · 짚 깔개
const TINT_BY_KIND = { stal: [0.5, 0.46, 0.42], mush: [0.68, 0.62, 0.56], bone: [0.78, 0.74, 0.68], bed: [0.75, 0.7, 0.62] };
export function propTint(name) { const p = PROPS[name]; if (p && p.tint) return p.tint; const m = /^([a-z]+)\d+$/.exec(name); return m && TINT_BY_KIND[m[1]] || null; }
