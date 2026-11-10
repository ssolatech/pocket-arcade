// 오프라인 지원: 처음 접속할 때 파일을 기기에 저장해 두고, 이후에는 인터넷 없이도 실행.
// 온라인일 때는 백그라운드에서 최신 파일을 받아 다음 실행부터 반영한다.
const CACHE = 'pocket-arcade-v10';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/version.js',
  './js/avatar.js',
  './js/core.js',
  './js/dev.js',
  './js/games/dungeon.js',
  './js/games/meteor.js',
  './js/games/jump.js',
  './js/games/farm.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  if (new URL(e.request.url).searchParams.has('fresh')) return;   // 개발자 화면의 최신 버전 확인용
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request)
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
