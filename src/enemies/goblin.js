// 고블린: 오른손에 몽둥이. 단순하지만 그냥 곧장 오지만은 않고, 다음에 뭘 할지 매번 확률로 고른다
//   멀면 걸어서 다가오고 · 공격 거리 바로 바깥에서 가끔 옆걸음·노려보기·뒷걸음으로 간을 보고 · 닿으면 내려찍고
//   내려찍은 뒤·맞은 뒤엔 쉬기 / 물러나기 / 옆으로 비키기 / 바로 또 덤비기 중 하나(잠깐 머뭇거린 뒤)
//   기분(mood)이 몇 초마다 바뀌어 덤비는 때와 몸 사리는 때가 섞이고, 방금 한 행동은 다시 잘 안 고른다
//   쓰러짐: 평타로 죽으면 뒤로 넘어지고(die), 3타로 죽으면 뒤로 날아가 떨어진다(dieFly). 시체는 바닥에 남는다
//   적 공통 연결부: holder · step(dt) · hit(from, kb) · die(fin) · gs · GB(뼈) · height · mat · onStrike
import { T, V } from '../core/math.js';
import { PATH, loadGLTF, loadTex, loadJSON } from '../core/assets.js';
import { makeClub, CLUB_DIM } from './club.js';
import { CONFIG } from '../config.js';

// 움직임 성격(숫자만 바꿔 조절). 표의 숫자는 고를 비율(가중치)
export const GOBLIN = {
  afterAtk: { stay: 3, back: 2, side: 2, press: 1.2 },        // 내려찍은 뒤: 쉬기 · 물러나기 · 옆으로 · 바로 또 덤비기
  afterHit: { resume: 3, back: 2, side: 1.5, counter: 1.2 },   // 맞은 뒤: 그냥 다시 · 물러나기 · 옆으로 · 받아치기(쿨이 거의 다 됐을 때)
  probe: { band: 150, chance: 0.8, gap: [1.5, 4], pick: { side: 3, stare: 1.5, back: 0.8 } },   // 공격 거리 바깥 band 안에서 1초에 chance 확률로 간 보기
  crowd: { chance: 0.9, gap: [1, 2.5], pick: { hold: 2, side: 2, back: 1.5 } },                // 쉬는(쿨) 동안 바짝 붙어 있으면
  cd: [0.9, 2.1],            // 공격 쿨(초): 기분에 따라 짧아지거나 길어진다
  atkRate: 5,                // 쿨이 다 되면 1초에 이 정도 확률로 내려찍는다(박자가 매번 다르게)
  hesitate: [0, 0.35],       // 반응하기 전 머뭇거림(초)
  backDur: [0.3, 0.8], sideDur: [0.6, 1.5], stareDur: [0.4, 1.1],
  afterBack: { delay: [0.25, 0.6], side: [0.4, 0.8], settle: [0.2, 0.5] },   // 물러난 뒤: 잠깐 멈췄다가 → 옆으로 살짝 → 또 잠깐 멈춘 뒤 다시(바로 앞으로 다가오지 않게)
  mood: [3, 7],              // 기분이 바뀌는 간격(초). 0 = 몸 사림(물러나기·비키기 많이), 1 = 덤빔(덤비기·받아치기 많이)
  repeatK: 0.35,             // 방금 한 행동은 고를 비율을 이만큼 낮춘다(같은 패턴 반복 방지)
};
const rr = ([a, b]) => a + Math.random() * (b - a);
const CAUTIOUS = new Set(['back', 'side', 'stare', 'stay', 'hold']);

export async function createGoblin(G, o = {}) {
  const { scene, ENV_K } = G, DG = G.world, root = G.hero.root;
  const [gg, gBase, gNrm, club, SRCC] = await Promise.all([loadGLTF(PATH.enemies + 'goblin.glb'), loadTex(PATH.enemies + 'goblin_base.webp'), loadTex(PATH.enemies + 'goblin_nrm.webp'), makeClub(), loadJSON(PATH.enemies + 'goblin_clips.json')]);
  gBase.encoding = T.sRGBEncoding; gBase.anisotropy = 8;
  const g = gg.scene; let gsm = null; g.traverse(o => { if (o.isSkinnedMesh && !gsm) gsm = o; });
  gsm.material = new T.MeshStandardMaterial({ map: gBase, normalMap: gNrm, color: 0xd9d9d9, roughness: 0.85, metalness: 0, envMapIntensity: ENV_K || 0.5, skinning: true });   // 던전: 밝은 피부가 튀지 않게 조금 낮춤
  gsm.frustumCulled = false; gsm.castShadow = true; gsm.receiveShadow = true;
  const GB = {}; g.traverse(o => { if (/^mixamorig/.test(o.name)) GB[o.name.replace(/^mixamorig:?/, '')] = o; });
  const holder = new T.Group(); holder.add(g); scene.add(holder);
  const w = n => GB[n].getWorldPosition(V());
  const mixer = new T.AnimationMixer(g), atkClip = gg.animations[0], GT0 = 0.05;   // 공격 동작 0초 프레임은 깨져 있어 0.05초부터
  const tmp = mixer.clipAction(atkClip); tmp.play(); tmp.paused = true; tmp.time = GT0; mixer.update(0);
  // 실제로 그려지는(피부 입힌) 정점으로 크기·바닥 맞추기: 도윤 키의 2/3, 발바닥 = 바닥
  const skinBox = () => { holder.updateMatrixWorld(true); const sk = gsm.skeleton, pa = gsm.geometry.attributes.position, si = gsm.geometry.attributes.skinIndex, sw = gsm.geometry.attributes.skinWeight, BM = sk.bones.map((bn, k) => new T.Matrix4().multiplyMatrices(bn.matrixWorld, sk.boneInverses[k])), p0 = V(), t3 = V(), acc = V(); let lo = Infinity, hi2 = -Infinity;
    for (let i = 0; i < pa.count; i += 4) { p0.fromBufferAttribute(pa, i).applyMatrix4(gsm.bindMatrix); acc.set(0, 0, 0); let ws = 0; for (let k = 0; k < 4; k++) { const wv = sw.array[i * 4 + k]; if (!wv) continue; ws += wv; acc.addScaledVector(t3.copy(p0).applyMatrix4(BM[si.array[i * 4 + k]]), wv); }
      acc.divideScalar(ws || 1).applyMatrix4(gsm.bindMatrixInverse).applyMatrix4(gsm.matrixWorld); lo = Math.min(lo, acc.y); hi2 = Math.max(hi2, acc.y); } return [lo, hi2]; };
  let [lo0, hi0] = skinBox(); const doyunH = G.hero.height; g.scale.multiplyScalar(doyunH * 0.66 / (hi0 - lo0));
  [lo0, hi0] = skinBox(); g.position.y -= lo0; holder.updateMatrixWorld(true); const height = hi0 - lo0;
  // 몽둥이: 오른 주먹 가운데(가운뎃손가락 마디로 원 맞추기), 엄지 쪽으로 머리
  { const A0 = w('RightHandMiddle1'), Bm = w('RightHandMiddle3'), C = w('RightHandMiddle4'), ab = Bm.clone().sub(A0), ac = C.clone().sub(A0), nn = V().crossVectors(ab, ac);
    let ctr = A0.clone().add(V().crossVectors(nn, ab).multiplyScalar(ac.lengthSq()).add(V().crossVectors(ac, nn).multiplyScalar(ab.lengthSq())).divideScalar(2 * nn.lengthSq()));
    if (!isFinite(ctr.x) || ctr.distanceTo(w('RightHand')) > height * 0.12) ctr = w('RightHandMiddle1').lerp(w('RightHandMiddle2'), 0.5);
    const ax = w('RightHandIndex1').sub(w('RightHandPinky1')).normalize(), q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), ax), sc = height * 0.5 / CLUB_DIM.LEN;
    const Mw = new T.Matrix4().compose(ctr.clone().sub(V(0, club.userData.grip * sc, 0).applyQuaternion(q)), q, V(sc, sc, sc)), Ml = GB.RightHand.matrixWorld.clone().invert().multiply(Mw);
    Ml.decompose(club.position, club.quaternion, club.scale); GB.RightHand.add(club); }
  // 대기 동작: 공격 동작의 첫 자세 + 숨쉬기·들썩임·고개 갸웃 (4.8초 반복) → 다른 동작과 섞어 넘어갈 수 있게 동작 파일로 만든다
  const base = new Map(); for (const k in GB) if (GB[k].isBone) base.set(GB[k], GB[k].quaternion.clone()); const hipBase = GB.Hips.position.clone(); tmp.stop();
  const IDLE_MOV = { Spine: (b, s) => [0.02 * b, 0.04 * s, 0], Spine1: (b, s) => [0.03 * b, 0.03 * s, 0], Spine2: (b, s) => [0.04 * b, 0, 0.02 * s], Neck: (b, s) => [-0.03 * b, 0.05 * s, 0], Head: (b, s, tl) => [-0.03 * b, 0.12 * s, 0.12 * tl], LeftShoulder: b => [0, 0, 0.05 * b], RightShoulder: b => [0, 0, -0.05 * b] };
  const idleClip = (() => { const D = 4.8, N = 32, tracks = [];
    for (const [bone, q0] of base) { const nm = bone.name + '.quaternion', mv = IDLE_MOV[bone.name.replace(/^mixamorig:?/, '')];
      if (!mv) { tracks.push(new T.QuaternionKeyframeTrack(nm, [0], [q0.x, q0.y, q0.z, q0.w])); continue; }
      const times = [], vals = []; for (let k = 0; k <= N; k++) { const t = D * k / N, b = Math.sin(2 * Math.PI * t / 2.4), sw2 = Math.sin(2 * Math.PI * t / 4.8), tl = Math.sin(2 * Math.PI * t / 4.8) * Math.sin(2 * Math.PI * t / 2.4), e = mv(b, sw2, tl);
        const q = q0.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(e[0], e[1], e[2]))); times.push(t); vals.push(q.x, q.y, q.z, q.w); }
      tracks.push(new T.QuaternionKeyframeTrack(nm, times, vals)); }
    tracks.push(new T.VectorKeyframeTrack(GB.Hips.name + '.position', [0], [hipBase.x, hipBase.y, hipBase.z])); return new T.AnimationClip('idle', D, tracks); })();
  // 받은 동작: 엉덩이가 나아가는 만큼(앞·뒤·옆)을 빼서 제자리 동작으로 → 그만큼 실제로 옮긴다(발 안 미끄러지게). 돌려주는 값 = 이동 빠르기
  const clip = name => { const c = T.AnimationClip.parse(SRCC[name]); c.uuid = T.MathUtils.generateUUID(); return c; };   // 파일에서 읽은 동작은 고유 번호가 없어 새로 준다(안 그러면 서로 같은 동작으로 묶임)
  const inPlace = c => { const tr = c.tracks.find(t => /Hips\.position$/.test(t.name)), v = tr.values, n = v.length / 3, dx = v[(n - 1) * 3] - v[0], dz = v[(n - 1) * 3 + 2] - v[2];
    for (let i = 0; i < n; i++) { const u = tr.times[i] / c.duration; v[i * 3] -= dx * u; v[i * 3 + 2] -= dz * u; }
    return Math.hypot(dx, dz) * GB.Hips.parent.getWorldScale(V()).x / c.duration; };
  const walkClip = clip('walk'), hitClip = clip('hit'), backClip = clip('back'), sideClip = clip('strafe'), sideClipR = clip('strafe');
  const walkSpeed = inPlace(walkClip), backSpeed = inPlace(backClip), sideSpeed = inPlace(sideClip); inPlace(sideClipR);
  // 죽는 동작: 엉덩이가 앞뒤·옆으로 가는 길은 동작에서 빼 두고(rootPath), 그 길대로 몸 전체를 옮긴다 → 벽·장애물을 뚫고 눕지 않게
  const rootPath = c => { const tr = c.tracks.find(t => /Hips\.position$/.test(t.name)), v = tr.values, n = v.length / 3, x0 = v[0], z0 = v[2], path = { t: Array.from(tr.times), x: [], z: [] };
    for (let i = 0; i < n; i++) { path.x.push(v[i * 3] - x0); path.z.push(v[i * 3 + 2] - z0); v[i * 3] = x0; v[i * 3 + 2] = z0; } return path; };
  const dieClip = clip('die'), dieFlyClip = clip('dieFly'), DIE_PATH = { die: rootPath(dieClip), dieFly: rootPath(dieFlyClip) };
  const A = { idle: mixer.clipAction(idleClip), walk: mixer.clipAction(walkClip), atk: mixer.clipAction(atkClip), hit: mixer.clipAction(hitClip),
    back: mixer.clipAction(backClip), sideL: mixer.clipAction(sideClip), sideR: mixer.clipAction(sideClipR), die: mixer.clipAction(dieClip), dieFly: mixer.clipAction(dieFlyClip) };
  A.sideR.timeScale = -1;   // 오른쪽 옆걸음 = 왼쪽 옆걸음을 거꾸로
  for (const k of ['atk', 'hit', 'die', 'dieFly']) { A[k].setLoop(T.LoopOnce); A[k].clampWhenFinished = true; }
  const KB_K = 9;   // 넉백 멈추는 빠르기(속도 = 거리×KB_K, 지수로 줄어 합이 거리)
  const gs = { state: 'idle', yaw: 0, cd: 1.2, t: 0, R: height * 0.8, kb: 0, kdir: V(), ATK: height * 0.95, AGGRO: CONFIG.sight.goblin, until: 0, nextProbe: 0, nextCrowd: 0,
    mood: Math.random(), moodTo: Math.random(), moodT: rr(GOBLIN.mood), next: null, last: null };
  let cur = A.idle; cur.play();
  const GSTRIKE = 0.87;   // 고블린 공격에서 몽둥이가 앞으로 내려찍히는 때
  function go(name, fade, from = 0) { if (name === 'atk') gs.struck = false; const nx = A[name]; nx.reset(); nx.time = from; nx.setEffectiveWeight(1); nx.play(); if (cur !== nx) cur.crossFadeTo(nx, fade, false); cur = nx; gs.state = name; }
  mixer.update(0);
  // 벽·장애물 여유: (x,z)에서 dir 쪽으로 몇 걸음 가도 되는지
  const free = (dx, dz) => { if (!DG) return true; const p = holder.position; for (const Ld of [40, 80]) { const x = p.x + dx * Ld, z = p.z + dz * Ld; if (DG.sdf(x, z) > -60) return false; for (const c of DG.colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + 20) return false; } return true; };
  const leftDir = () => [Math.cos(gs.yaw), -Math.sin(gs.yaw)];   // 몸 기준 왼쪽(세계)
  function side(dur) { const [lx, lz] = leftDir(); let s = Math.random() < 0.5 ? 1 : -1; if (!free(lx * s, lz * s)) s = -s; if (!free(lx * s, lz * s)) return false;
    gs.side = s; gs.until = gs.t + dur; go(s > 0 ? 'sideL' : 'sideR', 0.2); return true; }
  function back(dur) { if (!free(-Math.sin(gs.yaw), -Math.cos(gs.yaw))) return false; gs.until = gs.t + dur; go('back', 0.15); return true; }
  // 제자리에서 주인공을 보며 잠깐(노려보기·머뭇거림): 대기 동작은 이어서(처음부터 다시 틀지 않게)
  function hold(dur) { gs.until = gs.t + dur; if (cur !== A.idle) go('idle', 0.25); gs.state = 'pause'; }
  // 확률로 고르기: 기분이 몸 사림 쪽이면 물러나기·비키기·노려보기를, 덤빔 쪽이면 덤비기·받아치기를 더 고른다. 방금 한 것은 덜
  function pick(table) { const ws = Object.entries(table).map(([k, w]) => [k, w * (CAUTIOUS.has(k) ? 1.4 - 0.8 * gs.mood : 0.6 + 0.8 * gs.mood) * (k === gs.last ? GOBLIN.repeatK : 1)]);
    let r = Math.random() * ws.reduce((s, [, w]) => s + w, 0); for (const [k, w] of ws) { r -= w; if (r <= 0) return (gs.last = k); } return (gs.last = ws[ws.length - 1][0]); }
  // 고른 행동 하기(막혀서 못 하면 false)
  function act(k) { switch (k) {
    case 'back': return back(rr(GOBLIN.backDur));
    case 'side': return side(rr(GOBLIN.sideDur));
    case 'stay': case 'stare': case 'hold': hold(rr(GOBLIN.stareDur)); return true;
    case 'press': gs.cd = rr([0.2, 0.6]); hold(rr([0.1, 0.3])); return true;   // 바로 또 덤빈다
    case 'counter': if (gs.cd < 0.6) gs.cd = 0; return false;                    // 받아치기: 쿨을 끝내고 바로 다시
    case 'afterBack': gs.settle = true; if (side(rr(GOBLIN.afterBack.side))) return true; gs.settle = false; hold(rr(GOBLIN.afterBack.settle)); return true;   // 물러난 뒤 옆으로 살짝(막혔으면 그냥 조금 더 멈춤)
    default: return false; } }
  const react = table => { gs.next = pick(table); hold(rr(GOBLIN.hesitate)); };   // 잠깐 머뭇거린 뒤 고른 행동
  function hit(from, kb = 0) { if (kb > 0) { gs.kdir.set(holder.position.x - from.x, 0, holder.position.z - from.z).normalize(); gs.kb = kb * KB_K; }   // 넉백: 맞은 쪽 반대로 kb만큼 짧게 미끄러지듯
    if (gs.state === 'dead') return false; if (gs.state === 'hit' && A.hit.time < 0.3) return false; gs.cd = Math.max(gs.cd, 0.9); gs.next = null; gs.settle = false; go('hit', 0.06, 0); return true; }   // 맞는 동작은 그대로(옆으로 휘청)
  // 죽음: 맞은 쪽 반대로 넘어진다(넉백 대신 동작의 길대로). 다 넘어지면 그 자세 그대로 멈춘다(시체)
  const DP = V(), DQ = V();
  const pathAt = (P, t) => { const T0 = P.t; let i = 0; while (i < T0.length - 2 && T0[i + 1] < t) i++; const u = Math.max(0, Math.min(1, (t - T0[i]) / ((T0[i + 1] - T0[i]) || 1))); return [P.x[i] + (P.x[i + 1] - P.x[i]) * u, P.z[i] + (P.z[i + 1] - P.z[i]) * u]; };
  function die(fin = false) { if (gs.state === 'dead') return; const to = root.position.clone().sub(holder.position);
    gs.faceTo = Math.atan2(to.x, to.z); gs.kb = 0; gs.next = null; gs.deadAct = fin ? 'dieFly' : 'die'; gs.dt0 = 0; gs.done = false; go(gs.deadAct, 0.1); gs.state = 'dead'; }
  function deadStep(dt) { const a = A[gs.deadAct], P = DIE_PATH[gs.deadAct], t0 = a.time;
    let d = gs.faceTo - gs.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); gs.yaw += d * (1 - Math.exp(-dt * 14)); holder.rotation.y = gs.yaw;   // 친 쪽을 마주 보고 넘어간다
    mixer.update(dt); const t1 = a.time, par = GB.Hips.parent; par.updateMatrixWorld(true);
    const [x0, z0] = pathAt(P, t0), [x1, z1] = pathAt(P, t1); DP.set(x0, 0, z0); DQ.set(x1, 0, z1); par.localToWorld(DP); par.localToWorld(DQ);
    const p = holder.position; p.x += DQ.x - DP.x; p.z += DQ.z - DP.z;
    if (DG) { DG.clamp(p, 50); for (const c of DG.colliders) { const dx = p.x - c.x, dz = p.z - c.z, dd = Math.hypot(dx, dz), mr = c.r + 24; if (dd < mr && dd > 1e-3) { p.x += dx / dd * (mr - dd); p.z += dz / dd * (mr - dd); } } }
    if (t1 >= a.getClip().duration - 1e-3) gs.done = true; }
  function step(dt) { if (gs.state === 'dead') { if (!gs.done) deadStep(dt); return; }
    gs.t += dt; gs.cd -= dt;
    if (gs.t > gs.moodT) { gs.moodTo = Math.random(); gs.moodT = gs.t + rr(GOBLIN.mood); } gs.mood += (gs.moodTo - gs.mood) * (1 - Math.exp(-dt * 0.6));   // 기분이 천천히 바뀐다
    if (DG) { const hp = holder.position; DG.clamp(hp, 36); for (const c of DG.colliders) { const dx = hp.x - c.x, dz = hp.z - c.z, d = Math.hypot(dx, dz), mr = c.r + 14; if (d < mr && d > 1e-3) { hp.x += dx / d * (mr - d); hp.z += dz / d * (mr - d); } } }
    if (gs.kb > 0.5) { holder.position.addScaledVector(gs.kdir, gs.kb * dt); gs.kb *= Math.exp(-dt * KB_K); } else gs.kb = 0;
    const to = root.position.clone().sub(holder.position); to.y = 0; const dist = to.length(), ty = Math.atan2(to.x, to.z); let d = ty - gs.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    const turn = rate => { gs.yaw += d * (1 - Math.exp(-dt * rate)); }, p = holder.position;
    const engage = () => go(dist < gs.AGGRO && dist > gs.ATK ? 'walk' : 'idle', 0.25);
    if (gs.state === 'hit') {
      if (A.hit.time >= hitClip.duration - 0.08) { const t = { ...GOBLIN.afterHit }; if (dist > gs.ATK + 80) t.back = 0; if (gs.cd > 0.6 || dist > gs.ATK + 40) t.counter = 0; react(t); } }
    else if (gs.state === 'atk') { if (A.atk.time < 0.45) turn(5);
      if (!gs.struck && A.atk.time >= GSTRIKE) { gs.struck = true; if (dist < gs.ATK + 22 && Math.abs(d) < 0.9 && api.onStrike) api.onStrike(holder.position); }
      if (A.atk.time >= atkClip.duration - 1e-3) { gs.cd = rr(GOBLIN.cd) * (1.3 - 0.6 * gs.mood); react(GOBLIN.afterAtk); } }
    else if (gs.state === 'pause') { turn(5);   // 머뭇거림·노려보기: 끝나면 골라 둔 행동, 없으면 다시 덤빈다
      if (gs.t > gs.until) { const k = gs.next; gs.next = null; if (!(k && act(k)) && gs.state === 'pause') engage(); } }
    else if (gs.state === 'back') { turn(6); const bx = -Math.sin(gs.yaw), bz = -Math.cos(gs.yaw);   // 뒤로 물러나기: 주인공을 보며 뒷걸음
      p.x += bx * backSpeed * dt; p.z += bz * backSpeed * dt; if (gs.t > gs.until || !free(bx, bz)) { gs.next = 'afterBack'; hold(rr(GOBLIN.afterBack.delay)); } }
    else if (gs.state === 'sideL' || gs.state === 'sideR') { turn(5); const [lx, lz] = leftDir();   // 옆걸음: 주인공을 보며 옆으로
      p.x += lx * gs.side * sideSpeed * dt; p.z += lz * gs.side * sideSpeed * dt;
      if (gs.t > gs.until || !free(lx * gs.side, lz * gs.side) || dist < gs.ATK * 0.8) { if (gs.settle) { gs.settle = false; hold(rr(GOBLIN.afterBack.settle)); } else engage(); } }
    else { turn(gs.state === 'walk' ? 4 : 5);
      if (dist < gs.ATK) { if (gs.state !== 'idle') go('idle', 0.2);
        if (gs.cd <= 0 && Math.abs(d) < 0.6) { if (Math.random() < dt * GOBLIN.atkRate) go('atk', 0.12, GT0); }   // 쿨이 다 되면 박자를 조금씩 다르게 내려찍는다
        else if (gs.cd > 0.4 && gs.t > gs.nextCrowd && Math.random() < dt * GOBLIN.crowd.chance) { gs.nextCrowd = gs.t + rr(GOBLIN.crowd.gap); act(pick(GOBLIN.crowd.pick)); } }   // 쉬는 동안 바짝 붙어 있으면
      else if (dist < gs.AGGRO) {
        // 견제: 공격 거리 바로 바깥에서 가끔 간을 본다(옆걸음 · 노려보기 · 뒷걸음)
        if (dist < gs.ATK + GOBLIN.probe.band && gs.t > gs.nextProbe && Math.random() < dt * GOBLIN.probe.chance && act(pick(GOBLIN.probe.pick))) gs.nextProbe = gs.t + rr(GOBLIN.probe.gap);
        else { if (gs.state !== 'walk') go('walk', 0.25);
          // 다리 재생 빠르기 = 실제 이동 빠르기 (문워크 안 하게). 많이 돌아야 하면 천천히 걸으며 돈다
          const k = Math.abs(d) < 0.6 ? 1 : Math.abs(d) < 1.4 ? 0.55 : 0.35, sp = walkSpeed * k; A.walk.timeScale = k;
          p.x += Math.sin(gs.yaw) * sp * dt; p.z += Math.cos(gs.yaw) * sp * dt; } }
      else if (gs.state !== 'idle') go('idle', 0.3); }
    holder.rotation.y = gs.yaw; mixer.update(dt); }
  const api = { holder, step, hit, die, gs, height, GB, club, A, walkSpeed, backSpeed, sideSpeed, mat: gsm.material, onStrike: null, kind: 'goblin' };
  return api;
}
