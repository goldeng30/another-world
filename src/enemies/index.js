// 적 종류 목록: 방 데이터의 enemies: [{ type: 'wolf', at: [u, v], skin: 'white' }] 로 생성
// 새 적은 파일 하나(createXxx(G, spec) → 공통 연결부 api)를 만들고 여기에 이름을 더한다
// 보스: { type, at, boss: true, name, hp, atk } — 머리 위 막대 대신 화면 위 가운데 큰 막대(이름)로 나온다
import { T } from '../core/math.js';
import { createWolf } from './wolf.js';
import { createGoblin } from './goblin.js';

export const ENEMY_TYPES = { goblin: createGoblin, wolf: createWolf };
// 종류별 기본 체력·공격력(방 데이터에서 hp·atk 로 바꿀 수 있다)
export const ENEMY_STATS = { goblin: { name: '고블린', hp: 60, atk: 12 }, wolf: { name: '늑대', hp: 80, atk: 10 } };
// 쓰러짐: 죽는 동작이 있는 적(e.die)은 넘어진 뒤 시체로 남는다(방을 나가면 치움). 동작이 없는 적은 하얗게 빛나며 흐려져 없어진다
export const DIE = { fade: 0.9, sink: 12 };

const groundAt = (G, x, z) => G.world && G.world.groundY ? G.world.groundY(x, z) : 0;   // 바닥 높낮이
export async function spawnEnemy(G, spec) {
  const make = ENEMY_TYPES[spec.type]; if (!make) throw new Error('없는 적 종류: ' + spec.type);
  const e = await make(G, spec), S = ENEMY_STATS[spec.type] || {};
  if (spec.at && G.world) { const [x, z] = G.world.world(spec.at[0], spec.at[1]); e.holder.position.set(x, groundAt(G, x, z), z); }
  Object.assign(e, { spec, name: spec.name || S.name || spec.type, boss: !!spec.boss, hpMax: spec.hp || S.hp || 50, atk: spec.atk ?? S.atk ?? 10, dead: false, deadT: 0 }); e.hp = e.hpMax;
  e.onStrike = (from, kb) => { if (G.hero.hit(from, kb)) G.hero.hurt(e.atk); };   // 적의 공격이 닿으면 주인공이 맞는다(방금 맞아 젖혀지는 중이면 안 깎임)
  e.hurt = (dmg, fin = false) => { if (e.dead) return; e.hp = Math.max(0, e.hp - dmg); if (G.onDamage) G.onDamage(() => e.holder.position.clone().setY(e.holder.position.y + e.height), dmg, fin ? 'fin' : ''); if (e.hp <= 0) die(e, fin); };   // 데미지 숫자는 머리 위   // fin: 마지막(3타) 공격으로 죽었나
  return e;
}

function die(e, fin) { e.dead = true; e.deadT = 0; e.onStrike = null;
  if (e.die) { e.die(fin); return; }
  e.fadeMats = []; e.holder.traverse(o => { if (o.isMesh && o.material) { const m = o.material.clone(); m.transparent = true; o.material = m; e.fadeMats.push(m); } }); }

// 한 프레임: 살아 있는 적은 움직이고, 쓰러진 적은 넘어지거나(시체로 남음) 흐려지다 없어진다
export function stepEnemies(G, dt) {
  const L = G.enemies;
  for (let i = L.length - 1; i >= 0; i--) { const e = L[i];
    const gy = groundAt(G, e.holder.position.x, e.holder.position.z);
    if (!e.dead) { e.step(dt); e.holder.position.y = gy; continue; }
    e.deadT += dt; if (e.die) { e.step(dt); e.holder.position.y = gy; continue; }   // 넘어지는 동작(다 넘어지면 멈춘 시체)
    if (e.deadT < 0.45) e.step(dt);   // 맞아 휘청이는 동작은 조금 더
    const u = Math.min(1, e.deadT / DIE.fade), k = (1 - u) * (1 - u) * 0.6, op = 1 - T.MathUtils.smoothstep(u, 0.2, 1);
    for (const m of e.fadeMats) { m.opacity = op; if (m.emissive) m.emissive.setRGB(k, k * 0.92, k * 0.8); }
    e.holder.position.y = gy - DIE.sink * u * u; if (u > 0.4) e.holder.traverse(o => { o.castShadow = false; });
    if (u >= 1) { G.scene.remove(e.holder); for (const m of e.fadeMats) m.dispose(); L.splice(i, 1); } }
}
