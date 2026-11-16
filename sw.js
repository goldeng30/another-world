// 이세계: 파일을 기기에 저장해 두고 먼저 꺼내 쓴다. 파일이 바뀌면 VER가 바뀌어 새로 받는다
const VER = 'isekai-8d7de0028c';
const FILES = ["./", "index.html", "manifest.webmanifest", "app.js", "clips.js", "pipe.js", "club.js", "doyun_glb.js", "gob_glb.js", "gob_clips.js", "doyun_base.webp", "doyun_nrm.webp", "doyun_eyes.webp", "gob_base.webp", "gob_nrm.webp", "rust.webp", "tape.webp", "lib/three.min.js", "lib/GLTFLoader.js", "lib/OrbitControls.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; const u = new URL(e.request.url); if (u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
