# 架构（v2）

## 一句话

**HTML 直出画面，JS 只接交互，重活全部搬到构建期。**

## 分层

```
┌──────────────────────────────────────────────────────────┐
│ index.html        桌面 DOM + 图标 sprite + 关键 CSS 内联   │  ← 首帧即渲染
├──────────────────────────────────────────────────────────┤
│ src/core/         状态 / 注册表 / 性能探针 / DOM 工具       │  ← 零框架
├──────────────────────────────────────────────────────────┤
│ src/shell/        壁纸·锁屏·开机 / 通知·QS / 窗口·Recents      │
├──────────────────────────────────────────────────────────┤
│ src/motion/       容器变换 · 预测式返回 · 唯一 rAF 宿主     │
├──────────────────────────────────────────────────────────┤
│ src/apps/         11 项原版应用 + 3 抽屉占位（按需 chunk）   │
└──────────────────────────────────────────────────────────┘
        ↑ 构建期产出：styles/palettes.css · palettes.json · wallpapers/*.webp
```

## 为什么零框架

框架解决的是「状态 → DOM 的映射」。这个应用的状态很小（壁纸/主题/音量/磁贴开关），
而视图更新点很明确（图标高亮、磁贴圆角、面板位移）。用框架会带来：

- 首屏多 15~45 KB 运行时；
- 一次 mount 的同步开销（在 4x CPU 节流下就是几十毫秒）；
- 对「面板跟手」这类高频交互，虚拟 DOM 反而是负担。

所以这里直接写 DOM：`store.subscribe` 按 key 分发，谁关心谁更新，不做整树 diff。

## 数据流

```
用户手势 ──► shell 组件 ──► store.set(key, value)
                              │
                              ├─► 订阅者按 key 增量更新（属性/class/style）
                              └─► 合并写入 localStorage（idle 帧）
```

单向、无中间层。`store` 是唯一可变状态，组件不回写别人的状态。

## 模块职责

| 文件 | 职责 | 关键约束 |
| --- | --- | --- |
| `core/store.ts` | 全局状态 + 持久化 | 初始化只 `JSON.parse` 一次；写盘进 idle |
| `core/registry.ts` | app 元数据 + 懒加载 | 每个 app 一个 chunk |
| `core/perf.ts` | 首屏打点 + 预算判定 | 超预算只 `warn`，不阻断 |
| `core/dom.ts` | `$` / `el` / `clamp` / `rafThrottle` | 不引第三方 |
| `shell/system.ts` | 壁纸、主题、调色板套用、开机动画+引导页、锁屏、下拉手势 | 壁纸三级加载；DPI 降级探测 |
| `shell/shade.ts` | 通知中心 + 控制中心 | 跟手只写 transform；磁贴只改 data-on |
| `shell/apps.ts` | 窗口管理、Recents、桌面绑定、边缘返回 | 骨架先出，内容后到 |
| `apps/*.ts` | 应用实现 | `mount(root, ctx): unmount`，必须可卸载 |

## app 契约

```ts
export interface AppModule {
  mount(root: HTMLElement, ctx: AppContext): () => void;
}
```

- `ctx` 提供 `open / close / toast / setWallpaper / setTheme`，**app 不直接依赖 shell**，
  避免循环引用；
- `mount` 必须返回卸载函数，且要清掉自己起的 `setInterval` / `EventSource` / `Audio`。
  （v1 的时钟 app 就有「关掉后定时器还在跑」的泄漏，v2 用 `timers` 集合统一清。）

## 构建管线

```
scripts/extract-wallpapers.py   旧素材 → 分级 WebP + LQIP + k-means 主色 JSON
scripts/build-palettes.mjs      JSON → HCT 打分 → palettes.css + palettes.json
vite build                      TS → 分包；入口 CSS 内联进 HTML
scripts/perf-gate.py            真浏览器 4G 实测 → 预算断言
```

顺序有依赖：`palettes` 必须在 `build` 之前（`palettes.css` 被 `main.css` `@import`）。

`npm run build` 目前不自动跑前两步——调色板只在换壁纸时才需要重算，把它挂在每次
构建上会让构建变慢（HCT 求解约 1.5 s）。换壁纸时的正确流程：

```bash
python3 scripts/extract-wallpapers.py <旧素材目录>
node scripts/build-palettes.mjs
npm run build
```

## 手势模型

| 手势 | 触发区 | 行为 |
| --- | --- | --- |
| 下拉（左半） | 顶部 64px | 打开通知中心，跟手 |
| 下拉（右半） | 顶部 64px | 打开控制中心，跟手 |
| 面板内下滑 | 面板空白区 | 关闭；速度 > 0.4px/ms 也关 |
| 通知中心上滑 | 面板空白区 | 接力进控制中心 |
| 通知横滑 | 通知卡 | 超 110px 删除，否则回弹 |
| 桌面上滑 | 桌面空白 | 打开 Recents |
| 边缘内滑 | 左右 22px | 返回（关 Recents → 关 app） |

全部用 `pointerdown/move/up` + `setPointerCapture`，移动端与鼠标一致。
跟手阶段 `transition: none` 直写 `transform`，松手后再交回 CSS 过渡。

## 设计令牌

`src/styles/tokens.css` 是唯一真源，每个值标 `aosp:` / `material:` / `self:`。
颜色角色不在 tokens 里硬编码，由 `palettes.css`（构建期生成）注入 `--color-*`。
详见 `docs/DESIGN-SPEC.md`（v1 冻结版，v2 继续沿用其 token 命名）。
