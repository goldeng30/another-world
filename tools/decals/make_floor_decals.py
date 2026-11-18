# 바닥 디테일 에셋(위에서 내려다본 평면 그림): assets/decals/floor_c.webp(색 + 투명도) · floor_n.webp(노멀)
#   4×4 칸(한 칸 256px). 칸 순서는 src/data/decals.js 의 FLOOR_DECALS 와 같다 — 다시 만들려면: python3 tools/decals/make_floor_decals.py [미리보기.jpg]
#   받은 사진 재질(assets/textures, ambientCG)을 그대로 오려 쓴다: 높이(_h)로 가장자리를 돌·짚·이끼 모양대로 자르고, 노멀(_n)도 같이 옮긴다
#   낙엽은 leafset030(투명도 포함 낱장 16장)을 돌려 흩뿌리고, 판자는 planks 재질에서 이음새(높이가 낮은 줄)를 따라 판자 한 장씩 떼어 쓴다
import numpy as np
from PIL import Image
import os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TEXD = os.path.join(ROOT, 'assets/textures')
CELL, GRID = 256, 4
ATL = CELL * GRID

def load(name, m):
    p = os.path.join(TEXD, f'{name}_{m}.webp'); im = Image.open(p)
    if m == 'c': return np.asarray(im.convert('RGBA' if im.mode == 'RGBA' else 'RGB'), np.float32) / 255
    if m == 'n': a = np.asarray(im.convert('RGB'), np.float32) / 255 * 2 - 1; a[..., 1] *= -1; return a   # GL(초록 = 그림 위) → 아틀라스(초록 = 그림 아래, v 방향)
    return np.asarray(im.convert('L'), np.float32) / 255
MATS = {}
def mat(name):
    if name not in MATS: MATS[name] = {m: load(name, m) for m in ('c', 'n', 'h')}
    return MATS[name]

def blur(a, r):
    r = int(max(1, r))
    for _ in range(3):
        for ax in (0, 1):
            c = np.cumsum(np.pad(a, [(r + 1, r) if i == ax else (0, 0) for i in range(a.ndim)], mode='edge'), axis=ax)
            a = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
    return a

def vnoise(rng, h, w, cells):
    g = rng.random((cells + 3, cells + 3)).astype(np.float32)
    a = np.asarray(Image.fromarray(g, mode='F').resize((int(w * (cells + 3) / cells), int(h * (cells + 3) / cells)), Image.BICUBIC))
    oy, ox = int(h / cells), int(w / cells); return np.clip(a[oy:oy + h, ox:ox + w], 0, 1)

def fbm(rng, h, w, c0, o=4):
    v, a, t = 0, 0.5, 0
    for i in range(o): v = v + a * vnoise(rng, h, w, c0 * 2 ** i); t += a; a *= 0.5
    return v / t

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def resize(a, w, h):   # 실수 배열(…, C) 크기 바꾸기
    if a.ndim == 2: return np.asarray(Image.fromarray(a.astype(np.float32), mode='F').resize((w, h), Image.BICUBIC))
    return np.dstack([resize(a[..., k], w, h) for k in range(a.shape[2])])

def rot(a, deg, fill=0.0):   # 실수 배열 돌리기(그림 기준 반시계)
    if a.ndim == 2: return np.asarray(Image.fromarray(a.astype(np.float32), mode='F').rotate(deg, Image.BICUBIC, expand=True, fillcolor=fill))
    return np.dstack([rot(a[..., k], deg, fill) for k in range(a.shape[2])])

def rot_normal(n, deg):   # 노멀 그림을 돌릴 때 벡터도 같이 돌린다(아틀라스 기준: x 오른쪽, y 아래)
    t = np.radians(deg); c, s = np.cos(t), np.sin(t); x, y = n[..., 0], n[..., 1]
    return np.dstack([x * c + y * s, -x * s + y * c, n[..., 2]])

class Canvas:
    def __init__(s, rng):
        s.rng = rng; s.col = np.zeros((CELL, CELL, 3), np.float32); s.a = np.zeros((CELL, CELL), np.float32); s.n = np.zeros((CELL, CELL, 3), np.float32); s.n[..., 2] = 1
        s.yy, s.xx = np.mgrid[0:CELL, 0:CELL].astype(np.float32)
    def over(s, m, c, n=None):
        m = np.clip(m, 0, 1)[..., None]; s.col = s.col * (1 - m) + c * m; s.a = s.a + m[..., 0] * (1 - s.a)
        if n is not None: s.n = s.n * (1 - m) + n * m
    def shadow(s, m, dx=3, dy=4, r=3, k=0.5):   # 바닥에 떨어지는 그림자(밑에 깔림)
        sm = blur(np.roll(np.roll(m, dy, 0), dx, 1), r) * k
        s.col = s.col * (1 - sm[..., None] * s.a[..., None] * 0.8); s.a = s.a + sm * (1 - s.a)
    def paste(s, x0, y0, rgba, nrm, shadow=None):   # 그림 조각(투명도 포함)을 (x0, y0) 왼쪽 위에 얹기
        h, w = rgba.shape[:2]; X0, Y0 = max(0, x0), max(0, y0); X1, Y1 = min(CELL, x0 + w), min(CELL, y0 + h)
        if X1 <= X0 or Y1 <= Y0: return
        sub = rgba[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]; nn = nrm[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
        M = np.zeros((CELL, CELL), np.float32); M[Y0:Y1, X0:X1] = sub[..., 3]
        C = np.zeros((CELL, CELL, 3), np.float32); C[Y0:Y1, X0:X1] = sub[..., :3]; N = np.zeros((CELL, CELL, 3), np.float32); N[..., 2] = 1; N[Y0:Y1, X0:X1] = nn
        if shadow: s.shadow(M, *shadow)
        s.over(M, C, N)
    def fade_border(s, px=10):
        e = np.minimum(np.minimum(s.xx, CELL - 1 - s.xx), np.minimum(s.yy, CELL - 1 - s.yy)); s.a *= smooth(2, px, e)

def grade(c, k=1.0, sat=1.0, tint=(1, 1, 1)):   # 밝기·채도·색 맞추기(동굴 톤)
    l = (c[..., :3] * np.array([0.3, 0.59, 0.11])).sum(-1, keepdims=True); out = (l + (c[..., :3] - l) * sat) * k * np.array(tint, np.float32)
    return np.clip(out, 0, 1)

def blob(cv, r0, cells=4, k=0.4, cx=CELL / 2, cy=CELL / 2):   # 퍼지는 덩어리 모양 0..1
    d = np.hypot(cv.xx - cx, cv.yy - cy) / r0
    return np.clip(1 - d + (fbm(cv.rng, CELL, CELL, cells) - 0.5) * k * 2, 0, 1)

def ground_patch(cv, name, src=512, r0=100, hk=1.6, lo=0.32, hi=0.5, k=1.0, sat=0.85, tint=(1, 1, 1), only_high=False, sh=0.35):
    # 재질 한 조각을 오려 깔기: 가장자리는 덩어리 모양 + 높이(돌·짚이 남고 바닥은 먼저 사라짐)
    M = mat(name); rng = cv.rng; y, x = rng.integers(0, 1024 - src, 2)
    c = resize(M['c'][y:y + src, x:x + src, :3], CELL, CELL); n = resize(M['n'][y:y + src, x:x + src], CELL, CELL); h = resize(M['h'][y:y + src, x:x + src], CELL, CELL)
    n = n / np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-4)
    b = blob(cv, r0); hh = (h - h.mean()) / max(h.std(), 1e-3)
    a = smooth(lo, hi, b + hh * 0.08 * hk) if not only_high else smooth(lo, hi, b * 0.5 + 0.5) * smooth(0.4, 1.0, hh)   # only_high: 높은 곳(돌)만 남김
    if sh > 0: cv.shadow(a * smooth(0.3, 0.9, hh * 0.5 + 0.5), dx=2, dy=2, r=2, k=sh)   # 돌·짚만 살짝 그림자(이끼·흙은 없음)
    cv.over(a, grade(c, k, sat, tint), n)

def leaf_sprite(i, size, deg, k=0.62, sat=0.6):   # leafset030 의 i 번째 잎을 크기·각도대로
    M = mat('leafset030'); y, x = (i // 4) * 256, (i % 4) * 256
    c = M['c'][y:y + 256, x:x + 256]; n = M['n'][y:y + 256, x:x + 256]
    c = np.dstack([grade(c, k, sat, (1.0, 0.92, 0.82)), c[..., 3]])
    c = resize(c, size, size); n = resize(n, size, size)
    c = rot(c, deg); n = rot_normal(rot(n, deg), deg); n[..., 2] = np.where(c[..., 3] > 0.01, n[..., 2], 1)
    return c, n

def leaves(cv, n, smin, smax, r0, k=0.62):
    rng = cv.rng; b = blob(cv, r0, 4, 0.35); placed = 0
    for _ in range(n * 10):
        if placed >= n: break
        x, y = rng.random() * CELL, rng.random() * CELL
        if rng.random() > b[int(y), int(x)] ** 0.7: continue
        sz = int(smin + (smax - smin) * rng.random()); c, nn = leaf_sprite(int(rng.integers(16)), sz, rng.random() * 360, k * (0.8 + rng.random() * 0.35))
        cv.paste(int(x - c.shape[1] / 2), int(y - c.shape[0] / 2), c, nn, shadow=(2, 3, 2, 0.45)); placed += 1

def board_rows(name):   # 판자 재질에서 이음새(높이가 낮은 줄) 찾기
    h = mat(name)['h']; rm = np.convolve(h.mean(1), np.ones(5) / 5, 'same'); med, sd = np.median(rm), rm.std()
    g = [i for i in range(2, len(rm) - 2) if rm[i] == rm[i - 2:i + 3].min() and rm[i] < med - 0.8 * sd]
    return [(g[i], g[i + 1]) for i in range(len(g) - 1) if 40 < g[i + 1] - g[i] < 200]

def board(cv, name, rows, L, Wt, k=0.75, broken=(False, False), gone=None):   # 판자 한 장(가로로 긴 그림) — 이음새 사이 한 줄을 떼어 온다
    M = mat(name); rng = cv.rng; y0, y1 = rows[rng.integers(len(rows))]; y0 += 2; y1 -= 2; src_len = int(L * (y1 - y0) / Wt); x0 = rng.integers(0, 1024 - src_len)
    c = resize(M['c'][y0:y1, x0:x0 + src_len, :3], L, Wt); n = resize(M['n'][y0:y1, x0:x0 + src_len], L, Wt); hh = resize(M['h'][y0:y1, x0:x0 + src_len], L, Wt)
    yy, xx = np.mgrid[0:Wt, 0:L].astype(np.float32); jag = lambda: np.abs(((yy + rng.random() * 9) / 4.5) % 2 - 1) * 10 + vnoise(rng, Wt, L, 12) * 8
    e0 = jag() if broken[0] else np.zeros_like(xx); e1 = L - (jag() if broken[1] else 0)
    a = smooth(-0.5, 1.2, xx - e0) * smooth(0.5, -1.2, xx - e1) * smooth(-0.5, 1.0, yy) * smooth(Wt - 0.5, Wt - 1.5, yy)
    if gone: a *= 1 - smooth(gone[1], gone[1] - 2, np.abs(xx - gone[0])) * (yy > Wt * (0.35 + 0.3 * rng.random()))
    edge = np.minimum(np.minimum(xx - e0, e1 - xx), np.minimum(yy, Wt - yy)); cc = grade(c, k, 0.85) * (0.7 + 0.3 * smooth(0, 3, edge))[..., None]
    for sx in (5, L - 7):   # 녹슨 못 둘
        for sy in (Wt * 0.3, Wt * 0.7):
            if rng.random() < 0.75:
                d = np.hypot(xx - sx, yy - sy); nm = smooth(2.0, 1.0, d) * a; cc = cc * (1 - nm[..., None]) + np.array([0.18, 0.1, 0.06]) * nm[..., None]
    return np.dstack([cc, a]), n

def place_board(cv, img, n, cx, cy, deg, sh=(3, 4, 3, 0.55)):
    c = rot(img, deg); nn = rot_normal(rot(n, deg), deg); cv.paste(int(cx - c.shape[1] / 2), int(cy - c.shape[0] / 2), c, nn, shadow=sh)

def deck(cv, name, nb=5, L=(200, 236), k=0.7):   # 판자 데크: 나란한 판자 여러 장(길이·부러짐 제각각, 하나는 빠짐)
    rng = cv.rng; rows = board_rows(name); Wt = 40; top = CELL / 2 - nb * (Wt + 3) / 2; miss = rng.integers(1, nb - 1)
    for i in range(nb):
        if i == miss and rng.random() < 0.6: continue
        l = int(rng.uniform(*L)); img, n = board(cv, name, rows, l, Wt, k * rng.uniform(0.85, 1.1), (rng.random() < 0.35, rng.random() < 0.5), (l * rng.uniform(0.3, 0.7), rng.uniform(8, 18)) if rng.random() < 0.3 else None)
        place_board(cv, img, n, CELL / 2 + rng.normal(0, 6), top + i * (Wt + 3) + Wt / 2, rng.normal(0, 1.2))

def build(seed=11):
    R = lambda i: np.random.default_rng(seed * 100 + i); cells = []
    def cell(i, f): cv = Canvas(R(i)); f(cv); cv.fade_border(10); cells.append((cv.col, cv.a, cv.n))
    # 0~3 돌밭(자갈 섞인 땅) · 잔돌만
    cell(0, lambda cv: ground_patch(cv, 'ground108', 560, 100, k=0.55, sat=0.7))
    cell(1, lambda cv: ground_patch(cv, 'ground085', 520, 96, k=0.6, sat=0.75))
    cell(2, lambda cv: ground_patch(cv, 'ground108', 420, 104, hk=2.4, lo=0.4, hi=0.55, k=0.55, sat=0.7))
    cell(3, lambda cv: ground_patch(cv, 'ground085', 480, 108, k=0.5, sat=0.7, only_high=True, sh=0.25))   # 잔돌: 어두운 잔돌 섞인 흙에서 높은 곳(돌)만
    # 4~5 짚(고블린 잠자리) · 6 이끼 · 7 흙
    cell(4, lambda cv: ground_patch(cv, 'ground072', 560, 108, hk=1.2, lo=0.25, hi=0.5, k=0.5, sat=0.7, tint=(1, 0.95, 0.85), sh=0.2))
    cell(5, lambda cv: ground_patch(cv, 'ground072', 420, 90, hk=2.0, lo=0.34, hi=0.52, k=0.5, sat=0.7, tint=(1, 0.95, 0.85), sh=0.2))
    cell(6, lambda cv: ground_patch(cv, 'ground068', 620, 112, hk=1.0, lo=0.15, hi=0.55, k=0.45, sat=0.6, tint=(0.9, 1.0, 0.85), sh=0))
    cell(7, lambda cv: ground_patch(cv, 'ground067', 600, 112, hk=0.8, lo=0.12, hi=0.55, k=0.55, sat=0.8, sh=0))
    # 8~11 낙엽: 무더기 둘 · 몇 장 · 낱장
    cell(8, lambda cv: leaves(cv, 30, 46, 70, 96))
    cell(9, lambda cv: leaves(cv, 18, 50, 76, 90))
    cell(10, lambda cv: leaves(cv, 7, 54, 78, 105))
    cell(11, lambda cv: leaves(cv, 3, 60, 84, 80))
    # 12 판자 데크 · 13 흩어진 판자 · 14 바랜 판자(부러짐) · 15 그을음
    cell(12, lambda cv: deck(cv, 'planks012', 5))
    def loose(cv):
        rows = board_rows('planks012'); rng = cv.rng
        for (cx, cy, deg, l) in [(110, 100, 18, 190), (150, 170, -64, 150), (95, 190, 4, 110)]:
            img, n = board(cv, 'planks012', rows, l, 40, 0.72, (rng.random() < 0.5, True)); place_board(cv, img, n, cx, cy, deg)
    cell(13, loose)
    def grey(cv):
        rows = board_rows('planks023a'); rng = cv.rng
        img, n = board(cv, 'planks023a', rows, 150, 44, 0.62, (False, True)); place_board(cv, img, n, 100, 110, 28)
        img, n = board(cv, 'planks023a', rows, 100, 44, 0.62, (True, False)); place_board(cv, img, n, 170, 160, 52)
        for _ in range(4): img, n = board(cv, 'planks023a', rows, int(rng.uniform(26, 44)), 9, 0.6, (True, True)); place_board(cv, img, n, rng.uniform(80, 190), rng.uniform(150, 210), rng.uniform(0, 360), (1, 2, 1, 0.45))
    cell(14, grey)
    def soot(cv):
        b = blob(cv, 95, 4, 0.6); a = smooth(0.0, 0.8, b) * 0.78; cv.over(a, np.full((CELL, CELL, 3), [0.05, 0.045, 0.04], np.float32) * (0.8 + 0.4 * vnoise(cv.rng, CELL, CELL, 10))[..., None])
        g = (vnoise(cv.rng, CELL, CELL, 70) > 0.8) * smooth(0.2, 0.6, b); cv.over(blur(g.astype(np.float32), 1) * 0.55, np.full((CELL, CELL, 3), [0.36, 0.35, 0.33], np.float32))
    cell(15, soot)
    return cells

def main():
    cells = build()
    C = np.zeros((ATL, ATL, 4), np.float32); N = np.zeros((ATL, ATL, 3), np.float32); N[..., 2] = 1
    for i, (col, a, n) in enumerate(cells):
        y, x = (i // GRID) * CELL, (i % GRID) * CELL
        C[y:y + CELL, x:x + CELL, :3] = np.clip(col, 0, 1); C[y:y + CELL, x:x + CELL, 3] = np.clip(a, 0, 1)
        n = n / np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-4); N[y:y + CELL, x:x + CELL] = n
    a = C[..., 3:4]; filled = blur(C[..., :3] * a, 6) / np.maximum(blur(a, 6), 1e-4); C[..., :3] = np.where(a > 0.02, C[..., :3], filled)   # 밉맵 번짐 방지
    out = os.path.join(ROOT, 'assets/decals'); os.makedirs(out, exist_ok=True)
    Image.fromarray((C * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(out, 'floor_c.webp'), quality=90, method=6)
    Image.fromarray(((N * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(out, 'floor_n.webp'), quality=92, method=6)
    if len(sys.argv) > 1:
        bg = load('rock062', 'c')[:ATL, :ATL] * np.array([0.56, 0.46, 0.42]) * 1.6
        pv = bg * (1 - C[..., 3:4]) + C[..., :3] * C[..., 3:4]; Image.fromarray((np.clip(pv, 0, 1) * 255).astype(np.uint8)).save(sys.argv[1])
    print('ok', os.path.getsize(os.path.join(out, 'floor_c.webp')) // 1024, 'KB', os.path.getsize(os.path.join(out, 'floor_n.webp')) // 1024, 'KB')

main()
