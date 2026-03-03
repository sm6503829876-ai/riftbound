// 符文战场 · Riftbound — Service Worker
// 缓存策略：优先网络，网络失败时返回缓存（离线兜底）

const CACHE_NAME = 'riftbound-v1';

// 需要预缓存的本地资源（CDN 资源由浏览器自行缓存）
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/colyseus-sdk/colyseus.js',
];

// ── 安装：预缓存本地资源 ─────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE).catch(() => {
        // 部分资源可能还不存在，忽略错误
      });
    })
  );
  self.skipWaiting();
});

// ── 激活：清理旧缓存 ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── 拦截请求：网络优先，失败时走缓存 ────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // WebSocket 请求不拦截
  if (event.request.url.startsWith('ws://') || event.request.url.startsWith('wss://')) return;

  // API 请求（/api/rooms）：网络优先，失败时不缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // 其他请求：网络优先，失败时返回缓存
  event.respondWith(
    fetch(event.request)
      .then(res => {
        // 缓存成功的同源响应
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
