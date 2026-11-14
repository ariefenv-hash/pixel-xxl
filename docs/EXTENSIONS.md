# 扩展迁移对照（11 + 1）

原工程 `project.json` 里挂了 11 个 TurboWarp 扩展（`extensions/manifest.json`），另有一份
`extensions-extra/qwq1018-gpu-liquid-glass-v4.js`。它们不是「框架依赖」，而是四类能力：

1. **构建期烘焙**：把矢量/位图裁成 60 张皮肤帧（cropURL、lmsSkins、lmsAssets、svgconvert、skyhigh173JSON）；
2. **运行时滤镜**：毛玻璃、模糊、混色（qiaoqiaoMica、blurExportPro、lmsLooksPlus、clipblend）；
3. **配色**：从壁纸生成 Monet 调色板（materialPalettePro）；
4. **声音**：循环/定点播放（lmsSoundExpanded）。

v2 不做「在浏览器里跑 Scratch 扩展」，而是按能力逐项重构。判断标准：**它解决的问题是否还存在**。
第 1 类的问题在 v2 里已经不存在（没有 60 帧皮肤，只有一份活 DOM），所以不搬；第 2、3、4 类搬。

| 扩展 | 原用途（证据） | v2 落点 | 状态 |
| --- | --- | --- | --- |
| `cropURL` | `crop`/`circleCrop`/`highQualityCrop`；`应用` 角色里循环 61 次裁出 440→723px、圆角 180→0 的 60 张皮肤帧 | 容器变换直接写 `transform + border-radius`，几何连续，不需要预裁 | 被替代 |
| `lmsSkins` | `registerURLSkin`/`setSkin` 按 `app + 帧号` 切皮肤 | 单一 `.app-window`，`launch.ts` 逐帧投影 | 被替代 |
| `lmsAssets` | 运行时 `addCostume`/`renameCostume` 改素材表 | Vite 构建管线 + `public/` 静态资源 | 被替代 |
| `svgconvert` | SVG 文本 → dataURL，供 `registerSVGSkin` | 内联 `<symbol>` 雪碧图（`index.html`） | 被替代 |
| `skyhigh173JSON` | 32 个 JSON 积木，用于读调色板 | 原生 `JSON.parse` / 构建期 `scripts/hct.mjs` | 被替代 |
| `materialPalettePro` | `generate(data, algo)` 从壁纸图算 HCT 调色板 | 构建期烘 `src/palettes.json` + `palettes.css`（`npm run palettes`） | **已重构** |
| `qiaoqiaoMica` | `setBlur` / 降采样 / 缓存，给窗口做背景模糊 | `backdrop-filter` + `data-perf='low'` 实色降级；`shell/effects.ts` 检测支持度 | **已重构** |
| `blurExportPro` | `exportBlurWithStep` 分级模糊导出 | 只在 Dock / 抽屉 / 面板上做一层模糊；不为每帧导出位图 | **已重构（按需）** |
| `lmsLooksPlus` | `effectValue`(ghost/brightness)、`replaceColors`、`snapshotStage` | CSS `opacity`/`filter: brightness()`/渐变 tint；`launch.ts` 的 `--launch-tint` 与 `--back-dim` | **已重构** |
| `xeltallivclipblend` | `setClipbox`/`setBlend`，裁剪盒与混合模式 | `clip-path` + `mix-blend-mode: soft-light`（玻璃高光） | **已重构（用到的那部分）** |
| `lmsSoundExpanded` | 18 个声音积木（循环、空间化） | `shell/effects.ts` 的 `tick()`：WebAudio 带通噪声，首次手势后解锁，音量 0.015 | **已重构（UI 反馈音）** |
| `gpu-liquid-glass`（extra） | WebGL 液态玻璃折射 | 不做 WebGL；用指针跟随的径向高光（`--gx/--gy`）近似镜面反射 | **部分重构（有意）** |

## 为什么不做 WebGL 液态玻璃

原扩展是给 Scratch 舞台做全屏折射的，代价是一张全屏 RT + 每帧 shader。v2 的首屏预算
（56KB JS、可交互 <1s）不允许为 Dock 的一条高光引入 WebGL 上下文；实测 `backdrop-filter`
在 4× 节流下已经能稳住 60fps，因此选择「模糊 + 高光」而不是「真折射」。如果以后要做，
落点应是 `.dock::after` 的 `background-image`（SVG filter）而不是再开一个 canvas。

## 声音策略

只在三处触发：开 app、关 app、抽屉到位。没有做「点击所有按钮都响」——那会让 demo 变吵，
也不符合 Pixel 的系统音策略（`playSoundEffect` 只覆盖少数交互）。如需关闭，改
`effects.ts` 顶部的 `enabled`。
