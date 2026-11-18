# 한 장에 여러 소품이 든 Tripo GLB → 떨어진 덩어리끼리 묶어 소품별로 나누기
# 사용: python split.py 원본.glb 출력폴더 [틈]   → 덩어리 목록(번호·면 수·범위) + 출력폴더/partN.npz (원본 면 번호)
import sys, numpy as np
src = open(__file__.replace('split.py', 'bake.py'), encoding='utf-8').read().rsplit('\nmain()', 1)[0]; exec(src)

def components(P, F):
    q = np.round(P / 1e-5).astype(np.int64); _, inv = np.unique(q, axis=0, return_inverse=True); inv = inv.ravel()   # 같은 자리 정점 하나로
    G = inv[F]; par = np.arange(inv.max() + 1)
    def find(a):
        r = a
        while par[r] != r: r = par[r]
        while par[a] != r: par[a], a = r, par[a]
        return r
    # 면의 세 정점을 잇는다(빠르게: 반복 축약)
    e = np.concatenate([G[:, [0, 1]], G[:, [1, 2]]])
    lab = np.arange(par.size)
    while True:
        a, b = lab[e[:, 0]], lab[e[:, 1]]; m = np.minimum(a, b)
        new = lab.copy(); np.minimum.at(new, e[:, 0], m); np.minimum.at(new, e[:, 1], m); new = new[new]
        if (new == lab).all(): break
        lab = new
    return lab[G[:, 0]]

def main2():
    hi_p, out, gap = sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 0.006
    import os; os.makedirs(out, exist_ok=True)
    m = load_mesh(hi_p); P, F = m['P'], m['F']; fl = components(P, F); ids, cnt = np.unique(fl, return_counts=True)
    A, B, C = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]; lo = np.minimum(np.minimum(A, B), C); hi = np.maximum(np.maximum(A, B), C)
    bb = {}
    for i in ids: s = fl == i; bb[i] = [lo[s].min(0), hi[s].max(0)]
    # 상자가 (틈 만큼 키워) 겹치는 덩어리끼리 묶기
    grp = {i: {i} for i in ids}; box = {i: bb[i] for i in ids}; changed = True
    while changed:
        changed = False; keys = list(grp)
        for a_ in range(len(keys)):
            for b_ in range(a_ + 1, len(keys)):
                a, b = keys[a_], keys[b_]
                if a not in grp or b not in grp: continue
                la, ha = box[a]; lb, hb = box[b]
                if np.all(la - gap <= hb) and np.all(lb - gap <= ha):
                    grp[a] |= grp.pop(b); box[a] = [np.minimum(la, lb), np.maximum(ha, hb)]; changed = True
    res = sorted(grp, key=lambda k: -sum(cnt[np.searchsorted(ids, list(grp[k]))]))
    for n, k in enumerate(res):
        faces = np.where(np.isin(fl, list(grp[k])))[0]; l, h = box[k]
        print(f'part{n}: 면 {len(faces)}  가운데 x={((l[0]+h[0])/2):.3f} z={((l[2]+h[2])/2):.3f}  크기 {np.round(h-l,3)}')
        np.savez(f'{out}/part{n}.npz', faces=faces, lo=l, hi=h)

main2()
