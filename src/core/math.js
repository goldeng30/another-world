// 공통 수학 도구 (three.js 전역 THREE 사용)
export const T = window.THREE;
export const DEG = Math.PI / 180;
export const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export const clamp01 = x => Math.max(0, Math.min(1, x));
export const sstep = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
export const bump = (x, a, b, c, d) => sstep(a, b, x) * (1 - sstep(c, d, x));
export const EASE = { io: t => t * t * (3 - 2 * t) };
// 각도 차이를 -π~π로 · 각도를 목표 쪽으로 부드럽게 돌리기
export const wrapA = d => Math.atan2(Math.sin(d), Math.cos(d));
export const turn = (c, to, rate, dt) => c + wrapA(to - c) * (1 - Math.exp(-dt * rate));
// 씨앗 있는 난수(같은 씨앗 → 같은 배치)
export function makeRng(seed = 12345) { let rs = seed; return () => (rs = (rs * 16807) % 2147483647) / 2147483647; }
