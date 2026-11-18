# 소품 만들기 (Tripo 원본 → 게임용 가벼운 모델)

원본 GLB(고해상도)를 면 수를 줄인 모델로 만들고, 원본의 색·굴곡을 질감 두 장(색 `_base.webp`, 노멀 `_nrm.webp`)에 구워 넣는다.

- 필요한 것: `pip install numpy pillow scipy xatlas`, gltfpack(`npx gltfpack`)
- 원본은 저장소 밖 작업 폴더 `work/props_in/폴더/*.glb` 에 둔다(`IN=` 으로 바꿀 수 있음)

| 하는 일 | 명령 |
|---|---|
| 한 덩어리 소품 | `./run_one.sh 이름 목표면수 질감크기` (예: `./run_one.sh cart 5000 1024`) |
| 여러 소품이 든 원본 나누기 | `python split.py 원본.glb ../../work/tmp/split_폴더` → 덩어리 번호 확인 |
| 나눈 덩어리 하나씩 | `./run_parts.sh mush0:mush:2:2000:512 mush1:mush:5:2000:512` |
| 모델 정보 보기 | `node glbinfo.cjs 파일.glb` |
| 피부색 바꾸기 | `python tint_skin.py 원본.webp 출력.webp 색조이동 채도배수` (고블린: `../../assets/enemies/goblin_base.orig.webp` → `goblin_base.webp`, 16 1.15) |
| 가벼운 고블린(몸 삼각형 줄이기) | `npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4 meshoptimizer` 후 `node lite_goblin.mjs 5500` (`../../assets/enemies/goblin.orig.glb` → `goblin.glb`, 뼈대·가중치·UV·동작 그대로) |

- 결과는 `assets/props/이름.glb · 이름_base.webp · 이름_nrm.webp` 로 바로 들어간다.
- 빛나는 부분(광석 결정)은 `이름_emi.webp`(흰색 = 빛남)를 따로 만들어 두면 광석 효과가 그 자리만 빛낸다.
- 질감 크기는 화면에 보이는 크기에 맞춘다: 작은 소품 512, 큰 소품(수레·기둥·모닥불) 1024.
