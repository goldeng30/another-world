// 주인공 동작 표(데이터): 동작 이름 → 쓸 Mixamo 클립 · 무기 쥐기 · 한 번/반복 · 공격 판정 구간 · 콤보 이음
// 새 동작은 여기에 한 줄 더하고, 클립 이름은 assets/hero/clips.json 안의 이름
export function makeActions() {
  const ACTS = {
    wwalk: { label: '무기 들고 걷기', clip: 'Great_Sword_Walk', pipe: true, two: true, wy: 19, fwd: true, step: true },   // step: 걸음 단위(손을 떼도 지금 걸음은 끝까지)
    wrun: { label: '무기 들고 달리기', clip: 'Standard_Run', arms: 'Great_Sword_Walk', pipe: true, two: true, wy: 19, fwd: true },
    wback: { label: '뒤로 걷기', clip: 'Great_Sword_Walk', pipe: true, two: true, wy: 19, rev: true, step: true },          // 걷기를 거꾸로 재생
    wstrR: { label: '오른쪽 옆걸음', clip: 'Great_Sword_Strafe', pipe: true, two: true, wy: 19, step: true },               // 받은 옆걸음은 오른쪽으로 간다
    wstrL: { label: '왼쪽 옆걸음', clip: 'Great_Sword_Strafe', pipe: true, two: true, wy: 19, rev: true, step: true },      // 거꾸로 재생하면 왼쪽
    widle: { label: '무기 들고 서기', clip: 'Great_Sword_Walk', pipe: true, two: true, wy: 19, idle: true },
    jump: { label: '점프', clip: 'Great_Sword_Jump', pipe: true, two: true, wy: 19, once: true, air: true, fade: 0.12, airT: [0.13, 0.64], airRate: 0.75, lift: 15 },   // 제자리·걷다가 점프: 조금 더 높고 길게
    rjump: { label: '달리며 점프', clip: 'Great_Sword_Jump_1', pipe: true, two: true, wy: 19, once: true, air: true, fade: 0.08, airT: [0.10, 0.56], airRate: 0.7, lift: 13, boost: 1.06 },   // 공중 구간만 천천히(체공 1.7배) + 더 높이 + 더 멀리
    slash: { label: '공격 1', clip: 'Great_Sword_Slash', pipe: true, two: true, wy: 19, once: true, fade: 0.1 },
    slash2: { label: '공격 2', clip: 'Great_Sword_Slash', pipe: true, two: true, wy: 19, once: true, fade: 0.12, mirror: true },   // 2번: 1번을 반대 방향(왼쪽 위 → 오른쪽 아래)으로, 손잡이·발·숙임은 그대로
    impact: { label: '맞음', clip: 'Great_Sword_Impact', pipe: true, two: false, wy: 19, once: true, fade: 0.08, cancel: 0.8 },   // cancel: 이때부터는 움직이면 끊는다
    // 무방비(칼은 넣어서 안 보임): 맨손 서기 · 맨손 걷기 · 일정 시간 걸으면 달리기
    uidle: { label: '맨손 서기', clip: 'Idle', fade: 0.3 },
    uwalk: { label: '맨손 걷기', clip: 'Walking', fwd: true },
    urun: { label: '맨손 달리기', clip: 'Running', fwd: true, fade: 0.3 },
    umove: { label: '맨손 이동(서기↔걷기↔달리기 섞기)', clip: 'Walking', blend: 'Running', stand: 'Idle', step: true, fade: 0.2 },   // 실제 빠르기에 맞춰 서기·걷기·달리기를 섞는다(보폭·발 박자가 빠르기에 맞게)
    uturn: { label: '달리다 돌아서기', clip: 'Change_Direction', once: true, turn: true, t0: 0.35, end: 1.75, fade: 0.15, rate: 1.1 },   // 달리다 반대로 꺾을 때: 브레이크 → 돌기 → 다시 달리기. 몸의 위치·방향은 동작에 든 길(path)을 따라간다
    // 맨손 서기에 가끔 섞는 대기(fidget): 움직이면 바로 끊긴다. 오래 서 있으면 기분 좋은 대기 1·2도 드문드문
    uidleB: { label: '맨손 대기(섞기)', clip: 'Unarmed_Idle_01', once: true, cancel: 0.001, fidget: true, fade: 0.6 },
    uhappy1: { label: '기분 좋은 대기 1', clip: 'Happy_Idle', once: true, cancel: 0.001, fidget: true, fade: 0.4 },
    uhappy2: { label: '기분 좋은 대기 2', clip: 'Happy_Idle_1', once: true, cancel: 0.001, fidget: true, fade: 0.4, rate: 0.6 },   // 몸을 빠르게 터는 동작이라 천천히(rate: 재생 빠르기)
    // 칼 빼기·넣기: 윗몸에만 덧씌운다(다리는 서기·걷기 그대로). 빼기 = 1(등 뒤로 손) → 2(빼서 들기), 넣기 = 2를 거꾸로 → 3(손 돌아오기)
    draw1: { label: '칼 잡으러', clip: 'Draw_1', once: true, layer: true },
    draw2: { label: '칼 빼기', clip: 'Draw_2', once: true, layer: true, pipe: true, two: true, wy: 19, hand: [-1, -1, 0.5, 0.78] },   // 처음엔 오른손에 붙은 채로, 끝에 두 손 잡기로
    sheath1: { label: '칼 넣기', clip: 'Draw_2', rev: true, once: true, layer: true, pipe: true, two: true, wy: 19, hand: [0.02, 0.3, 9, 9] },   // 두 손 잡기에서 오른손에 붙은 채로
    sheath2: { label: '칼 넣고 손 돌아오기', clip: 'Sheath_2', once: true, layer: true },
    slash3: { label: '공격 3', clip: 'Great_Sword_Slash_3', pipe: true, two: true, wy: 19, once: true, fade: 0.12, rm: true },   // rm: 동작이 앞으로 나가는 만큼 실제로 이동(발 안 미끄러지게)
  };
  // 공격(3단 콤보 1-2-3): win 파이프가 맞을 수 있는 구간 · T 내려치는(정면 지나는) 순간 · chain 다음 공격으로 넘어가는 때 · ideal 파이프 끝이 맞는 거리 · minR 붙을 수 있는 거리
  ACTS.slash.atk = { win: [0.55, 0.8], T: 0.69, chain: 0.84, ideal: 77 };
  ACTS.slash2.atk = { win: [0.55, 0.8], T: 0.69, chain: 0.84, idealK: -5 };   // 2번(새 동작): 머리 위로 들었다가 왼쪽→앞→오른쪽 수평으로. rate: 살짝 빠르게
  ACTS.slash3.atk = { win: [0.6, 0.88], T: 0.8, aimT: 0.76, chain: 1.22, minR: 45, final: true, rate: 1.15, idealK: -3, end: 1.42 };   // end: 마지막 공격은 여기서 기본 자세로 넘어간다(후딜 줄임)   // idealK: 파이프 끝 닿는 거리(reach)에서 뺄 값으로 ideal을 정한다   // final: 마지막 공격 — 끝까지 자세를 잡고 후딜(REC)까지   // aimT: 겨누는 기준 순간(휘두른 파이프가 고블린 높이를 지날 때)
  ACTS.slash.atk.fx = ACTS.slash2.atk.fx = { sparks: 9, flash: 34 }; ACTS.slash3.atk.fx = { sparks: 64, flash: 72, spd: 1.35, life: 1.3, hs: 0.12, shk: 11, vib: 45 };
  ACTS.slash.atk.dmg = ACTS.slash2.atk.dmg = 10; ACTS.slash3.atk.dmg = 20;   // 공격력: 1·2번 10, 마지막 3번 20
  ACTS.slash.atk.kb = ACTS.slash2.atk.kb = 14; ACTS.slash3.atk.kb = 75;   // 넉백 거리: 1·2번 살짝, 3번은 더(3번 끝나고 거리가 맞게)   // 타격 불꽃: 1·2번은 적게, 마지막 3번은 크게
  const COMBO = ['slash', 'slash2', 'slash3'];   // 3단 콤보 1 → 2 → 3
  // 이음 표: [앞 공격에서 넘어가는 때 ta, 다음 공격을 시작하는 곳 tb, 섞는 시간]
  //  맞는 간격 = 1번만 연타할 때 간격(약 1.2초)과 같게, 마지막 3번만 조금 더 길게. 재생은 원래 빠르기 그대로, 다음 공격은 들어 올리는 동작부터 다 휘두른다.
  //  그 간격 안에서 두 공격 자세가 가장 비슷한 곳끼리 붙였다(앞 동작은 계속 움직이며 섞는다)
  const LINK = { slash: { slash2: [1.15, 0.13, 0.26, 0.04] },   // 1→2: 1번이 아직 움직일 때 넘어가 2번을 처음부터
    slash2: { slash3: [1.15, 0.13, 0.24, 0.05] }, slash3: {} };   // 2→3: 2번이 아직 움직일 때 넘어가고, 앞당긴 만큼 3번 들어 올리기를 늘린다(넷째 값)
  const REC = 0.12;   // 마지막 공격 뒤 자세 잡고 나서도 못 움직이는 시간(게임 속 초)
  const LATE = 0.24;
  const BUF_EARLY = 0.1;   // 1·2번: 맞기 이만큼 전부터 다음 공격 입력을 받는다   // 넘어가는 때를 이만큼 지나 누르면 다음 공격을 처음부터
  for (const k in LINK) { const v = Object.values(LINK[k]); if (v.length) ACTS[k].atk.chain = Math.min(...v.map(x => x[0])); }
  const LIVE_DUR = 10.2;
  const HAND = { on: { rg: 0.95, rt: 0.8, lg: 0.45, lt: 0.3 }, off: { rg: 0.35, rt: 0.25, lg: 0.35, lt: 0.25 } };
  return { ACTS, COMBO, LINK, REC, LATE, BUF_EARLY, LIVE_DUR, HAND };
}
