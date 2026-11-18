// GLB 요약: 메시·삼각형 수·정점 수·이미지 크기·재질
const fs = require('fs'); const b = fs.readFileSync(process.argv[2]); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString());
const acc = j.accessors; let tri = 0, vert = 0;
for (const m of j.meshes) for (const p of m.primitives) { vert += acc[p.attributes.POSITION].count; tri += (p.indices !== undefined ? acc[p.indices].count : acc[p.attributes.POSITION].count) / 3; console.log('mesh', m.name, 'attrs', Object.keys(p.attributes).join(','), 'mat', p.material); }
console.log('삼각형', Math.round(tri), '정점', vert, '노드', j.nodes.length, '스킨', (j.skins || []).length, '애니', (j.animations || []).length);
for (const [i, im] of (j.images || []).entries()) { const bv = j.bufferViews[im.bufferView]; console.log('image', i, im.mimeType, (bv.byteLength / 1e6).toFixed(2) + 'MB'); }
for (const m of j.materials || []) console.log('material', JSON.stringify(m).slice(0, 300));
const pos = acc[j.meshes[0].primitives[0].attributes.POSITION]; console.log('min', pos.min, 'max', pos.max);
