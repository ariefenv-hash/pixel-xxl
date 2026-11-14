/**
 * sw.js — 二访秒开（性能预算 #12）
 *
 * 策略：
 *  - 导航请求（HTML）：network-first + 400ms 超时回落缓存（离线也能开）
 *  - 带 hash 的静态资源：cache-first（内容哈希文件名，永久有效）
 *  - 壁纸/音频：cache-first + 后台回填
 *
 * 不做 precache manifest：vite 产物每次哈希变化，与其维护清单，不如让
 * 首页导航先把资源拉一遍、由 runtime cache 自动收敛。
 */

const VERSION = 'px2-v1';
const HTML_CACHE = `${VERSION}-html`;
const ASSET_CACHE = `${VERSION}-asset`;
const TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(HTML_CACHE).then((c) => c.add('./index.html').catch(() => undefined)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

const isAsset = (url) =>
  /\.(js|css|webp|png|svg|woff2?|mp3)$/i.test(url.pathname) || url.pathname.includes('/assets/');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 导航：network-first，超时回落缓存
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(HTML_CACHE);
        try {
          const fresh = await Promise.race([
            fetch(req),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT)),
          ]);
          if (fresh && fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match(req)) || (await cache.match('./index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // 静态资源：cache-first
  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })()
    );
  }
});
