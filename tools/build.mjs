// 빌드: src/ → dist/game.js (한 파일로 묶기) + sw.js 파일 목록 + 아티팩트용 페이지 + (--single) 한 파일 앱
//   node tools/build.mjs            게임 코드 묶기 · sw.js · dist/artifact.html · dist/publish.json
//   node tools/build.mjs --single   + dist/single/이세계.html (three.js·코드·자산을 모두 안에 넣은 파일 하나)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const exists = f => fs.existsSync(P(f));
const single = process.argv.includes('--single');

// 1) 게임 코드 묶기
const t0 = Date.now();
await build({ entryPoints: [P('src/main.js')], bundle: true, format: 'iife', target: ['es2019'], minify: true, legalComments: 'none', outfile: P('dist/game.js'), logLevel: 'warning' });
console.log(`dist/game.js ${(fs.statSync(P('dist/game.js')).size / 1024).toFixed(0)}KB (${Date.now() - t0}ms)`);

// 2) 방 데이터에서 필요한 자산 목록 만들기(방이 쓰는 것만 내보낸다)
const { ROOMS } = await import(pathToFileURL(P('src/data/rooms/index.js')).href);
const { PROPS } = await import(pathToFileURL(P('src/data/props.js')).href);
const { WALL_KIT } = await import(pathToFileURL(P('src/data/wallkit.js')).href);
const need = new Set(['assets/hero/doyun.glb', 'assets/hero/doyun_base.webp', 'assets/hero/doyun_nrm.webp', 'assets/hero/doyun_eyes.webp', 'assets/hero/clips.json', 'assets/weapons/rust.webp', 'assets/weapons/tape.webp']);
const ENEMY_FILES = { wolf: ['wolf.glb', 'wolf_base.webp', 'wolf_white_base.webp', 'wolf_nrm.webp'], goblin: ['goblin.glb', 'goblin_base.webp', 'goblin_nrm.webp', 'goblin_clips.json'] };
for (const R of Object.values(ROOMS)) {
  for (const n of Object.values(R.surfaces)) for (const t of ['c', 'n']) need.add(`assets/textures/${n}_${t}.webp`);
  const props = new Set();
  for (const p of R.place) { const n = p.prop || p.ore || p.wallProp; if (n) props.add(n); if (p.wallTorches) props.add('torchw'); }
  for (const n of (R.rocks && R.rocks.stalagmites) || []) props.add(n);
  for (const n of (R.totems && R.totems.pool) || []) props.add(n);   // 무작위 토템
  const gs = R.gather && R.gather.spawn; if (gs) for (const n of [...(gs.orePool || []), ...(gs.herbPool || [])]) props.add(n);   // 무작위로 나올 수 있는 채집물
  for (const n of props) { const tx = (PROPS[n] && PROPS[n].tex) || n; need.add(`assets/props/${n}.glb`); need.add(`assets/props/${tx}_base.webp`); need.add(`assets/props/${tx}_nrm.webp`); if (exists(`assets/props/${n}_emi.webp`)) need.add(`assets/props/${n}_emi.webp`); }
  for (const e of R.enemies || []) for (const f of ENEMY_FILES[e.type] || []) need.add('assets/enemies/' + f);
  if (R.decals) for (const t of ['c', 'n']) need.add(`assets/decals/floor_${t}.webp`);   // 바닥 디테일 아틀라스
  for (const p of R.place) if (p.rock) need.add(`assets/rocks/${p.rock}.glb`);   // 바위 에셋
  if (R.wallKit) for (const n of Object.keys(WALL_KIT)) need.add(`assets/rocks/${n}.glb`);   // 벽 조각
  if (R.rim) for (const k of [...Object.keys(R.rim.kinds || {}), ...Object.keys((R.rim.low && R.rim.low.kinds) || {})]) need.add(`assets/rocks/${k}${R.rim.lo === false ? '' : '_lo'}.glb`);   // 경계 바위 벽(가벼운 판)
  for (const c of R.ceiling || []) need.add(`assets/rocks/${c.rock || 'spireA'}.glb`);   // 천장 종유석
  for (const k of (R.stalactites && R.stalactites.kinds) || []) need.add(`assets/rocks/${k}.glb`);   // 매달린 돌
  if (R.stones) for (const n of ['pebbleA', 'pebbleB', 'pebbleC', 'pebbleD', 'stoneA', 'stoneB', 'stoneC', 'stoneD']) need.add(`assets/rocks/${n}.glb`);   // 자잘한 돌
  if (R.stones && R.stones.grit) for (const t of ['c', 'n']) need.add(`assets/decals/floor_${t}.webp`);
  if (R.litter) for (const f of ['planks012_c', 'planks012_n', 'leafset030_c', 'leafset030_n']) need.add(`assets/textures/${f}.webp`);   // 3D 판자·낙엽 재질
}
const assets = [...need].sort();
for (const f of assets) if (!exists(f)) throw new Error('자산 없음: ' + f);
const mb = assets.reduce((s, f) => s + fs.statSync(P(f)).size, 0) / 1e6;
console.log(`자산 ${assets.length}개 ${mb.toFixed(1)}MB`);

// 3) 홈 화면 앱(sw.js): 파일 목록 + 버전(내용이 바뀌면 새로 받는다)
const swFiles = ['./', 'index.html', 'manifest.webmanifest', 'lib/three.min.js', 'lib/GLTFLoader.js', 'dist/game.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', ...assets];
const h = crypto.createHash('sha1'); for (const f of swFiles.slice(1)) h.update(fs.readFileSync(P(f)));
const sw = fs.readFileSync(P('sw.js'), 'utf8').replace(/const VER = '[^']*';/, `const VER = 'isekai-${h.digest('hex').slice(0, 10)}';`).replace(/const FILES = \[[^\]]*\];/, `const FILES = ${JSON.stringify(swFiles)};`);
fs.writeFileSync(P('sw.js'), sw);

// 4) 아티팩트용 페이지: 문서 뼈대·홈 화면 앱 부분은 빼고, three.js는 CDN에서
const page = fs.readFileSync(P('index.html'), 'utf8');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/';
let art = page.replace(/<!-- pwa -->[\s\S]*?<!-- \/pwa -->\n?/g, '')
  .replace(/<!-- three -->[\s\S]*?<!-- \/three -->/, `<script src="${CDN}build/three.min.js"></script>\n<script src="${CDN}examples/js/loaders/GLTFLoader.js"></script>`)
  .replace(/<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n/, '').replace('</head>\n<body>\n', '').replace('</body>\n</html>\n', '')
  .replace('<meta name="viewport"', '<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="viewport"');
art = art.replace('<script src="dist/game.js"></script>', '<script>window.__ASSET_JS_MODE = true;</script>\n<script src="dist/game.js"></script>');
fs.writeFileSync(P('dist/artifact.html'), art);
// 아티팩트는 .glb 를 받지 않아서 모델만 base64 스크립트로 감싼다: dist/artifact/경로.glb.js
const pub = { 'dist/game.js': 'dist/game.js' };
for (const f of assets) { if (!f.endsWith('.glb')) { pub[f] = f; continue; }
  const out = 'dist/artifact/' + f + '.js'; fs.mkdirSync(path.dirname(P(out)), { recursive: true });
  fs.writeFileSync(P(out), `(window.__ASSET_JS = window.__ASSET_JS || {})[${JSON.stringify(f)}] = "${fs.readFileSync(P(f)).toString('base64')}";\n`); pub[f + '.js'] = out; }
fs.writeFileSync(P('dist/publish.json'), JSON.stringify({ page: 'dist/artifact.html', files: pub }, null, 1));

// 5) 한 파일 앱: three.js · 게임 코드 · 자산(data URI)을 모두 안에
if (single) {
  const MIME = { '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png' };
  const baked = {}; for (const f of assets) baked[f] = `data:${MIME[path.extname(f)]};base64,` + fs.readFileSync(P(f)).toString('base64');
  const js = f => fs.readFileSync(P(f), 'utf8').replace(/<\/script/g, '<\\/script');
  let one = page.replace(/<!-- pwa -->[\s\S]*?<!-- \/pwa -->\n?/g, '')
    .replace(/<!-- three -->[\s\S]*?<!-- \/three -->/, () => `<script>\n${js('lib/three.min.js')}\n</script>\n<script>\n${js('lib/GLTFLoader.js')}\n</script>`)
    .replace('<script src="dist/game.js"></script>', () => `<script>window.__ASSETS = ${JSON.stringify(baked)};</script>\n<script>\n${js('dist/game.js')}\n</script>`);
  fs.mkdirSync(P('dist/single'), { recursive: true }); fs.writeFileSync(P('dist/single/이세계.html'), one);
  console.log(`dist/single/이세계.html ${(Buffer.byteLength(one) / 1e6).toFixed(1)}MB`);
}
