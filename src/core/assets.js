// 자산 불러오기: 경로 규칙 · 한 번만 받기(캐시) · 받는 중 진행률
// 한 파일 앱으로 묶으면 파일 내용이 window.__ASSETS[경로] = data URI 로 들어 있어 그걸 쓴다
import { T } from './math.js';
import { CONFIG } from '../config.js';

export const PATH = {
  hero: 'assets/hero/',
  weapons: 'assets/weapons/',
  enemies: 'assets/enemies/',
  props: 'assets/props/',
  textures: 'assets/textures/',
  rocks: 'assets/rocks/',
};

const BAKED = window.__ASSETS || null;
export const url = p => (BAKED && BAKED[p]) || p;

const cache = new Map();
const prog = { total: 0, done: 0, fns: [] };
function track(pr) { prog.total++; const fin = () => { prog.done++; for (const f of prog.fns) f(prog.done, prog.total); }; pr.then(fin, fin); return pr; }
export const onProgress = fn => prog.fns.push(fn);
const once = (key, make) => { if (!cache.has(key)) cache.set(key, track(make())); return cache.get(key); };

// 아티팩트는 .glb 를 올릴 수 없어서, 빌드가 base64 스크립트(이름.glb.js)로 감싸 둔다 → 스크립트로 받아 바이트로 되돌린다
const JS_WRAP = !BAKED && !!window.__ASSET_JS_MODE;
function loadWrapped(p) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = p + '.js';
  s.onload = () => { const box = window.__ASSET_JS || {}, b64 = box[p]; delete box[p]; s.remove(); if (!b64) return rej(new Error('불러오기 실패: ' + p));
    const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); res(u8.buffer); };
  s.onerror = () => rej(new Error('불러오기 실패: ' + p)); document.head.appendChild(s); }); }
export function loadBuffer(p) { return track(JS_WRAP && p.endsWith('.glb') ? loadWrapped(p) : fetch(url(p)).then(r => { if (!r.ok) throw new Error('불러오기 실패: ' + p); return r.arrayBuffer(); })); }
export const loadJSON = p => once('j:' + p, () => fetch(url(p)).then(r => { if (!r.ok) throw new Error('불러오기 실패: ' + p); return r.json(); }));
export const loadImage = p => once('i:' + p, () => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('불러오기 실패: ' + p)); im.src = url(p); }));

// 질감: 같은 파일은 같은 질감 객체를 함께 쓴다(내려받기·그래픽 메모리 한 번)
const tl = new T.TextureLoader();
export const loadTex = p => once('t:' + p, () => new Promise((res, rej) => tl.load(url(p), res, undefined, () => rej(new Error('불러오기 실패: ' + p)))));
export const tryTex = p => loadTex(p).catch(() => null);
// 소품 질감: 기기 품질에 맞춰 최대 크기를 넘으면 줄여서 쓴다(휴대폰 512, 컴퓨터 1024 — config.js 의 quality.*.propTex)
const PROP_MAX = () => (matchMedia('(pointer: coarse)').matches ? CONFIG.quality.touch : CONFIG.quality.desktop).propTex || 4096;
export const loadPropTex = p => once('pt:' + p, () => loadTex(p).then(t => { const im = t.image, mx = PROP_MAX(), w = im && im.width, h = im && im.height; if (!w || Math.max(w, h) <= mx) return t;
  const k = mx / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height);
  t.image = c; t.needsUpdate = true; return t; }));
export const tryPropTex = p => loadPropTex(p).catch(() => null);

// glTF 모델(.glb): 원본 버퍼는 읽고 나면 버린다(모델마다 새로 해석 → 같은 모델 여러 마리도 각자)
export async function loadGLTF(p) { const buf = await loadBuffer(p); return new Promise((res, rej) => new T.GLTFLoader().parse(buf, '', res, rej)); }
