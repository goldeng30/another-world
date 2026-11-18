// 값 잡음(주기 있게 → 질감이 이어진다). 지형·벽 모양에 쓴다
const hash = (x, y, z, s) => { let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca77); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967295; };
const sm = t => t * t * (3 - 2 * t), md = (a, p) => ((a % p) + p) % p;
export const n2 = (x, y, p, s) => { const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi), X0 = md(xi, p), X1 = md(xi + 1, p), Y0 = md(yi, p), Y1 = md(yi + 1, p);
  const a = hash(X0, Y0, 0, s), b = hash(X1, Y0, 0, s), c = hash(X0, Y1, 0, s), d = hash(X1, Y1, 0, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
export const fbm2 = (x, y, p, s, o = 4) => { let v = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { v += a * n2(x * f, y * f, p * f, s + i * 13); t += a; a *= 0.5; f *= 2; } return v / t; };
export const n3 = (x, y, z, s) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm(x - xi), v = sm(y - yi), w = sm(z - zi); let r = 0;
  for (let k = 0; k < 8; k++) { const dx = k & 1, dy = (k >> 1) & 1, dz = k >> 2; r += hash(xi + dx, yi + dy, zi + dz, s) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); } return r; };
export const fbm3 = (x, y, z, s, o = 3) => { let v = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { v += a * n3(x * f, y * f, z * f, s + i * 7); t += a; a *= 0.5; f *= 2; } return v / t; };
