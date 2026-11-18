// 게임 루프 + 해상도 자동 조절
// 1.5초(90프레임) 평균이 50fps 아래면 해상도를 한 단계(15%) 낮춘다. 낮춰도 나아지지 않으면(화면이 30fps로 묶인 기기 등) 되돌리고 멈춘다
import { CONFIG } from '../config.js';

export function createAutoRes(rd) { const C = CONFIG.quality.autoRes;
  const AR = { base: rd.getPixelRatio(), n: 0, sum: 0, t0: performance.now() + C.warmup, prev: 0, lastAvg: 0, done: false };
  AR.min = Math.max(C.minDpr, AR.base * C.minK);
  function feed(ms) { if (AR.done || ms > 250 || performance.now() < AR.t0) return; AR.sum += ms; if (++AR.n < C.frames) return; const avg = AR.sum / AR.n; AR.n = 0; AR.sum = 0;
    if (AR.prev) { if (avg > AR.lastAvg * 0.95) { rd.setPixelRatio(AR.prev); AR.done = true; return; } AR.prev = 0; }
    if (avg > C.slowMs && rd.getPixelRatio() > AR.min + 0.01) { AR.prev = rd.getPixelRatio(); AR.lastAvg = avg; rd.setPixelRatio(Math.max(AR.min, AR.prev * C.step)); AR.t0 = performance.now() + 500; } }
  return { AR, feed };
}

// step(dt): 한 프레임 진행(계산), draw(): 그리기. window.__pause면 멈춘다(점검용)
export function startLoop(step, draw, autoRes, onFrame) {
  let last = performance.now();
  function loop(now) { const ms = Math.max(0, now - last), dt = Math.min(0.05, ms / 1000); last = now;   // 첫 프레임 시각이 시작 시각보다 앞설 수 있어 음수는 0으로
    if (!window.__pause) { if (autoRes) autoRes.feed(ms); step(dt); draw(); if (onFrame) onFrame(ms); }
    requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}
