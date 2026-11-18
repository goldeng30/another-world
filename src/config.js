// 게임 전체 설정(숫자만 바꿔 조절)
export const CONFIG = {
  startRoom: 'cave01',
  game: { speed: 1.3 },
  hero: { hp: 100, mp: 50, level: 1, run: [0.8, 0.7], pace: { walk: 0.6, run: 0.5, combat: 1.25 },
    idleMix: { first: [5, 8], gap: [4, 8], long: 10 },   // 가만히 서 있을 때(실제 초): first 뒤 첫 섞기(맨손 대기) · 그 뒤 gap 마다 · long 넘게 서 있으면 세 가지(맨손 대기·기분 좋은 대기 1·2)를 돌아가며
    accel: { walk: 260, run: 300, stop: 500 },
    cadence: { walk: 1, run: 1 }, lean: 14,
    sheathAfter: 1.4 },   // 적이 없어진 뒤 칼을 넣기 시작할 때까지 기다리는 시간(실제 초, 넣는 동작 시간은 빼고)   // cadence: 발 박자(1 = 원래 동작 박자 그대로 보이게). 빠르기가 낮으면 보폭을 줄여 맞춘다 · lean: 다 달릴 때 윗몸을 앞으로 숙이는 각도(도)   // 무방비 이동 가속도(1초에 빨라지는 양): 서 있다가 걷기 · 걷다가 달리기 · 멈출 때(줄어드는 양)   // 가만히 서 있을 때(실제 초): first 뒤 첫 섞기 · 그 뒤 gap 마다 · long 넘게 서 있으면 happy 확률로 기분 좋은 대기   // pace: 무방비 걷기·달리기 빠르기(동작 재생과 이동을 같은 비율로 → 발이 안 미끄러짐)   // run: 무방비일 때 조이스틱을 이만큼(0~1) 넘게 끌면 달리고, 둘째 값 아래로 줄이면 다시 걷는다(키보드는 Shift)
  sight: { hero: 380, goblin: 420 },   // 알아채는 거리: 주인공(칼 빼기) · 고블린(다가오기, 주인공보다 조금 넓게)   // 주인공 최대 HP·MP(적 체력·공격력은 enemies/index.js 의 ENEMY_STATS, 내 공격력은 hero/actions.js 의 dmg)   // 게임 속 시간 빠르기: 내 공격·이동, 적 이동·공격이 같은 비율로
  // 쿼터뷰: 45도 비스듬히 내려다보며 주인공을 가운데에 부드럽게 따라감(화면이 좁을수록 조금 멀리)
  camera: { fov: 30, yawDeg: 45, pitchDeg: 26, dist: 680, h: 55, follow: 7, edge: { side: 130, below: 90, soft: 70 } },   // dist: 카메라 거리(멀수록 넓게 보임) · edge: 방 경계 밖 어둠이 화면 옆(side)·아래(below)로 이만큼까지만 보이게 카메라를 막는다(soft: 막히기 전 부드럽게)
  fog: { near: 500, far: 1500 },   // 안개: 카메라 거리 + near 부터 흐려지기 시작해 + far 에서 다 흐려짐(화면 뒤쪽 어둠 정도)
  exposure: 1.55,   // 전체 밝기(노출). 1 = 원래
  headLight: { y: 340, dist: 820, i: 1.25 },   // 주인공을 따라다니는 따뜻한 불빛: 높이 띄워 주변을 은은하게(낮으면 주인공만 비추고 발밑 그림자를 지워 붕 떠 보인다)
  heroTint: [0.85, 0.79, 0.72],   // 주인공 색을 동굴 톤(조금 따뜻하고 어둡게)으로 — 배경과 따로 놀지 않게
  // 그래픽 품질: 터치 기기(휴대폰)와 컴퓨터. 프레임이 떨어지면 해상도를 자동으로 낮춘다(core/loop.js)
  quality: {
    touch: { maxDpr: 1.5, shadowMap: 1024, propTex: 512 },    // propTex: 소품 그림(질감) 최대 크기 — 화면에서 작게 보이니 휴대폰은 줄여 GPU 메모리·올리는 시간을 아낀다
    desktop: { maxDpr: 2, shadowMap: 2048, propTex: 1024 },
    autoRes: { warmup: 3000, frames: 90, slowMs: 20, step: 0.85, minK: 0.55, minDpr: 0.75 },
  },
};
