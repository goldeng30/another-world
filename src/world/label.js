// 이름표: 글자를 바닥에 눕힌 판(화면에서 가로로 읽히게). 전시장 등에서 쓴다
import { T } from '../core/math.js';

export function makeLabel(text, opt = {}) {
  const px = opt.px || 56, c = document.createElement('canvas'), g = c.getContext('2d'), font = `600 ${px}px "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + px, h = Math.ceil(px * 1.6); c.width = w; c.height = h;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(text, w / 2 + 2, h / 2 + 2); g.fillStyle = opt.color || '#e9e2d6'; g.fillText(text, w / 2, h / 2);
  const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
  const k = (opt.size || 19) / px, geo = new T.PlaneGeometry(w * k, h * k); geo.rotateX(-Math.PI / 2);
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }); mat.userData.ownsMap = true;
  const m = new T.Mesh(geo, mat); m.rotation.y = Math.PI / 4; m.renderOrder = 1;   // 화면 기준 가로(u 방향)로 읽히게
  return m;
}
