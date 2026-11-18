# 재질 목록 (assets/textures)

출처: ambientCG(CC0). 1K PNG를 받아 webp로 바꿔 둔 것. 파일 이름 = 소문자 ID + 맵
- `_c` 색(낙엽처럼 투명도가 있으면 알파 포함) · `_n` 노멀(GL) · `_h` 높이(Displacement) · `_r` 거칠기
- 게임은 방 데이터 `surfaces` 에 적힌 것만 받는다. `_h`·`_r` 는 에셋 만드는 도구(tools/)가 쓴다

## 바닥·벽·바위 (방 surfaces 에서 쓰는 중)
| ID | 무엇 | 맵 | 쓰는 곳 |
|---|---|---|---|
| rock062 | 어두운 바위 바닥 | c n | 전투방 바닥 기본 |
| rock050 | 회색 바위 | c n | 전투방 바닥 섞기 · 바위(삼면 투영) |
| ground110 | 다진 흙 | c n | 바닥(흙) · 전시장 |
| gravel024 | 자갈 | c n | 바닥(자갈) |
| gravel043 | 굵은 자갈 | c n | 바닥 섞기 |
| ground037 | 이끼 낀 흙 | c n | 습한 곳 |
| moss002 | 이끼 | c n | 벽·바위 이끼 |
| rocks016 | 돌벽 | c n | 벽 |

## 받은 것 — 바닥 디테일 에셋(assets/decals)을 만드는 데 씀 (tools/decals/make_floor_decals.py)
| ID | 무엇 | 맵 | 쓸 곳 |
|---|---|---|---|
| planks012 | 어두운 갈색 낡은 판자 | c n h r | 판자 데크·흩어진 판자 |
| planks023a | 회색으로 바랜 판자 | c n h r | 판자(오래된 것) |
| planks036b | 갈색 판자(결·옹이 뚜렷) | c n h r | 판자·나무 잔해 |
| ground108 | 돌·자갈·잔가지 섞인 맨땅 | c n h r | 돌 무더기 밑 땅 · 잔자갈 · 경계 쪽 바닥 |
| leafset030 | 참나무 낙엽 16장(4×4, 투명도) | c(알파) n h r | 낙엽 |
| ground067 | 붉은 갈색 맨흙(잔부스러기) | c n h r | 다진 흙 · 흙길 |
| ground068 | 이끼 낀 땅(초록 이끼 + 흙) | c n h r | 습한 곳 이끼 |
| ground072 | 짚·나무 부스러기 깔린 땅 | c n h r | 고블린 잠자리·야영지 짚 |
| ground085 | 검은 잔돌 섞인 흙 | c n h r | 잔자갈 섞인 흙 |
