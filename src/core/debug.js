// 개발용 성능 표시: 주소 끝에 ?debug 를 붙이거나 ` 키 · 휴대폰은 왼쪽 위 등급·레벨 자리를 세 번 눌러 켜고 끈다(fps · 프레임 ms · 그리기 호출 · 삼각형 · 셰이더 · 질감 · 해상도)
export function createStats(rd) {
  let el = null, on = /[?&]debug\b/.test(location.search), acc = 0, n = 0, worst = 0, t0 = performance.now();
  const show = v => { on = v; if (on && !el) { el = document.createElement('pre'); el.style.cssText = 'position:fixed;left:8px;top:48px;z-index:9;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#cfe;background:rgba(0,0,0,.6);border-radius:6px;pointer-events:none'; document.body.appendChild(el); } if (el) el.hidden = !on; };
  window.addEventListener('keydown', e => { if (e.code === 'Backquote') show(!on); });
  // 휴대폰: 왼쪽 위 등급·레벨 표시 자리를 빠르게 세 번 누르면 켜고 끈다(그 자리는 누름을 막지 않아서 창 전체에서 위치로 확인)
  let taps = []; window.addEventListener('pointerdown', e => { const me = document.getElementById('hud-me'); if (!me) return; const r = me.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const t = performance.now(); taps = taps.filter(x => t - x < 700); taps.push(t); if (taps.length >= 3) { taps = []; show(!on); } }, true);
  show(on);
  return function frame(ms) { if (!on) return; acc += ms; n++; worst = Math.max(worst, ms); const now = performance.now(); if (now - t0 < 500) return;
    const i = rd.info, fps = 1000 / (acc / n);
    el.textContent = `fps ${fps.toFixed(0)}  (${(acc / n).toFixed(1)}ms, 최대 ${worst.toFixed(0)})\n호출 ${i.render.calls}  삼각형 ${(i.render.triangles / 1000).toFixed(0)}k\n셰이더 ${i.programs.length}  질감 ${i.memory.textures}  모양 ${i.memory.geometries}\n해상도 ×${rd.getPixelRatio().toFixed(2)}`;
    acc = 0; n = 0; worst = 0; t0 = now; };
}
