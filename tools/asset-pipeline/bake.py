# Tripo 고해상도 GLB → 게임용 소품: 줄인 메시(새 UV) + 원본에서 옮겨 그린 색·노멀(물체 기준) 질감
# 사용: python bake.py 원본.glb 줄인.glb 출력이름 [질감크기] [면목록.npz]
import sys, json, struct, io
import numpy as np, xatlas
from PIL import Image
from scipy.spatial import cKDTree

def read_glb(path):
    b = open(path, 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + jl]); off = 20 + jl; bl = struct.unpack_from('<I', b, off)[0]; bin_ = b[off + 8: off + 8 + bl]
    CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]
        start = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
        if stride and stride != isz:
            raw = np.frombuffer(bin_, dtype=np.uint8, count=stride * a['count'], offset=start).reshape(a['count'], stride)[:, :isz]
            return np.frombuffer(raw.tobytes(), dtype=dt).reshape(a['count'], n)
        return np.frombuffer(bin_, dtype=dt, count=a['count'] * n, offset=start).reshape(a['count'], n)
    def img(i):
        im = j['images'][i]; bv = j['bufferViews'][im['bufferView']]; s = bv.get('byteOffset', 0)
        return Image.open(io.BytesIO(bin_[s:s + bv['byteLength']])).convert('RGB')
    return j, acc, img

def load_mesh(path, with_tex=False):
    j, acc, img = read_glb(path); P, N, U, I = [], [], [], []; base = 0
    for m in j['meshes']:
        for pr in m['primitives']:
            p = acc(pr['attributes']['POSITION']).astype(np.float64); P.append(p)
            N.append(acc(pr['attributes']['NORMAL']).astype(np.float64) if 'NORMAL' in pr['attributes'] else np.zeros_like(p))
            U.append(acc(pr['attributes']['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in pr['attributes'] else np.zeros((len(p), 2)))
            I.append(acc(pr['indices']).reshape(-1, 3).astype(np.int64) + base); base += len(p)
    out = dict(P=np.concatenate(P), N=np.concatenate(N), U=np.concatenate(U), F=np.concatenate(I))
    if with_tex:
        mat = j['materials'][0]; tex = lambda k: j['textures'][k['index']]['source']
        pbr = mat.get('pbrMetallicRoughness', {})
        out['base'] = np.asarray(img(tex(pbr['baseColorTexture'])), dtype=np.float32) / 255.0
        out['nrm'] = np.asarray(img(tex(mat['normalTexture'])), dtype=np.float32) / 255.0 if 'normalTexture' in mat else None
    return out

def sample(im, uv):   # 쌍선형 표본(glTF: u 오른쪽, v 아래로, 바둑판 반복)
    H, W = im.shape[:2]; x = (uv[:, 0] % 1.0) * W - 0.5; y = (uv[:, 1] % 1.0) * H - 0.5
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    g = lambda yy, xx: im[yy % H, xx % W]
    return (g(y0, x0) * (1 - fx) + g(y0, x0 + 1) * fx) * (1 - fy) + (g(y0 + 1, x0) * (1 - fx) + g(y0 + 1, x0 + 1) * fx) * fy

def closest_on_tri(p, a, b, c):   # 점 p에서 삼각형 abc 위 가장 가까운 점의 무게중심 좌표 (벡터화)
    ab = b - a; ac = c - a; ap = p - a
    d1 = (ab * ap).sum(-1); d2 = (ac * ap).sum(-1); bp = p - b; d3 = (ab * bp).sum(-1); d4 = (ac * bp).sum(-1)
    cp = p - c; d5 = (ab * cp).sum(-1); d6 = (ac * cp).sum(-1)
    va = d3 * d6 - d5 * d4; vb = d5 * d2 - d1 * d6; vc = d1 * d4 - d3 * d2
    den = va + vb + vc; den = np.where(np.abs(den) < 1e-20, 1e-20, den); v = vb / den; w = vc / den; u = 1 - v - w
    bc = np.stack([u, v, w], -1)
    # 바깥쪽 영역(꼭짓점·모서리)
    def setw(mask, val):
        bc[mask] = val[mask] if val.ndim > 1 else val
    m = (d1 <= 0) & (d2 <= 0); setw(m, np.array([1., 0, 0]))
    m2 = (d3 >= 0) & (d4 <= d3) & ~m; setw(m2, np.array([0., 1, 0])); m |= m2
    m2 = (d6 >= 0) & (d5 <= d6) & ~m; setw(m2, np.array([0., 0, 1])); m |= m2
    t = d1 / np.where(np.abs(d1 - d3) < 1e-20, 1e-20, d1 - d3); m2 = (vc <= 0) & (d1 >= 0) & (d3 <= 0) & ~m; setw(m2, np.stack([1 - t, t, 0 * t], -1)); m |= m2
    t = d2 / np.where(np.abs(d2 - d6) < 1e-20, 1e-20, d2 - d6); m2 = (vb <= 0) & (d2 >= 0) & (d6 <= 0) & ~m; setw(m2, np.stack([1 - t, 0 * t, t], -1)); m |= m2
    t = (d4 - d3) / np.where(np.abs((d4 - d3) + (d5 - d6)) < 1e-20, 1e-20, (d4 - d3) + (d5 - d6)); m2 = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0) & ~m; setw(m2, np.stack([0 * t, 1 - t, t], -1))
    q = a * bc[..., 0:1] + b * bc[..., 1:2] + c * bc[..., 2:3]
    return bc, q

def write_glb(path, P, N, UV, F):
    P = P.astype(np.float32); N = N.astype(np.float32); UV = UV.astype(np.float32)
    idx = F.astype(np.uint16 if len(P) < 65536 else np.uint32).reshape(-1)
    parts = [P.tobytes(), N.tobytes(), UV.tobytes(), idx.tobytes()]; offs = []; buf = b''
    for p in parts:
        offs.append(len(buf)); buf += p + b'\0' * ((4 - len(p) % 4) % 4)
    j = {'asset': {'version': '2.0', 'generator': 'isekai bake'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
         'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
         'materials': [{'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.85}}],
         'buffers': [{'byteLength': len(buf)}],
         'bufferViews': [{'buffer': 0, 'byteOffset': offs[i], 'byteLength': len(parts[i]), **({'target': 34963} if i == 3 else {'target': 34962})} for i in range(4)],
         'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()},
                       {'bufferView': 1, 'componentType': 5126, 'count': len(N), 'type': 'VEC3'},
                       {'bufferView': 2, 'componentType': 5126, 'count': len(UV), 'type': 'VEC2'},
                       {'bufferView': 3, 'componentType': 5123 if idx.dtype == np.uint16 else 5125, 'count': len(idx), 'type': 'SCALAR'}]}
    js = json.dumps(j).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(buf), 0x004E4942) + buf
    open(path, 'wb').write(out)

def dilate(img, filled, n):
    img = img.copy(); filled = filled.copy()
    for _ in range(n):
        acc = np.zeros_like(img); cnt = np.zeros(filled.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            sh = np.roll(np.roll(filled, dy, 0), dx, 1); acc += np.roll(np.roll(img * filled[..., None], dy, 0), dx, 1); cnt += sh
        new = (~filled) & (cnt > 0); img[new] = acc[new] / cnt[new][:, None]; filled = filled | new
    return img, filled

def main():
    hi_p, lo_p, out, S = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 1024
    hi = load_mesh(hi_p, True); lo = load_mesh(lo_p)
    if len(sys.argv) > 5: hi['F'] = hi['F'][np.load(sys.argv[5])['faces']]   # 여러 소품이 든 원본에서 이 소품의 면만
    print('원본 면', len(hi['F']), '줄인 면', len(lo['F']), '범위', hi['P'].min(0).round(3), hi['P'].max(0).round(3), lo['P'].min(0).round(3), lo['P'].max(0).round(3))
    # 1) 줄인 메시에 새 UV
    at = xatlas.Atlas(); at.add_mesh(lo['P'].astype(np.float32), lo['F'].astype(np.uint32), lo['N'].astype(np.float32))
    po = xatlas.PackOptions(); po.resolution = S; po.padding = 4; po.bilinear = True; co = xatlas.ChartOptions(); at.generate(co, po)
    vmap, F2, UV2 = at[0]; P2 = lo['P'][vmap]; N2 = lo['N'][vmap]; print('UV 펼침: 정점', len(P2), '면', len(F2))
    # 2) 질감 칸마다 줄인 표면 위 점 (래스터)
    px = UV2 * S; pts = []; nls = []; pix = []
    for t in range(len(F2)):
        i0, i1, i2 = F2[t]; a, b, c = px[i0], px[i1], px[i2]
        x0, x1 = int(np.floor(min(a[0], b[0], c[0]))), int(np.ceil(max(a[0], b[0], c[0]))); y0, y1 = int(np.floor(min(a[1], b[1], c[1]))), int(np.ceil(max(a[1], b[1], c[1])))
        xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1 + 1, S)), np.arange(max(y0, 0), min(y1 + 1, S))); xs = xs.ravel(); ys = ys.ravel()
        if not len(xs): continue
        q = np.stack([xs + 0.5, ys + 0.5], -1); v0 = b - a; v1 = c - a; v2 = q - a; d00 = v0 @ v0; d01 = v0 @ v1; d11 = v1 @ v1
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-12: continue
        d20 = v2 @ v0; d21 = v2 @ v1; w1 = (d11 * d20 - d01 * d21) / den; w2 = (d00 * d21 - d01 * d20) / den; w0 = 1 - w1 - w2
        e = -0.02; m = (w0 >= e) & (w1 >= e) & (w2 >= e)
        if not m.any(): continue
        W = np.stack([w0[m], w1[m], w2[m]], -1); pts.append(W @ P2[[i0, i1, i2]]); nl = W @ N2[[i0, i1, i2]]; nls.append(nl); pix.append(np.stack([ys[m], xs[m]], -1))
    pts = np.concatenate(pts); nls = np.concatenate(nls); pix = np.concatenate(pix); nls /= np.linalg.norm(nls, axis=1, keepdims=True) + 1e-12
    print('칠할 칸', len(pts))
    # 3) 원본에서 가장 가까운 표면 찾기 (삼각형 중심 KD-트리 → 후보 8개 정밀)
    HP, HF = hi['P'], hi['F']; A, B, C = HP[HF[:, 0]], HP[HF[:, 1]], HP[HF[:, 2]]; cen = (A + B + C) / 3; fn = np.cross(B - A, C - A); fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-20
    tree = cKDTree(cen); K = 8; col = np.zeros((len(pts), 3), np.float32); nrm = np.zeros((len(pts), 3), np.float32)
    # 원본 삼각형마다 접선(T)·종접선(B): 접선 공간 노멀맵을 물체 기준으로 바꾸려고
    UVh = hi['U']; ua, ub, uc = UVh[HF[:, 0]], UVh[HF[:, 1]], UVh[HF[:, 2]]; e1 = B - A; e2 = C - A; du1 = ub - ua; du2 = uc - ua
    r = du1[:, 0] * du2[:, 1] - du2[:, 0] * du1[:, 1]; r = np.where(np.abs(r) < 1e-12, 1e-12, r)
    Tg = (e1 * du2[:, 1:2] - e2 * du1[:, 1:2]) / r[:, None]; Bt = (e2 * du1[:, 0:1] - e1 * du2[:, 0:1]) / r[:, None]
    for s0 in range(0, len(pts), 60000):
        p = pts[s0:s0 + 60000]; nl = nls[s0:s0 + 60000]; _, ii = tree.query(p, k=K)
        pa, pb, pc = A[ii], B[ii], C[ii]; bc, q = closest_on_tri(np.repeat(p[:, None, :], K, 1), pa, pb, pc)
        d = np.linalg.norm(q - p[:, None, :], axis=-1); facing = (fn[ii] * nl[:, None, :]).sum(-1); d = d + (facing < -0.2) * 1e3   # 반대쪽 면은 피한다
        k = d.argmin(1); r_ = np.arange(len(p)); t = ii[r_, k]; w = bc[r_, k]
        uv = w[:, 0:1] * ua[t] + w[:, 1:2] * ub[t] + w[:, 2:3] * uc[t]; col[s0:s0 + 60000] = sample(hi['base'], uv)
        nv = w[:, 0:1] * hi['N'][HF[t, 0]] + w[:, 1:2] * hi['N'][HF[t, 1]] + w[:, 2:3] * hi['N'][HF[t, 2]]; nv /= np.linalg.norm(nv, axis=1, keepdims=True) + 1e-12
        if hi['nrm'] is not None:
            ts = sample(hi['nrm'], uv) * 2 - 1; tg = Tg[t] - nv * (Tg[t] * nv).sum(1, keepdims=True); tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-12
            hand = np.sign((np.cross(nv, tg) * Bt[t]).sum(1, keepdims=True)); hand[hand == 0] = 1; bt = np.cross(nv, tg) * hand
            nv = tg * ts[:, 0:1] + bt * ts[:, 1:2] + nv * ts[:, 2:3]; nv /= np.linalg.norm(nv, axis=1, keepdims=True) + 1e-12
        nrm[s0:s0 + 60000] = nv
    # 4) 질감 그리기 + 섬 바깥 번지기(이음선 안 보이게)
    cimg = np.zeros((S, S, 3), np.float32); nimg = np.zeros((S, S, 3), np.float32); filled = np.zeros((S, S), bool)
    cimg[pix[:, 0], pix[:, 1]] = col; nimg[pix[:, 0], pix[:, 1]] = nrm * 0.5 + 0.5; filled[pix[:, 0], pix[:, 1]] = True
    cimg, _ = dilate(cimg, filled, 8); nimg, _ = dilate(nimg, filled, 8)
    Image.fromarray((np.clip(cimg, 0, 1) * 255).astype(np.uint8)).save(out + '_base.webp', quality=88)
    Image.fromarray((np.clip(nimg, 0, 1) * 255).astype(np.uint8)).save(out + '_nrm.webp', quality=92)
    write_glb(out + '.glb', P2, N2, UV2, F2)
    print('완료', out)

main()
