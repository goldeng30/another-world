// 화면 위 정보(HUD): 왼쪽 위 내 등급·레벨 · 내 발밑 HP·MP 막대 · 적 머리 위 작은 체력 막대 · 보스는 위 가운데 큰 막대와 이름
//   레벨: 바뀔 때만 숫자를 고친다
//   내 막대: 발밑을 화면에 옮겨 그 아래에 HP·MP(칸 나누기 없음), 늘 보인다
//   막대: 줄어든 만큼 잠깐 밝게 남았다가 따라 줄어든다(얼마나 깎였는지 보이게). 숫자가 바뀔 때만 화면을 고친다
//   적 막대: 평소엔 숨기고, 전투에 들어가면(칼을 빼기 시작하면) 내 발밑 막대와 같이 나타난다. 그 밖엔 맞았거나 가까이 붙으면 나타났다가 한동안 안 맞고 떨어지면 사라진다
//   보스 막대: 보스가 가까워지거나 맞으면 나타나 쓰러질 때까지 있다
//   미리보기(bossPreview, 지금은 끔): 켜면 방에 보스가 없어도 위에 늘 띄워 두고, 방의 첫 적 체력을 대신 보여 준다(깎이는 모습 확인용)
import { V } from '../core/math.js';

export const HUD = { dmg: { life: 1.1, rise: 18, pop: 0.1, popK: 1.15, jitter: 7, above: 8 }, chipHold: 0.4, chipRate: 0.8, showFor: 4, above: 12, bossNear: 560, low: 0.3, bossPreview: false };

const BAR = '<div class="trk"><i class="chip"></i><i class="fill"></i><i class="tick"></i></div>';
function meter(el, num) {
  el.insertAdjacentHTML('afterbegin', BAR);
  const fill = el.querySelector('.fill'), chip = el.querySelector('.chip');
  let f = -1, c = 1, hold = 0, wf = -1, wc = -1, txt = null;
  return { set(v, dt, text) { v = Math.max(0, Math.min(1, v));
    if (f < 0) c = v; else if (v < f - 1e-6) hold = HUD.chipHold;   // 줄었다: 잠깐 그대로 두었다가 따라 줄어든다
    f = v; if (c <= f) { c = f; hold = 0; } else if (hold > 0) hold -= dt; else c = Math.max(f, c - HUD.chipRate * dt);
    if (Math.abs(f - wf) > 1e-4) { fill.style.transform = `scaleX(${f.toFixed(4)})`; wf = f; }
    if (Math.abs(c - wc) > 1e-4) { chip.style.transform = `scaleX(${c.toFixed(4)})`; wc = c; }
    if (num && text !== txt) { num.textContent = text; txt = text; } } };
}

export function createHUD(G, $ = s => document.querySelector(s)) {
  const lvEl = $('#hud-me .me-lv b'), self = $('#hud-self'), hp = meter($('#hud-self .hp')), mp = meter($('#hud-self .mp'));
  let selfAt = null, selfOn = false;
  const bossEl = $('#hud-boss'), bossName = $('#hud-boss .boss-name span'), bossBar = meter($('#hud-boss .bar'));
  const layer = $('#hud-foes'), foes = new Map(), P = V();
  let boss, bossOn = false, lowOn = false, lv = null;   // boss: 처음엔 undefined(보스 없음 null 과 달라야 이름이 한 번 들어간다)

  function foeUI(e) { let f = foes.get(e); if (f) return f;
    const el = document.createElement('div'); el.className = 'foe'; el.innerHTML = '<div class="bar"></div>'; layer.appendChild(el);
    f = { el, m: meter(el.firstChild), seen: e.hp, t: 0, on: false, x: null }; foes.set(e, f); return f; }
  const dist = e => Math.hypot(e.holder.position.x - G.hero.root.position.x, e.holder.position.z - G.hero.root.position.z);

  function update(dt) {
    const s = G.hero.stats;
    if (lvEl && s.level !== lv) { lvEl.textContent = s.level; lv = s.level; }
    hp.set(s.hp / s.hpMax, dt); mp.set(s.mp / s.mpMax, dt);
    const low = s.hp > 0 && s.hp / s.hpMax <= HUD.low; if (low !== lowOn) { self.classList.toggle('low', low); lowOn = low; }
    const C = G.hero.H.ctrl, fight = C.ctl.armed || C.DR.mode === 'draw'; if (fight !== selfOn) { self.classList.toggle('on', fight); selfOn = fight; }   // 내 발밑 막대는 전투 상태에서만(몬스터 막대도 같이)
    const cv = G.rd.domElement, w = cv.clientWidth, h = cv.clientHeight;
    // 내 발밑 막대
    P.copy(G.hero.root.position); P.project(G.cam);
    { const x = ((P.x + 1) / 2 * w).toFixed(1), y = ((1 - P.y) / 2 * h).toFixed(1), k = x + ',' + y; if (k !== selfAt) { self.style.transform = `translate(${x}px, ${y}px)`; selfAt = k; } }
    // 적 머리 위 막대(보스 빼고)
    for (const e of G.enemies) { if (e.boss) continue; const f = foeUI(e);
      if (e.hp < f.seen) f.t = HUD.showFor; f.seen = e.hp; f.t -= dt;
      P.copy(e.holder.position); P.y += e.height + HUD.above; P.project(G.cam);
      const vis = (e.dead ? e.deadT < 0.35 : f.t > 0 || (fight && dist(e) < C.COMBAT.exit)) && P.z < 1 && Math.abs(P.x) < 1.2 && Math.abs(P.y) < 1.2;   // 전투에 들어가면 내 막대와 같이 나타난다(전투가 풀리면 같이 사라짐)
      if (vis !== f.on) { f.el.classList.toggle('on', vis); f.on = vis; }
      if (vis || f.on) { const x = ((P.x + 1) / 2 * w).toFixed(1), y = ((1 - P.y) / 2 * h).toFixed(1), k = x + ',' + y; if (k !== f.x) { f.el.style.transform = `translate(${x}px, ${y}px)`; f.x = k; } }
      f.m.set(e.hp / e.hpMax, dt); }
    for (const [e, f] of foes) if (e.boss || !G.enemies.includes(e)) { f.el.remove(); foes.delete(e); }
    // 보스 막대
    const b = G.enemies.find(e => e.boss) || null;
    if (b !== boss) { boss = b; bossOn = false; bossEl.classList.remove('on'); bossName.textContent = b ? b.name : '보스'; }
    if (!boss && HUD.bossPreview) { if (!bossOn) { bossOn = true; bossEl.classList.add('on'); } const e = G.enemies[0]; bossBar.set(e ? e.hp / e.hpMax : 1, dt); }
    if (boss) { if (!bossOn && !boss.dead && (dist(boss) < HUD.bossNear || boss.hp < boss.hpMax)) { bossOn = true; bossEl.classList.add('on'); }
      if (bossOn && boss.dead && boss.deadT > 0.5) { bossOn = false; bossEl.classList.remove('on'); }
      bossBar.set(boss.hp / boss.hpMax, dt); }
  }
  // 데미지 숫자: 맞은 쪽 머리 위(at() = 머리 위치)에서 커졌다 줄며 나타나 떠오르다 사라진다
  const dmgLayer = $('#hud-dmg'), pops = [], Q = V();
  function popDamage(at, amount, kind) { if (!dmgLayer || !(amount > 0)) return; const el = document.createElement('div'); el.className = 'dmg' + (kind ? ' ' + kind : ''); el.textContent = Math.round(amount); dmgLayer.appendChild(el);
    pops.push({ el, at, t: 0, jx: (Math.random() * 2 - 1) * HUD.dmg.jitter }); }
  let uiS = null; addEventListener('resize', () => { uiS = null; });   // 화면 배율(--s): 크기가 바뀔 때만 다시 읽는다(매 프레임 스타일 계산 안 하게)
  function stepPops(dt) { if (!pops.length) return; const D = HUD.dmg, cv = G.rd.domElement, w = cv.clientWidth, h = cv.clientHeight;
    if (uiS == null) uiS = parseFloat(getComputedStyle(document.getElementById('game')).getPropertyValue('--s')) || 1; const s = uiS;
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; const u = p.t / D.life; if (u >= 1) { p.el.remove(); pops.splice(i, 1); continue; }
      Q.copy(p.at()); Q.y += D.above; Q.project(G.cam); const x = (Q.x + 1) / 2 * w + p.jx * s, y = (1 - Q.y) / 2 * h - D.rise * s * (1 - Math.pow(1 - u, 3));
      const sc = p.t < D.pop ? D.popK - (D.popK - 1) * (p.t / D.pop) : 1, op = Math.min(1, p.t / 0.06) * (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45);
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${sc.toFixed(3)})`; p.el.style.opacity = op.toFixed(3); } }
  const update0 = update;
  return { update: dt => { update0(dt); stepPops(dt); }, popDamage };
}
