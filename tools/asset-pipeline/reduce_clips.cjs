// 동작 파일(clips.json) 줄이기: 앞뒤 키로 곧게 이어도 거의 같은(회전 tolQ도 · 위치 tolP 안) 중간 키를 뺀다
//   엉덩이(Hips) 키는 그대로 둔다(제자리 동작 만들기·길 빼내기에 원래 박자가 필요)
//   node tools/asset-pipeline/reduce_clips.cjs assets/hero/clips.json [tolQ=0.3] [tolP=0.05]
const fs = require('fs');
const [file, tq = '0.3', tp = '0.05'] = process.argv.slice(2); const TOLQ = +tq * Math.PI / 180, TOLP = +tp;
const clips = JSON.parse(fs.readFileSync(file, 'utf8')); let before = 0, after = 0;
const qAng = (a, b) => { let d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)); };
for (const name in clips) for (const tr of clips[name].tracks) {
  const n = tr.times.length; before += n; if (n < 3 || /Hips\./.test(tr.name)) { after += n; continue; }
  const S = tr.values.length / n, Q = S === 4, at = i => tr.values.slice(i * S, i * S + S);
  const ok = (a, b) => { const va = at(a), vb = at(b); let sg = 1; if (Q && va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2] + va[3] * vb[3] < 0) sg = -1;
    for (let k = a + 1; k < b; k++) { const u = (tr.times[k] - tr.times[a]) / (tr.times[b] - tr.times[a]), v = va.map((x, j) => x + (vb[j] * sg - x) * u), vk = at(k);
      if (Q) { const l = Math.hypot(...v); if (qAng(v.map(x => x / l), vk) > TOLQ) return false; } else if (v.some((x, j) => Math.abs(x - vk[j]) > TOLP)) return false; }
    return true; };
  const keep = [0]; let a = 0; for (let b = 2; b < n; b++) if (!ok(a, b)) { keep.push(b - 1); a = b - 1; } keep.push(n - 1);
  tr.times = keep.map(i => tr.times[i]); tr.values = keep.flatMap(i => at(i)); after += keep.length; }
const s0 = fs.statSync(file).size; fs.writeFileSync(file, JSON.stringify(clips)); const s1 = fs.statSync(file).size;
console.log(file, 'keys', before, '→', after, '·', (s0 / 1e6).toFixed(2), 'MB →', (s1 / 1e6).toFixed(2), 'MB');
