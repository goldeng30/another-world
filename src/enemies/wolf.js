// 굴 늑대(Tripo 뼈대 + 오른 뒷다리 발목·발 뼈 보강): 동작 파일이 없어 뼈를 직접 움직인다
//   대기(숨쉬기·고개·꼬리) · 맴돌기 · 덮치기(웅크렸다 뛰어들며 앞발) · 맞기(움찔, 3타엔 밀려남)
//   적 공통 연결부: holder(위치) · step(dt) · hit(from, kb, final) · gs(상태) · GB.Spine2 · mat · onStrike · body()
import { T, V } from '../core/math.js';
import { PATH, loadGLTF, loadTex } from '../core/assets.js';

export const WOLF_SKINS = { grey: 'wolf_base.webp', white: 'wolf_white_base.webp' };   // 늑대 털: 회색(기본) · 흰색 — 같은 모델에 질감만 바꾼다
export async function createWolf(G, o = {}) {
  const { scene, ENV_K } = G, DG = G.world, root = G.hero.root, P0 = G.hero.rig.P0, B = G.hero.rig.B;
    const [gg, wBase, wNrm] = await Promise.all([loadGLTF(PATH.enemies + 'wolf.glb'), loadTex(PATH.enemies + (WOLF_SKINS[o.skin] || WOLF_SKINS.grey)), loadTex(PATH.enemies + 'wolf_nrm.webp')]);
    wBase.flipY = false; wBase.encoding = T.sRGBEncoding; wBase.anisotropy = 8; wNrm.flipY = false;
    const g = gg.scene; let sm = null; g.traverse(o => { if (o.isSkinnedMesh && !sm) sm = o; });
    sm.material = new T.MeshStandardMaterial({ map: wBase, normalMap: wNrm, normalScale: new T.Vector2(1, -1), roughness: 0.9, metalness: 0, envMapIntensity: ENV_K || 0.5, skinning: true });
    sm.frustumCulled = false; sm.castShadow = true; sm.receiveShadow = true;
    const WB = {}; g.traverse(o => { if (o.isBone) WB[o.name.replace(/^tripo/, '')] = o; });
    const holder = new T.Group(), body = new T.Group(); holder.add(body); body.add(g); scene.add(holder);
    const wp = b => { holder.updateMatrixWorld(true); return holder.worldToLocal(b.getWorldPosition(V())); };
    // 머리가 +z(앞)를 보게 돌리고, 어깨 높이 = 도윤 키의 0.42, 몸 가운데를 제자리에
    { const h = wp(WB.Head_0), t = wp(WB.bone_23); g.rotation.y = -Math.atan2(h.x - t.x, h.z - t.z); }   // 몸통(꼬리 뿌리 → 가슴)이 +z를 보게
    const doyunH = P0.get(B.Head).y + 13; g.scale.multiplyScalar(doyunH * 0.42 / wp(WB.Head_0).y);
    { const a = wp(WB.bone_23), c = wp(WB.Head_0); g.position.x -= (a.x + c.x) / 2; g.position.z -= (a.z + c.z) / 2; }
    // 원본 그림이 고개를 돌린 자세라 머리가 옆을 본다 → 목(Head_1·Head_2)을 돌려 머리를 몸통 방향으로 곧게(이걸 기본 자세로)
    { const turnNow = (b, ang) => { holder.updateMatrixWorld(true); const hq0 = holder.getWorldQuaternion(new T.Quaternion()).invert(), pw = hq0.multiply(b.parent.getWorldQuaternion(new T.Quaternion())), q = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), ang); b.quaternion.premultiply(pw.clone().invert().multiply(q).multiply(pw)); };
      for (let it = 0; it < 3; it++) { const a = wp(WB.Head_3), b = wp(WB.Head_4), yawH = Math.atan2(b.x - a.x, b.z - a.z); turnNow(WB.Head_1, -yawH * 0.55); turnNow(WB.Head_2, -yawH * 0.45); } }
    const height = wp(WB.Head_3).y + 10, S = g.scale.x;
    // 뼈 회전 도우미: 늑대 기준 축(x 옆 · y 위 · z 앞)으로 돌린다. 부모의 기본 자세 기준(FK로 쌓임)
    const bones = Object.values(WB), REST = new Map(), PW = new Map();
    holder.updateMatrixWorld(true); const hq = holder.getWorldQuaternion(new T.Quaternion()).invert();
    for (const b of bones) { REST.set(b, b.quaternion.clone()); const pw = hq.clone().multiply(b.parent.getWorldQuaternion(new T.Quaternion())); PW.set(b, [pw, pw.clone().invert()]); }
    const AX = { x: V(1, 0, 0), y: V(0, 1, 0), z: V(0, 0, 1) }, qa = new T.Quaternion(), qd = new T.Quaternion();
    const rot = (b, ax, ang) => { if (!b || !ang) return; const [pw, pwi] = PW.get(b); qd.copy(pwi).multiply(qa.setFromAxisAngle(AX[ax], ang)).multiply(pw); b.quaternion.premultiply(qd); };
    // 다리 IK: 발이 갈 자리를 먼저 정하고, 어깨(엉덩이)·팔꿈치(무릎)를 그 자리에 맞춰 굽힌다(두 마디). 발목·손목은 발 접기
    //   앞다리: 어깨 → 팔꿈치(뒤로 굽음) → 손목 → 발 / 뒷다리: 엉덩이 → 무릎(앞으로 굽음) → 발목 → 발
    const leg = (front, n0, n1, n2, n3) => ({ front, b0: WB[n0], b1: WB[n1], b2: WB[n2], b3: WB[n3] });
    const LEGS = { FL: leg(true, '0_Left_Limb_0', '0_Left_Limb_2', '0_Left_Limb_3', '0_Left_Limb_4'), FR: leg(true, 'bone_13', '0_Right_Limb_1', '0_Right_Limb_2', '0_Right_Limb_3'),
      HL: leg(false, '1_Left_Limb_0', '1_Left_Limb_1', '1_Left_Limb_2', '1_Left_Limb_3'), HR: leg(false, '1_Right_Limb_0', '1_Right_Limb_1', '1_Right_Limb_2', '1_Right_Limb_3') };
    for (const k in LEGS) { const L = LEGS[k], p0 = wp(L.b0), p1 = wp(L.b1), p2 = wp(L.b2), p3 = wp(L.b3); L.l1 = p1.distanceTo(p0); L.l2 = p2.distanceTo(p1); L.paw = p3; L.dp = p3.clone().sub(p2); L.x = p0.x; }
    // 네 박자 걸음(천천히 다가올 때): 한쪽 뒷발 → 같은 쪽 앞발 → 반대쪽 뒷발 → 반대쪽 앞발. 한 발씩 들고 나머지 셋은 땅에(딛는 시간 65%)
    const sideOf = k => LEGS[k].x > 0, GAIT = {}; for (const k in LEGS) GAIT[k] = (k[0] === 'H' ? 0 : 0.25) + (sideOf(k) === sideOf('HL') ? 0 : 0.5); const DUTY = 0.65;
    // 옆걸음: 따라오는 쪽 앞발이 붙고 → 가는 쪽 앞발이 벌리고 → 따라오는 쪽 뒷발이 붙고 → 가는 쪽 뒷발이 벌린다(앞 두 발이 동시에 뜨지 않게 딛는 시간을 늘림)
    const DUTY_S = 0.78, SIDE_W = 13, sideGait = (k, lead) => { const ld = (LEGS[k].x > 0 ? 1 : -1) === lead; return k[0] === 'F' ? (ld ? 0.5 : 0.75) : (ld ? 0 : 0.25); };
    const GO = {}; for (const k in LEGS) GO[k] = GAIT[k]; let sideM = false, sideW = 0;   // GO: 지금 쓰는 다리 순서(앞걸음 ↔ 옆걸음 사이를 천천히 옮겨 감)
    const LEG_LEN = wp(WB.Head_0).y, LIFT = LEG_LEN * 0.15, F_WALK = 0.95;   // 다리 길이 · 발 드는 높이 · 걸음 빠르기(초당)
    const WALK_SP = 78;   // 경계하며 천천히 다가온다
    const hqi = new T.Quaternion(), tq = new T.Quaternion(), tq2 = new T.Quaternion(), uu = V(), nn = V();
    const P = b => holder.worldToLocal(b.getWorldPosition(V()));
    function aim(b, from, to, want) {   // b를 돌려 (from→to)가 want 방향을 보게(홀더 기준)
      uu.copy(to).sub(from).normalize(); nn.copy(want).normalize(); if (uu.dot(nn) > 0.999999) return;
      tq.setFromUnitVectors(uu, nn); const pw = hqi.clone().multiply(b.parent.getWorldQuaternion(tq2)); b.quaternion.premultiply(pw.clone().invert().multiply(tq).multiply(pw)); b.updateMatrixWorld(true); }
    function solveLeg(L, paw, flex) {   // paw: 발이 갈 자리(홀더 기준) · flex: 발 접기(x축, +는 뒤로)
      const dp = L.dp.clone().applyAxisAngle(AX.x, flex), T2 = paw.clone().sub(dp);   // 손목·발목이 갈 자리
      const A = P(L.b0), d = T2.clone().sub(A), dl = Math.max(1e-3, Math.min(d.length(), (L.l1 + L.l2) * 0.999)), dn = d.clone().normalize();
      const pole = V(0, 0, L.front ? -1 : 1), perp = pole.clone().addScaledVector(dn, -dn.dot(pole)); if (perp.lengthSq() < 1e-8) perp.set(0, 0, L.front ? -1 : 1); perp.normalize();
      const ca = Math.max(-1, Math.min(1, (L.l1 * L.l1 + dl * dl - L.l2 * L.l2) / (2 * L.l1 * dl))), sa = Math.sqrt(1 - ca * ca), J1 = A.clone().addScaledVector(dn, L.l1 * ca).addScaledVector(perp, L.l1 * sa);
      aim(L.b0, A, P(L.b1), J1.clone().sub(A)); const p1 = P(L.b1); aim(L.b1, p1, P(L.b2), T2.clone().sub(p1)); const p2 = P(L.b2); aim(L.b2, p2, P(L.b3), dp); }
    const KB_K = 9, gs = { state: 'idle', yaw: 0, cd: 1.6 + Math.random(), t: 0, stun: 0, R: 70, kb: 0, kdir: V(), ATK: 120, AGGRO: 560, START: 165 };
    const W = { walk: 0, stalk: 0 }; let phase = 0, at = 0, ht = 9, stride = 0;
    // 물기: 0~TW 웅크림(길게, 보고 피할 수 있게) → TW~TL 뛰어들며 머리 내지름(TL에 문다) → TR까지 돌아옴
    const JUMP_H = (P0.get(B.Head).y + 13) * 0.27;   // 뛰어오르는 높이: 머리가 주인공 가슴께에 닿게
    const R_CIRC = 160, CIRC_SP = 18; let cdir = Math.random() < 0.5 ? 1 : -1, circT = 0, headYaw = 0, mdx = 0, mdz = 1;   // mdx·mdz: 몸 기준 걸어가는 방향(옆걸음이면 옆)   // 맴돌 때 거리 · 빠르기 · 방향
    const FALL_FWD = 34;   // 떨어지는 동안 앞으로 더 나아가는 거리
    const TW = 1.4, TL = 1.7, TR = 2.6, ATK_HIT = TL - 0.05, ATK_D = TR, LUNGE = 85, HIT_D = 0.42;
    // 덮치기 착지: 앞발이 먼저(LAND_F), 뒷발이 나중(LAND_H) 땅에 닿는다 · 앞발은 FZL만큼 앞에 딛고 그 자리에 붙어 있다
    const HH_K = 0.45, LAND_F = 0.24, LAND_H = 0.44, FZL = 14, ZS = (wp(LEGS.FL.b0).z + wp(LEGS.FR.b0).z) / 2, ZH = (wp(LEGS.HL.b0).z + wp(LEGS.HR.b0).z) / 2, KB_HERO = 380;
    const fallAt = t => FALL_FWD * sm2((t - TL) / 0.4);   // TL 뒤 t까지 앞으로 나아간 거리
    let SF = 0, SE = 0;   // 앞다리 쭉 펴기: 정도 · 들어 올리는 각(수평에서 위로)
    const sm2 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    holder.position.set(0, 0, -240);
    function pose(t) {
      for (const b of bones) b.quaternion.copy(REST.get(b)); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
      const br = Math.sin(t * 2.4), sw = Math.sin(t * 0.9), w = W.walk, ph = phase % 1; SF = 0;
      // 몸: 숨쉬기 + 걸음 들썩임(한 걸음에 두 번 살짝) · 좌우로 조금 흔들림
      body.position.y += br * 0.5 + Math.cos(4 * Math.PI * ph) * 1.0 * w; body.rotation.x += Math.sin(4 * Math.PI * ph) * 0.01 * w; body.rotation.z += Math.sin(2 * Math.PI * ph) * 0.025 * w;
      // 경계 자세(주인공이 가까이 있을 때): 머리를 어깨보다 낮게 숙이되 눈은 앞, 꼬리는 아래로, 몸을 조금 낮춘다
      const sk = W.stalk; body.position.y -= 1.5 * sk; body.rotation.x -= 0.02 * sk;   // 몸은 거의 안 낮춘다(앞다리가 접히지 않게)
      rot(WB.Head_1, 'x', 0.28 * sk); rot(WB.Head_2, 'x', 0.06 * sk); rot(WB.Head_3, 'x', -0.14 * sk); rot(WB.bone_23, 'x', -0.6 * sk); rot(WB.Tail_0, 'x', -0.12 * sk);
      // 고개 · 꼬리 · 귀 (고개는 주인공 쪽으로 돌림)
      rot(WB.Head_1, 'y', headYaw * 0.55); rot(WB.Head_2, 'y', headYaw * 0.45);
      rot(WB.Head_1, 'x', 0.03 * br - Math.cos(4 * Math.PI * ph) * 0.04 * w); rot(WB.Head_1, 'y', 0.12 * sw * (1 - w) * (1 - 0.7 * sk));
      rot(WB.bone_23, 'y', 0.18 * Math.sin(t * 1.3) * (1 - w) + 0.15 * Math.sin(2 * Math.PI * ph) * w); rot(WB.bone_23, 'x', -0.08);
      rot(WB.bone_7, 'z', 0.08 * Math.max(0, Math.sin(t * 3.1) - 0.85) * 6); rot(WB.bone_8, 'z', -0.08 * Math.max(0, Math.sin(t * 2.7 + 1) - 0.85) * 6);
      // 발 자리: 서 있던 자리 + 걸음(딛는 동안 몸 기준으로 뒤로 밀림 = 실제로는 땅 제자리, 나머지 동안 들어 올려 앞으로)
      const feet = {}; for (const k in LEGS) feet[k] = { p: LEGS[k].paw.clone(), g: V(), a: V(), f: 0 };   // g: 걸음 · a: 물기 때 더하는 발 자리
      const du = DUTY + (DUTY_S - DUTY) * sideW;
      if (w > 0.01) for (const k in LEGS) { const L = LEGS[k], p = (ph + GO[k]) % 1, st = p < du, u = st ? p / du : (p - du) / (1 - du);
        const zr = st ? 1 - 2 * u : -1 + 2 * sm2(u);   // 발 앞뒤(1 앞, -1 뒤)
        feet[k].g.x += zr * stride / 2 * w * mdx; feet[k].g.z += zr * stride / 2 * w * mdz; feet[k].g.y += (st ? 0 : LIFT * Math.min(1, 0.5 + stride / 80) * Math.sin(Math.PI * u)) * w;
        // 발목(손목) 아래: 딛는 동안 발이 앞이면 앞으로, 뒤로 밀려 가면 뒤로 기운다(발목이 펴지며 밀어냄). 들 때 앞발은 손목을 뒤로 접고, 뒷발은 발끝을 당긴다
        feet[k].f += ((st ? -0.4 * zr : 0) + (st ? 0 : Math.sin(Math.PI * u) * (L.front ? 0.8 : -0.5))) * w; }
      // 덮치기: 웅크림 → 앞다리를 쭉 펴며 사람 가슴 쪽으로 날아들어 밀쳐 냄(공중에서 멈추지 않음) → 그대로 내려앉음
      // 덮치기: 웅크림 → 몸을 앞으로 쭉 펴며 사람 가슴 높이로 뛰어들어 밀쳐 냄 → 앞발 먼저, 뒷발 나중에 내려앉음
      if (gs.state === 'atk') { const a = at, c = a < TW ? sm2(a / TW) : a < TL ? 1 - sm2((a - TW) / (TL - TW)) : 0;   // 웅크림
        const up = a < TW ? 0 : a < TL ? sm2((a - TW) / (TL - TW)) : 1;
        const hf = a < TL ? up : 1 - sm2((a - TL) / LAND_F), hh = a < TL ? up * HH_K : HH_K * (1 - sm2((a - TL) / LAND_H));   // 어깨·엉덩이 높이(뛰는 높이 비율)
        const ys = JUMP_H * hf, yh = JUMP_H * hh, th = (yh - ys) / (ZS - ZH);   // 몸 기울기(+면 앞이 내려감): 뛸 땐 앞이 들리고, 내려올 땐 앞이 먼저 내려간다
        const lf = a > TL + LAND_F - 0.04 && a < TL + LAND_F + 0.28 ? Math.sin(Math.PI * (a - TL - LAND_F + 0.04) / 0.32) : 0, lh = a > TL + LAND_H - 0.04 && a < TL + LAND_H + 0.36 ? Math.sin(Math.PI * (a - TL - LAND_H + 0.04) / 0.4) : 0;   // 디딜 때 무게 받아 꺼짐
        body.position.y += -7 * c + ys + ZS * th - 4 * lf - 5 * lh; body.rotation.x += 0.12 * c + th + 0.04 * lf;
        rot(WB.Head_1, 'x', 0.12 * c - 0.75 * th); rot(WB.Head_2, 'x', 0.05 * c); rot(WB.bone_23, 'x', -0.3 * up * (a < TL ? 1 : hh / HH_K));   // 머리는 몸 기울기만큼 되돌려 앞(가슴)을 본다
        const ef = a < TL ? up : 1 - sm2((a - TL) / LAND_F), eh = a < TL ? up : 1 - sm2((a - TL) / LAND_H);   // 앞·뒷다리 펴기
        const rec = a > TL + 0.4 ? 1 - sm2((a - TL - 0.4) / (TR - TL - 0.4)) : 1;   // 다 내려앉은 뒤 제자리로
        const fz = a < TL ? 0 : a < TL + LAND_F ? FZL * sm2((a - TL) / LAND_F) : FZL - (fallAt(Math.min(a, TL + 0.4)) - fallAt(TL + LAND_F));   // 앞발: 앞에 딛고 몸이 나아가는 만큼 뒤로(땅에 붙음)
        for (const k of ['FL', 'FR']) feet[k].a.z += fz * rec;   // 앞발: 내려앉은 자리에 붙어 있다
        SF = a < TW ? 0 : a < TL ? sm2((a - TW) / ((TL - TW) * 0.6)) : 1 - sm2((a - TL) / LAND_F); SE = 0.12;   // 앞다리: 발끝까지 일자로 쭉 펴서 거의 수평으로(가슴 쪽)
        for (const k of ['HL', 'HR']) { feet[k].a.z -= 26 * eh; feet[k].a.y += yh * 0.45; } }   // 뒷다리: 땅을 박차 뒤로 뻗었다가 나중에 몸 밑으로 내려 딛는다
      if (ht < HIT_D) { const k = Math.sin(Math.PI * Math.min(1, ht / HIT_D)) * (ht < 0.08 ? ht / 0.08 : 1) * (gs.state === 'atk' && gs.armor ? 0.35 : 1);   // 맞기: 고개가 젖혀지고 몸이 뒤로 움찔(발은 그대로)
        body.rotation.x -= 0.12 * k; body.rotation.z += 0.08 * k; rot(WB.Head_1, 'x', -0.4 * k); rot(WB.Head_1, 'y', 0.25 * k); rot(WB.bone_23, 'x', 0.3 * k); }
      holder.updateMatrixWorld(true); hqi.copy(holder.getWorldQuaternion(tq2)).invert();
      // 서서 돌 때(걷지 않을 때): 발은 땅(세계)에 붙어 있고, 벌어진 발만 들어 새 자리로 옮겨 딛는다. 걸을 때는 걸음이 정한 자리를 따라간다
      for (const k in LEGS) { const L = LEGS[k], F = feet[k], A = ANC[k];
        if (anch && A.ok) { const lp = holder.worldToLocal(V(A.x, 0, A.z)), up = A.st ? Math.sin(Math.PI * Math.min(1, A.t)) : 0;
          F.p.set(lp.x, L.paw.y + LIFT * 0.7 * up, lp.z).add(F.a); F.f += up * (L.front ? 0.9 : -0.4); }
        else { const wpt = holder.localToWorld(F.p.clone().add(F.g)); A.x = wpt.x; A.z = wpt.z; A.ok = true; A.st = null; F.p.add(F.g).add(F.a); }
        if (SF > 0 && L.front) { const Sh = P(L.b0), len = L.l1 + L.l2 + L.dp.length(), hy = Math.min(P(WB.Head_3).y, P(WB.Head_4).y);
          const se = Math.min(SE, Math.asin(Math.max(-0.6, Math.min(1, (hy - 14 - Sh.y) / len)))), dir = V(0, Math.sin(se), Math.cos(se)), T = Sh.addScaledVector(dir, len * 1.6);   // 발끝이 머리보다 위로 안 가게 · 닿지 않을 만큼 멀리 = 다리가 곧게 펴진다
          F.p.lerp(T, SF); F.f += (Math.atan2(L.dp.y, L.dp.z) - se - F.f) * SF; }   // 발목도 다리와 일자로
        solveLeg(L, F.p, F.f); } }
    // 발 디딤(서서 돌 때): 제자리(몸 기준)에서 STEP_TH 넘게 벌어진 발부터, 한 번에 두 발까지 STEP_D초 동안 들어 옮긴다
    const ANC = {}; for (const k in LEGS) ANC[k] = { x: 0, z: 0, ok: false, st: null, t: 0 }; let anch = false;
    const STEP_TH = 9, STEP_D = 0.24; let calm = 0, lastYaw = 0;   // 다 돌고 가만히 있으면(calm) 조금 벌어진 발도 하나씩 바로 딛는다
    function updateSteps(dt) { holder.updateMatrixWorld(true); let busy = 0; const errs = []; calm = Math.abs(gs.yaw - lastYaw) / Math.max(dt, 1e-4) < 0.25 ? calm + dt : 0; lastYaw = gs.yaw; const th = calm > 0.35 ? 3 : STEP_TH, maxB = calm > 0.35 ? 1 : 2;
      for (const k in LEGS) { const A = ANC[k]; if (!A.ok) continue; const r = holder.localToWorld(LEGS[k].paw.clone());
        if (A.st) { A.t += dt / STEP_D; A.st.tx = r.x; A.st.tz = r.z; const u = sm2(Math.min(1, A.t)); A.x = A.st.fx + (A.st.tx - A.st.fx) * u; A.z = A.st.fz + (A.st.tz - A.st.fz) * u; if (A.t >= 1) A.st = null; else busy++; continue; }
        const e = Math.hypot(r.x - A.x, r.z - A.z); if (e > th) errs.push([e, k]); }
      errs.sort((a, b) => b[0] - a[0]); for (const [, k] of errs) { if (busy >= maxB) break; const A = ANC[k]; A.st = { fx: A.x, fz: A.z, tx: A.x, tz: A.z }; A.t = 0; busy++; } }
    function hit(from, kb = 0, fin = false) { const armor = gs.state === 'atk' && gs.armor && !fin;   // 반격 덮치기는 1·2타엔 안 끊기고 안 밀린다(3타 fin은 다 받는다)
      if (kb > 0 && !armor) { gs.kdir.set(holder.position.x - from.x, 0, holder.position.z - from.z).normalize(); gs.kb = kb * KB_K; }
      if (ht < 0.12) return false; ht = 0;
      if (fin) { gs.cd = 3.0 + Math.random() * 1.0; press = 0; gs.stun = 0.8; if (gs.state === 'atk' && at < ATK_HIT) gs.state = 'idle'; }   // 3타: 밀려나고, 하던 덮치기는 끊기고, 공격 카운트를 처음부터 다시
      else if (!armor) { gs.stun = 0.6; gs.cd = Math.max(gs.cd, 1.2); press = 0; if (gs.state === 'atk' && at < ATK_HIT) gs.state = 'idle'; } return true; }   // 1·2타: 잠깐 굳고(경직), 바로 덮치지 못한다   // 보통 덮치기는 물기 전에 맞으면 끊기고, 곧 반격한다
    // 길 찾기: 가려는 쪽(35·70 앞)이 벽·바위·물건에 더 가까워지면 막힌 것. 한쪽(정한 쪽 먼저)으로 조금씩 틀어 본다(틀었으면 0.6초는 유지). 벽을 따라가거나 멀어지는 건 괜찮다. 다 막히면 null
    let side = 1, keepA = 0, keepT = 0, flipLock = 0, pauseT = 0, press = 0, rpx = null, rpz = 0; const VEL = { x: 0, z: 0 };
    const clr = (x, z) => { let c = -DG.sdf(x, z) - 50; for (const o of DG.colliders) c = Math.min(c, Math.hypot(x - o.x, z - o.z) - o.r - 30); return c; };   // 늑대가 더 갈 수 있는 여유
    const free = (mx, mz) => { if (!DG) return true; const p = holder.position, c0 = clr(p.x, p.z); for (const L of [35, 70]) { const c = clr(p.x + mx * L, p.z + mz * L); if (c < 20 && c < c0 - 2) return false; } return true; };
    const rotv = (mx, mz, a) => { const c = Math.cos(a), s = Math.sin(a); return [mx * c + mz * s, mz * c - mx * s]; };
    function steer(mx, mz) { if (gs.t < keepT) { const r = rotv(mx, mz, keepA); if (free(r[0], r[1])) return r; }
      if (free(mx, mz)) { keepA = 0; return [mx, mz]; }
      for (const a of [0.5, 1.0, 1.5, 2.0]) for (const s of [side, -side]) { const r = rotv(mx, mz, a * s); if (free(r[0], r[1])) { side = s; keepA = a * s; keepT = gs.t + 0.6; return r; } }
      return null; }
    function step(dt) { gs.t += dt; gs.cd -= dt; ht += dt; if (gs.stun > 0) gs.stun -= dt; const hp = holder.position;
      if (gs.kb > 0.5) { hp.addScaledVector(gs.kdir, gs.kb * dt); gs.kb *= Math.exp(-dt * KB_K); } else gs.kb = 0;
      const px = hp.x, pz = hp.z;
      const to = root.position.clone().sub(hp); to.y = 0; const dist = to.length(), ty = Math.atan2(to.x, to.z); let d = ty - gs.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = rate => { gs.yaw += d * (1 - Math.exp(-dt * rate)); }; let moving = 0;
      const walkTo = (hx, hz, rate, sp) => { const m = steer(hx, hz); if (!m) { turn(rate); return 0; }   // 막히면 돌아서 간다
        let dm = Math.atan2(m[0], m[1]) - gs.yaw; dm = Math.atan2(Math.sin(dm), Math.cos(dm)); gs.yaw += dm * (1 - Math.exp(-dt * rate));
        const v = sp * (Math.abs(dm) < 0.6 ? 1 : Math.abs(dm) < 1.4 ? 0.55 : 0.3); hp.x += Math.sin(gs.yaw) * v * dt; hp.z += Math.cos(gs.yaw) * v * dt; return v; };
      // 주인공이 가까이서 쫓아오면(1초) 물러나기만 하지 않고 덮친다
      const appr = rpx === null || dt < 1e-4 ? 0 : -((root.position.x - rpx) * to.x + (root.position.z - rpz) * to.z) / (dist * dt); rpx = root.position.x; rpz = root.position.z;
      press = dist < 150 && appr > 25 && gs.state !== 'atk' ? press + dt : Math.max(0, press - dt * 1.5); if (press > 1.0 && gs.cd > 0.2 && gs.state !== 'atk') gs.cd = 0.2;
      if ((ht < HIT_D * 0.8 || gs.stun > 0) && !(gs.state === 'atk' && gs.armor)) { /* 움찔·경직 동안은 멈춤(반격 덮치기 중엔 안 멈춤) */ }
      else if (gs.state === 'atk') { at += dt * (gs.armor && at < TW ? TW / 0.55 : 1); if (at < TW - 0.1) turn(5);   // 반격은 웅크림이 짧다(0.55초)
        if (at > TW && at - dt < TL) { const s0 = sm2((at - dt - TW) / (TL - TW)), s1 = sm2((at - TW) / (TL - TW)), mv = Math.min(LUNGE * (s1 - s0), Math.max(0, dist - gs.R + 10)); hp.x += Math.sin(gs.yaw) * mv; hp.z += Math.cos(gs.yaw) * mv; }
        if (at > TL && at - dt < TL + 0.4) { const s0 = sm2((Math.max(TL, at - dt) - TL) / 0.4), s1 = sm2((Math.min(at, TL + 0.4) - TL) / 0.4), mv = FALL_FWD * (s1 - s0); hp.x += Math.sin(gs.yaw) * mv; hp.z += Math.cos(gs.yaw) * mv; }   // 부딪힌 뒤에도 앞으로 떨어지며 내려앉는다(뒤로 물러나지 않음)
        if (!gs.struck && at >= ATK_HIT) { gs.struck = true; if (dist < gs.ATK && Math.abs(d) < 0.8 && api.onStrike) api.onStrike(hp, KB_HERO); }   // 가슴을 밀쳐 뒤로 날린다
        if (at >= ATK_D) { gs.cd = 3.0 + Math.random() * 1.0; gs.state = 'idle'; press = 0; } }
      else if (dist >= gs.START + 60) {   // 멀면: 경계하며 다가온다(아주 멀면 그냥 서 있음)
        if (dist < gs.AGGRO) { gs.state = 'walk'; moving = walkTo(to.x / dist, to.z / dist, gs.state === 'walk' ? 5 : 3.5, WALK_SP); } else { gs.state = 'idle'; turn(3.5); } }
      else if (gs.cd <= 0) {   // 덮칠 때: 주인공 쪽으로 돌아서서(멀면 조금 다가가) 덮친다. 얼마 전에 맞았거나 쫓기던 중이면 반격(짧은 웅크림·안 끊김)
        if (dist > gs.START) { gs.state = 'walk'; moving = walkTo(to.x / dist, to.z / dist, 4, WALK_SP); }
        else { gs.state = 'idle'; turn(4); if (Math.abs(d) < 0.3) { gs.state = 'atk'; at = 0; gs.struck = false; gs.armor = ht < 2.5 || press > 0.6; } } }
      else {   // 기다리는 동안: 먹이를 노리듯 주인공 둘레를 맴돈다(고개는 주인공). 가끔 방향을 바꾸고, 막히면 반대로 돈다(한번 바꾸면 1.5초는 그대로)
        gs.state = 'circle'; const rx = to.x / dist, rz = to.z / dist, k = Math.max(-0.6, Math.min(1, (dist - R_CIRC) / 50));
        const dirOf = c => { const x = -rz * c + rx * k, z = rx * c + rz * k, l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
        if (gs.t > circT) { const [ax, az] = dirOf(-cdir); if (free(ax, az)) { cdir = -cdir; flipLock = gs.t + 1.5; pauseT = gs.t + 0.5 + Math.random() * 0.6; } circT = gs.t + 3.5 + Math.random() * 2.5; }   // 방향을 바꿀 땐 잠깐 멈춰 노려본다
        let [mx, mz] = dirOf(cdir); if (!free(mx, mz) && gs.t > flipLock) { const [ax, az] = dirOf(-cdir); if (free(ax, az)) { cdir = -cdir; mx = ax; mz = az; flipLock = gs.t + 1.5; circT = gs.t + 2 + Math.random() * 2; } }
        const m = gs.t < pauseT ? null : steer(mx, mz);
        if (m) { const tm = Math.atan2(m[0], m[1]); let toH = ty - tm; toH = Math.atan2(Math.sin(toH), Math.cos(toH));
          let dd = tm + toH * 0.6 - gs.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); gs.yaw += dd * (1 - Math.exp(-dt * 3));   // 몸은 도는 방향과 주인공 사이(60% 주인공 쪽)를 본다
          moving = CIRC_SP; hp.x += m[0] * moving * dt; hp.z += m[1] * moving * dt; }
        else turn(3); }
      if (DG) { DG.clamp(hp, 50); for (const c of DG.colliders) { const dx = hp.x - c.x, dz = hp.z - c.z, dd = Math.hypot(dx, dz), mr = c.r + 30; if (dd < mr && dd > 1e-3) { hp.x += dx / dd * (mr - dd); hp.z += dz / dd * (mr - dd); } } }
      // 걸음은 실제로 움직인 만큼·움직인 방향으로(막혀서 못 가면 제자리걸음·발 떨림 없이 선다)
      if (dt > 1e-4) { const kv = 1 - Math.exp(-dt * 10); VEL.x += ((hp.x - px) / dt - VEL.x) * kv; VEL.z += ((hp.z - pz) / dt - VEL.z) * kv; }
      if (moving > 0) { const sp = Math.hypot(VEL.x, VEL.z); moving = Math.min(moving, sp); if (sp > 1) { const rel = Math.atan2(VEL.x, VEL.z) - gs.yaw; mdx = Math.sin(rel); mdz = Math.cos(rel); } }
      { let dh = ty - gs.yaw; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); headYaw += (Math.max(-0.9, Math.min(0.9, dh)) * W.stalk - headYaw) * (1 - Math.exp(-dt * 6)); }   // 고개는 늘 주인공을 본다
      W.walk += ((moving > 8 ? 1 : 0) - W.walk) * (1 - Math.exp(-dt * 8)); W.stalk += ((dist < gs.AGGRO ? 1 : 0) - W.stalk) * (1 - Math.exp(-dt * 3));
      if (moving > 8) { if (!sideM && Math.abs(mdx) > 0.55) sideM = true; else if (sideM && Math.abs(mdx) < 0.4) sideM = false; }   // 옆걸음으로 바꾸기(왔다 갔다 안 하게 여유를 둠)
      sideW += ((sideM ? 1 : 0) - sideW) * (1 - Math.exp(-dt * 3)); const lead = mdx >= 0 ? 1 : -1;
      for (const k in LEGS) { const tg = sideM ? sideGait(k, lead) : GAIT[k]; let dg = tg - GO[k]; dg -= Math.round(dg); GO[k] = ((GO[k] + dg * (W.walk < 0.15 ? 1 : 1 - Math.exp(-dt * 3))) % 1 + 1) % 1; }   // 서 있을 땐 바로 바꾼다
      const du = DUTY + (DUTY_S - DUTY) * sideW;
      if (moving > 8) { let F = F_WALK * (0.5 + 0.5 * Math.min(1, moving / WALK_SP)); if (sideW > 0.5) F = Math.max(F, moving * du * Math.abs(mdx) / SIDE_W); stride = moving * du / F; phase += F * dt; } else if (W.walk > 0.02) phase += F_WALK * dt;   // 천천히 갈 땐 발도 천천히(한 발 한 발) · 옆으로 갈수록 보폭은 짧게 · 딛는 동안 발이 땅에서 안 미끄러지는 보폭
      holder.rotation.y = gs.yaw; anch = W.walk <= 0.3 && !(gs.state === 'atk' && at > TW) && gs.kb <= 0.5; if (anch) updateSteps(dt); pose(gs.t); }
    const GB = { Spine2: WB.Head_0, Head: WB.Head_3 };
    const bodyCaps = () => { const w = b => b.getWorldPosition(V()); return [{ a: w(WB.bone_23), b: w(WB.Head_0), r: 0.13 * S }, { a: w(WB.Head_0), b: w(WB.Head_3), r: 0.09 * S }, { a: w(WB.Head_3), b: w(WB.Head_4), r: 0.07 * S }]; };
    pose(0);
    const api = { holder, step, hit, gs, height, GB, WB, mat: sm.material, onStrike: null, body: bodyCaps, kind: 'wolf' };
    api.anc = () => { holder.updateMatrixWorld(true); const o = {}; for (const k in LEGS) { const A = ANC[k], r = holder.localToWorld(LEGS[k].paw.clone()), f = LEGS[k].b3.getWorldPosition(V()); o[k] = { err: Math.hypot(r.x - A.x, r.z - A.z).toFixed(1), st: !!A.st, footY: f.y.toFixed(1), footErr: Math.hypot(f.x - A.x, f.z - A.z).toFixed(1) }; } return o; };   // 점검용
    api.mv = () => ({ cdir, mdx, mdz, walk: W.walk, x: holder.position.x, z: holder.position.z });   // 점검용
    api.debugPose = (st, t, ph, w, h = 9, sd = 60, sk = 0) => { anch = false; gs.state = st; at = t; phase = ph; W.walk = w; ht = h; stride = sd; W.stalk = sk; pose(gs.t); };   // 점검용
    return api; }
