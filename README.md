# Pixel XXL · Android 17 桌面（纯 Web）

Android 17 桌面的网页实现：桌面（4+4+1 无标签图标 + 贝壳纹模拟钟组件 + 第二页 bilibili）、
开机动画与中文引导页、锁屏、通知中心、控制中心、最近任务，以及原版 11 项应用清单
（信息/浏览器/相机仅存于 All Apps）。**视觉 1:1 对齐原版 Scratch 工程（#36，真源 = release v1.00 `1111.html`）；
没有 Scratch 运行时，没有框架，没有 Web Font。**

| 指标（CI 实测：4G 1.6Mbps/RTT150ms，CPU 4× 节流） | 值 | 预算 |
| --- | --- | --- |
| 可交互 | **526 ms** | < 1000 ms |
| 首屏内容（FCP） | **324 ms** | < 1500 ms |
| 首次传输（gzip） | **63.4 KB** | < 200 KB |
| 长任务 | **1 个（~109 ms，首屏解析）** | — |

线上：[ariefenv-hash.github.io/pixel-xxl](https://ariefenv-hash.github.io/pixel-xxl/)

## 为什么快

快的不是某一处优化，而是整条链路上**没有一步是"每次都要重算"**的。

| 传统做法 | 本项目 |
| --- | --- |
| 首屏等 JS 解析完才渲染 | 桌面 DOM 与关键 CSS 内联在 HTML 里，**首帧就有画面** |
| 壁纸取色在设备上跑算法 | 壁纸的 HCT 调色板在**构建期**算好，运行时只写一次 CSS 变量 |
| 每个图标一次请求 | 图标是内联 SVG sprite，**零请求** |
| 应用代码进首包 | 每个 app 独立 chunk，**点开才加载** |
| 框架运行时 + 虚拟 DOM | 原生 DOM + 直接属性写入 |
| Web Font（FOUT/FOIT） | 系统字体栈 |
| `width/height/top/left` 动画 | 只动 `transform` / `opacity`，走合成层 |
| 桌面端也开毛玻璃 | 按 `deviceMemory` / 核心数降级，低端关 `backdrop-filter` |
| 开窗 = 淡入 + 缩放 | **容器变换**：窗口从图标的那个正方形长到全屏（500ms / emphasized，关 250ms） |
| 返回 = 直接切页 | **预测式返回**：105dp 边缘面板起手，小球按 AOSP 五态形变（0×48→51×46→48×48→60×48→0.86），松手才提交 |
| 上滑 = 回桌面 | **上滑长按进后台**：窗口跟手缩小，320ms 判定，松手吸成卡片；点卡片用同一实例拉回全屏 |
| 应用列表 = 另一页 | **All Apps 抽屉**：跟手 + 弹簧、毛玻璃、桌面图标退场、图标错峰淡入 |
| 点小组件 = 直接跳转 | **组件容器变换**：按 QSTM 的 500/125ms 时间轴，组件本身长大成窗口 |

完整清单与实测见 [`docs/PERF.md`](docs/PERF.md)，架构见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。
动效参数（每个数值的 AOSP 出处）见 [`docs/MOTION-SPEC.md`](docs/MOTION-SPEC.md) —— 慢放检视：`window.__launchSpeed = 0.1`。

## 快速开始

```bash
npm install
npm run dev        # 开发（http://localhost:5173）
npm run build      # 类型检查 + 生产构建 → dist/
npm run gate       # 首屏性能门禁（4G / 4x CPU 实测，超预算退出码 1）
```

## 目录

```
index.html            单入口：内联 SVG sprite + 桌面 DOM + 关键 CSS 注入点
src/
  core/               状态、注册表、性能探针、DOM 工具（零框架）
  shell/              壁纸/锁屏 · 通知中心+控制中心 · app 窗口/Recents（原版无状态栏/Dock，#36）
                      抽屉 · 小组件 · 扩展能力（玻璃高光 / UI 音效）
  apps/               11 项原版应用（5 真功能 + 6 占位）+ 3 个仅抽屉占位
  motion/             driver（唯一 rAF 宿主）· launch（图标/组件容器变换）
                      predictive + back-indicator（预测式返回）· handoff（上滑/长按进后台）
                      window-morph（全屏 ↔ 卡片）· vendor/ = md3 内核原样内嵌
  styles/             tokens（设计令牌）· palettes（构建期生成）· shell · apps
scripts/
  hct.mjs             HCT 色彩空间（CAM16 + L*），构建期用
  extract-wallpapers.py  壁纸分级转码 + k-means 主色采样
  build-palettes.mjs  壁纸 → 5 套调色板 × 明暗两态
  perf-gate.py        首屏性能门禁（CI 用）
docs/                 设计规范、架构、性能账、历史移植记录
```

## 调试参数

| 参数 | 作用 |
| --- | --- |
| `?theme=light` / `?theme=dark` | 强制明暗 |
| `?wp=w1`…`?wp=w5` | 指定壁纸 |
| `?perf=low` | 强制低端降级模式（关毛玻璃） |
| `?lock=1` | 走完整锁屏流程（默认直接进桌面） |

`window.__perf` 暴露首屏各节点耗时；设置 → 首屏性能 里也能直接看到。

## 应用清单

| 应用 | 状态 | 说明 |
| --- | --- | --- |
| 计算器 | 完整 | 自带 tokenizer + 递归下降求值（不用 `eval`），支持括号/百分比/连算 |
| 时钟 | 完整 | 世界时钟 / 闹钟 / 秒表 / 计时器四子系统 |
| 个性化 | 完整 | 壁纸切换、明暗、当前调色板色值展示 |
| 音乐 | 完整 | 播放器 + 曲目列表 + 进度拖动，音频懒加载 |
| 设置 | 完整 | 外观、首屏性能自检面板、存储清理、关于 |
| 相册/商店/通知/视频/电话/bilibili/信息/Chrome/相机 | 占位 | 统一占位页（诚实标注后续计划） |

## 设计出处

所有视觉数值集中在 `src/styles/tokens.css`，逐条标注 `aosp:` / `material:` / `self:`。
AOSP 出处与逐值审计见 [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md) 与
[`docs/DESIGN-SPEC-AUDIT.md`](docs/DESIGN-SPEC-AUDIT.md)。

## 历史

v1 是从一个 Scratch（TurboWarp）工程拆分移植的版本，跑得起来但初始化要 1~2 分钟。
v2 放弃该运行时，整机重写为纯 Web。旧版的移植记录保留在
[`docs/PORTING.md`](docs/PORTING.md)、[`docs/ANALYSIS.md`](docs/ANALYSIS.md)，
作为「为什么重写」的取证材料。
