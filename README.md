# Pixel XXL · Android 17 桌面（纯 Web）

Android 17 桌面的网页实现：桌面、状态栏、锁屏、通知中心、控制中心、最近任务，以及
14 个应用。**没有 Scratch 运行时，没有框架，没有 Web Font。**

| 指标（CI 实测：4G 1.6Mbps/RTT150ms，CPU 4× 节流） | 值 | 预算 |
| --- | --- | --- |
| 可交互 | **418 ms** | < 1000 ms |
| 首屏内容（FCP） | **284 ms** | < 1500 ms |
| 首次传输（gzip） | **56.1 KB** | < 200 KB |
| 长任务 | **0 个** | — |

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
| 返回 = 直接切页 | **预测式返回**：边缘拖拽跟手，窗口缩小让位、桌面显形、箭头指示，松手才提交 |

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
  shell/              壁纸/状态栏/锁屏 · 通知中心+控制中心 · app 窗口/Recents
  apps/               14 个应用（5 个真功能 + 9 个占位）
  motion/             driver（唯一 rAF 宿主）· launch（容器变换）· predictive（预测式返回）
                      vendor/ = md3 内核原样内嵌（spring / 定时轴 / AOSP 曲线 / 打断协议）
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
