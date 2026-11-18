// 불빛 모으기: 방 안 점광원(횃불·모닥불·광석·출구 빛·토템)은 자리·세기만 남기고 끈다(visible = false).
//   주인공 둘레에서 영향이 큰 ACTIVE 개만 고정 개수(K)의 진짜 빛으로 옮겨 비춘다
//   → 방에 횃불이 많아도 화면 계산은 늘 같고(빛 개수가 안 바뀌어 셰이더도 다시 안 만듦), 먼 횃불은 불꽃·빛 번짐 모양만 남는다
//   바뀔 때는 세기를 천천히 올리고 내려서 툭 켜지거나 꺼지지 않게(K - ACTIVE 칸은 사라지는 빛 몫)
import { T } from '../core/math.js';

export function createLightPool(root, K = 6, ACTIVE = 5, VIEW = 950) {   // VIEW: 화면에 보이는 범위(주인공에서 화면 끝까지 — 위쪽은 650 넘게 보인다). 화면 안 빛은 처음부터 켜져 있게(다가가야 켜지면 어색)
  const pool = []; for (let i = 0; i < K; i++) { const L = new T.PointLight(0xffffff, 0, 1, 2); L.userData.pool = true; root.add(L); pool.push(L); }
  const src = new Map(), wp = new T.Vector3(); let last = null;
  return function update(t, hp) {
    const dt = last === null ? 1 : Math.min(0.1, Math.max(0, t - last)); last = t;
    const seen = new Set(); root.traverse(o => { if (o.isPointLight && !o.userData.pool) { seen.add(o); o.visible = false; if (!src.has(o)) src.set(o, { w: 0, fresh: true }); } });   // 새로 생긴 빛(채집물 등)도 곧바로 끈다
    for (const o of [...src.keys()]) if (!seen.has(o)) src.delete(o);
    const list = []; for (const [o, s] of src) { o.getWorldPosition(wp); s.x = wp.x; s.y = wp.y; s.z = wp.z;
      const d = hp ? Math.hypot(wp.x - hp.x, wp.z - hp.z) : 0, f = Math.max(0, 1 - d / ((o.distance || 300) + VIEW)); s.score = o.intensity * f * f; list.push([o, s]); }   // 영향: 세기 × (빛 닿는 거리 + 화면 반경 안에서 가까울수록)
    list.sort((a, b) => b[1].score - a[1].score);
    list.forEach(([, s], i) => { const want = i < ACTIVE && s.score > 1e-4 ? 1 : 0; s.w = s.fresh ? want : s.w + (want - s.w) * Math.min(1, dt * 4); s.fresh = false; });
    const act = list.filter(([, s]) => s.w > 0.002).sort((a, b) => b[1].w - a[1].w);
    for (let i = 0; i < K; i++) { const L = pool[i], a = act[i]; if (!a) { L.intensity = 0; continue; }
      const [o, s] = a; L.position.set(s.x, s.y, s.z); L.color.copy(o.color); L.distance = o.distance; L.decay = o.decay; L.intensity = o.intensity * s.w; } };
}
