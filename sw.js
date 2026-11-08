/**
 * sw.js — v1.03 Service Worker 缓存层
 *
 * 策略（依据 docs/MOBILE.md 修复路线 #2）：
 * - assets/* 与 jsDelivr 包分片：素材文件名/包名 = 内容哈希（Scratch 官方素材规范），
 *   内容寻址 ⇒ 永不变化
 *   ⇒ cache-first 永久缓存，首次访问后二次加载零网络；
 * - lib/* 与 project.json：stale-while-revalidate（秒回缓存，后台刷新）；
 * - index.html：network-first（保更新），离线回退缓存；
 * - 每次发版递增 VERSION ⇒ 旧缓存整体清除，避免壳层跨版本错配。
 * v1.06：修复跨域放行 bug——此前 fetch handler 首行对一切跨域请求 return，
 * 使 jsDelivr 分片的 cache-first 规则永远执行不到，走 CDN 的首访零持久化；
 * 现仅对 CDN pack 分片放行跨域限制（cache.put 静默容错），其余跨域照旧不接管。
 * v1.08：壳层更新（project-loader.js/index.html 进度条单调化+解码文案，
 *   六度撞号合流终树）；素材与分片未变，ASSET_CACHE 不动，仅递增 VERSION 使旧壳层缓存失效。
 * 注意：GitHub Pages 无法自定义 Cache-Control（默认 max-age=600），
 * 本 SW 是弱网/二次访问体验的正式缓存方案（与 IndexedDB 本地素材库双保险）。
 */
const VERSION = 'v1.08';
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
  // v1.06 修复：jsDelivr 分片（跨域）此前被下行首行放行、永不入缓存；
  // 现仅对 CDN pack 分片放行跨域限制，其余跨域请求照旧不接管。
  const isPackCdn = url.hostname === 'cdn.jsdelivr.net' &&
    url.pathname.includes('/assets/pack-') && url.pathname.endsWith('.bin');
  if (url.origin !== self.location.origin && !isPackCdn) return;

  // 1) md5 命名素材与合并包分片：内容寻址不可变，cache-first
  //    （同源 assets/* 与 jsDelivr 镜像 pack-* 分片，whichever 命中哪个源都缓存该源）
  if (url.pathname.includes('/assets/') || isPackCdn) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(req).then((hit) =>
          hit ||
          fetch(req).then((resp) => {
            if (resp && resp.ok) {
              try { cache.put(req, resp.clone()).catch(() => {}); } catch (e) { /* 静默 */ }
            }
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
