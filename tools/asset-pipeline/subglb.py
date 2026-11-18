# 원본 GLB에서 면 목록(npz)만 떼어 GLB로 (줄이기 입력용): 같은 자리 정점을 하나로 합치고 UV는 버린다(이음선 때문에 덜 줄어드는 것 방지)
import sys, numpy as np
src = open(__file__.replace('subglb.py', 'bake.py'), encoding='utf-8').read().rsplit('\nmain()', 1)[0]; exec(src)
m = load_mesh(sys.argv[1]); F = m['F'][np.load(sys.argv[2])['faces']]
q = np.round(m['P'] / 1e-5).astype(np.int64); _, wid = np.unique(q, axis=0, return_inverse=True); wid = wid.ravel(); F = wid[F]
F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
used, inv = np.unique(F, return_inverse=True); P = np.zeros((wid.max() + 1, 3)); P[wid] = m['P']; P = P[used]; F2 = inv.reshape(-1, 3)
N = np.zeros_like(P); fn = np.cross(P[F2[:, 1]] - P[F2[:, 0]], P[F2[:, 2]] - P[F2[:, 0]])
for k in range(3): np.add.at(N, F2[:, k], fn)
N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
write_glb(sys.argv[3], P, N, np.zeros((len(P), 2)), F2); print('면', len(F2), '정점', len(P))
