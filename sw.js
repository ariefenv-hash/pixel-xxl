/**
 * sw.js — v1.03 Service Worker 缓存层
 *
 * 策略（依据 docs/MOBILE.md 修复路线 #2）：
 * - assets/*：素材文件名 = 内容 md5（Scratch 官方素材规范），内容寻址 ⇒ 永不变化
 *   ⇒ cache-first 永久缓存，首次访问后二次加载零网络；
 * - lib/* 与 project.json：stale-while-revalidate（秒回缓存，后台刷新）；
 * - index.html：network-first（保更新），离线回退缓存；
 * - 每次发版递增 VERSION ⇒ 旧缓存整体清除，避免壳层跨版本错配。
 * 注意：GitHub Pages 无法自定义 Cache-Control（默认 max-age=600），
 * 本 SW 是弱网/二次访问体验的正式缓存方案。
 */
const VERSION = 'v1.04';
const SHELL_CACHE = `pixel-xxl-shell-${VERSION}`;
const ASSET_CACHE = 'pixel-xxl-assets-1'; // 素材内容寻址不随版本失效，跨版本复用
const SHELL = [
  'index.html',
  'project.json',
  'lib/turbowarp-core.js',
  'lib/pixel-xxl-app.js',
  'lib/project-loader.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) md5 命名素材：不可变，cache-first
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(req).then((hit) =>
          hit ||
          fetch(req).then((resp) => {
            if (resp && resp.ok) cache.put(req, resp.clone());
            return resp;
          })
        )
      )
    );
    return;
  }

  // 2) 入口页：network-first，离线回退
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('index.html', copy));
          }
          return resp;
        })
        .catch(() =>
          caches.match('index.html').then((hit) => hit || Response.error())
        )
    );
    return;
  }

  // 3) 壳层资源（lib/*、project.json）：stale-while-revalidate
  if (url.pathname.includes('/lib/') || url.pathname.endsWith('/project.json')) {
    event.respondWith(
      caches.open(SHELL_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const network = fetch(req)
            .then((resp) => {
              if (resp && resp.ok) cache.put(req, resp.clone());
              return resp;
            })
            .catch(() => hit);
          return hit || network;
        })
      )
    );
  }
});
