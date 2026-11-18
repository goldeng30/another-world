// 바닥 디테일 에셋(위에서 본 평면 그림 아틀라스): assets/decals/floor_c.webp · floor_n.webp — tools/decals/make_floor_decals.py 로 만든다
//   받은 사진 재질(ambientCG: ground108·085 돌밭, ground072 짚, ground068 이끼, ground067 흙, leafset030 낙엽, planks012·023a 판자)을 오려 만든 것
//   kinds: 이름 → 아틀라스 칸 번호(여러 개면 그중 무작위) · s: 크기를 안 주면 쓰는 크기(지름) · rot: false 면 돌리지 않음
//   어느 방이든 방 데이터 decals 에서 이 이름으로 끌어다 쓴다(굵은 돌은 3D 돌 무더기 stones 로)
export const FLOOR_DECALS = {
  file: 'assets/decals/floor', grid: 4,
  kinds: {
    gravel: { cells: [0, 1, 2], s: 95 },      // 돌밭(자갈 섞인 땅)
    grit: { cells: [3], s: 85 },              // 잔돌만 흩어진(3D 돌 무더기 밑)
    straw: { cells: [4, 5], s: 95 },          // 짚(고블린 잠자리)
    moss: { cells: [6], s: 115 },             // 이끼
    dirt: { cells: [7], s: 115 },             // 맨흙 얼룩
    leaves: { cells: [8, 9], s: 75 },         // 낙엽 무더기
    leaf: { cells: [10, 11], s: 80 },         // 낙엽 몇 장
    planks: { cells: [12], s: 135 },          // 판자 데크
    plank: { cells: [13, 14], s: 115 },       // 흩어진 판자 · 바랜 판자
    soot: { cells: [15], s: 90 },             // 그을음
  },
};
