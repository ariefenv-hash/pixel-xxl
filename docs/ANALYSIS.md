# ANALYSIS.md — Pixel XXL 详细分析报告（移植后）

> 分析对象：本仓库的忠实移植本体（原单文件 `Pixel.XL.0827.html`，57,470,525B，SHA-256 `98db52e0…1308`）。
> 撰写时间：2026-11-08，**移植（v1.00）完成之后**——遵循"先移植 → 再详细分析 → 最后才升级"的顺序。
> 本报告全部为实测/一手源码结论；引用旧会话报告处已注明。

## 1. 文件本体：打包形态解剖

TurboWarp Packager（packager.turbowarp.org）单文件产物，实测 681 个真实 `<script>`/`<style>`
标签（另有 3 个位于运行时 bundle 字符串内的假匹配）：

| 区段 | 实测体积 | 内容 |
| --- | --- | --- |
| `<head>` + 骨架 | ~5KB | CSP 放宽声明、页面 CSS（含 `.sc-monitor-root[data-opcode^="data_"]` 橙色监视器定制、原版 `idden]` 笔误）、绿旗启动屏（内嵌 SVG + `style[1]`） |
| script[2] core | 1,796,250 字符 | VM + 渲染器 + scratch-storage + Scaffolding 库 + JSZip |
| script[3] app | 456,746 字符 | DOM 引用、`handleError`/`setProgress`/`interpolate`、Scaffolding 配置、云变量、**11 扩展装载循环** |
| script[4] | 1,401 字符 | base85 解码器（`( )`→`< >` 重映射、`code-0x2a`、小端 `setUint32`） |
| script[5..678] | 674 分块 | 673×65536 + 23336 = 44,129,064B zip（PK 头实测校验） |
| script[679] | 1,572 字符 | `getProjectData`：JSZip 解包 → project.json；storage helper 按 md5 从 zip 取素材 |
| script[680] | 501 字符 | `run()`：loadProject → 进度条 → 启动屏点击 |

## 2. 运行时配置（一手实测，lib/pixel-xxl-app.js 头部）

- 舞台 **324×720**（9:20 手机比例），`resizeMode="preserve-ratio"`，`editableLists=false`，`usePackagedRuntime=false`
- **Turbo 模式关闭**、`setInterpolation(true)`（若可用）
- 云变量 provider：`wss://clouddata.turbowarp.org` 与 `wss://clouddata.turbowarp.xyz`，项目名 `p4-@Pixel XXL.sb3`
- 用户名 `player####`（随机 4 位数字）、强调色 `#ff4c4c`
- 进度条分段：解码 0.1→0.75，zip 素材装载 0.75→0.98，loadProject 完成 = 1

## 3. 工程数据（本仓库逐字节实测）

- `project.json` 1,054,272B；`targets` **21 个**（Stage + 20 sprite）；`meta.platform = TurboWarp`
- 素材 **328 个**：175 PNG + 151 SVG + 2 MP3，合计被引用体积 **52,796,865B**
  - 引用账目：325 个 `md5ext` + 3 个 `assetId+dataFormat`（时钟时/分/秒针三造型）——**双向核对零缺失零多余**
  - 57MB 体积主因：5 张内嵌 base64 照片的壁纸 SVG（单张 3.6~8.9MB，IMG_2647/IMG_2712 等用户照片套 SVG 壳）
- 2 首 MP3：fripSide - only my railgun / 蛋仔汤音 - 刀酱《520AM》（旧会话报告判定，本次按素材存在性实测确认）

## 4. 扩展体系（11 个，一手源码已全部落盘 `extensions/`）

自写 5 个（源码头注实读）：

| 扩展 | 源码实测要点 |
| --- | --- |
| cropURL（11,983B） | 繁体注释；`loadImage` + 离屏 canvas `highQualityScale` 分步高质量缩放——图标→窗口 61 帧裁切动画的底座 |
| materialPalettePro（3,517B） | `generate` 积木，算法菜单 **average / median / kmeans**；drawImage 取像素 → 生成 light/dark tonal palette |
| svgconvert（978B） | SVG 文本 → dataURL 中转 |
| qiaoqiaoMica（17,083B） | "稳定优化版·无防抖"：任务队列串行（`isGenerating`/`generateQueue`）、错误边界、`originalCostumeMap`、`maxCacheSize`/`downsamplingLevel`/`enableAutoPreload` 三开关、渲染节流 |
| blurExportPro（3,524B） | "模糊导出（强度+步长）TurboWrap 专用" |

官方 6 个：lmsLooksPlus（38,333B）/ lmsSkins（22,086B）/ skyhigh173JSON（48,681B）/ lmsAssets（36,414B）/ lmsSoundExpanded（30,870B）/ xeltallivclipblend（26,862B）——全部以内嵌 data URL 形式随 `lib/pixel-xxl-app.js` 装载，与原版逐字节一致。

**未集成**：`extensions-extra/qwq1018-gpu-liquid-glass-v4.js`（GPU 液态玻璃 v4）——原构建内零命中，系打包后另写方案，维持未集成原状（需 unsandboxed 拿 `renderer._gl` 才可用）。

## 5. 运行机制摘要（结合扩展源码与运行时状态实测）

1. **启动链**：进度条（素材+loadProject）→ 启动屏点击 → 174 帧开机动画 → 预渲染/取色门控（`渲染的进度 ≥ 渲染数`）→ 三页开机引导 → 桌面。
   回归实测：t25s `渲染的进度=178`、t50s `渲染的进度=671`（= 11 图标 × 61 帧预渲染皮肤）、`开机引导页` 0→1。
2. **Material You 取色管线**：壁纸 SVG → materialPalettePro（average/median/kmeans 三算法）→ light/dark tonal palette → 按 `亮度模式`（实测默认 500）选 tone → lmsLooksPlus `replaceColors` 逐控件重染 → `壁纸编号`（实测默认 3）切换时全链重跑。
3. **云母模糊**：qiaoqiaoMica 队列串行 + LRU 缓存 + 降采样，驱动壁纸 0↔16 级模糊与抽屉连续插值。
4. **预渲染变焦**：cropURL 注册 61 张不同裁切高度/圆角的皮肤，播放时仅换肤——启动预计算换运行时零开销。

（§5 第 1、2 条的"61 帧/174 帧/门控"等数值同时得到旧会话 3,012 行反编译报告与本轮运行时状态实证的双重印证。）

## 6. 移植层分析（唯一重写层：lib/project-loader.js）

| 语义点 | 原版 | 移植版 | 一致性 |
| --- | --- | --- | --- |
| 素材寻址 | zip 内 `assetId.dataFormat`（含子目录回退正则） | `assets/<assetId>.<dataFormat>`（扁平 md5 命名） | 等价：zip 内素材全部在根/单层目录，实测逐字节落盘 |
| 找不到素材 | `console.error('Asset is not in zip')` + `resolve(null)` | `console.error('Asset is not in assets/')` + `resolve(null)` | 逐条对应 |
| 素材对象 | `storage.createAsset(assetType, dataFormat, uint8, assetId)` | 同一调用 | 相同 |
| 进度条 | 解码 0.1→0.75 / zip 0.75→0.98 | project.json 解析 0.1→0.75 / 按素材计数 | 分段语义保留 |
| 重复素材 | 每次读 zip | md5 Map 缓存（只 fetch 一次） | 运行时可见行为不变 |
| GC 钩子 | `PROJECT_LOADED` 后置空 zip | 无大缓冲需 GC（按需 fetch） | 不需要 |

## 7. 无头回归记录（2026-11-08，python-playwright + chromium/swiftshader，720×900）

| 检查点 | 原版 | 移植版 |
| --- | --- | --- |
| LAUNCH READY（加载完成出启动屏） | ✓ | ✓ |
| t25 运行时状态 | targets=35，渲染进度 178/671，引导页=0，亮度模式=500，壁纸编号=3，锁屏=0 | **全等** |
| t50 运行时状态 | targets=86，渲染进度 **671/671**，引导页=1 | **全等** |
| t80 运行时状态 | 同 t50 稳定 | **全等** |
| 页面错误 | 0 | 0 |
| 截图像素差（3 检查点） | — | **bbox=None，非零像素 0（0.00%）** |

环境共性观察（**两版共有，非移植缺陷**）：swiftshader 软渲染下 qiaoqiaoMica 输出
`渲染调用失败: TypeError: renderer.render is not a function` 警告——源是扩展对渲染器
内部 API 的调用在软件 GL 环境降级路径的兼容性问题，硬件 GPU 环境无此现象。

## 8. 升级点清单（**全部未动工**——依用户指令，升级在移植与分析之后单独立项）

> 按"移植做好之前一切升级点不可靠"的原则，本节仅登记候选，不含实现。任何一条动工前须先立项并逐项源码考证。

| 候选 | 依据 | 风险提示 |
| --- | --- | --- |
| GPU 液态玻璃集成（qwq1018 v4） | 十四参数方案已存档 `extensions-extra/` | 与 qiaoqiaoMica 的"整张糊"路线是两套并存方案；unsandboxed 依赖 |
| 壁纸重压缩（SVG 壳 base64 → WebP） | 30MB+ 体积主因 | 有损；需用户裁决画质口径 |
| 素材 HTTP 缓存头 / Service Worker | 加载提速 | 改变离线行为，需回归 |
| 云变量通道收敛 | 双 wss 端点 | 在线依赖，离线需静默降级（现状已是 try/catch） |
| 存档脏值清理（开机引导页/锁屏随包保存） | 旧报告 §7-5 | 兜底自愈存在；清理需重打包 project.json（破坏"逐字节"原则，须单独立项） |

## 9. 复跑与校验入口

- 全量重建：`python3 scripts/extract_port.py`（把原始 HTML 放回 `work/Pixel.XL.0827.html` 或改脚本头两个常量）
- 无头回归：`python3 scripts/regression-headless.py`（需 8081/8082 双静态服务）
- 指纹与映射：`docs/PORTING.md`、`_original/README.md`

## 10. 架构演进决策（2026-11-08，v1.03 时点；**2026-11-08 晚注记：中期路线已由用户裁决立项，见 §10.1**）

**结论：不做 Vite+React+TS 整体重写；工程化收益用"加载层"路线兑现（v1.03 已落地一半）。**

依据（逐条对应实测）：

1. 用户体感瓶颈 = 首载 15 分钟 + 好差设备都慢 ⇒ 瓶颈在**字节量与网络**（52.8MB 素材、
   Pages 无缓存头），不在框架。换框架对这三项收益为零；v1.03（素材 -58% + SW 零网络
   二访）直接命中根因，当天可见效。
2. "好差设备都一样"反而排除了渲染/CPU 因素——若是 CPU 瓶颈，好设备应明显更快。
   剩余的设备相关项是 MOBILE.md §二的"启动空窗"（DPR3 像素处理），属梯队③议题，
   与框架无关。
3. 运行时是 TurboWarp 编译器驱动的 Canvas 程序，UI 状态在 stage 内部；
   React 的 DOM 协调层插不进主链路，引入只增加 重写风险 ≠ 收益。
4. 忠实移植的红线（core/app 逐字节）刚刚兑现为"像素差 0%"回归基线；
   整体重写会把这条基线清零重来。

两步走路线：

| 阶段 | 动作 | 状态 |
| --- | --- | --- |
| 短期（已完成） | 素材瘦身（md5 键同步）+ Service Worker（PWA 地基、离线可用、二访秒开） | v1.03 已落地 |
| 中期（梯队④立项时） | 结构性混合渲染：把静态 UI 从 Canvas 搬到 DOM/CSS——新壳本来就是新写，**那时**用 Vite + TypeScript（React 可选）搭新壳，运行时保持原样；迁移成本被混合渲染吸收，一举两得 | 待立项 |

Vite 的剩余价值何时兑现：dev server / 压缩 / 打包 / PWA 插件。其中 PWA 与"内容指纹"
已被 sw.js + md5 文件名覆盖，只剩开发体验收益——优先级低，不值得为此打破基线。

### 10.1 后续裁决注记（2026-11-08 晚 · 用户方向变更）

用户指示「先做项目迁移，md3 的连续打断与并行动画逻辑直接复用」——中期路线正式立项
（议题 #23），本节「不做 Vite+TS」结论**就新壳路线而言已被取代**；但 §10 的红线依据
（core/app 逐字节、像素差 0% 回归基线）依然全部有效，并被新壳架构继承：

- **不做整体重写**的判断未变——变的是形态：新壳以 **iframe 原样嵌根入口** 实现
  （运行时启动序列零复制，根入口 100% 保真），而非把运行时搬进框架重写；
- Vite+TS 落地为 `shell-src/`（源码）→ `shell/`（产物，Pages 双入口 `/shell/`），
  根目录保持零构建忠实态；
- 首个 L2 载体 = 控制中心/QS 磁贴 POC（vendored md3 连续打断内核 +
  VMBridge 写通道复刻工程事件链），架构与边界见 `docs/SHELL.md`；
- 验证：`scripts/shell-verify.py`（新壳三场景）+ pack-verify 五场景（L0 零破坏）。
