// 화면 맞추기 · 전체화면
// 휴대폰(터치)은 화면 가득, 컴퓨터는 모바일 가로 비율(844:390)로 맞춰 가운데. 버튼 크기는 화면 높이 390 기준 비율
export function setupScreen($ = s => document.querySelector(s)) {
  { const ASP = 844 / 390, g = $('#game'), touch = matchMedia('(pointer: coarse)').matches;
    function fit() { const W = innerWidth, H = innerHeight; let w = W, h = H, s;
      if (touch) s = Math.min(1.25, Math.max(0.7, Math.min(h, w * 0.46) / 390));   // 세로로 들어도 버튼이 겹치지 않게 폭에도 맞춘다
      else { if (W / H > ASP) w = Math.round(H * ASP); else h = Math.round(W / ASP); s = h / 390; }
      g.style.width = w + 'px'; g.style.height = h + 'px'; g.style.setProperty('--s', s.toFixed(4)); }
    addEventListener('resize', fit); fit(); }
  // 전체화면: 시작 버튼(사용자가 눌러야 브라우저가 허락) · 빠져나오면 오른쪽 위 버튼으로 다시. 휴대폰은 가로로 고정 시도
  { const de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen, fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    const enter = () => { try { const r = req && req.call(de, { navigationUI: 'hide' }); if (r && r.then) r.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {} };
    const standalone = navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches, ios = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios && !standalone && !req) $('#ios-tip').hidden = false;   // 아이폰 사파리는 전체화면이 안 돼서 홈 화면 추가 안내
    document.addEventListener('gesturestart', e => e.preventDefault());   // 두 손가락 확대 막기
    const fsBtn = $('#b-fs'), sync = () => { fsBtn.hidden = !req || standalone || !!fsEl(); };
    $('#b-start').addEventListener('click', () => { enter(); $('#start').hidden = true; });
    fsBtn.addEventListener('click', enter); document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync); sync(); }
}
