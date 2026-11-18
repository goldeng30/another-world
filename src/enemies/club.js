// 고블린 몽둥이 (단위 cm): makeClub() → Group, 원점 = 손잡이 아래 끝, +y = 머리 쪽. userData.grip = 쥐는 곳 높이
// 옹이 진 나무 몽둥이 + 손잡이 더러운 천 감기 + 머리에 녹슨 쇠띠 두 줄 + 박힌 못대가리 · 삐져나온 굽은 못
import { T } from '../core/math.js';
import { mergeByMaterial } from '../core/merge.js';
import { PATH, loadImage } from '../core/assets.js';
const V3 = (x, y, z) => new T.Vector3(x, y, z);
const LEN = 60, GRIP0 = 2.6, GRIP1 = 17, BANDS = [36.5, 51.5];
// 고정 난수 (매번 같은 모양)
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
// 부드러운 3D 값 노이즈
const H = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi, f = t => t * t * (3 - 2 * t), u = f(xf), v = f(yf), w = f(zf);
  const l = (a, b, t) => a + (b - a) * t; let r = 0;
  r = l(l(l(H(xi, yi, zi), H(xi + 1, yi, zi), u), l(H(xi, yi + 1, zi), H(xi + 1, yi + 1, zi), u), v), l(l(H(xi, yi, zi + 1), H(xi + 1, yi, zi + 1), u), l(H(xi, yi + 1, zi + 1), H(xi + 1, yi + 1, zi + 1), u), v), w);
  return r * 2 - 1; }
const fbm = (x, y, z) => noise(x, y, z) * 0.6 + noise(x * 2.1, y * 2.1, z * 2.1) * 0.28 + noise(x * 4.3, y * 4.3, z * 4.3) * 0.12;
// 나무 몸통 반지름(높이별): 아래 손잡이 끝 혹 → 가는 손잡이 → 점점 굵어지는 머리 → 둥근 끝
const PROF = [[0, 1.2], [0.6, 1.85], [1.6, 2.0], [2.6, 1.65], [6, 1.6], [12, 1.7], [17, 1.85], [21, 2.3], [26, 3.0], [32, 3.6], [40, 4.15], [48, 4.45], [54, 4.4], [57.5, 3.9], [59.3, 2.9], [60.2, 1.4], [60.5, 0]];
const rAt = y => { for (let k = 1; k < PROF.length; k++) if (y <= PROF[k][0]) { const [y0, r0] = PROF[k - 1], [y1, r1] = PROF[k], t = (y - y0) / (y1 - y0), s = t * t * (3 - 2 * t); return r0 + (r1 - r0) * s; } return 0; };
const bendX = y => 1.1 * Math.sin(Math.PI * y / LEN);
// 옹이(혹)와 찍힌 자국: 머리 쪽 표면에 (높이, 각도, 크기, 부호)
seed = 7; const KNOTS = []; for (let i = 0; i < 9; i++) KNOTS.push([24 + rnd() * 33, rnd() * Math.PI * 2, 1.6 + rnd() * 1.6, i % 3 === 2 ? -0.55 : 0.75 + rnd() * 0.5]);
function surfR(y, a) { const r = rAt(y); if (r <= 0) return 0; const head = Math.max(0, Math.min(1, (y - 18) / 14));
  let d = fbm(Math.cos(a) * 1.3, y * 0.11, Math.sin(a) * 1.3) * (0.06 + 0.1 * head) * r;
  for (const [ky, ka, ks, kh] of KNOTS) { let da = Math.atan2(Math.sin(a - ka), Math.cos(a - ka)) * r; const dy = y - ky, q = (da * da + dy * dy) / (ks * ks); if (q < 4) d += kh * Math.exp(-q * 1.6); }
  return Math.max(0.2, r + d * (y > LEN - 0.4 ? 0 : 1)); }
// 나무 질감: 세로결 + 옹이 무늬 + 위쪽 때·핏자국
function woodCanvas() { const W = 512, Hh = 1024, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  g.fillStyle = '#4b3524'; g.fillRect(0, 0, W, Hh); seed = 11;
  for (let i = 0; i < 170; i++) { const x0 = rnd() * W, amp = 3 + rnd() * 10, fr = 0.004 + rnd() * 0.01, ph = rnd() * 6, dk = rnd(); g.strokeStyle = dk < 0.65 ? `rgba(28,18,10,${0.15 + rnd() * 0.3})` : `rgba(120,95,70,${0.06 + rnd() * 0.12})`; g.lineWidth = 0.8 + rnd() * 2.4;
    g.beginPath(); for (let y = 0; y <= Hh; y += 8) { const x = x0 + Math.sin(y * fr + ph) * amp; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  for (let i = 0; i < 7; i++) { const cx = rnd() * W, cy = rnd() * Hh * 0.75, rx = 6 + rnd() * 10; for (let k = 5; k >= 1; k--) { g.strokeStyle = `rgba(35,20,10,${0.18 + k * 0.05})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, rx * k / 3, rx * k / 1.6, 0, 0, 7); g.stroke(); } g.fillStyle = 'rgba(25,14,8,0.8)'; g.beginPath(); g.ellipse(cx, cy, rx * 0.4, rx * 0.7, 0, 0, 7); g.fill(); }
  // 위(머리, v 큰 쪽 = 그림 위쪽)에 때·검붉은 얼룩
  for (let i = 0; i < 110; i++) { const x = rnd() * W, y = rnd() * Hh * (i < 70 ? 0.5 : 1), r = 8 + rnd() * 45, gr = g.createRadialGradient(x, y, 1, x, y, r); const red = rnd() < 0.45; gr.addColorStop(0, red && y < Hh * 0.5 ? 'rgba(62,16,12,0.5)' : 'rgba(20,15,10,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // 잔 흠집
  g.strokeStyle = 'rgba(175,140,100,0.35)'; g.lineWidth = 1; for (let i = 0; i < 90; i++) { const x = rnd() * W, y = rnd() * Hh * 0.6, l = 6 + rnd() * 20, a = rnd() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return c; }
// 천 감기 질감: 비스듬한 띠(겹친 가장자리 그늘) + 올 무늬 + 손때
function clothCanvas() { const n = 512, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.fillStyle = '#7d7262'; g.fillRect(0, 0, n, n); seed = 23;
  for (let y = 0; y < n; y += 3) { g.fillStyle = `rgba(60,50,40,${0.05 + rnd() * 0.06})`; g.fillRect(0, y, n, 1); } for (let x = 0; x < n; x += 3) { g.fillStyle = `rgba(255,245,225,${0.03 + rnd() * 0.05})`; g.fillRect(x, 0, 1, n); }
  const band = n / 4; g.save(); g.translate(n / 2, n / 2); g.rotate(-0.42); for (let k = -6; k <= 6; k++) { const y = k * band; const gr = g.createLinearGradient(0, y - band / 2, 0, y + band / 2); gr.addColorStop(0, 'rgba(30,24,18,0.55)'); gr.addColorStop(0.12, 'rgba(30,24,18,0.0)'); gr.addColorStop(0.85, 'rgba(255,240,210,0.08)'); gr.addColorStop(1, 'rgba(30,24,18,0.25)'); g.fillStyle = gr; g.fillRect(-n, y - band / 2, n * 2, band); } g.restore();
  for (let i = 0; i < 70; i++) { const x = rnd() * n, y = rnd() * n, r = 10 + rnd() * 55, gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(40,28,18,${0.3 + rnd() * 0.3})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  return c; }
function rustCanvas(im) { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); if (im) g.drawImage(im, 0, 0, 512, 512); else { g.fillStyle = '#6b3a20'; g.fillRect(0, 0, 512, 512); } return c; }
const tex = (cv, rx, ry, srgb) => { const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; if (srgb) t.encoding = T.sRGBEncoding; return t; };
// 높이별 회전체: 반지름 함수 rf(y,a)로 몸통·천 감기 만들기 (uv: u 둘레, v 높이). ys = 고리 높이들(아래→위)
const span = (y0, y1, dy) => { const n = Math.max(1, Math.round((y1 - y0) / dy)), out = []; for (let j = 0; j <= n; j++) out.push(y0 + (y1 - y0) * j / n); return out; };
function revolve(ys, seg, rf) { const ny = ys.length - 1, y0 = ys[0], y1 = ys[ny], pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) { const y = ys[j]; for (let i = 0; i <= seg; i++) { const a = (i % seg) / seg * Math.PI * 2, r = rf(y, a); pos.push(Math.cos(a) * r + bendX(y), y, Math.sin(a) * r); uv.push(i / seg, (y - y0) / (y1 - y0)); } }
  for (let j = 0; j < ny; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const gm = new T.BufferGeometry(); gm.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gm.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); gm.setIndex(idx); gm.computeVertexNormals();
  // 둘레 이음매(u=0/1) 법선 맞추기
  const na = gm.attributes.normal; for (let j = 0; j <= ny; j++) { const a = j * (seg + 1), b = a + seg; const n = V3(na.getX(a) + na.getX(b), na.getY(a) + na.getY(b), na.getZ(a) + na.getZ(b)).normalize(); na.setXYZ(a, n.x, n.y, n.z); na.setXYZ(b, n.x, n.y, n.z); }
  return gm; }
// 둥근 끝: 몸통 맨 위·아래 막기
function capGeo(y, r, up) { const g = new T.CircleGeometry(r, 8); g.rotateX(up ? -Math.PI / 2 : Math.PI / 2); g.translate(bendX(y), y, 0); return g; }
export const CLUB_DIM = { LEN, GRIP0, GRIP1 };
export async function makeClub() {
  let rim = null; try { rim = await loadImage(PATH.weapons + 'rust.webp'); } catch (e) {}
  const woodC = woodCanvas(), clothC = clothCanvas(), rustC = rustCanvas(rim);
  const woodMat = new T.MeshStandardMaterial({ map: tex(woodC, 2, 1, true), bumpMap: tex(woodC, 2, 1), bumpScale: 0.12, roughness: 0.88, metalness: 0, color: 0xc9bdb0 });
  const clothMat = new T.MeshStandardMaterial({ map: tex(clothC, 1, 3.2, true), bumpMap: tex(clothC, 1, 3.2), bumpScale: 0.1, roughness: 0.95, metalness: 0, color: 0xd8cfc2 });
  const rustMat = (rx, ry) => new T.MeshStandardMaterial({ map: tex(rustC, rx, ry, true), bumpMap: tex(rustC, rx, ry), bumpScale: 0.1, roughness: 0.8, metalness: 0.55, color: 0xcfc6bc });
  const club = new T.Group();
  // 나무 몸통: 천 속에 숨는 손잡이(2.6~17)는 고리 몇 개만, 보이는 머리 쪽은 2.3 간격 · 둘레 12칸 (가벼운 판: 삼각형 약 1.5천)
  const body = new T.Mesh(revolve([0, 0.7, 1.6, 2.6, 9.8, ...span(17, 57.5, 2.3), 58.7, 59.6, 60.2, LEN + 0.45], 12, surfR), woodMat); club.add(body);
  club.add(new T.Mesh(capGeo(0, surfR(0, 0) + 0.02, false), woodMat));
  // 손잡이 천 감기 (나무보다 조금 굵게, 위아래 끝은 한 겹 더)
  const cr = (y, a) => surfR(y, a) + 0.22 + 0.06 * Math.sin(a * 3 + y * 0.7);
  club.add(new T.Mesh(revolve(span(GRIP0, GRIP1, 2.4), 12, cr), clothMat));
  for (const [ya, yb] of [[GRIP0 - 0.2, GRIP0 + 1.4], [GRIP1 - 1.4, GRIP1 + 0.3]]) club.add(new T.Mesh(revolve([ya, yb], 12, (y, a) => cr(y, a) + 0.18), clothMat));
  // 쇠띠: 그 높이 몸통보다 조금 바깥, 두께 있는 고리
  for (const by of BANDS) { const h = 2.4; let rmax = 0; for (let i = 0; i < 64; i++) for (const dy of [-h / 2, 0, h / 2]) rmax = Math.max(rmax, surfR(by + dy, i / 64 * Math.PI * 2));
    const ro = rmax + 0.32, ri = rmax - 0.25, prof = [new T.Vector2(ri, -h / 2), new T.Vector2(ro, -h / 2 + 0.15), new T.Vector2(ro, h / 2 - 0.15), new T.Vector2(ri, h / 2)];   // 위아래 면을 살짝 비스듬히(모따기 대신)
    const band = new T.Mesh(new T.LatheGeometry(prof, 16), rustMat(2.5, 0.3)); band.position.set(bendX(by), by, 0); band.rotation.z = -Math.atan(1.1 * Math.PI / LEN * Math.cos(Math.PI * by / LEN)); club.add(band);
    // 띠 이음 리벳
    for (const a of [0.4, 0.4 + Math.PI]) { const rv = new T.Mesh(new T.SphereGeometry(0.42, 6, 3), rustMat(0.3, 0.3)); rv.scale.set(1, 1, 0.55); const p = V3(Math.cos(a) * ro + bendX(by), by, Math.sin(a) * ro); rv.position.copy(p); rv.lookAt(p.clone().add(V3(Math.cos(a), 0, Math.sin(a)))); club.add(rv); } }
  // 못대가리(박힌 것) + 삐져나온 굽은 못
  seed = 31; const nailMat = rustMat(0.25, 0.25);
  const onSurf = (y, a, off) => { const r = surfR(y, a) + off; return V3(Math.cos(a) * r + bendX(y), y, Math.sin(a) * r); };
  for (let i = 0; i < 11; i++) { const y = 28 + rnd() * 30, a = rnd() * Math.PI * 2; if (BANDS.some(b => Math.abs(b - y) < 2.2)) continue;
    const hd = new T.Mesh(new T.CylinderGeometry(0.55, 0.62, 0.32, 6, 1), nailMat), p = onSurf(y, a, 0), n = V3(Math.cos(a), 0.15, Math.sin(a)).normalize();
    hd.position.copy(p); hd.quaternion.setFromUnitVectors(V3(0, 1, 0), n); club.add(hd); }
  for (const [y, a, len, bend] of [[44, 1.1, 3.2, 0.5], [55.5, 3.6, 2.6, -0.6], [33, 5.0, 2.4, 0.4]]) {
    const n = V3(Math.cos(a), 0.1, Math.sin(a)).normalize(), p = onSurf(y, a, -0.3), g = new T.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(V3(0, 1, 0), n);
    const s1 = new T.Mesh(new T.CylinderGeometry(0.17, 0.2, len * 0.6, 4, 1, true), nailMat); s1.position.y = len * 0.3; g.add(s1);
    const knee = new T.Group(); knee.position.y = len * 0.6; knee.rotation.z = bend; g.add(knee);
    const s2 = new T.Mesh(new T.CylinderGeometry(0.1, 0.17, len * 0.45, 4, 1, true), nailMat); s2.position.y = len * 0.22; knee.add(s2);
    const hd = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.25, 6), nailMat); hd.position.y = len * 0.45; knee.add(hd); club.add(g); }
  club.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); mergeByMaterial(club);   // 같은 재질(나무·천·녹슨 쇠) 조각끼리 합친다
  club.userData.grip = (GRIP0 + GRIP1) / 2 - 1.5;
  return club;
}
