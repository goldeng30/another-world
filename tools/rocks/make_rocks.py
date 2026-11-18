# 바위 에셋: assets/rocks/이름.glb (모양 + 꼭짓점 색: 밑동·틈 어둡게) — 질감은 게임에서 방의 바위 질감(삼면 투영)으로 입힌다
#   크기는 가로 지름 1(높이는 모양마다), 바닥은 y=0 에서 조금 묻힌 채로. 방 데이터에서 { rock: '이름', at, s } 로 배치
#   다시 만들려면: python3 tools/rocks/make_rocks.py
import numpy as np, json, struct, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets/rocks')

def icosphere(level):
    t = (1 + 5 ** 0.5) / 2
    V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    V = [np.array(v, float) / np.linalg.norm(v) for v in V]
    for _ in range(level):
        cache = {}; NF = []
        def mid(a, b):
            k = (min(a, b), max(a, b))
            if k not in cache: m = (V[a] + V[b]) / 2; V.append(m / np.linalg.norm(m)); cache[k] = len(V) - 1
            return cache[k]
        for a, b, c in F:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a); NF += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        F = NF
    return np.array(V), np.array(F, np.int64)

class Noise3:
    def __init__(s, seed): s.G = np.random.default_rng(seed).random((32, 32, 32))
    def __call__(s, p):
        i = np.floor(p).astype(int); f = p - i; f = f * f * (3 - 2 * f); G = s.G
        def g(dx, dy, dz): return G[(i[:, 0] + dx) % 32, (i[:, 1] + dy) % 32, (i[:, 2] + dz) % 32]
        x00 = g(0, 0, 0) * (1 - f[:, 0]) + g(1, 0, 0) * f[:, 0]; x10 = g(0, 1, 0) * (1 - f[:, 0]) + g(1, 1, 0) * f[:, 0]
        x01 = g(0, 0, 1) * (1 - f[:, 0]) + g(1, 0, 1) * f[:, 0]; x11 = g(0, 1, 1) * (1 - f[:, 0]) + g(1, 1, 1) * f[:, 0]
        y0 = x00 * (1 - f[:, 1]) + x10 * f[:, 1]; y1 = x01 * (1 - f[:, 1]) + x11 * f[:, 1]
        return y0 * (1 - f[:, 2]) + y1 * f[:, 2]

def normals(P, F):
    N = np.zeros_like(P); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(N, F[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)

def rock(seed, level=4, scale=(1, 0.7, 0.9), cuts=8, cut_off=(0.55, 0.85), cut_up=0.0, flat_top=None, disp=0.06, fine=0.018, strata=0.0, bottom=-0.25):
    rng = np.random.default_rng(seed); P, F = icosphere(level); P = P * np.array(scale)
    n1, n2, n3 = Noise3(seed + 1), Noise3(seed + 2), Noise3(seed + 3)
    P = P * (1 + (n1(P * 1.6 + 5) - 0.5) * 0.35)[:, None]   # 큰 덩어리 뒤틀기
    for _ in range(cuts):   # 평면으로 깎아 면을 세운다
        n = rng.normal(size=3); n[1] *= (1 - cut_up); n /= np.linalg.norm(n)
        d = np.max(P @ n) * rng.uniform(*cut_off); over = P @ n - d
        P = P - np.clip(over, 0, None)[:, None] * n
    if flat_top is not None:   # 윗면 기울어진 평면
        n = np.array([rng.normal(0, 0.25), 1, rng.normal(0, 0.25)]); n /= np.linalg.norm(n); d = np.max(P @ n) * flat_top
        P = P - np.clip(P @ n - d, 0, None)[:, None] * n
    N = normals(P, F)
    D = (n2(P * 2.6 + 11) - 0.5) * disp + (n3(P * 9 + 3) - 0.5) * fine
    if strata > 0: D += np.sin(P[:, 1] * 30 + n1(P * 3) * 4) * strata   # 결(층)
    P = P + N * D[:, None]
    P[:, 1] = np.maximum(P[:, 1], bottom * scale[1])   # 바닥 평평
    return P, F

def finish(P, F, sink=0.07, seed=0):
    P = P.copy(); P[:, 1] -= P[:, 1].min(); w = max(np.ptp(P[:, 0]), np.ptp(P[:, 2])); P[:, 0] -= (P[:, 0].max() + P[:, 0].min()) / 2; P[:, 2] -= (P[:, 2].max() + P[:, 2].min()) / 2
    P /= w; H = P[:, 1].max(); P[:, 1] -= H * sink
    N = normals(P, F)
    # 꼭짓점 색: 밑동 어둡게 + 오목한 틈 어둡게 + 위를 보는 면 살짝 밝게(먼지)
    nb = np.zeros_like(P); cnt = np.zeros(len(P))
    for a, b in ((0, 1), (1, 2), (2, 0)):
        np.add.at(nb, F[:, a], P[F[:, b]]); np.add.at(cnt, F[:, a], 1); np.add.at(nb, F[:, b], P[F[:, a]]); np.add.at(cnt, F[:, b], 1)
    lap = nb / cnt[:, None] - P; cav = np.clip((lap * N).sum(1) * 60, -1, 1)   # + 오목
    y = P[:, 1] + H * sink
    ao = 0.42 + 0.58 * np.clip(y / (0.38 * H + 1e-6), 0, 1) ** 0.7
    c = ao * (1 - 0.35 * np.clip(cav, 0, 1)) * (1 + 0.12 * np.clip(N[:, 1], 0, 1) ** 3)
    rng = np.random.default_rng(seed); tint = np.array([1, 0.97 + rng.random() * 0.04, 0.92 + rng.random() * 0.06])
    C = np.clip(c[:, None] * tint, 0, 1.2)
    return P, N, C, F

def merge(parts):
    P, N, C, F, off = [], [], [], [], 0
    for p, n, c, f in parts: P.append(p); N.append(n); C.append(c); F.append(f + off); off += len(p)
    return np.vstack(P), np.vstack(N), np.vstack(C), np.vstack(F)

def pile(seed, n=7, level=3):   # 돌무더기: 작은 바위 여러 개
    rng = np.random.default_rng(seed); parts = []
    for i in range(n):
        s = 0.55 if i == 0 else rng.uniform(0.22, 0.42)
        P, F = rock(seed * 10 + i, level=level, scale=(1, rng.uniform(0.55, 0.8), rng.uniform(0.75, 1)), cuts=rng.integers(5, 9), disp=0.05)
        P, N, C, F = finish(P, F, 0.05, seed * 10 + i); P *= s
        a = rng.random() * 6.28; r = 0 if i == 0 else rng.uniform(0.25, 0.55); rot = rng.random() * 6.28
        R = np.array([[np.cos(rot), 0, np.sin(rot)], [0, 1, 0], [-np.sin(rot), 0, np.cos(rot)]]); P = P @ R.T; N = N @ R.T
        P += np.array([np.cos(a) * r, -0.02 * s, np.sin(a) * r]); parts.append((P, N, C, F))
    P, N, C, F = merge(parts); w = max(np.ptp(P[:, 0]), np.ptp(P[:, 2])); P[:, 0] -= (P[:, 0].max() + P[:, 0].min()) / 2; P[:, 2] -= (P[:, 2].max() + P[:, 2].min()) / 2; P /= w
    return P, N, C, F

def moss(P, N, amt, seed, low=0.15):   # 이끼 양(꼭짓점): 위를 보는 면 + 얼룩(잡음) — 게임에서 이끼 질감을 이 만큼 덮는다
    n1, n2 = Noise3(seed + 7), Noise3(seed + 8); up = np.clip(N[:, 1], 0, 1)
    patch = np.clip((n1(P * 4 + 3) - 0.28) * 3.0, 0, 1) * (0.7 + 0.3 * n2(P * 11 + 5))
    side = np.clip(1 - P[:, 1] / (P[:, 1].max() * 0.35 + 1e-6), 0, 1) * 0.35   # 밑동 쪽 옆면에도 조금
    return np.clip((np.clip((up - low) / 0.45, 0, 1) + side) * patch * amt, 0, 1)

def write_glb(path, P, N, C, F, M=None):
    P = P.astype('<f4'); N = N.astype('<f4'); C = np.clip(C, 0, 1).astype('<f4'); I = F.astype('<u2' if len(P) < 65536 else '<u4').ravel()
    blobs, views, acc = [], [], []; off = 0
    def add(arr, target, comp, typ, cnt, mm=None):
        nonlocal off; b = arr.tobytes(); pad = (-len(b)) % 4; blobs.append(b + b'\0' * pad)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b), 'target': target}); a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': cnt, 'type': typ}
        if mm: a['min'], a['max'] = mm
        acc.append(a); off += len(b) + pad
    add(P, 34962, 5126, 'VEC3', len(P), ([float(v) for v in P.min(0)], [float(v) for v in P.max(0)]))
    add(N, 34962, 5126, 'VEC3', len(N)); add(C, 34962, 5126, 'VEC3', len(C))
    attrs = {'POSITION': 0, 'NORMAL': 1, 'COLOR_0': 2}
    if M is not None: add(M.astype('<f4'), 34962, 5126, 'SCALAR', len(M)); attrs['_MOSS'] = len(acc) - 1   # 이끼 양(게임에선 _moss)
    add(I, 34963, 5123 if I.dtype == np.dtype('<u2') else 5125, 'SCALAR', len(I))
    js = {'asset': {'version': '2.0', 'generator': 'make_rocks.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': os.path.basename(path)[:-4]}],
          'meshes': [{'primitives': [{'attributes': attrs, 'indices': len(acc) - 1}]}], 'buffers': [{'byteLength': off}], 'bufferViews': views, 'accessors': acc}
    jb = json.dumps(js, separators=(',', ':')).encode(); jb += b' ' * ((-len(jb)) % 4); bb = b''.join(blobs)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(bb))); f.write(struct.pack('<II', len(jb), 0x4E4F534A)); f.write(jb); f.write(struct.pack('<II', len(bb), 0x004E4942)); f.write(bb)

def stalactite(seed, length=3.4, segs=22, rings=30, bulges=3, twins=0):   # 매달린 돌(종유석): 원점 = 윗면(천장·벽 위에 붙는 곳), 아래로 뾰족. 윗부분은 어둡게(어둠 속으로 사라짐)
    rng = np.random.default_rng(seed); n1, n2 = Noise3(seed + 1), Noise3(seed + 2); parts = []
    for k in range(1 + twins):
        L = length * (1 if k == 0 else rng.uniform(0.35, 0.6)); r0 = 0.5 if k == 0 else rng.uniform(0.18, 0.28)
        ox, oz = (0, 0) if k == 0 else (np.cos(a := rng.uniform(0, 6.28)) * rng.uniform(0.25, 0.4), np.sin(a) * rng.uniform(0.25, 0.4))
        bt = rng.uniform(0.2, 0.75, bulges); bw = rng.uniform(0.04, 0.09, bulges); ba = rng.uniform(0.08, 0.18, bulges)
        P = []; F = []
        for i in range(rings + 1):
            t = i / rings; y = -t * L
            r = r0 * (1 - t) ** 0.85 * (1 + sum(ba[j] * np.exp(-((t - bt[j]) / bw[j]) ** 2) for j in range(bulges)))   # 아래로 가늘어지며 방울진 마디
            for j in range(segs):
                th = j / segs * 6.2832; p = np.array([np.cos(th), 0, np.sin(th)])
                q = np.array([[p[0] * 2 + 3, t * 4, p[2] * 2 + 7]]); rr = r * (1 + (n1(q)[0] - 0.5) * 0.45 + (n2(q * 3)[0] - 0.5) * 0.15)
                P.append([ox + p[0] * rr, y, oz + p[2] * rr])
        for i in range(rings):
            for j in range(segs):
                a0 = i * segs + j; a1 = i * segs + (j + 1) % segs; b0 = a0 + segs; b1 = a1 + segs; F += [(a0, b0, a1), (a1, b0, b1)]
        tip = len(P); P.append([ox, -L * 1.02, oz]); top = len(P); P.append([ox, 0.02, oz])
        for j in range(segs): F.append((rings * segs + j, tip, rings * segs + (j + 1) % segs)); F.append((top, j, (j + 1) % segs))
        P = np.array(P); F = np.array(F); N = normals(P, F)
        t = np.clip(-P[:, 1] / L, 0, 1); cav = (n2(P * 6 + 2) - 0.5)
        c = (0.12 + 0.88 * np.clip(t / 0.5, 0, 1) ** 1.3) * (0.85 + 0.3 * cav)   # 위쪽은 거의 검게
        parts.append((P, N, np.repeat(np.clip(c, 0, 1.1)[:, None], 3, 1) * np.array([1, 0.97, 0.93]), F))
    P, N, C, F = merge(parts); w = max(np.ptp(P[:, 0]), np.ptp(P[:, 2])); P /= w   # 가로 지름 1 기준
    return P, N, C, F

def mossy(make, amt, seed):   # 이끼 바위: 모양 + 이끼 양
    P, N, C, F = make(); return P, N, C, F, moss(P, N, amt, seed)

KIT = {   # 이름: 만드는 법 (src/data/rocks.js 와 같은 이름)
    # 매달린 돌(종유석): 원점이 윗면 — 벽 위·천장에 매단다
    'stalacA': lambda: stalactite(401, length=3.6, bulges=3),
    'stalacB': lambda: stalactite(409, length=2.6, bulges=2),
    'stalacC': lambda: stalactite(419, length=3.2, bulges=3, twins=2),
    'stalacD': lambda: stalactite(431, length=4.4, bulges=4, twins=1),
    # 이끼 낀 바위(이끼 양을 함께 담음 — 어느 방이든 이끼가 덮인다)
    'mossA': lambda: mossy(lambda: finish(*rock(301, scale=(1, 0.7, 0.9), cuts=9, flat_top=0.75), seed=301), 1.0, 301),
    'mossB': lambda: mossy(lambda: finish(*rock(313, scale=(1.15, 0.38, 0.95), cuts=8, cut_up=0.6, flat_top=0.78, strata=0.006), seed=313), 1.0, 313),
    'mossC': lambda: mossy(lambda: finish(*rock(327, scale=(1, 0.55, 0.85), cuts=5, disp=0.08), seed=327), 1.2, 327),
    'mossD': lambda: mossy(lambda: finish(*rock(331, scale=(0.9, 1.0, 0.85), cuts=10, cut_off=(0.5, 0.82)), seed=331), 0.9, 331),
    'boulderA': lambda: finish(*rock(11, scale=(1, 0.75, 0.9), cuts=9), seed=11),
    'boulderB': lambda: finish(*rock(23, scale=(1, 0.6, 0.85), cuts=8, flat_top=0.7, strata=0.008), seed=23),
    'boulderC': lambda: finish(*rock(37, scale=(1, 0.9, 0.95), cuts=11, cut_off=(0.5, 0.8)), seed=37),
    'slabA': lambda: finish(*rock(41, scale=(1.2, 0.3, 0.9), cuts=7, cut_up=0.7, flat_top=0.75, disp=0.04), seed=41),
    'slabB': lambda: finish(*rock(53, scale=(1.1, 0.25, 1.0), cuts=8, cut_up=0.8, flat_top=0.8, disp=0.035, strata=0.006), seed=53),
    'spireA': lambda: finish(*rock(61, scale=(0.5, 1.5, 0.45), cuts=9, cut_up=0.85, cut_off=(0.6, 0.9), flat_top=0.82, strata=0.01), seed=61),
    'pileA': lambda: pile(71, 7),
    'pileB': lambda: pile(83, 10),
    # 자잘한 돌(흩뿌리기용, 가벼운 모양): 둥근 돌 4 · 모난 돌 4 — 방 데이터 stones 가 이걸 여러 개 깔아 무더기를 만든다
    'pebbleA': lambda: finish(*rock(201, level=2, scale=(1, 0.6, 0.8), cuts=2, disp=0.05, fine=0), sink=0.12, seed=201),
    'pebbleB': lambda: finish(*rock(203, level=2, scale=(1, 0.5, 0.9), cuts=3, disp=0.06, fine=0), sink=0.12, seed=203),
    'pebbleC': lambda: finish(*rock(205, level=2, scale=(1, 0.7, 0.75), cuts=2, disp=0.05, fine=0), sink=0.12, seed=205),
    'pebbleD': lambda: finish(*rock(207, level=1, scale=(1, 0.55, 0.85), cuts=1, disp=0.04, fine=0), sink=0.12, seed=207),
    'stoneA': lambda: finish(*rock(211, level=2, scale=(1, 0.7, 0.8), cuts=7, disp=0.03, fine=0), sink=0.1, seed=211),
    'stoneB': lambda: finish(*rock(213, level=2, scale=(1, 0.45, 0.9), cuts=6, flat_top=0.7, disp=0.03, fine=0), sink=0.1, seed=213),
    'stoneC': lambda: finish(*rock(215, level=2, scale=(0.8, 0.8, 1), cuts=8, disp=0.03, fine=0), sink=0.1, seed=215),
    'stoneD': lambda: finish(*rock(217, level=1, scale=(1, 0.6, 0.8), cuts=5, disp=0.02, fine=0), sink=0.1, seed=217),
    'chunkA': lambda: finish(*rock(91, level=3, scale=(1, 0.65, 0.8), cuts=7, disp=0.05), seed=91),
    'chunkB': lambda: finish(*rock(97, level=3, scale=(1, 0.5, 0.9), cuts=6, flat_top=0.7, disp=0.05), seed=97),
}

# 가벼운 판(_lo): 경계 바위처럼 멀거나 벽 뒤에 반쯤 묻히는 자리용 — 같은 모양을 덜 촘촘하게(삼각형 1/4)
KIT.update({
    'boulderA_lo': lambda: finish(*rock(11, level=3, scale=(1, 0.75, 0.9), cuts=9), seed=11),
    'boulderB_lo': lambda: finish(*rock(23, level=3, scale=(1, 0.6, 0.85), cuts=8, flat_top=0.7, strata=0.008), seed=23),
    'boulderC_lo': lambda: finish(*rock(37, level=3, scale=(1, 0.9, 0.95), cuts=11, cut_off=(0.5, 0.8)), seed=37),
    'slabA_lo': lambda: finish(*rock(41, level=3, scale=(1.2, 0.3, 0.9), cuts=7, cut_up=0.7, flat_top=0.75, disp=0.04), seed=41),
    'slabB_lo': lambda: finish(*rock(53, level=3, scale=(1.1, 0.25, 1.0), cuts=8, cut_up=0.8, flat_top=0.8, disp=0.035, strata=0.006), seed=53),
    'spireA_lo': lambda: finish(*rock(61, level=3, scale=(0.5, 1.5, 0.45), cuts=9, cut_up=0.85, cut_off=(0.6, 0.9), flat_top=0.82, strata=0.01), seed=61),
    'pileA_lo': lambda: pile(71, 7, level=2),
    'pileB_lo': lambda: pile(83, 10, level=2),
})

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, make in KIT.items():
        r = make(); write_glb(os.path.join(OUT, name + '.glb'), *r); P, F = r[0], r[3]
        print(name, len(P), 'verts', len(F), 'tris', 'h=%.2f' % P[:, 1].max(), os.path.getsize(os.path.join(OUT, name + '.glb')) // 1024, 'KB')
