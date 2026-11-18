# 뼈대 든 GLB에서 질감 그림을 떼어 webp로 저장하고, GLB에는 모양·뼈대·살 정보만 남긴다
import sys, json, struct, io
from PIL import Image
src, out, name = sys.argv[1], sys.argv[2], sys.argv[3]
b = open(src, 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20 + jl]); off = 20 + jl; bl = struct.unpack_from('<I', b, off)[0]; bin_ = b[off + 8: off + 8 + bl]
mat = j['materials'][0]; pbr = mat.get('pbrMetallicRoughness', {}); tex = lambda k: j['textures'][k['index']]['source']
def img(i): bv = j['bufferViews'][j['images'][i]['bufferView']]; s = bv.get('byteOffset', 0); return Image.open(io.BytesIO(bin_[s:s + bv['byteLength']])).convert('RGB')
img(tex(pbr['baseColorTexture'])).save(f'{name}_base.webp', quality=85, method=6)
if 'normalTexture' in mat: img(tex(mat['normalTexture'])).save(f'{name}_nrm.webp', quality=85, method=6)
keep = sorted({a['bufferView'] for a in j['accessors'] if 'bufferView' in a})
newbuf = b''; remap = {}
for i in keep:
    bv = j['bufferViews'][i]; s = bv.get('byteOffset', 0); data = bin_[s:s + bv['byteLength']]
    remap[i] = len(remap); nb = dict(bv); nb['byteOffset'] = len(newbuf); newbuf += data + b'\0' * ((4 - len(data) % 4) % 4); j.setdefault('_bv', []).append(nb)
j['bufferViews'] = j.pop('_bv')
for a in j['accessors']:
    if 'bufferView' in a: a['bufferView'] = remap[a['bufferView']]
for k in ['images', 'textures', 'samplers']: j.pop(k, None)
j['materials'] = [{'name': 'm', 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.85}}]
j['buffers'] = [{'byteLength': len(newbuf)}]
js = json.dumps(j).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(out, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(newbuf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(newbuf), 0x004E4942) + newbuf)
print('ok', len(newbuf) // 1024, 'KB')
