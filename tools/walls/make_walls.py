# 벽 키트: assets/rocks/cliff*.glb — 방 둘레(벽 밑선)를 따라 게임이 골라 이어 붙이고 휘는 바위 벽 조각 (규격: tools/walls/KIT_SPEC.md)
#   좌표: x 벽 따라(-0.5~0.5 한 칸, ±0.62 까지 겹침) · y 위(0 = 바닥, -0.06 까지 묻힘) · +z 방 안쪽(앞면), z = 0 벽 밑선
#   모양: 평면으로 깎은 바위 덩어리(볼록 다면체, SDF) 몇 개의 합 + 세로 결 잡음 + 가로 결(층) → 벽 뒤 밑의 축에서 단면마다 바깥으로 광선을 쏴 겉면을 찾는다
#         그래서 x 방향 꼭짓점이 고르게 촘촘하다(휘어도 매끈) · 양 끝은 둥글게 뒤로 말려 들어가 이웃과 겹친 자리가 바위 틈처럼 보인다
#   기둥(cliffPillar*)은 세로 축에서 둘레로 광선을 쏜다(휘지 않고 통째로 세움, 원점 = 밑동 가운데)
#   꼭짓점 색: 밑동·틈 어둡게(SDF 가림 + 오목함), 위를 보는 턱은 살짝 밝게 — 위로 갈수록 어두워지는 건 게임이 한다
#   다시 만들려면: python3 tools/walls/make_walls.py
import sys, os, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'rocks'))
from make_rocks import Noise3, normals, rock, finish, merge, write_glb, OUT

Y0 = -0.06   # 묻힌 밑
def unit(v): v = np.asarray(v, float); return v / np.linalg.norm(v)
def sstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def smin(a, b, k): h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h)
def smax(a, b, k): return -smin(-a, -b, k)

class Block:   # 바위 덩어리 하나: 평면들의 (모서리 둥근) 교집합 — 앞면(위로 갈수록 뒤로) · 윗면(뒤로 갈수록 낮게) · 양옆(뒤로 갈수록 넓어져 이웃 덩어리와 V 틈) · 뒷면 · (밑면 yb: 위에 얹힌 덩어리) + 깎은 면
    #   cuts: 앞을 보는 깎은 면 · edge: 세로 모서리 깎기 · top: 윗면 깎기 — 모두 앞·옆·위를 보는 평면만(아래를 보는 면 = 처마 금지)
    def __init__(s, x0, x1, H, yb=None, zf=0.0, lean=0.08, yaw=0.0, tb=0.3, tx=0.0, sl=0.16, sr=0.16, syl=0.0, syr=0.0, ybt=0.0, zb=-0.5, k=0.018, ledges=(), cuts=5, edge=1, top=2, bite=(0.05, 0.14), brow=None, wob=0.16, seed=0):
        rng = np.random.default_rng(seed); xc = (x0 + x1) / 2; s.pl = []; s.ledges = ledges; y0 = -0.3 if yb is None else yb; s.wob = wob; s.nw = Noise3(seed + 50)
        def pl(n, p, kk): n = unit(n); s.pl.append((n, float(n @ np.asarray(p, float)), kk))
        pl((-yaw, lean, 1), (xc, 0, zf), k)                      # 앞면
        pl((tx, 1, -tb), (xc, H, zf - lean * H), k * 1.3)         # 윗면
        pl((-1, syl, sl), (x0, 0, zf), k); pl((1, syr, sr), (x1, 0, zf), k)   # 양옆(syl·syr: 틈 기울기)
        pl((0, 0, -1), (0, 0, zb), 0.01); pl((ybt, -1, 0), (xc, y0, 0), 0.012)   # 뒷면 · 밑면(ybt: 이음매 기울기)
        fz = lambda x, y: zf + yaw * (x - xc) - lean * y; ht = lambda x, z: H - tx * (x - xc) + tb * (z - fz(xc, H))
        xl = lambda y: x0 + syl * y; xr = lambda y: x1 - syr * y   # 옆선(기울어진 틈)
        cr = np.array([(x, y, fz(x, y)) for y in (max(y0, 0) + 0.05, H) for x in (xl(y), xr(y))] + [(x, ht(x, zb), zb) for x in (xl(H), xr(H))])   # 모서리(깎을 깊이 기준)
        def cut(n, b, kk): n = unit(n); s.pl.append((n, float(np.max(cr @ n)) - b, kk))
        if brow is not None: cut((rng.normal(0, 0.15), 1, brow[0]), brow[1], k)   # 이마 깎기: 앞-위 모서리를 비스듬한 평면으로
        for _ in range(cuts): cut((rng.uniform(-0.35, 0.35), rng.uniform(0.08, 0.6), 1), rng.uniform(*bite), k * 0.7)   # 비스듬히 위·앞을 보는 깨진 면
        for _ in range(edge): sg = rng.choice((-1, 1)); cut((sg * rng.uniform(0.7, 1.0), rng.uniform(0.1, 0.6), rng.uniform(0.5, 0.9)), rng.uniform(0.015, 0.04), k * 0.7)   # 세로 모서리 조금
        for _ in range(top): cut((rng.uniform(-0.9, 0.9), 1, rng.uniform(-0.1, 0.6)), rng.uniform(0.05, 0.15), k * 0.7)   # 윗면·윗모서리 깎기(들쭉날쭉한 윗선)
    def __call__(s, P):
        acc = None
        for i, (n, d, k) in enumerate(s.pl):
            v = P @ n - d
            if i == 0:
                for ys, sb, xa, xb in s.ledges:   # 턱: ys 위로는 앞면이 sb 만큼 뒤로(위를 보는 좁은 턱 — 먼지 앉는 곳)
                    v = v + sb * sstep(ys - 0.012, ys + 0.012, P[:, 1]) * sstep(xa - 0.03, xa + 0.03, P[:, 0]) * (1 - sstep(xb - 0.03, xb + 0.03, P[:, 0]))
            if i in (2, 3) and s.wob: v = v + (s.nw(P * np.array([1.8, 2.6, 1.8])) - 0.5) * s.wob   # 틈 선을 들쭉날쭉하게
            acc = v if acc is None else smax(acc, v, k)
        return acc

def rock_sdf(blocks, seed, amp=1.0, sa=1.0, ku=0.01):   # 조각 전체: 덩어리 합 + 세로로 긴 잡음(세로 결·불룩함) + 가로로 납작한 잡음(층·결, 불규칙)
    n1, n2, n3, n4 = Noise3(seed + 1), Noise3(seed + 2), Noise3(seed + 3), Noise3(seed + 4)
    def f(P):
        d = blocks[0](P)
        for b in blocks[1:]: d = smin(d, b(P), ku)
        d = d + ((n1(P * np.array([2.0, 0.8, 2.0]) + 5) - 0.5) * 0.035 + (n2(P * np.array([6, 3, 6]) + 11) - 0.5) * 0.018 + (n3(P * 13 + 3) - 0.5) * 0.006) * amp
        return d + (n4(P * np.array([2.5, 24, 2.5]) + 7) - 0.5) * 0.014 * sa
    return f

def cast(sdf, O, D, rmax, K=120, it=14):   # 광선마다 가장 바깥 겉면까지의 거리: 바깥에서 안으로 훑어 처음 안이 되는 곳 → 이분법
    sh = O.shape[:-1]; O = O.reshape(-1, 3); D = D.reshape(-1, 3); rs = np.linspace(rmax, 0, K); hit = np.full(len(O), -1)
    for k, r in enumerate(rs): ins = sdf(O + D * r) <= 0; hit[ins & (hit < 0)] = k
    lo = np.where(hit >= 0, rs[np.maximum(hit, 0)], 0.0); hi = np.where(hit > 0, rs[np.maximum(hit - 1, 0)], lo)
    for _ in range(it): m = (lo + hi) / 2; ins = sdf(O + D * m[:, None]) <= 0; lo = np.where(ins, m, lo); hi = np.where(ins, hi, m)
    return lo.reshape(sh)

def resample(Z, Y, n, wback=0.3):   # 단면 선을 n 점으로(무게 준 길이로 고르게): 뒷면(-z 를 보는 곳)은 성기게
    dz, dy = np.diff(Z), np.diff(Y); L = np.hypot(dz, dy); nz = np.where(L > 1e-9, dy / np.maximum(L, 1e-9), 1)
    s = np.concatenate([[0], np.cumsum(L * (wback + (1 - wback) * sstep(-0.75, -0.25, nz)))]); t = np.linspace(0, s[-1], n)
    return np.interp(t, s, Z), np.interp(t, s, Y), s[-1]

def no_overhang(Z, Y, k=0.3):   # 앞면(맨 위 점까지): 위로 가며 앞으로 나오는 기울기를 k 로 막는다(처마 없음) · 아래로 꺾이는 곳은 평평하게
    Z = Z.copy(); Y = Y.copy(); jm = int(np.argmax(Y))
    for j in range(1, jm + 1):
        Y[j] = max(Y[j], Y[j - 1]); Z[j] = min(Z[j], Z[j - 1] + k * (Y[j] - Y[j - 1]))
    return Z, Y

def sdf_ao(sdf, P, N, step, n=5, k=2.4):   # SDF 가림(틈·오목한 곳 어둡게)
    d0 = sdf(P); occ = np.zeros(len(P))
    for i in range(1, n + 1): h = i * step; occ += np.clip(h - (sdf(P + N * h) - d0), 0, None) / 2 ** i
    return np.clip(1 - k * occ / step, 0.35, 1)

def cavity(P, F, N, k=60):   # 오목함(make_rocks finish 와 같은 방식)
    nb = np.zeros_like(P); cnt = np.zeros(len(P))
    for a, b in ((0, 1), (1, 2), (2, 0)): np.add.at(nb, F[:, a], P[F[:, b]]); np.add.at(cnt, F[:, a], 1); np.add.at(nb, F[:, b], P[F[:, a]]); np.add.at(cnt, F[:, b], 1)
    return np.clip(((nb / np.maximum(cnt, 1)[:, None] - P) * N).sum(1) * k, -1, 1)

def shade(P, F, N, ao, H, seed, extra=1.0):   # 꼭짓점 색: 밑동 어둡게 × 틈 가림 × 오목함 × 위를 보는 면 살짝 밝게 (위로 갈수록 어둡게는 안 함)
    foot = 0.42 + 0.58 * np.clip((P[:, 1] - Y0) / min(0.38 * H, 0.3), 0, 1) ** 0.7
    c = foot * ao * (1 - 0.3 * np.clip(cavity(P, F, N), 0, 1)) * (1 + 0.14 * np.clip(N[:, 1], 0, 1) ** 3) * extra
    rng = np.random.default_rng(seed); tint = np.array([1, 0.97 + rng.random() * 0.04, 0.92 + rng.random() * 0.06])
    return np.clip(c[:, None] * tint, 0, 1.2)

def grid_faces(nx, ny):   # (nx 열 × ny 점) 격자 → 바깥을 보는 삼각형
    i, j = np.meshgrid(np.arange(nx - 1), np.arange(ny - 1), indexing='ij'); a = (i * ny + j).ravel(); b = a + ny; c = a + 1; d = b + 1
    return np.concatenate([np.stack([a, b, c], 1), np.stack([b, d, c], 1)])

def rubble(seed, n, zmax=0.15, xr=0.47, size=(0.05, 0.12)):   # 밑동 돌 부스러기: 밑선 앞(z 0~zmax)에 반쯤 묻혀 바닥 이음새를 덮는다
    rng = np.random.default_rng(seed); parts = []; xs = np.sort(rng.uniform(-xr, xr, n))
    for i, x in enumerate(xs):
        s = rng.uniform(*size); P, F = rock(seed * 17 + i, level=2, scale=(1, rng.uniform(0.45, 0.7), rng.uniform(0.7, 1)), cuts=int(rng.integers(3, 7)), disp=0.05, fine=0)
        P, N, C, F = finish(P, F, 0.15, seed * 17 + i); P = P * s; a = rng.uniform(0, 6.28); R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
        P = P @ R.T; N = N @ R.T; z = rng.uniform(0.01, max(0.012, zmax - s * 0.5)); P += np.array([x, -0.012, z]); parts.append((P, N, C * 0.72, F))
    return parts

def cliff(blocks, seed, h, zb, sp=0.046, xs_n=29, xr=0.53, ey=0.25, rub=8, rub_z=0.15, rub_s=(0.06, 0.15), amp=1.0, sa=1.0):
    # 벽 조각: 단면마다 광선(벽 뒤 밑 축에서 앞→위→뒤)으로 겉면을 찾아 격자로 · 양 끝은 뒤로 말기
    sdf = rock_sdf(blocks, seed, amp, sa); xs = np.linspace(-0.62, 0.62, xs_n); zp = zb + 0.1
    th = np.linspace(0, np.pi, 520); rmax = np.hypot(h + 0.3, 0.8)
    O = np.zeros((xs_n, len(th), 3)); O[..., 0] = xs[:, None]; O[..., 1] = Y0; O[..., 2] = zp
    D = np.zeros_like(O); D[..., 1] = np.sin(th)[None]; D[..., 2] = np.cos(th)[None]
    r = cast(sdf, O, D, rmax)
    prof = [no_overhang(zp + r[i] * np.cos(th), Y0 + r[i] * np.sin(th)) for i in range(xs_n)]
    Ls = [resample(Z, Y, 2)[2] for Z, Y in prof]; ny = int(np.ceil(max(Ls) / sp)) + 1
    G = np.zeros((xs_n, ny, 3))
    for i, (Z, Y) in enumerate(prof): z, y, _ = resample(Z, Y, ny); G[i, :, 0] = xs[i]; G[i, :, 1] = y; G[i, :, 2] = z
    P = G.reshape(-1, 3); F = grid_faces(xs_n, ny); N = normals(P, F)
    ao = sdf_ao(sdf, P, N, 0.022)
    # 양 끝: 끝 덩어리는 x = ±0.475 에서 안쪽 틈과 같은 옆면으로 끝나 뒤로 물러난다(이웃과 겹치면 그 자리가 틈) · 그 너머(|x| > xr, 이웃에 가려지는 곳)는
    #   남은 뒤 덩어리가 둥글게 뒤(zb)로 말려 들어가 단면이 뒷면 선으로 닫히고 높이도 조금 낮아진다
    t = np.clip((np.abs(P[:, 0]) - xr) / (0.62 - xr), 0, 1); szk = np.clip(1 - t ** 1.5, 0, 1) ** 0.5; syk = 1 - ey * t ** 1.5
    P[:, 2] = zb + (P[:, 2] - zb) * szk; P[:, 1] = Y0 + (P[:, 1] - Y0) * syk
    N = normals(P, F); C = shade(P, F, N, ao, h, seed, 1 - 0.55 * (1 - szk) ** 0.7)
    parts = [(P, N, C, F)] + (rubble(seed, rub, rub_z, size=rub_s) if rub else [])
    return merge(parts)

def column(c, R, Ht, taper, seed, K=7, bev=(0.14, 0.22), cuts=6):   # 기둥 덩어리: 위로 조금 좁아지는 다각 기둥(옆면 K 개, 모두 조금 위를 봄 = 처마 없음) + 비스듬히 깎아 둥근 머리
    rng = np.random.default_rng(seed); c = np.array([c[0], 0.0, c[1]]); pl = []; ph0 = rng.uniform(0, 2 * np.pi)
    def add(n, p, k): n = unit(n); pl.append((n, float(n @ (c + np.asarray(p, float))), k))
    for i in range(K):
        f = ph0 + 2 * np.pi * i / K + rng.uniform(-0.25, 0.25); t = taper * rng.uniform(0.6, 1.5); r = R * rng.uniform(0.86, 1.08)
        add((np.cos(f), t, np.sin(f)), (np.cos(f) * r, 0, np.sin(f) * r), 0.03)
    rt = R - taper * Ht; dome = rng.uniform(*bev) / rt ** 2; tl = rng.uniform(-0.12, 0.12, 2)   # 둥근 머리: 꼭대기에서 둘레로 dome·r² 만큼 내려가는 면
    for i in range(5):   # 머리 둘레 비스듬한 깎기(넓은 면 몇 개)
        f = ph0 + 2 * np.pi * (i + 0.5) / 5 + rng.uniform(-0.25, 0.25); b = rng.uniform(0.9, 1.6)
        add((np.cos(f), b, np.sin(f)), (np.cos(f) * rt * 0.8, Ht - dome * (rt * 0.8) ** 2 - 0.02, np.sin(f) * rt * 0.8), 0.04)
    th = np.linspace(0, 2 * np.pi, 16, endpoint=False); hull = np.concatenate([np.stack([np.cos(th) * R, np.zeros(16), np.sin(th) * R], 1), np.stack([np.cos(th) * rt, np.full(16, Ht - dome * rt ** 2), np.sin(th) * rt], 1), [[0, Ht, 0]]])
    for _ in range(cuts):   # 깎인 면(아래를 보는 면 없이): 그쪽 가장 튀어나온 곳에서 조금 베어 낸다
        f = rng.uniform(0, 2 * np.pi); n = unit((np.cos(f), rng.uniform(0.05, 0.6), np.sin(f))); pl.append((n, float(np.max(hull @ n) + n @ c) - rng.uniform(0.05, 0.13), 0.015))
    def f(P):
        e = None
        for n, d, k in pl: v = P @ n - d; e = v if e is None else smax(e, v, k)
        q = P - c; rr = q[:, 0] ** 2 + q[:, 2] ** 2; top = (q[:, 1] - Ht - tl[0] * q[:, 0] - tl[1] * q[:, 2] + dome * rr) / np.sqrt(1 + 4 * dome ** 2 * rr)
        return smax(e, top, 0.04)
    return f

def pillar(lumps, seed, h, na=34, sp=0.046):   # 기둥: 다각 기둥 덩어리 2~3개(밑이 넓고 위로 조금 좁아짐, 머리는 둥글게 깎음)의 부드러운 합 — 세로 축에서 둘레로 광선, 위는 둥근 뚜껑, 밑은 평평하게 닫음
    n1, n2, n3, n4 = Noise3(seed + 1), Noise3(seed + 2), Noise3(seed + 3), Noise3(seed + 4)
    L = [column(*a, seed=seed * 10 + i, **k) for i, (a, k) in enumerate(lumps)]
    def sdf(P):
        d = L[0](P)
        for f in L[1:]: d = smin(d, f(P), 0.035)
        d = smax(d, Y0 - P[:, 1], 0.01)
        d = d + (n1(P * np.array([2.6, 1.0, 2.6]) + 5) - 0.5) * 0.035 + (n2(P * 7 + 11) - 0.5) * 0.016 + (n3(P * 13 + 3) - 0.5) * 0.006
        return d + (n4(P * np.array([2.5, 24, 2.5]) + 7) - 0.5) * 0.007
    # 축: 원점(밑동 가운데)의 세로선 — 옆은 수평 광선, 위 뚜껑은 꼭대기 점에서 위로 기울며
    ytop = h * 0.86; nside = int(np.ceil((ytop - Y0) / sp)) + 1; ncap = 14
    ys = np.linspace(Y0, ytop, nside); ph = np.linspace(0, 2 * np.pi, na, endpoint=False)
    ax = lambda y: np.stack([np.zeros_like(y), y, np.zeros_like(y)], -1)
    el = np.linspace(0, np.pi / 2, ncap + 1)[1:]
    rows_o = np.concatenate([ax(ys), np.repeat(ax(np.array([ytop])), ncap, 0)]); rows_e = np.concatenate([np.zeros(nside), el])
    O = np.repeat(rows_o[:, None], na, 1); D = np.stack([np.cos(rows_e)[:, None] * np.cos(ph)[None], np.repeat(np.sin(rows_e)[:, None], na, 1), np.cos(rows_e)[:, None] * np.sin(ph)[None]], -1)
    r = cast(sdf, O, D, 1.0, K=90)
    for j in range(1, nside): r[j] = np.minimum(r[j], r[j - 1] + 0.3 * (ys[j] - ys[j - 1]))   # 옆면: 위로 가며 바깥으로 나오지 않게(처마·목 없음)
    G = O + D * r[..., None]; nr = G.shape[0]
    G[-1] = G[-1].mean(0)   # 꼭대기는 한 점으로 모은다(모두 같은 곳)
    P = np.concatenate([G.reshape(-1, 3), [[ax(np.array([Y0]))[0][0], Y0, ax(np.array([Y0]))[0][2]]]]); bot = len(P) - 1
    F = []
    for j in range(nr - 1):
        for i in range(na):
            a = j * na + i; b = j * na + (i + 1) % na; c = a + na; d = b + na; F += [(a, c, b), (b, c, d)]
    for i in range(na): F.append((bot, i, (i + 1) % na))
    F = np.array(F); N = normals(P, F)
    ao = sdf_ao(sdf, P, N, 0.022); C = shade(P, F, N, ao, h, seed)
    return P, N, C, F

# 조각 목록(src/data/wallkit.js 와 같은 이름) — 높은 벽 넷은 윗선·덩어리 나뉨이 서로 다르게
#   B(x0, x1, H, yb=밑면(있으면 위에 얹힌 덩어리), zf=앞면 위치(밑), ...) — 같은 x 범위에 앞(낮게)·뒤(높게) 둘을 두면 한 단 물러난 층(턱)
#   양 끝 덩어리는 x = ±0.475 에서 끝난다(이웃 조각과의 틈 = 안쪽 틈과 같은 폭) · 맨 뒤 넓은 덩어리(core)는 틈 바닥을 막고 끝에서 둥글게 닫힌다
E = 0.475
def core(zb, H, zf=-0.15, seed=7): return Block(-0.75, 0.75, H, zf=zf, lean=0.06, tb=0.45, zb=zb, k=0.04, cuts=0, edge=0, top=3, bite=(0.03, 0.08), wob=0, seed=seed)   # 뒤 덩어리: 틈이 위에서 깊은 홈(성벽 같은 네모 홈)으로 안 보이게 높게

def tallA():   # 왼쪽 좁은 덩어리 + 오른쪽 넓은 덩어리(틈은 가운데에서 비켜서) · 오른쪽 앞에 낮은 어깨 덩어리가 붙어 턱
    zb = -0.5; B = lambda *a, **k: Block(*a, zb=zb, **k); return cliff([
        B(-E, -0.22, 1.42, zf=0.02, lean=0.09, yaw=0.03, tx=0.15, tb=0.45, syr=0.05, cuts=7, top=3, brow=(0.9, 0.06), ledges=[(0.6, 0.04, -0.6, -0.2)], seed=11),
        B(-0.17, E, 1.5, zf=-0.04, lean=0.08, yaw=-0.03, tx=-0.08, tb=0.45, syl=0.05, cuts=7, top=3, ledges=[(1.05, 0.035, 0.0, 0.4)], seed=13),
        B(-0.17, 0.3, 0.78, zf=0.04, lean=0.1, yaw=0.04, tx=0.2, syl=0.05, sr=0.5, cuts=6, top=3, seed=14),
        core(zb, 1.36)], 101, 1.5, zb)

def tallB():   # 왼쪽 높은 덩어리(오른쪽으로 기움) + 오른쪽은 앞 낮은 덩어리 뒤로 둘로 갈라진 높은 덩어리(T 자 틈)
    zb = -0.5; B = lambda *a, **k: Block(*a, zb=zb, **k); return cliff([
        B(-E, -0.15, 1.45, zf=0.0, lean=0.09, yaw=0.02, tx=0.15, tb=0.45, syr=0.06, cuts=7, brow=(1.0, 0.06), ledges=[(0.55, 0.04, -0.6, -0.1)], seed=21),
        B(-0.1, E, 0.9, zf=0.05, lean=0.08, yaw=-0.03, tx=-0.06, syl=-0.06, cuts=7, top=3, seed=22),
        B(-0.13, 0.2, 1.55, zf=-0.03, lean=0.07, tx=0.12, tb=0.45, syl=-0.06, syr=0.07, cuts=6, top=3, seed=23),
        B(0.26, E, 1.38, zf=-0.04, lean=0.07, tx=-0.15, tb=0.45, syl=0.06, cuts=6, seed=24),
        core(zb, 1.38)], 202, 1.55, zb)

def tallC():   # 계단진 윗선: 오른쪽 덩어리가 가장 높고 오른쪽으로 기울어 낮아짐 · 왼쪽은 턱 둘 · 밑에 떨어진 덩어리
    zb = -0.5; B = lambda *a, **k: Block(*a, zb=zb, **k); return cliff([
        B(-E, -0.05, 1.28, zf=0.01, lean=0.09, yaw=0.03, tx=-0.1, tb=0.45, syr=0.06, cuts=7, top=3, ledges=[(0.8, 0.05, -0.6, -0.05), (0.35, 0.03, -0.3, 0.0)], seed=31),
        B(0.0, E, 1.56, zf=-0.01, lean=0.1, yaw=-0.03, tx=0.25, tb=0.45, syl=0.05, cuts=8, top=3, brow=(0.8, 0.06), ledges=[(1.05, 0.04, 0.0, 0.3)], seed=32),
        B(-0.3, 0.06, 0.32, zf=0.09, lean=0.22, tb=0.6, k=0.03, cuts=4, edge=2, bite=(0.03, 0.08), seed=35),
        core(zb, 1.36)], 303, 1.56, zb)

def tallD():   # 층진 절벽: 앞은 한 칸 통째 낮은 덩어리(넓은 턱), 그 뒤로 갈라진 높은 덩어리 둘
    zb = -0.5; B = lambda *a, **k: Block(*a, zb=zb, **k); return cliff([
        B(-E, E, 0.74, zf=0.04, lean=0.08, yaw=0.02, tx=0.04, cuts=8, top=3, seed=41),
        B(-E, 0.09, 1.5, zf=-0.06, lean=0.06, tx=0.12, tb=0.45, syr=0.06, cuts=6, top=3, brow=(0.9, 0.06), seed=42),
        B(0.12, E, 1.36, zf=-0.04, lean=0.07, tx=-0.18, tb=0.45, syl=0.07, cuts=7, ledges=[(1.0, 0.04, 0.1, 0.6)], seed=43),
        core(zb, 1.34)], 404, 1.5, zb)

def midA():   # 덩어리 둘: 오른쪽은 앞 낮은 덩어리 뒤로 한 단 물러남
    zb = -0.4; B = lambda *a, **k: Block(*a, zb=zb, bite=(0.04, 0.1), **k); return cliff([
        B(-E, 0.13, 0.8, zf=0.03, lean=0.13, yaw=0.03, tx=0.18, tb=0.45, syr=0.08, cuts=7, brow=(1.0, 0.05), ledges=[(0.35, 0.03, -0.4, -0.1)], seed=51),
        B(0.18, E, 0.5, zf=0.04, lean=0.1, yaw=-0.03, tx=-0.06, syl=0.07, cuts=6, seed=52),
        B(0.18, E, 0.86, zf=-0.04, lean=0.12, tx=-0.16, tb=0.45, syl=0.08, cuts=6, top=3, seed=53),
        core(zb, 0.76, -0.13)], 505, 0.86, zb, sp=0.042)

def midB():   # 앞은 한 칸 통째 낮은 덩어리, 그 뒤로 갈라진 덩어리 둘
    zb = -0.4; B = lambda *a, **k: Block(*a, zb=zb, bite=(0.04, 0.1), **k); return cliff([
        B(-E, E, 0.46, zf=0.04, lean=0.1, yaw=-0.02, tx=0.05, cuts=8, top=3, seed=61),
        B(-E, -0.1, 0.85, zf=-0.04, lean=0.12, tx=-0.16, tb=0.45, syr=0.08, cuts=6, brow=(0.9, 0.05), seed=62),
        B(-0.06, E, 0.78, zf=-0.03, lean=0.12, tx=0.15, tb=0.45, syl=0.08, cuts=7, seed=63),
        core(zb, 0.76, -0.13)], 606, 0.86, zb, sp=0.042)

def lowA():   # 낮은 바위 둔덕: 앞이 많이 눕고 위가 둥근 덩어리 둘 + 앞에 낮은 덩어리 · 이음매는 좁게
    zb = -0.3; e = 0.485; B = lambda *a, **k: Block(*a, **{'zb': zb, 'k': 0.045, 'tb': 0.6, 'bite': (0.03, 0.08), 'wob': 0.08, 'top': 3, 'sl': 0.3, 'sr': 0.3, **k}); return cliff([
        B(-e, -0.13, 0.37, zf=0.05, lean=0.32, yaw=0.04, tx=0.15, syr=0.12, cuts=6, edge=2, seed=71),
        B(-0.1, e, 0.43, zf=0.02, lean=0.28, yaw=-0.03, tx=-0.1, syl=0.12, cuts=7, edge=2, seed=72),
        B(0.02, 0.3, 0.24, zf=0.08, lean=0.4, tb=0.7, sr=0.6, sl=0.6, cuts=4, edge=2, seed=74),
        core(zb, 0.36, -0.12)], 707, 0.43, zb, sp=0.032, ey=0.2, rub=7, rub_s=(0.05, 0.11), amp=0.7, sa=0.7)

def lowB():   # 낮은 바위 둔덕: 덩어리 셋, 가운데가 앞으로 · 오른쪽이 조금 높음
    zb = -0.3; e = 0.485; B = lambda *a, **k: Block(*a, **{'zb': zb, 'k': 0.045, 'tb': 0.6, 'bite': (0.03, 0.08), 'wob': 0.08, 'top': 3, 'sl': 0.3, 'sr': 0.3, **k}); return cliff([
        B(-e, -0.17, 0.38, zf=0.03, lean=0.3, tx=-0.12, syr=0.1, cuts=6, edge=2, seed=81),
        B(-0.15, 0.2, 0.33, zf=0.07, lean=0.36, yaw=0.06, tx=0.12, syl=0.1, syr=0.12, cuts=6, edge=2, seed=82),
        B(0.17, e, 0.42, zf=0.02, lean=0.28, tx=0.08, syl=0.1, cuts=7, edge=2, seed=83),
        core(zb, 0.36, -0.12)], 808, 0.42, zb, sp=0.032, ey=0.2, rub=7, rub_s=(0.05, 0.11), amp=0.7, sa=0.7)

def pillarA():   # 큰 기둥 + 옆에 붙은 낮은 덩어리 + 뒤에 붙은 중간 덩어리
    return pillar([(((0, 0), 0.36, 1.6, 0.07), {}), (((-0.25, 0.16), 0.21, 0.74, 0.1), dict(K=6)), (((0.18, -0.17), 0.23, 1.12, 0.08), dict(K=6))], 901, 1.6)

def pillarB():   # 기둥 + 옆에 붙은 중간 덩어리(조금 기울어진 머리)
    return pillar([(((0, 0), 0.35, 1.62, 0.06), dict(K=8)), (((0.22, 0.13), 0.24, 1.0, 0.09), dict(K=6, bev=(0.2, 0.3)))], 911, 1.62)

KIT = {   # 이름: (만드는 법, 종류, 이름표) — src/data/wallkit.js 는 이 목록과 실제 높이로 만든다
    'cliffTallA': (tallA, 'tall', '높은 벽 A'), 'cliffTallB': (tallB, 'tall', '높은 벽 B(넓은 턱)'), 'cliffTallC': (tallC, 'tall', '높은 벽 C(계단 윗선)'), 'cliffTallD': (tallD, 'tall', '높은 벽 D(층진 절벽)'),
    'cliffMidA': (midA, 'mid', '중간 벽 A'), 'cliffMidB': (midB, 'mid', '중간 벽 B'), 'cliffLowA': (lowA, 'low', '낮은 벽 A'), 'cliffLowB': (lowB, 'low', '낮은 벽 B'),
    'cliffPillarA': (pillarA, 'pillar', '바위 기둥 A'), 'cliffPillarB': (pillarB, 'pillar', '바위 기둥 B')}
WALLKIT_JS = os.path.join(os.path.dirname(OUT), '..', 'src', 'data', 'wallkit.js')

def write_kit_js(hs):   # src/data/wallkit.js: 종류 · 실제 높이(최대 y) · 이름표
    L = ['// 벽 키트(assets/rocks/이름.glb — tools/walls/make_walls.py 가 만들고 이 파일도 그때 다시 쓴다): 방 둘레(벽 밑선)를 따라 이어 붙이고 휘는 바위 벽 조각',
         '//   한 칸: x -0.5~0.5(±0.62 까지 겹침) · y 위(0 = 바닥) · +z 방 안쪽(앞면). 게임에서 x·z 에 칸 길이(기본 230)를 곱하고, y 는 목표 높이 / (h · 칸 길이) 로 늘이거나 줄인다',
         '//   kind: tall(먼 쪽 높은 벽) · mid(옆 벽 중간) · low(낮은 벽·벽 끝) · pillar(굴 입구 양옆·모서리에 통째로 세우는 기둥, 원점 = 밑동 가운데, 지름 약 0.75) · h: 실제 높이(최대 y)',
         'export const WALL_KIT = {']
    for name, (_, kind, label) in KIT.items(): L.append(f"  {name}: {{ kind: '{kind}', h: {hs[name]:.3f}, label: '{label}' }},")
    open(WALLKIT_JS, 'w').write('\n'.join(L + ['};', '']))

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); only = sys.argv[1:]; hs = {}
    for name, (make, kind, label) in KIT.items():
        if only and name not in only: continue
        P, N, C, F = make(); path = os.path.join(OUT, name + '.glb'); write_glb(path, P, N, C, F); hs[name] = float(P[:, 1].max())
        print(name, len(P), 'verts', len(F), 'tris', 'h=%.3f' % P[:, 1].max(), 'x=%.2f~%.2f' % (P[:, 0].min(), P[:, 0].max()), 'z=%.2f~%.2f' % (P[:, 2].min(), P[:, 2].max()), os.path.getsize(path) // 1024, 'KB')
    if len(hs) == len(KIT): write_kit_js(hs); print('->', os.path.normpath(WALLKIT_JS))
    else: print('(일부만 만들어서 wallkit.js 는 그대로)')
