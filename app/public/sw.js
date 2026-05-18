// 💥 서비스 워커 영구 자폭 및 캐시 완전 파괴 로직
self.addEventListener('install', event => {
  // 즉시 설치 완료 처리
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    // 1. 브라우저에 저장된 모든 캐시 저장소(Cache Storage)를 탐색 및 완전 삭제!
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('[SW] Clearing Cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
    .then(() => {
      // 2. 현재 열려 있는 모든 웹 탭 제어권 즉시 회수
      return self.clients.claim();
    })
    .then(() => {
      // 3. 서비스 워커 스스로를 브라우저 등록부에서 영구 삭제(Unregister)하여 자폭!
      console.log('[SW] Self-destruct complete. Unregistering...');
      return self.registration.unregister();
    })
  );
});

// 4. 자폭 대기 시간 동안 발생하는 모든 네트워크 요청은 캐싱 없이 즉시 원본 서버(Vercel)로 통과!
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
