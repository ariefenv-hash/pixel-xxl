# 性能账（v2）

> 单一验收口径：中端机 4G 冷启，可交互 < 1000ms、首屏内容 < 1500ms、首次传输 < 200KB。
> 由 `scripts/perf-gate.py` 在 CI 每个 push 实测，超预算直接红灯。

## 实测（Chromium，420×910，4G 1.6Mbps / RTT 150ms，CPU 4x 节流）

| 节点 | 实测 | 预算 | 余量 |
| --- | --- | --- | --- |
| FCP（首屏内容） | 280 ms | 1500 ms | 5.4× |
| DOMContentLoaded | 383 ms | — | — |
| 外壳就绪 | 389 ms | — | — |
| **可交互** | **394 ms** | 1000 ms | 2.5× |
| load | 692 ms | — | — |
| 首次传输（gzip） | 50.7 KB | 200 KB | 3.9× |
| 长任务 | 0 个 | — | — |

对比 v1（Scratch 版，同一台机器）：

| | v1 | v2 |
| --- | --- | --- |
| 首次可交互 | 60~120 s（低端机 144 s） | 0.39 s |
| 二次访问 | 60~120 s（VM 每次重建） | < 0.5 s（SW 缓存） |
| 首屏传输 | 22 MB 素材 + 1.8 MB 运行时 | 50.7 KB |

## 优化点清单（15 条，逐条对应实现）

### 加载层

**1. 关键 CSS 内联**
`vite.config.ts` 的 `inline-critical-css` 插件把入口 CSS（26 KB）塞进 `<style>` 并删掉
`<link>`。省一个关键路径往返（4G 约 120ms）。
→ `vite.config.ts:inlineCriticalCss()`

**2. 桌面 DOM 直出**
图标栅格、状态栏、Dock、面板骨架全部写在 `index.html` 里，**不依赖 JS 生成**。
JS 只做事件绑定，因此「首帧有画面」与「JS 是否就绪」解耦。
→ `index.html` 的 `.desktop__grid` / `.statusbar` / `.shade` / `.qs`

**3. 图标零请求**
40 个图标是内联 SVG `<symbol>` sprite，用 `<use href="#ic-xxx">` 引用。
→ `index.html` 顶部 `<svg class="sprite">`

**4. app 代码分割**
每个 app 一个 chunk（0.3~5.5 KB），`registry.ts` 里用动态 `import()`。
首屏 JS 只含外壳（34.7 KB / gzip 10.6 KB），不含任何 app 代码。
→ `src/core/registry.ts` 的 `load: () => import('../apps/xxx')`

**5. 打开与内容解耦**
点图标时立即插入窗口骨架并起 240ms 入场动画，同时并行 `import()`，
chunk 到位后再挂载内容。用户永远看不到「点了没反应」。
→ `src/shell/apps.ts:open()`

**6. 壁纸三级加载**
CSS 里内联 554 B 的 LQIP（base64）→ 立即换 360 档（~89 KB）→ 空闲且高清屏/非省流
时才升 1080 档。首帧永远有颜色，没有白屏。
→ `src/shell/system.ts:applyWallpaper()`

**7. Service Worker**
导航 network-first（4s 超时回落缓存），带 hash 的静态资源 cache-first。
二访走缓存，传输接近 0。
→ `public/sw.js`

### 计算层

**8. 调色板构建期烘焙**
壁纸 → k-means 采样 → HCT(CAM16 + L*) 打分选 seed → 五套 tonal palette → 角色映射，
全部在 `npm run build` 前算完，产物是 `src/styles/palettes.css`（默认壁纸，静态可用）
+ `src/palettes.json`（全量，切壁纸时套用）。
运行时**零取色计算**，只有一次 `setProperty` 循环。
→ `scripts/hct.mjs` · `scripts/build-palettes.mjs`

> 这条是 v2 最关键的一条：v1 的启动空窗里有一大块就是设备上重跑取色算法。

**9. 壁纸分级转码**
同一张图输出 360/720/1080 三档 WebP + 24px LQIP。
→ `scripts/extract-wallpapers.py`

**10. 状态持久化无计算**
`localStorage` 一次 `JSON.parse`（约 1 KB），写入合并到 `requestIdleCallback`，
手势途中不会触发同步 IO。
→ `src/core/store.ts`

### 渲染层

**11. 只动 transform / opacity**
面板开合、图标按压、磁贴切换、通知滑删、app 转场、进度条全是 `transform` 或
`opacity`。没有任何 `width/height/top/left` 过渡，不触发重排。
进度条用 `scaleX` 而不是 `width`。
→ `src/styles/shell.css` · `src/apps/music.ts`

**12. 手势 rAF 节流**
`pointermove` 不直接写样式，合并到 rAF（一帧最多写一次），且只写 `transform`。
→ `src/core/dom.ts:rafThrottle()`

**13. 低端设备降级**
`deviceMemory ≤ 3` 或 `hardwareConcurrency ≤ 4` → `data-perf="low"`，
关掉 `backdrop-filter`、换不透明面板。探测只做一次。
→ `src/shell/system.ts:detectPerfTier()`

**14. 渲染隔离**
app 容器 `contain: content`，滚动列表 `overscroll-behavior: contain`。
→ `src/styles/shell.css` 的 `.app-window__body`

**15. 尊重「减少动效」**
`prefers-reduced-motion` 下所有过渡降到 1ms，功能不变。
→ `src/styles/shell.css` 末尾

## 怎么自己验

```bash
npm run build
npm run gate            # 4G + 4x CPU 实测，打印 JSON 与 PASS/FAIL
```

浏览器里：`window.__perf` 或 设置 → 首屏性能（同一份数据，用户可见）。

## 已知未做的

- **app 快照**：Recents 卡片用图标水印代替真缩略图（真快照要 `html2canvas` 类方案，
  成本与收益不匹配）。
- **字体**：用系统栈，中文在部分 Android WebView 上字重表现不一致。
- **占位 app**：9 个应用仍是占位页（原工程本身就是占位），真功能待立项。
