# 피부색 바꾸기: 색 질감에서 살(누런 올리브 색 범위)만 골라 색조를 돌리고 채도를 올린다
# 사용: python tint_skin.py 원본.webp 출력.webp [색조 이동(도, +면 초록 쪽)] [채도 배수]
import sys, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]; dh = float(sys.argv[3]) if len(sys.argv) > 3 else 20; sk = float(sys.argv[4]) if len(sys.argv) > 4 else 1.2
im = np.asarray(Image.open(src).convert('RGB')).astype(float) / 255
r, g, b = im[..., 0], im[..., 1], im[..., 2]; mx = im.max(-1); mn = im.min(-1); v = mx; d = np.maximum(mx - mn, 1e-6); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
# 살: 색조 30~70도(누런 올리브), 너무 흐리거나(천·붕대) 너무 진하지(눈) 않고, 너무 어둡지 않은 곳. 얼룩지지 않게 흐려서 부드럽게
mask = sm(28, 36, h) * (1 - sm(70, 90, h)) * sm(0.07, 0.13, s) * sm(0.28, 0.38, v) * (1 - sm(0.5, 0.62, s))
mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(float) / 255
mask = sm(0.25, 0.6, mask) * (v > 0.1)
h2 = (h + dh * mask) % 360; s2 = np.clip(s * (1 + (sk - 1) * mask), 0, 1)
c = v * s2; x = c * (1 - np.abs((h2 / 60) % 2 - 1)); m = v - c; k = (h2 // 60).astype(int) % 6
rgb = np.zeros_like(im)
for i, (a, bb, cc) in enumerate([(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)]):
    sel = k == i
    for ch, val in enumerate((a, bb, cc)): rgb[..., ch] = np.where(sel, (val if np.isscalar(val) else val) + m, rgb[..., ch])
Image.fromarray((np.clip(rgb, 0, 1) * 255).round().astype(np.uint8)).save(out, quality=90)
print('살 비율', round(float(mask[v > 0.12].mean()), 3))
