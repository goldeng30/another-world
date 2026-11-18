// 입력: 키보드(W A S D 이동, Shift 달리기, F 공격, 스페이스 점프) · 화면 조이스틱 · 공격 버튼 → 입력 상태 하나(inp)
export const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

export function createInput(inp, $ = s => document.querySelector(s)) {
  Object.assign(inp, { keys: new Set(), joy: { x: 0, y: 0, id: null }, req: null, held: false, shift: false });
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) inp.req = 'jump'; } if (e.code === 'KeyF') { if (!e.repeat) inp.req = 'slash'; inp.held = true; } if (MOVE_KEYS.has(e.code)) inp.keys.add(e.code); if (e.key === 'Shift') inp.shift = true; });
  window.addEventListener('keyup', e => { if (e.code === 'Space') e.preventDefault(); inp.keys.delete(e.code); if (e.code === 'KeyF') inp.held = false; if (e.key === 'Shift') inp.shift = false; });
  window.addEventListener('blur', () => { inp.keys.clear(); inp.held = false; inp.shift = false; });

  // 왼쪽 조이스틱
  const joyEl = $('#joy'), knob = $('#joy-knob'), J = inp.joy;
  if (joyEl && knob) {
    const upd = e => { const r = joyEl.getBoundingClientRect(), R = r.width * 0.36, cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`; J.x = dx / R; J.y = -dy / R; };
    joyEl.addEventListener('pointerdown', e => { e.preventDefault(); J.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); upd(e); });
    joyEl.addEventListener('pointermove', e => { if (e.pointerId === J.id) upd(e); });
    const end = e => { if (e.pointerId !== J.id) return; J.id = null; J.x = J.y = 0; knob.style.transform = ''; };
    joyEl.addEventListener('pointerup', end); joyEl.addEventListener('pointercancel', end);
  }
  // 오른쪽 버튼: 누르면 공격, 꾹 누르고 있으면 3단까지
  const press = (id, down, up) => { const el = $(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('down'); down(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { el.classList.remove('down'); if (up) up(); }); el.addEventListener('contextmenu', e => e.preventDefault()); };
  press('#b-atk', () => { inp.req = 'slash'; inp.held = true; }, () => { inp.held = false; });
  return inp;
}
