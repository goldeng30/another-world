# 이세계 (another-world)

F급 헌터 한도윤의 던전 액션. 브라우저에서 바로 실행되는 웹앱입니다(three.js r128).

## 실행

- GitHub Pages 주소로 열고 **시작**을 누르면 전체화면으로 시작합니다.
- 아이폰: 사파리에서 열고 **공유 → 홈 화면에 추가** 후, 홈 화면 아이콘으로 열면 전체화면으로 실행됩니다.
- 성능 표시: 주소 끝에 `?debug` 또는 `` ` `` 키 (fps · 그리기 호출 · 삼각형 · 셰이더 · 해상도)
- 새로고침: 오른쪽 위 ↻ 버튼 또는 `R` 키 → 토템·광석·식물 다시 뽑기, 적(시체 포함) 치우고 다시, 주인공은 들어온 자리로 HP·MP 가득
- 전시장(광석·채집물·토템을 일자로 늘어놓은 곳): 오른쪽 위 네모 버튼 또는 `G` 키로 전투방 ↔ 전시장, 주소 끝 `?room=gallery` 로 바로

## 조작

| | 휴대폰 | PC |
|---|---|---|
| 이동 (많이 끌면·Shift 달리기) | 왼쪽 조이스틱 | W A S D (+ Shift) |
| 공격 (1→2→3 콤보, 꾹 누르면 3타까지) | 공격 버튼 | F |

## 폴더

```
index.html            게임 페이지(화면 틀·버튼·스타일) → lib/three + dist/game.js
src/                  게임 코드(ES 모듈) — 빌드하면 dist/game.js 한 파일
  main.js             시작점: 렌더러 → 방 → 주인공 → 적 → 효과 → 카메라 → 루프
  config.js           숫자 설정(게임 속도·카메라·품질·해상도 자동 조절)
  core/               렌더러·빛·그림자 · 자산 불러오기 · 입력 · 루프 · 카메라 · 성능 표시 · 수학/잡음
  hero/               주인공: model(모델·눈) · rig(뼈대·IK) · weapon(쇠파이프) · actions(동작 표) · animation(재생) · combat(타격 판정) · controller(조작·콤보)
  enemies/            적 종류(index.js 목록 · 체력·공격력 ENEMY_STATS · 쓰러짐) · goblin.js(몽둥이 club.js · 죽는 동작: 평타 die · 3타 dieFly, 시체는 남음) · wolf.js
  ui/                 screen(화면 맞추기·전체화면) · hud(내 HP·MP · 적 머리 위 막대 · 보스 막대)
  world/              방 만들기: room(순서) · shape(모양·이동 범위) · surfaces/floor/walls(표면) · props · flame · ore · totem · rocks
  fx/                 타격 효과(불꽃·번쩍임·히트스톱·화면 흔들림)
  data/rooms/         방 데이터(모양·출구·소품 배치·적) — 방 하나 = 파일 하나 · gallery.js(전시장: 목록에 한 줄 더하면 늘어남)
  data/props.js       소품 정보(질감 같이 쓰기·색 낮춤)
assets/               hero · weapons · enemies · props(소품 라이브러리 .glb + 질감) · textures(바닥·벽 사진 질감)
tools/build.mjs       빌드(dist/game.js · sw.js 파일 목록 · 아티팩트 페이지 · 한 파일 앱)
tools/asset-pipeline/ Tripo 원본 → 가벼운 소품 모델 + 질감 굽기
tests/                점검(smoke: 불러오기·이동·공격, goblin: 고블린 움직임·싸움, enemy: 늑대와 싸우기, hud: 체력 막대·보스 막대·쓰러짐)
```

## 개발

```bash
npm install
```

```bash
npm run build
```

```bash
npm test
```

- 코드를 고친 뒤에는 `npm run build` (dist/game.js · sw.js 가 갱신됨)
- 한 파일 앱(인터넷 없이 열리는 html 하나): `npm run bundle` → `dist/single/이세계.html`

## 늘리기

- **방**: `src/data/rooms/battle01.js` 를 본떠 새 파일 → `src/data/rooms/index.js` 에 등록. `place` 는 위에서부터 차례로 놓는다
  - `{ prop, at:[u,v], s, face, turn, y, col(부딪힘 반지름), keep(바위 안 둘 반지름), lineCol, flame, eyes, name }`
  - `{ ore, at, color, pow, deep, dead }` · `{ wallProp, at, s, y, name }` · `{ wallTorches: { around, gap, light } }`
  - 좌표는 화면 기준(u 오른쪽, v 위). 적은 `enemies: [{ type: 'wolf', at: [u, v] }]`
  - 보스는 `{ type, at, boss: true, name, hp, atk }` → 머리 위 막대 대신 화면 위 가운데 큰 막대(이름)
- **소품**: `tools/asset-pipeline` 으로 `assets/props/이름.glb · _base.webp · _nrm.webp` 를 만들면 방 데이터에서 이름으로 바로 쓴다. 질감 공유·색 낮춤은 `src/data/props.js`
- **적**: `src/enemies/새적.js` 에 `createXxx(G, spec)` (공통 연결부: `holder · step(dt) · hit(from, kb, final) · gs · GB.Spine2 · mat · onStrike · body()`) → `src/enemies/index.js` 에 등록
- **주인공 동작**: `src/hero/actions.js` 에 한 줄(클립 이름은 `assets/hero/clips.json`)
- **맨손 대기 섞기**: 가만히 서 있으면 가끔 Unarmed_Idle_01, 오래(15초) 서 있으면 Happy_Idle 1·2 도 드문드문 — `config.js` 의 `hero.idleMix` · 고블린은 `sight.goblin`(420)에서 주인공을 알아챈다(주인공보다 조금 넓게)
- **상호작용 선택**: 싸우는 중(칼을 뺀 상태)이 아닐 때 광석·식물·다 쓰러진 시체 가까이(`world/select.js` 의 `SEL.range`) 가면 가장 가까운 하나를 골라 `G.selected` 에 두고, 그 물체 자체를 따뜻하게 밝혀 숨 쉬듯 깜빡이게 하고 바깥 윤곽에만 얇은 테두리를 그린다 · 방에 살아 있는 몬스터가 있으면 토템은 반응하지 않는다
- **데미지 숫자**: 맞으면 머리 위에 숫자가 튀어나와 떠오르며 사라진다(내가 준 것 뼈색 · 3타 주황 · 내가 받은 것 붉게) — `ui/hud.js` 의 `HUD.dmg` · 내 발밑 HP·MP 막대는 전투 상태에서만 보인다
- **걸음 맞추기**: 무방비 이동은 실제 빠르기에 맞춰 서기↔걷기↔달리기를 섞어 보폭을 정하고(발 박자는 원래 동작 박자, `hero.cadence`), 디딘 발이 바닥에서 밀리지 않게 한다. 달릴수록 윗몸을 숙인다(`hero.lean`). 달리다 반대로 꺾으면 돌아서는 동작(Change_Direction: 브레이크 → 돌기 → 다시 달리기)
- **관성·한 걸음**: 무방비 이동은 가속도로 서서히 빨라지고 느려지며, 빠르기에 맞춰 걷기와 달리기를 섞는다(`config.js` 의 `hero.accel`). 살짝 끌어도 최소 한 걸음은 끝까지 걷는다(전투 자세도 같음, 걸음이 땅에 닿는 순간에 선다)
- **걷기·달리기**: 무방비일 때 조이스틱을 많이 끌면 달리고 덜 끌면 걷는다(`config.js` 의 `hero.run`). 키보드는 Shift 를 누르고 있으면 달리기
- **무방비 ↔ 전투 자세**: 처음엔 무방비(칼은 넣어서 안 보임). 살아 있는 적이 `config.js` 의 `sight.hero`(380) 안으로 오거나 공격을 누르면 칼을 빼고(빼기만, 공격은 다시 눌러야)(윗몸에만 덧씌워 걸으면서도), 560 밖에 `hero.sheathAfter`(1.4초) 동안 적이 없으면 넣는다 — `hero/controller.js` 의 `COMBAT`
- **체력·공격력**: 주인공 HP·MP `config.js` 의 `hero` · 내 공격력 `hero/actions.js` 의 `dmg` · 적 `enemies/index.js` 의 `ENEMY_STATS`
- **광석 채굴 등 상호작용**: 방을 만들면 광석이 `G.world.interactables` 에 들어 있다(위치·모델·빛)
- **들어온 자리·방향**: 방 데이터 `spawn`(자리) · `spawnFace`(보는 방향, 기본 방 안쪽). 처음 들어올 때·새로고침 때 이 자리에서 이 방향을 보고 시작
- **카메라 시야 막기**: 방 경계 쪽으로 가면 카메라가 주인공을 가운데 두지 않고 멈춰 어둠을 조금만 보인다(`config.js` 의 `camera.edge`). 출구 굴 가까이·안에서는 막지 않고 그냥 따라간다
- **바닥 디테일 에셋**(모든 방 공용): `assets/decals/floor_*.webp` — 돌밭·잔돌·짚·이끼·맨흙·낙엽 무더기·낙엽·판자 데크·흩어진 판자·그을음(받은 사진 재질을 높이 따라 오려 만든 평면 그림 + 노멀, 재질 목록은 `assets/textures/MATERIALS.md`). 만들기: `python3 tools/decals/make_floor_decals.py`, 이름 목록: `src/data/decals.js`. 방 데이터 `decals = { at, around, edge, clear, tint }` 로 배치(바닥 높낮이에 붙고 경계 어둠도 같이)
- **벽 바깥 바위 덩어리**: 벽은 얇은 판이라 뒤가 비어 보인다 → 방 데이터 `wallMass = { ext, cell, slope }` 로 벽 바깥 전체를 속이 찬 바위(격자 높이 지도)로 채운다. 높이는 가까운 벽의 실제 높이를 따라가고(카메라 쪽은 없음), 벽 꼭대기 덮개가 덩어리 속으로 맞물려 어느 각도에서도 뒷공간·틈이 안 보인다(`src/world/walls.js`)
- **벽 높이**: 먼 쪽은 높고 카메라 쪽으로 갈수록 낮아져 끝난다. `wallSide = [cf 시작, cf 끝]` 로 양옆 벽을 어디까지 높게 세울지(둘레를 따라 고르게 한 방향 값 기준이라 경계가 울퉁불퉁해도 중간에 안 끊김), `wallEnd = { ramp, fade }` 로 벽 끝이 낮아지고 어두워지는 길이. 옆으로 선 벽은 위가 기울지 않는다(옆에서 보면 얇은 날처럼 보여서)
- **전투방 분위기**(battle01): 조명(머리 위 불빛 약하게·횃불 빛 웅덩이·출구 굴 차가운 빛 `lights`)·색보정(`lighting.grade`)·가장자리 어둡게(`vignette`)·경계 바위 벽(`rim`)·먼 쪽 벽에 매달린 돌(`stalactites`, 종유석 에셋 stalacA~D)·접촉 그림자(`contact`)·흙길(`decals.path`)·먼지(`dust`)·카메라 각도(`camera`) — 모두 방 데이터로 켜고 끔. 그림자 범위는 화면에 보이는 플레이 구역(카메라가 보는 점에서 720)까지만
- **3D 판자·낙엽**: 방 데이터 `litter = { decks, boards, leaves }` — 판자는 planks012 사진 재질로 두께·부러진 끝·받침목(데크)까지, 낙엽은 leafset030 잎을 말아 겹쳐 쌓음(`src/data/litter.js`, `src/world/litter.js`)
- **자잘한 돌 무더기(3D)**: 작은 돌 에셋(`assets/rocks/pebble*·stone*`)을 깔아 무더기로 — 방 데이터 `stones = { edge, at, grit }` (경계 따라 띄엄띄엄 · 자리 지정 · 밑에 잔자갈 그림). 한 번에 그림, 부딪힘 없음
- **바위 에셋**(모든 방 공용): `assets/rocks/*.glb` — 큰 바위 3·넓적 바위 2·선 바위·돌무더기 2·돌덩이 2·이끼 바위 4(이끼 양을 모양에 담아 어느 방이든 이끼가 덮임 — 방 surfaces 에 moss 질감 필요). 만들기: `python3 tools/rocks/make_rocks.py`, 이름 목록: `src/data/rocks.js`. 방 데이터 place 에 `{ rock: 'boulderA', at: [u, v], s: 지름 }` (질감은 그 방 바위 질감). 전시장(G 키)에 두 묶음 다 줄 세워 둠
- **바닥 높낮이**: 방 데이터 `relief = { amp, bump, edge }` — 살짝 굽이치는 바닥(주인공·적·소품·바위가 그 높이에 선다). 없으면 평평
- **출구 굴 어둠**: 출구 굴 안으로 들어갈수록 주인공도 어둠에 잠겨 막힌 끝에서는 안 보인다(다음 방 넘어가기는 이 자리에 붙이면 된다)

## 성능 원칙

- 방이 쓰는 자산만, 한꺼번에(병렬) 받는다. 모델은 .glb 그대로(문자열 변환 없음), 같은 질감은 한 번만
- 완전히 어두운 곳(방 밖·출구 굴 깊은 곳)은 질감·빛·그림자 계산 없이 바로 검정
- 점광원 수가 화면 전체 계산량 → 꼭 필요한 곳만(토템 둘은 하나를 같이 씀)
- 셰이더는 시작할 때 미리 다 만들어 둔다(처음 보이는 순간 멈칫 없게)
- 프레임이 떨어지면 해상도를 자동으로 낮춘다(`config.js` 의 `quality.autoRes`)
- 코드로 만든 무기(쇠파이프·몽둥이)는 같은 재질 조각끼리 합친다(`core/merge.js`) → 그리기 호출·그림자 호출이 준다
- 소품 질감은 기기 품질에 맞춰 줄여 쓴다(휴대폰 512 · 컴퓨터 1024, `quality.*.propTex`) — 바닥·벽처럼 반복되는 질감은 그대로
- 동작 파일은 곧게 이어도 거의 같은 중간 키를 뺀다(`tools/asset-pipeline/reduce_clips.cjs`, 회전 0.3°·위치 0.05 안). 새 동작을 넣은 뒤 한 번 돌린다
