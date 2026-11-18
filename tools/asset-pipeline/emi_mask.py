# 광석 빛 마스크(_emi.webp) 만들기: 색 질감에서 결정·광맥 색(색조 범위·채도 이상)만 흰색으로
# 사용: python emi_mask.py 원본_base.webp 출력_emi.webp 색조시작 색조끝 [최소채도] [최소밝기]
#   예) 붉은 혈석 345 15 0.3 0.25 (색조는 0~360도, 시작>끝이면 0도를 넘어 이어짐)
#   쇠붙이처럼 채도가 낮은 푸른 광맥: python emi_mask.py 원본 출력 cool 0.015 0.045 [최소밝기] → (파랑-빨강) 값으로 고른다
import sys, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]; cool = sys.argv[3] == 'cool'
h0, h1 = (0, 0) if cool else (float(sys.argv[3]), float(sys.argv[4]))
smin = float(sys.argv[5]) if len(sys.argv) > 5 else 0.25; vmin = float(sys.argv[6]) if len(sys.argv) > 6 else 0.25
im = np.asarray(Image.open(src).convert('RGB')).astype(float) / 255
r, g, b = im[..., 0], im[..., 1], im[..., 2]; mx = im.max(-1); mn = im.min(-1); v = mx; d = np.maximum(mx - mn, 1e-6); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
if cool: m = sm(float(sys.argv[4]), smin, b - r) * sm(vmin, vmin + 0.1, v)   # cool 모드: 4번째 = 시작, 5번째 = 끝(파랑-빨강)
else:
    inh = ((h >= h0) & (h <= h1)) if h0 <= h1 else ((h >= h0) | (h <= h1))
    m = inh * sm(smin, smin + 0.12, s) * sm(vmin, vmin + 0.1, v)
m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(float) / 255
m = sm(0.2, 0.7, m)
Image.fromarray((m * 255).astype(np.uint8)).save(out, quality=90)
print(out, '빛 비율', round(float(m.mean()), 3))
