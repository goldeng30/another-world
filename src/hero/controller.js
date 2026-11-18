// 주인공 조작: 무방비 ↔ 전투 자세(칼 빼기·넣기) · 이동(카메라 기준) · 적 바라보기(LOCK) · 3단 콤보 입력 · 공격 보정 · 넉백 · 벽·장애물 밀어내기
import { V, DEG, sstep, EASE, wrapA, turn } from '../core/math.js';
import { createInput } from '../core/input.js';
import { CONFIG } from '../config.js';

export function createController(H) {
  const { G, rig, weapon, anim, combat } = H;
  const { root, B, applyFrame } = rig;
  const { posePipe, pipeSamples } = weapon;
  const { st, play, switchAct, actFrame, makeWarp, LEGS, SPD, LAYER } = anim;
  const { ACTS, COMBO, LINK, REC, LATE, BUF_EARLY } = H.acts;
  const { ASSIST, STEP_FWD, pipeContact, assistPoint, hitFX } = combat;
  const ctl = { on: true, armed: false, calm: 0, vAct: 0, running: false, stillT: 0, fidgetAt: 6, idleBag: [], idleLast: null, stepAct: null, stepFrom: 0, stepLast: 0, req: null, ci: 0, buf: false, rec: 0, soft: 0, held: false, joy: { x: 0, y: 0, id: null }, runT: false, yaw: 0, v: 0, keys: new Set(), WALK: SPD('Great_Sword_Walk'), RUN: SPD('Standard_Run'), R: 2800 };
  createInput(ctl);   // ctl.keys · ctl.joy · ctl.req · ctl.held
  H.ctl = ctl;
  const CARRY = { v: [0.2, 0.78], legs: [0.12, 0.55] };   // 달리며 공격: 속도 줄이는 구간 · 달리던 다리에서 휘두르기 다리로 넘어가는 구간(초)
  const LOCK = { on: false, IN: 380, OUT: 440, yaw: 0, RUNK: 1.8 };   // RUNK: 달리기 켠 채 옆·뒤로 갈 때 걸음 재생 배속
  const WALK_K = CONFIG.hero.pace.combat;   // 전투 자세 걸음(앞·뒤·옆) 빠르기: 동작 재생과 이동을 같은 배로(발이 미끄러지지 않게) — config.js 의 hero.pace.combat
  const SEC = { f: a => Math.abs(a) < 55, b: a => Math.abs(a) > 125, l: a => a > 35 && a < 145, r: a => a < -35 && a > -145 };   // 지금 방향을 조금 더 넓게 잡아 경계에서 떨지 않게
  ACTS.wwalk.spd = ctl.WALK; ACTS.wrun.spd = ctl.RUN; ACTS.wback.spd = ctl.WALK; ACTS.wstrR.spd = ACTS.wstrL.spd = SPD('Great_Sword_Strafe'); ACTS.uwalk.spd = SPD('Walking'); ACTS.urun.spd = SPD('Running'); ACTS.uwalk.k = CONFIG.hero.pace.walk; ACTS.urun.k = CONFIG.hero.pace.run;
  // 무방비 이동(umove): 빠르기 vW(걷기)~vR(달리기) 사이를 가속도로 오가고, 빠르기에 따라 걷기·달리기를 섞는다. 발 박자 = 빠르기 / 한 바퀴 보폭(S)
  const LOCO = { vW: SPD('Walking') * CONFIG.hero.pace.walk, vR: SPD('Running') * CONFIG.hero.pace.run };
  // 걸음 표(GAIT): 섞는 정도 u(0.5~1 = 서기↔걷기, 1~2 = 걷기↔달리기)마다 한 바퀴 보폭 S 와 그때 자연스러운 발 박자로 나오는 빠르기 v → 실제 빠르기에 맞는 u 를 골라 보폭·박자를 맞춘다
  const GAIT = (() => { const a = ACTS.umove, K = CONFIG.hero.cadence, cW = K.walk / anim.CLIP.Walking.dur / CONFIG.game.speed, cR = K.run / anim.CLIP.Running.dur / CONFIG.game.speed, Tb = [];
    for (let i = 0; i <= 15; i++) { const u = 0.5 + i * 0.1, S = anim.strideOf(a, Math.min(1, u), Math.max(0, u - 1)), c = u <= 1 ? cW : cW + (cR - cW) * (u - 1); Tb.push({ u, S, v: Math.max(S * c, i ? Tb[i - 1].v + 0.01 : 0) }); }
    return Tb; })();
  function gaitFor(g) { const Tb = GAIT; if (g <= Tb[0].v) return Tb[0]; for (let i = 1; i < Tb.length; i++) if (g <= Tb[i].v) { const k = (g - Tb[i - 1].v) / ((Tb[i].v - Tb[i - 1].v) || 1); return { u: Tb[i - 1].u + (Tb[i].u - Tb[i - 1].u) * k, S: Tb[i - 1].S + (Tb[i].S - Tb[i - 1].S) * k }; } return Tb[Tb.length - 1]; }
  // 달리다 반대로 꺾기(TURN): 꺾는 각이 ang 보다 크고 충분히 빠를 때. scale: 동작 속 달리기가 우리보다 빨라서 가는 길을 줄인다
  const TURN = { ang: 130 * DEG, minV: 0.8, scale: 0.7 };
  const pathAt = (P, t) => { const Ts = P.t; let i = 0; while (i < Ts.length - 2 && Ts[i + 1] < t) i++; const k = Math.max(0, Math.min(1, (t - Ts[i]) / ((Ts[i + 1] - Ts[i]) || 1))), L = n => P[n][i] + (P[n][i + 1] - P[n][i]) * k; return { x: L('x'), z: L('z'), yaw: L('yaw') }; };
  function startTurn() { const a = ACTS.uturn, b = pathAt(a.path, a.t0); play('uturn', a.t0, a.fade); ctl.turn = { yaw0: ctl.yaw, y0: b.yaw, last: b }; ctl.v = 0; }
  function endTurn() { ctl.turn = null; ctl.mv = ctl.yaw; ctl.v = ctl.vAct = LOCO.vR * 0.85; play('umove', ACTS.umove.stops[0], 0.2); } for (const n of ['wwalk', 'wback', 'wstrR', 'wstrL']) ACTS[n].k = WALK_K; ctl.mv = 0; ctl.sec = null;
  // ── 무방비 ↔ 전투 자세: 살아 있는 적이 enter 안으로 오면(또는 공격을 누르면) 칼을 빼고, exit 밖에 hero.sheathAfter(실제 초) 동안 아무도 없으면 넣는다
  //    칼 빼기·넣기는 윗몸에만 덧씌워(DR) 서 있든 걷든 다리는 그대로. 무방비일 땐 칼이 안 보이고, 손이 등 뒤에 닿는 순간 나타나거나 사라진다
  const COMBAT = { enter: CONFIG.sight.hero, exit: 560, fadeIn: 0.15, fadeOut: 0.22 };
  const SEQ = { draw: ['draw1', 'draw2'], sheath: ['sheath1', 'sheath2'] };
  const DR = { mode: null, i: 0, act: null, t: 0, w: 0, next: null };
  const startDraw = () => Object.assign(DR, { mode: 'draw', i: 0, act: 'draw1', t: 0, w: 0, next: null });
  function startSheath() { ctl.armed = false; ctl.buf = false; Object.assign(DR, { mode: 'sheath', i: 0, act: 'sheath1', t: 0, w: 0, next: null }); }
  function drawStep(dt) { if (!DR.mode) return; const seq = SEQ[DR.mode]; let a = ACTS[DR.act]; DR.t += dt;
    if (DR.t >= a.dur) { if (DR.i < seq.length - 1) { DR.t -= a.dur; DR.i++; DR.act = seq[DR.i]; a = ACTS[DR.act]; weapon.holster(DR.mode === 'sheath'); }   // 손이 등 뒤에 닿는 순간: 빼기면 칼이 손에 나타나고, 넣기면 사라진다
      else { const nx = DR.next; DR.mode = null; DR.w = 0; if (nx === 'draw') startDraw(); return; } }
    const last = DR.i === seq.length - 1, wIn = DR.i === 0 ? Math.min(1, DR.t / COMBAT.fadeIn) : 1, wOut = last ? Math.min(1, (a.dur - DR.t) / COMBAT.fadeOut) : 1; DR.w = Math.max(0, Math.min(wIn, wOut));
    if (DR.mode === 'draw' && last && !ctl.armed && DR.t >= a.dur - COMBAT.fadeOut) { ctl.armed = true; ctl.calm = 0; ctl.buf = false; } }   // 다 뺐다: 전투 자세로
  function disarm() { ctl.px = null; ctl.vAct = 0; ctl.turn = null; DR.mode = null; DR.w = 0; DR.next = null; ctl.armed = false; ctl.calm = 0; ctl.stillT = 0; ctl.fidgetAt = 6; ctl.buf = false; weapon.holster(true); }
  function ctlFrame(dt) { if (!ctl.on) return; const GOB = G.enemy, DG = G.world;
    const k = ctl.keys, f = Math.max(-1, Math.min(1, (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + ctl.joy.y)), r = Math.max(-1, Math.min(1, (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + ctl.joy.x));
    const fw = G.camTarget.clone().sub(G.cam.position); fw.y = 0; if (fw.lengthSq() < 1e-6) fw.set(0, 0, -1); fw.normalize(); const rt = V(-fw.z, 0, fw.x);
    if (ctl.rec > 0) ctl.rec -= dt; const recov = ctl.rec > 0;   // 후딜 중
    const dir = fw.multiplyScalar(f).add(rt.multiplyScalar(r)), moveIn = !recov && dir.lengthSq() > 0.04, run = false;   // 달리기 없음(전투 자세)
    // 한 걸음은 끝까지: 걷던 중 손을 떼도 지금 걸음이 땅에 닿는 순간(stops)까지는 간다 → 살짝 끌어도 최소 한 걸음(두 발이 모인 자세에서 시작해 내딛은 발이 닿을 때까지, 무방비·전투 자세 모두)
    const ca = ACTS[st.act], loco = !!ca.stops && !ca.once; let crossed = false;
    if (!loco) ctl.stepAct = null; else { if (ctl.stepAct !== st.act) { ctl.stepAct = st.act; ctl.stepFrom = ctl.stepLast = st.t; }
      for (const s of ca.stops) { const at = s + (Math.floor((ctl.stepLast - s) / ca.dur) + 1) * ca.dur; if (at <= st.t) crossed = true; } ctl.stepLast = st.t; }
    const holding = !moveIn && loco && !recov && !(crossed && st.t - ctl.stepFrom >= 0.1 * ca.dur && !(ca.blend && ctl.v > LOCO.vW * 1.1)), moving = moveIn || holding;   // 달리던 중이면 걷는 빠르기까지 줄인 뒤 선다
    if (!moveIn && loco && !holding) ctl.v *= 0.2;   // 걸음이 닿았다: 거기서 선다
    if (GOB) { const gx = GOB.holder.position.x - root.position.x, gz = GOB.holder.position.z - root.position.z; LOCK.on = ctl.armed && Math.hypot(gx, gz) < (LOCK.on ? LOCK.OUT : LOCK.IN); LOCK.yaw = Math.atan2(gx, gz); } else LOCK.on = false;
    const my = moveIn ? Math.atan2(dir.x, dir.z) : ctl.mv;
    const jm = Math.hypot(ctl.joy.x, ctl.joy.y), RUN = CONFIG.hero.run;   // 조이스틱을 끈 정도: 많이 끌면 달리기, 덜 끌면 걷기(경계에서 떨지 않게 들어갈 때·나올 때 기준을 다르게)
    ctl.running = moveIn && !ctl.armed && (k.size ? ctl.shift : jm >= (ctl.running ? RUN[1] : RUN[0]));
    let want = ctl.armed ? 'widle' : !moving ? 'uidle' : 'umove', rate = 1;
    if (moving && ctl.armed) { if (!LOCK.on) { want = run ? 'wrun' : 'wwalk'; ctl.sec = null; }
      else { const a = wrapA(my - LOCK.yaw) / DEG;   // +면 몸 기준 왼쪽으로 가는 것
        if (!(ctl.sec && SEC[ctl.sec](a))) ctl.sec = Math.abs(a) <= 45 ? 'f' : Math.abs(a) >= 135 ? 'b' : a > 0 ? 'l' : 'r';
        want = ctl.sec === 'f' ? (run ? 'wrun' : 'wwalk') : ctl.sec === 'b' ? 'wback' : ctl.sec === 'l' ? 'wstrL' : 'wstrR';
        if (run && ctl.sec !== 'f') rate = LOCK.RUNK; } }   // 달리기 켠 채 옆·뒤로는 같은 걸음을 빠르게
    if (holding) want = st.act;   // 마저 걷는 중엔 하던 걸음 그대로
    const cur = ACTS[st.act], busy = cur.once && st.t < (cur.atk && moving && !cur.atk.final ? cur.atk.chain + 0.18 : cur.atk && cur.atk.end ? cur.atk.end : cur.cancel && moving ? cur.cancel : cur.dur - (cur.air ? 0.08 : 0.12));   // 공격 뒤 여운은 움직이면 끊는다(마지막 공격은 못 끊음)
    const near = GOB ? Math.hypot(GOB.holder.position.x - root.position.x, GOB.holder.position.z - root.position.z) : Infinity;
    if (!ctl.armed) {   // 무방비: 공격을 누르거나 적이 가까우면 칼을 뺀다(빼기만, 휘두르지 않음). 점프는 안 된다
      if (ctl.req === 'slash') { if (!DR.mode) startDraw(); else if (DR.mode === 'sheath') DR.next = 'draw'; }   // 칼 빼기까지만(공격은 다시 눌러야)
      ctl.req = null; ctl.buf = false;
      if (near < COMBAT.enter) { if (!DR.mode) startDraw(); else if (DR.mode === 'sheath') DR.next = 'draw'; }
      // 가만히 서 있으면 가끔 다른 대기를 섞는다(오래 서 있으면 기분 좋은 대기도 드문드문). 칼을 빼기 시작하면 바로 맨손 서기로
      const IM = CONFIG.hero.idleMix, rr = ([a, b]) => a + Math.random() * (b - a), still = !moving && !DR.mode && (st.act === 'uidle' || cur.fidget); let mixed = false;
      if (DR.mode && cur.fidget) { play('uidle', 0, 0.3); mixed = true; }
      ctl.stillT = still ? ctl.stillT + dt / CONFIG.game.speed : 0; if (!still) ctl.fidgetAt = rr(IM.first);
      else if (st.act === 'uidle' && ctl.stillT >= ctl.fidgetAt) { let n = 'uidleB';   // 처음엔 맨손 대기, 오래 서 있으면 세 가지를 섞은 주머니에서 하나씩(다 나올 때까지 겹치지 않게, 같은 걸 연달아 안 하게)
        if (ctl.stillT >= IM.long) { if (!ctl.idleBag.length) { ctl.idleBag = ['uidleB', 'uhappy1', 'uhappy2'].sort(() => Math.random() - 0.5); if (ctl.idleBag[0] === ctl.idleLast) ctl.idleBag.push(ctl.idleBag.shift()); } n = ctl.idleBag.shift(); }
        ctl.idleLast = n;
        play(n, 0, ACTS[n].fade); mixed = true; ctl.fidgetAt = ctl.stillT + ACTS[n].dur / (CONFIG.game.speed * (ACTS[n].rate || 1)) + rr(IM.gap); }
      if (cur.turn) { if (st.t >= cur.end) endTurn(); }   // 돌아서기: 끝나면 달리던 빠르기로 이어 달린다
      else if (st.act === 'umove' && moveIn && ctl.running && !DR.mode && ctl.vAct > TURN.minV * LOCO.vR && Math.abs(wrapA(my - ctl.mv)) > TURN.ang) startTurn();   // 달리다 반대로 꺾으면
      else if (!busy && !mixed) switchAct(want); }
    else {
    if (!DR.mode && !cur.once) { ctl.calm = near > COMBAT.exit ? ctl.calm + dt / CONFIG.game.speed : 0; if (ctl.calm > CONFIG.hero.sheathAfter) { ctl.calm = 0; startSheath(); } }   // 한동안 적이 없으면 칼을 넣는다
    // 연속기: 공격 중에 누르면 기억했다가 넘어가는 때(chain)에 다음 공격. 공격이 끝나 버리면 다음엔 처음(1)부터
    if (ctl.req === 'slash' && (cur.atk || recov)) { if (!cur.atk || (cur.atk.final ? st.t > (cur.atk.end || cur.dur) - 0.3 : st.t >= cur.atk.T - BUF_EARLY)) ctl.buf = true; ctl.req = null; }   // 다음 공격 입력은 내려치기 직전부터만 받는다(그보다 일찍 누른 건 무시). 마지막 공격은 끝나갈 때만
    if (recov && ctl.req) ctl.req = null;   // 후딜 중엔 점프도 안 된다
    if (ctl.held && cur.atk && !cur.atk.final && st.t >= cur.atk.T - BUF_EARLY) ctl.buf = true;   // 공격을 꾹 누르고 있으면 1 → 2 → 3까지 쭉(3번에서 멈춤)
    const nx = cur.atk ? COMBO[(ctl.ci + 1) % COMBO.length] : null, lk = nx && LINK[st.act] && LINK[st.act][nx];
    if (lk && ctl.buf && st.t >= lk[0]) { ctl.buf = false; ctl.ci = (ctl.ci + 1) % COMBO.length; const late = st.t > lk[0] + LATE; play(nx, late ? 0 : lk[1], late ? 0.2 : lk[2]); ctl.v = 0; if (!late) st.warp = makeWarp(nx, lk[1], lk[3] || 0); }
    else if (cur.atk && cur.atk.final && !busy) { ctl.rec = REC; ctl.soft = REC + 0.5; play('widle', 0, 0.45); }   // 마지막 공격이 끝나 자세를 잡으면 후딜(기본 자세로 천천히 섞고, 몸도 천천히 돌린다)
    else if (!recov && ctl.buf && !cur.atk) { ctl.buf = false; ctl.ci = 0; play(COMBO[0]); }   // 후딜 중 눌러 둔 공격은 끝나자마자 1번부터
    else if (!busy && ctl.req) { if (ctl.req === 'slash') { ctl.ci = 0; ctl.buf = false; }   // 달리는 중 점프는 달리기 점프
      const pa = st.act, pt = st.t, pr = st.speed; play(ctl.req === 'jump' && st.act === 'wrun' ? 'rjump' : ctl.req); if (ACTS[st.act].boost) ctl.v *= ACTS[st.act].boost;
      if (ACTS[st.act].atk && ACTS[pa].spd) { const fy = LOCK.on ? LOCK.yaw : ctl.yaw, fv = ctl.v * Math.cos(ctl.mv - fy);   // 걷거나 달리던 속도 중 앞(때리는 쪽)으로 가던 만큼만 이어서 휘두른다
        if (fv > 20) { st.carry = { act: pa, t0: pt, rate: pr, v0: fv }; ctl.mv = fy; } }
      ctl.req = null; } else if (!(cur.atk && ctl.buf)) { if (busy) ctl.req = null; if (!busy) { switchAct(want); if (!ACTS[st.act].atk && !recov) ctl.buf = false; } } }
    const act = ACTS[st.act], lock = act.once && !act.air;
    st.speed = act.spd ? (rate > 1 ? LOCK.RUNK : act.k || 1) : act.atk ? act.atk.rate || 1 : act.rate || 1;
    // 바라보는 쪽(yaw)과 움직이는 쪽(mv)을 따로: 몬스터가 가까우면 몸은 몬스터 쪽, 아니면 가는 쪽
    if (ctl.soft > 0) ctl.soft -= dt;
    if (LOCK.on) { let ty = LOCK.yaw, rr;   // 공격: 내려치기 전까지 겨누고(9), 내려치는 동안 고정, 내려친 뒤엔 천천히 몬스터 쪽으로 되돌린다(마지막 공격은 더 천천히)
      if (lock && act.atk) { if (st.t < act.atk.T + 0.06) { ty -= act.atk.aim; rr = st.t < act.atk.T - 0.12 ? 9 : 0; } else rr = act.atk.final ? 2.2 : 3.5; }
      else rr = lock ? 0 : act.air ? 5 : ctl.soft > 0 ? 3.5 : 12;
      ctl.yaw = turn(ctl.yaw, ty, rr, dt); }
    else if (moving && !lock) ctl.yaw = turn(ctl.yaw, my, act.air ? 4 : run ? 9 : 11, dt);
    if (moving && !lock) ctl.mv = turn(ctl.mv, my, act.air ? 4 : 14, dt);
    if (act.rm) { ctl.mv = ctl.yaw; }
    let tv = act.rm ? act.rmv * st.speed : lock ? 0 : act.air ? ctl.v : (moving ? act.spd || 0 : 0) * st.speed;
    if (act.blend) tv = moving ? (ctl.running ? LOCO.vR : LOCO.vW) : 0;
    if (!LOCK.on && !act.air) tv *= 0.35 + 0.65 * Math.max(0, Math.cos(ctl.yaw - ctl.mv));   // 돌아서는 동안은 느리게
    if (lock && st.carry) { ctl.v = st.carry.v0 * (1 - sstep(CARRY.v[0], CARRY.v[1], st.t));   // 관성: 휘두르는 동안 달리던 속도로 나가다가 내려칠 때쯤 멈춘다
      if (LOCK.on && GOB) { const gd = Math.hypot(GOB.holder.position.x - root.position.x, GOB.holder.position.z - root.position.z); ctl.v = Math.min(ctl.v, Math.max(0, gd - (act.atk.ideal || ASSIST.IDEAL)) * 7); } }   // 고블린 앞에선 파이프 끝이 맞는 거리에서 멈춘다
    else if (act.rm) ctl.v = tv;
    else if (act.blend) { const A = CONFIG.hero.accel, up = tv > ctl.v; ctl.v = up ? Math.min(tv, ctl.v + (ctl.v >= LOCO.vW - 1 ? A.run : A.walk) * dt) : Math.max(tv, ctl.v - A.stop * dt); }   // 가속도: 서서히 빨라지고 서서히 느려진다
    else ctl.v += (tv - ctl.v) * (1 - Math.exp(-dt * (lock ? 14 : 7)));
    if (act.blend) { const g = Math.max(ctl.vAct, 0.4 * ctl.v, 12), gt = gaitFor(g), rk = Math.max(0, Math.min(1, (g - LOCO.vW) / (LOCO.vR - LOCO.vW)));   // 실제로 나아간 빠르기(g)에 맞는 걸음: 보폭은 섞는 정도로, 발 박자 = 빠르기 / 보폭 → 디딘 발이 바닥에서 안 밀린다(벽에 막혀 덜 가면 걸음도 그만큼)
      H.loco = { a: Math.min(1, gt.u), w: Math.max(0, gt.u - 1), lean: CONFIG.hero.lean * DEG * rk }; st.speed = g / gt.S; }
    const p = root.position; if (ctl.px == null) { ctl.px = p.x; ctl.pz = p.z; } p.x += Math.sin(ctl.mv) * ctl.v * dt; p.z += Math.cos(ctl.mv) * ctl.v * dt;
    if (act.turn && ctl.turn) { const tr = ctl.turn, c = pathAt(act.path, Math.min(st.t, act.dur)), R = tr.yaw0 - tr.y0, dx = (c.x - tr.last.x) * TURN.scale, dz = (c.z - tr.last.z) * TURN.scale;   // 돌아서기: 동작에 든 길·방향대로 몸을 옮기고 돌린다
      p.x += dx * Math.cos(R) + dz * Math.sin(R); p.z += -dx * Math.sin(R) + dz * Math.cos(R); ctl.yaw = tr.yaw0 + (c.yaw - tr.y0); tr.last = c; }
    // 1·2타: 몬스터가 붙을 거리에 없으면(보정 없음) 휘두르며 살짝 앞으로 내딛는다
    if (lock && act.atk && !act.atk.final && !st.carry && !(GOB && Math.hypot(GOB.holder.position.x - p.x, GOB.holder.position.z - p.z) < ASSIST.D + 5)) {
      const want = STEP_FWD * sstep(ASSIST.PULL_T[0], act.atk.T - 0.05, st.t), m = want - (st.step || 0); st.step = want; p.x += Math.sin(ctl.yaw) * m; p.z += Math.cos(ctl.yaw) * m; }
    if (KBH.v > 2) { p.x += Math.sin(KBH.a) * KBH.v * dt; p.z += Math.cos(KBH.a) * KBH.v * dt; KBH.v *= Math.exp(-dt * 6); } else KBH.v = 0;   // 넉백: 밀려났다가 멈춘다
    if (DG && DG.clamp) DG.clamp(p, 40); else { const RR = ctl.R, rr = Math.hypot(p.x, p.z); if (rr > RR) { p.x *= RR / rr; p.z *= RR / rr; } }   // 던전: 동굴 모양 안으로
    if (DG) for (const c of DG.colliders) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), mr = c.r + 16; if (d < mr && d > 1e-3) { p.x += dx / d * (mr - d); p.z += dz / d * (mr - d); } }   // 천막·모닥불·바위 등
    if (GOB) { const gx = p.x - GOB.holder.position.x, gz = p.z - GOB.holder.position.z, gd = Math.hypot(gx, gz), tR = act.atk && act.atk.minR ? Math.min(GOB.gs.R, act.atk.minR) : GOB.gs.R;   // 붙을 수 있는 거리: 줄어들 땐 바로, 늘어날 땐 천천히(3번 끝나고 순간이동하듯 밀려나지 않게)
      ctl.minR = ctl.minR == null || tR < ctl.minR ? tR : ctl.minR + (tR - ctl.minR) * (1 - Math.exp(-dt * 2.5)); const mn = ctl.minR; if (gd < mn && gd > 1e-3) { p.x += gx / gd * (mn - gd); p.z += gz / gd * (mn - gd); } }
    if (GOB && act.atk && act.atk.ideal && !st.hitDone && st.t > ASSIST.PULL_T[0] && st.t < act.atk.T - 0.05) { const gx = GOB.holder.position.x - p.x, gz = GOB.holder.position.z - p.z, gd = Math.hypot(gx, gz);   // 휘두르며 파이프 끝이 맞는 거리로: 멀면 한 걸음 붙고, 너무 붙었으면 살짝 물러선다
      if (gd < ASSIST.D + 5 && !st.carry) { const left = ASSIST.MAX - (st.pull || 0), m = Math.max(-ASSIST.BACK * dt, -left, Math.min(gd - act.atk.ideal, ASSIST.PULL * dt, left)); st.pull = (st.pull || 0) + Math.abs(m); p.x += gx / gd * m; p.z += gz / gd * m; } }
    { const mvd = Math.hypot(p.x - ctl.px, p.z - ctl.pz); if (dt > 1e-5 && isFinite(mvd)) ctl.vAct += (mvd / dt - ctl.vAct) * (1 - Math.exp(-dt * 12)); ctl.px = p.x; ctl.pz = p.z; }   // 이번 프레임에 실제로 나아간 빠르기(벽·장애물에 막힌 만큼 뺀)
    root.rotation.y = ctl.yaw;
    G.follow(p); }
  // 한 프레임(게임 속 dt): 조작 → 동작 고르기·재생 → 자세 적용 → 공격 판정
  function update(dt) { const GOB = G.enemy;
    ctlFrame(dt); if (DR.mode && ACTS[st.act].atk) { DR.mode = null; DR.w = 0; } drawStep(dt);   // 공격이 시작되면 덧씌우기는 끝
    const a = ACTS[st.act], inAir = a.airT && st.t > a.airT[0] && st.t < a.airT[1]; const w = st.warp, wi = w ? Math.floor((st.t - w.t0) / w.dt) : -1; st.t += dt * st.speed * (inAir ? a.airRate : 1) * (w && wi >= 0 && wi < w.r.length ? w.r[wi] : 1); const t = a.once ? Math.min(st.t, a.dur - 1e-3) : st.t % a.dur;
    const f = actFrame(a, t);
    if (st.carry && a.atk) { const ca = ACTS[st.carry.act], w = 1 - sstep(CARRY.legs[0], CARRY.legs[1], t);   // 휘두르기 앞부분은 달리던 다리 그대로
      if (w > 0) { const fc = actFrame(ca, (st.carry.t0 + st.t * st.carry.rate) % ca.dur);
        for (const [bo, q] of f.q) { if (LEGS.test(bo.name.replace(/^mixamorig:?/, ''))) q.slerp(fc.q.get(bo), w); } f.hip.y += (fc.hip.y - f.hip.y) * w; } }
    if (a.lift && t > a.airT[0] && t < a.airT[1]) { const u = (t - a.airT[0]) / (a.airT[1] - a.airT[0]); f.hip.y += a.lift * 4 * u * (1 - u); }
    if (st.fade < 1 && st.fromF) { st.fade = Math.min(1, st.fade + dt * st.speed / st.fadeDur); const k = EASE.io(st.fade); let F0 = st.fromF;
      if (st.from) { const fa = st.from.a; st.from.t += dt * st.from.sp; const ft = fa.once ? Math.min(st.from.t, fa.dur - 1e-3) : st.from.t % fa.dur; F0 = actFrame(fa, ft); }
      for (const [b, q] of f.q) { const q0 = F0.q.get(b); if (q0) q.copy(q0.clone().slerp(q, k)); } f.hip.lerpVectors(F0.hip, f.hip.clone(), k); }
    let pa = a, pt = t; if (DR.mode && DR.w > 0) { const la = ACTS[DR.act], lf = actFrame(la, DR.t);   // 칼 빼기·넣기: 윗몸(손가락까지)을 덮는다
      for (const [bo, q] of f.q) if (LAYER(bo.name.replace(/^mixamorig:?/, ''))) { const q1 = lf.q.get(bo); if (q1) q.slerp(q1, DR.w); }
      if (DR.w > 0.5) { pa = la; pt = DR.t; } }
    applyFrame(f); posePipe(pa, pt); H.lastF = f;   // 한 손 동작(피격)은 오른손 기본 쥐기, 두 손 동작은 두 주먹을 잇는 선(구간에 따라 오른손 방향)
    // 공격이 맞았나: 내려치는 동안 파이프(오른손~끝)가 지난 자리가 고블린 머리·몸통에 닿으면. 끝에 가까운 곳부터 본다
    if (GOB && a.atk && !st.hitDone && t > a.atk.win[0] && t < a.atk.win[1]) { let c = pipeContact(); if (!c && t >= a.atk.T) c = assistPoint(a);   // 닿았거나, 내려친 순간 사거리 안이면 맞는다
      if (c) { GOB.hit(root.position, a.atk.kb || (a.atk.final ? 70 : 0), !!a.atk.final); st.hitDone = true; hitFX(c, a.atk.fx); if (GOB.hurt) GOB.hurt(a.atk.dmg || 0, !!a.atk.final); } }   // 체력은 효과를 낸 뒤 깎는다(쓰러지면 G.enemy 에서 빠지므로)   // 3타(마지막)는 늑대를 밀어낸다
    if (a.atk) H.PIPE_PREV = pipeSamples(); else H.PIPE_PREV = null;
  }
  // 주인공이 맞으면(맞았으면 true, 방금 맞아 젖혀지는 중이면 false): 하던 동작을 끊고 피격 동작, 살짝 뒤로 밀리고 화면 조금 흔들림. 연속기는 처음부터
  const KBH = { v: 0, a: 0 };   // 주인공 넉백(밀려나는 빠르기·방향)
  function heroHit(from, kb = 0) { const { FX, HS, SHK } = G.fx;
    if (st.act === 'impact' && st.t < 0.35) return false; ctl.turn = null; if (DR.mode) { ctl.armed = !weapon.W.away; DR.mode = null; DR.w = 0; DR.next = null; } play('impact', 0.1, 0.03); ctl.buf = false; ctl.ci = 0; ctl.rec = 0; ctl.req = null;   // 맞는 즉시 젖혀지게: 동작의 느린 첫 0.1초는 건너뛰고 거의 바로 넘어간다
    ctl.mv = Math.atan2(root.position.x - from.x, root.position.z - from.z); ctl.v = 110; if (kb) { KBH.v = kb; KBH.a = ctl.mv; } HS.t = 0.025; SHK.t = 0.2; SHK.a = 6;
    const n = V(from.x - root.position.x, 0, from.z - root.position.z).normalize(), at = B.Spine2.getWorldPosition(V()).addScaledVector(n, 12).add(V(0, 6, 0));   // 맞은 자리: 가슴의 고블린 쪽
    FX.burst(at, n, { hero: true, red: true, sparks: 12, flash: 42, flashCol: [1.0, 0.22, 0.16] }); if (G.TOUCH && navigator.vibrate) try { navigator.vibrate(60); } catch (e) {} return true; }
  return { ctl, LOCK, CARRY, WALK_K, KBH, COMBAT, DR, GAIT, LOCO, disarm, startDraw, startSheath, ctlFrame, update, hit: heroHit };
}
