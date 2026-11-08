# PORTING.md — 移植映射表与校验记录

> 移植对象：`Pixel.XL.0827.html`（TurboWarp Packager 单文件，57,470,525B）
> 移植原则：**逐代码逐资源**。运行时与工程数据逐字节一致；仅"数据装载层"因
> 打包态（base85 分块 + 内存 zip）不存在于真实文件形态而做语义等价重写。
> 移植日期：2026-11-08。工具：`scripts/extract_port.py`（可复跑）。

## 一、原 HTML 结构 → 本仓库文件映射

原文件共 681 个真实 `<script>`/`<style>` 标签（另有 3 个位于运行时 bundle 字符串内的假匹配）：

| 原位置 | 原内容 | 体积 | 去向 |
| --- | --- | --- | --- |
| `<head>` + `<body>` 骨架 | meta/CSP/title、页面 CSS（style[0] 2,929B）、`#app`/`#launch`（绿旗 SVG + style[1] 113B）/#loading/#error | ~5KB | `index.html`（重建，逐字节保留） |
| script[2] | 运行时 core bundle（VM + 渲染器 + 存储 + Scaffolding 库） | 1,796,250B | `lib/turbowarp-core.js` **逐字节** |
| script[3] | app 层：DOM 引用、错误处理、进度、Scaffolding 实例配置（324×720 preserve-ratio）、云变量 provider、turbo/插值开关、**11 个内嵌扩展装载循环** | 456,746B | `lib/pixel-xxl-app.js` **逐字节** |
| script[4] | base85 解码器 + `decodeChunk` + `projectDecodeBuffer`(44,129,064B) | 1,401B | ❌ 打包态专用，由 `lib/project-loader.js` 取代 |
| script[5..678] | 674 个 `<script data="…">decodeChunk(N)</script>`（673×65536 + 23336 = 44,129,064B zip） | ~53.9MB | 解码 → 解包为 `project.json` + `assets/`（逐字节，CRC 全过） |
| script[679] | `getProjectData`（JSZip 解包 → 返回 project.json；storage helper 从 zip 按 md5 取素材） | 1,572B | 语义等价重写 → `lib/project-loader.js`（从 `assets/` fetch） |
| script[680] | `run()` 启动函数（loadProject → 进度 → 启动屏点击） | 501B | `index.html` 内联 **逐字节** |

## 二、素材清单（1:1，无增删改）

| 类型 | 数量 | 说明 |
| --- | --- | --- |
| PNG | 175 | 位图造型/缩略图 |
| SVG | 151 | 矢量造型（含 5 张内嵌 base64 照片的壁纸，单张 3.6~8.9MB——57MB 体积主因） |
| MP3 | 2 | fripSide - only my railgun / 蛋仔汤音 - 刀酱《520AM》 |
| 合计 | 328 | 命名 = project.json 内 `md5ext`（Scratch 官方存储规范） |

角色/舞台：21 个（Stage + 20 sprite）——与 project.json `targets` 数量一致。

## 三、扩展清单（11 个，与 project.json `extensions` 字段逐项对应）

| # | 文件（`extensions/`） | ID | 类别 | 体积 |
| --- | --- | --- | --- | --- |
| 0 | 00-cropURL.js | cropURL | 自写（图标→窗口 61 帧裁切） | 11,983 |
| 1 | 01-materialPalettePro.js | materialPalettePro | 自写（壁纸→tonal palette） | 3,517 |
| 2 | 02-svgconvert.js | svgconvert | 自写（SVG→dataURL） | 978 |
| 3 | 03-qiaoqiaoMica.js | qiaoqiaoMica | 自写（CPU 云母模糊，17KB） | 17,083 |
| 4 | 04-blurExportPro.js | blurExportPro | 自写（模糊导出） | 3,524 |
| 5 | 05-lmsLooksPlus.js | lmsLooksPlus | 官方（Lily LooksPlus） | 38,333 |
| 6 | 06-lmsSkins.js | lmsSkins | 官方（Lily Skins） | 22,086 |
| 7 | 07-skyhigh173JSON.js | skyhigh173JSON | 官方（skyhigh173 JSON） | 48,681 |
| 8 | 08-lmsAssets.js | lmsAssets | 官方（Lily Assets） | 36,414 |
| 9 | 09-lmsSoundExpanded.js | lmsSoundExpanded | 官方（Lily SoundExpanded） | 30,870 |
| 10 | 10-xeltallivclipblend.js | xeltallivclipblend | 官方（Xeltalliv clipping&blending） | 26,862 |

运行时实际装载走 `lib/pixel-xxl-app.js` 内嵌数组（与原版逐字节一致）；
`extensions/` 为其解码后的真实源码副本（对应内嵌 `data:text/javascript` 元素逐字节还原）。

**未集成扩展**：`extensions-extra/qwq1018-gpu-liquid-glass-v4.js`——原构建不含（全文零命中），
为作者打包后另写的 GPU 液态玻璃方案，维持"未集成"原状，仅收录存档。

## 四、唯一重写层：数据装载

原版链路：`674 分块 base85 → projectDecodeBuffer → JSZip.loadAsync → project.json + 素材(内存 zip)`
移植链路：`fetch project.json + fetch assets/<md5>.<ext> → storage.createAsset`

- `storage.addHelper({ load })` 契约、`storage.createAsset` 调用、找不到素材时
  `console.error + resolve(null)` 的降级行为，均与原版逐条对应；
- 进度条分段保持原版语义：project.json 解析 0.1 → 素材加载 0.1~0.75 → loadProject 0.75~1；
- 增加 md5 去重缓存（同素材多引用只 fetch 一次；原版每次读 zip 等价于重复解码，
  行为兼容，属加载层内部优化，不影响运行时可见行为）。

## 五、校验记录（2026-11-08 实测）

| 项 | 值 |
| --- | --- |
| 原 HTML SHA-256 | `98db52e05fe4ed38ecca4d94832532f7ebf99e82d628970cb99797ade1901308` |
| 674 分块解码产物字节数 | 44,129,064（与原版 `new ArrayBuffer(44129064)` 及尾块偏移精确一致） |
| zip PK 魔数 | ✓ `PK\x03\x04` |
| zip CRC 校验 | ✓ 329 项全过（zipfile.testzip 无异常） |
| project.json 字节数 | 1,054,272 |
| 运行时 core SHA-256 | `b5aed7bcb364843c653e7e2fb97f46af02065d60d898f33174b682783a1b4802` |
| 运行时 app SHA-256 | `d581cdb4673ec42aceaf97d6beafe58fa4ba4c3d93ac8734d7d8e1daa56debbb` |
| 残留打包态引用 | ✓ 无（`decodeChunk`/`projectDecodeBuffer`/`base85decode` 全库零命中） |
| 无头回归 | 见 `docs/ANALYSIS.md` 附录（原版 vs 本版 启动/桌面渲染比对） |

## 六、复跑方式

```bash
python3 scripts/extract_port.py   # 从原始 HTML 全量重建（需先放回 work/Pixel.XL.0827.html）
```

## 七、v1.03 加载性能版（2026-11-08）

背景：真机弱网首载约 15 分钟（56MB 素材下载主导，详见 docs/MOBILE.md §二）。
本轮在"忠实移植"红线内做加载层优化：运行时 core/app 逐字节不动，素材视觉语义
（除位图压缩编码外）零改动，工程数据仅 md5 键等长同步。

### 7.1 素材瘦身（scripts/slim_assets.py）

- 原理：10 张大 SVG（含 5 张壁纸，最大 8.95MB）= 矢量薄壳 + 内嵌 base64 位图照片，
  PNG 编码的照片是体积爆炸根源；只替换壳内位图载荷为 WebP q90（method=6），
  分辨率不降（最长边上限 2436 = 原素材原生分辨率），SVG 壳逐字节保留，
  `.svg` 扩展名与 dataFormat 语义不变；
- 内容变 → md5 变 → 文件随 md5 改名，project.json 的 assetId/md5ext 同步（10 处，等长替换）；
  改名前已核实：md5 仅被 project.json 引用（core/app/extensions 零引用），改名安全；
- 结果：assets 总量 52.8MB → 22.34MB（-58%）；10 张 SVG 合计 34.1MB → 3.4MB；
- 保真度（scripts/slim-verify.py，git 历史旧图 vs 新图，240px 宽 canvas 逐像素比对）：
  mean diff ≤ 0.63/255，差值 >24 的像素占比 0.000%，max ≤ 9/255 —— 肉眼不可分辨；
- 完整性（loader 真实取数口径 `assetId.dataFormat`）：missing=0、orphan=0
  （时钟-时/分/秒 3 条目本就无 md5ext 字段，v1.00 起即如此，非本轮引入）。

### 7.2 Service Worker 缓存层（sw.js + index.html 尾部注册脚本）

- 本轮唯一壳层改动：index.html 仅追加注册脚本（原骨架逐字节保留）；
- 策略：assets/*（md5 内容寻址=不可变）cache-first 永久缓存；lib/*、project.json
  stale-while-revalidate；index.html network-first；发版递增 sw.js VERSION 清旧缓存；
- 弥补 GitHub Pages 不可自定义 Cache-Control（默认 max-age=600，328 素材二次访问
  仍要 304 往返）的平台限制；
- 实测（本地 chromium，scripts/slim-verify.py）：首访 0 素材 404 / 0 页面错误；
  二次访问 246/246 素材 transferSize=0（零网络命中缓存）。

### 7.3 保留项与待裁决

- PNG 长尾 12.7MB（61 个 >100KB）未动：core 存储层位图 MIME 映射实测仅
  `ImageBitmap:{contentType:"image/png"}`（`image/webp` 零命中），转 WebP 需改
  dataFormat 语义，待立项裁决后再动；
- MP3 共 6.0MB 未动（音质口径待裁决；可 128kbps 重编码约 -60%）；
- 启动空窗期进度反馈（MOBILE.md 修复路线 #4）未动：门控计数器在 app bundle
  闭包内无全局出口，动它需要触碰"app 层逐字节一致"红线，单独立项。

## 八、v1.04 资产合并包层（2026-11-08）

背景：v1.03 后首访字节数减半，但 328 个素材仍逐个 fetch——弱网/高延迟链路下
每请求的排队与握手是「好设备差设备都慢」的另一半元凶。本轮把请求维度也打掉：
**首访素材请求 328 → 1**。运行时 core/app 仍逐字节不动。

### 8.1 合并包（scripts/build-pack.py → assets/pack-2a59a28a.bin）

- 328 个素材按文件名排序拼接为单个 22,339,222B 内容寻址包，
  包名 `pack-<sha256[:8]>.bin`（内容变 ⇒ 名变 ⇒ SW 视为不可变，cache-first 不串档）；
- 清单（文件名 → [offset,size]）内嵌于 `lib/project-loader.js` 的
  BEGIN/END PACK 自动生成区（≈14KB，省一次索引请求）；
- 素材内容变更后重跑 `python3 scripts/build-pack.py` 即可再生包并同步标记区
  （旧包自动删除）。

### 8.2 加载层（lib/project-loader.js，唯一语义重写层的追加演进）

- 模块初始化即启动包下载（与 project.json fetch 并行，吃满带宽）；
- 流式读取，下载进度直驱 HTML 进度条 0.1→0.75 段（v1.03 前素材逐个计数驱动的
  同段语义保持，长包下载期间进度条不再停滞）；
- `storage.addHelper.load`：包清单命中 → `Uint8Array(buffer, offset, size)` 切片交付
  （与逐文件版同为视图、零拷贝）；包不可用/下载失败/未登记文件名 →
  回退逐文件 fetch（v1.00 语义原样保留，且逐文件路径仍经 SW 缓存）。

### 8.3 壳层启动空窗提示（index.html，加法式修改）

- 点击启动后画布存在壁纸取色/云母/预渲染主线程空窗（黑屏、输入被吞，
  见 MOBILE.md §二）；壳层新增 `#boot-hint` 提示条（pointer-events:none 不拦截点击），
  画布出现亮帧即隐藏；WebGL 无 preserveDrawingBuffer（twgl 创建，antialias:false），
  采样不可靠时 20s 封顶隐藏。

### 8.4 验证（scripts/pack-verify.py，证据 docs/pack-verify.json）

- A 正常链路：pack 恰 1 次请求、逐文件 fetch=0、0 HTTP≥400、0 报错、启动屏出现、
  提示条出现且自动隐藏、vm targets=35；
- B SW 二访（同浏览器 reload）：pack transferSize=0（零网络）；
- C 兜底：拦截 pack 请求 → 回退 360 次逐文件 fetch，装载链完整（仅预期网络噪声）；
- 权威回归（scripts/regression-headless.py，双版三检查点）：移植版与原版单文件
  运行时状态演化一致（targets 35→86、渲染的进度→671、开机引导页 0→1、
  0 页面错误；swiftshader 伪影告警两版同在，非移植引入）。

### 8.5 首访请求账（对「好设备差设备都一样慢」的量化回答）

| 阶段 | 素材字节数 | 素材请求数 | 说明 |
| --- | --- | --- | --- |
| v1.02 及以前 | 52.8MB | 328 | 字节+请求双高 |
| v1.03 | 22.34MB | 328 | 字节减半，请求仍高 |
| v1.04 | 22.34MB | **1**（包） | 弱网延迟大头（每请求排队/握手）消除 |

剩余待裁决项不变（§7.3）：PNG 长尾 12.7MB、MP3 6.0MB。

## 九、v1.05 分片包 + CDN 前置 + 真实启动进度（2026-11-08）

背景：用户裁决「先把进度条改掉」——体感两大问题：① 首访字节全走 GitHub Pages
（大陆链路慢、且与设备好坏无关）；② 点击启动后有一段黑屏空窗，此时 HTML 进度条已
消失，体感"卡死/点不动"。

### 9.1 分片包（scripts/build-pack.py → pack-2a59a28a-p1/p2.bin）

- jsDelivr GH 源单文件上限 20MB（实测 403 "File size exceeded the configured limit
  of 20 MB."），22.34MB 拆为 2 片（14.92MB + 7.42MB），内容指纹不变（同 stem）；
- PACK 清单升级：`files: {md5ext: [分片号, 片内offset, 长度]}`，两片并行下载。

### 9.2 CDN 前置与回退链（lib/project-loader.js）

- 每片两个源：`https://cdn.jsdelivr.net/gh/<repo>@main/assets/<part>`（实测 CORS
  `access-control-allow-origin: *`、CDN 缓存 12h）优先 → **首字节 6s 超时**
  （AbortController，防 CDN 拥塞卡死）或失败即切同源 `assets/<part>`（SW cache-first，
  二访零网络）→ 全失败逐文件兜底（v1.00 语义原样）；
- SW v1.05：jsDelivr 的 pack 分片同样纳入 ASSET_CACHE cache-first（cors 响应可安全
  缓存）——哪个源命中就缓存哪个源，跨版本内容寻址不串档；
- 分片进度按片累计上报，并行下载下进度条 0.1→0.75 段依然平滑。

### 9.3 真实启动进度条（index.html #boot-hint 升级）

- 数据源：运行时 Scratch 变量「渲染的进度/渲染数」（回归实测位于 stage.variables，
  `window.vm` 全局可读）——壳层只读，不触碰 app 层逐字节红线；
- 点击启动后显示「正在准备桌面素材 N%…」+ 180px 迷你进度条（0.3s 平滑过渡）；
- 隐藏条件：画布亮帧（开机动画开始）或 进度满 ~4s 或 180s 硬封顶；
- 顺带修复 v1.04 的 20s 封顶过早消失（软渲染空窗 ~144s 远超 20s）。

### 9.4 验证（scripts/pack-verify.py，证据 docs/pack-verify.json）

- A：分片 2 次装载、CDN 尝试 2 次（本地未推送期 404→按设计回退同源）、逐文件=0、
  提示条真实百分比（实测文案「正在准备桌面素材 52%…」）并自动隐藏、0 报错、
  vm targets=80；
- B：SW 二访两分片 transferSize=0（零网络）；
- C：拦截分片 → 360 次逐文件兜底完整；
- 权威回归（regression-headless.py 双版三检查点）：targets 35→86、渲染的进度→671、
  开机引导页 0→1、0 页面错误，移植版与原版一致。

### 9.5 用户体感账（对「一点进去一小会就进去」的回答）

| 场景 | v1.02 及以前 | v1.05 |
| --- | --- | --- |
| 首访字节 | 52.8MB | 22.34MB |
| 首访请求数 | 328 | **2**（CDN 优先，超时自动切同源） |
| 弱网路径 | GitHub Pages 单路 | jsDelivr CDN + GitHub Pages 双路 |
| 点击启动后 | 黑屏无反馈 | 真实百分比进度条 |
| 二次访问 | 328 × 304 往返 | SW 缓存零网络 |

待裁决项不变（§7.3）：PNG 长尾 12.7MB、MP3 6.0MB。

## 十、v1.06 IndexedDB 本地素材库 + 双源竞速（2026-11-08）

> 对应用户反馈：「下载完成之后，初始化又要很长时间，并且貌似没有持久化，
> 导致每次重建都需要重载」——两个独立根因，均已修复并验证。
>
> 撞号合流注记（三度）：对侧 v1.06（f904330 IndexedDB+双源竞速）与本方 v1.06（e28beee
> 三缺陷修复）同号交叉——双方独立发现并修复同一 sw.js isPackCdn 死代码缺陷（互证）；
> 分片下载面取对侧竞速+IDB 版（先完成者胜，优于本方硬超时切源，hardTimer 逻辑弃用）；
> 本方存续价值 = ①#boot-feedback 渲染段全屏层（对侧 #loading-note 管下载段，两段正交）
> ②pack-verify 的 #boot-feedback 断言迁移与环境无关双源命中口径 ③boot-feedback-probe
> 三通道冒烟脚本。

### 10.1 根因一：CDN 前置击穿了 SW 持久化（v1.05 引入的回归）

- sw.js fetch handler 首行 `if (url.origin !== location.origin) return;` 对一切跨域
  请求放行 → §9.2 所称「jsDelivr 分片纳入 ASSET_CACHE cache-first」**永远执行不到**；
- 走 CDN 的首访在 SW 层零持久化；二访 loader 仍先打 CDN——快则重下 22MB，
  慢则白等 6s 首字节超时再切同源。「每次重建都需要重载」的主因。

### 10.2 根因二：CDN 慢速流防不住（首字节超时的盲区）

- 无头诊断实测：jsDelivr 首字节 <6s 返回（不清超时），但 body 流速极低，
  22MB 拖到 5 分钟仍未完成，素材加载全部 pending 在 ensurePack 上；
- 首字节超时只防「完全无响应」，防不住「慢速流」——用户「初始化又要
  很长时间」体验的另一半来源。

### 10.3 修复（lib/project-loader.js / sw.js / index.html，运行时仍逐字节不动）

1. **IndexedDB 本地素材库**（分片读序：内存 → IDB → 双源竞速 → 逐文件兜底）：
   - 分片完整下载后写入 `pixel-xxl-assets/parts`（键=内容寻址分片名，按大小校验，
     半写/换代旧档视为未命中）；
   - 二访 IDB 命中 ⇒ 分片 0 网络请求，且**不依赖 SW**：iOS Safari 7 天不用即清
     Cache API、微信/WebView 内核常禁 SW，IndexedDB 在上述环境均可用；
   - 全量就绪后请求 `navigator.storage.persist()`（防配额逐出）；旧分片换代自动清理；
2. **双源竞速**（替换 v1.05「CDN 优先→同源」串行链）：
   - 同源/CDN 并行，任一完成即胜出并 AbortController 中止落败源，总时间=min(两源)；
   - SW 缓存命中的同源请求秒回直接胜出；进度取双源较大值防回跳；
   - 代价：首访流量最多 2x22MB（弱网流量换时间）；
3. **sw.js 跨域放行修复**：仅对 CDN pack 分片放行（cache.put 静默容错），
   其余跨域照旧不接管；VERSION v1.06；
4. **加载屏四态文案**（index.html #loading-note，加法）：轮询 loader 暴露的
   `__packState()`——「首次下载中 X% / 已从本地素材库载入 / 逐文件兜底 / 解码中」，
   为 0.75→1.0 无细分进度事件的解码段给出诚实预期。

### 10.4 验证（scripts/pack-verify.py，证据 docs/pack-verify.json）

- A：正常链路 + **首访后 IDB 分片计数=2** + 反馈层真实百分比自动收层；
- B：二访 reload → **分片网络请求=0**、`__packSource()==='idb'`、SW 受控；
- C：拦截全部网络源 → 360 次逐文件兜底完整；
- E：**清 IDB**（同源页删库）+ 拦 CDN → reload 走同源网络（SW 写入）→
  再清 IDB reload → **同源分片 transferSize=0（SW cache-first 命中）** + IDB 重新写入；
  即 IDB 失效（iOS 配额逐出等）时 SW 兜底层独立成立；
- 权威回归（regression-headless.py 双版三检查点）一致、0 页面错误；
- 无头双访体感：首访 28s（localhost 基准）/ 二访 0 下载直达解码段，
  二访文案「已从本地素材库载入素材包」。

### 10.5 用户体感账（v1.06）

| 场景 | 首访 | 二访（v1.05） | 二访（v1.06） |
| --- | --- | --- | --- |
| 分片下载 | 竞速 22MB（min 双源） | 全量重下 22MB | **0（IndexedDB）** |
| SW 兜底 | — | 仅同源路径生效 | 含 CDN 分片（跨域 bug 已修） |
| 加载屏反馈 | 下载 X% 真实进度 | 无 | 四态真实状态 |

## 十一、#boot-feedback 启动屏反馈完整层（对侧谱系 v1.04→v1.07，撞号合流终形态）

背景：修复路线 #4（docs/MOBILE.md §三）——点击绿旗后进入运行时编译/软渲染空窗
（低端设备实测约 144 秒），屏幕全黑零反馈，用户体感「黑屏点不动」。
上轮 §7.3 记载的顾虑是「门控计数器在 app bundle 闭包内无全局出口，动它需要触碰
app 层红线」——本轮方案**绕开红线**：不改 app bundle 内部任何逻辑，改为
**纯追加外部观察层**，用运行时可观察信号间接推断启动阶段。

### 11.1 方案（index.html 尾部追加 script，v1.03 SW 注册先例同律，骨架逐字节零改动）

- **触发**：MutationObserver 监听 `#launch` 的 `hidden` 属性——点击绿旗瞬间
  （launchScreen.hidden = true）叠加 `#boot-feedback` 全屏反馈层（z-index 9999，
  黑底 + 标题 + 阶段文案 aria-live=polite + 已启动秒数 + 阶段进度条 + 脉冲动画点）；
- **阶段推断**（watchdog 每秒轮询外部信号，零 app 层触碰）：
  `window.vm` 未出现 →「运行时启动中…」；targets < 3 →「装载舞台与角色…」；
  targets 就绪但 `runtime.threads` 空 →「编译工程数据…」；threads 非空 →「渲染首帧…」；
- **数据源双通道**：优先读运行时 Scratch 变量「渲染的进度/渲染数」
  （`window.vm` 全局可读，v1.05 对侧修正 v1.02「门控无出口」误判），
  变量不可读时退回阶段推断；
- **收层五通道**：①画面点亮（drawImage 64×48 采样非黑像素占比 > 0.5% 连续 2 次
  防抖 → 350ms 后收层）②像素通道失效（drawImage/getImageData 抛错）时保守放行
  （threads 曾非空 + 100s）③进度满 ~4s 退场 ④180s 硬封顶 ⑤`#error` 屏显示立即收层；
- **长空窗提示**：>45s 显示「低性能设备首次启动可能需要 1~3 分钟」；>150s 显示
  「长时间未点亮」建议行；
- **回归兼容**：URL 带 `?nofb=1` 不安装（节点不创建、行为与 v1.03 逐字节一致）
  ——双版像素对比回归（scripts/regression-headless.py）走此通道。

### 11.2 实测证据（scripts/boot-feedback-probe.py → docs/boot-feedback-evidence.json）

- A（nofb 豁免）：installed=false、fb 节点不存在、vm 正常启动 targets=24、零 pageerror；
- B（桌面 720×900 全链路）：点击 1.5s 内层出现（阶段「渲染首帧…」threads=14）、
  计时/进度条正常推进、hint 48.2s 准时出现、301s 全局兜底收层、收层后不重挂、
  零 pageerror；
- C（移动仿真 390×844 DPR3 touch）：层出现、阶段文案正常、零 pageerror；
- verdict=PASS。desktop_lit=false 系 headless swiftshader 黑屏伪影
  （docs/MOBILE.md §一），真机 GPU 下像素点亮通道待真机验收。

> 撞号合流注记（一度/二度）：本段原随对侧谱系 v1.04（4a7343c）提交，历经 f7ed235
> （v1.05 合流）、4971735（v1.06 合流）演进；对侧 #boot-hint 轻量提示条被本层
> 超集覆盖移除（二度）。五度撞号融合（18197ef）对 #loading-note 下载段四态文案与
> 本层渲染段全屏层正交并留。

## 十二、v1.08 进度条单调化：修复「先跑完一根条、再出现一根真条」（本方 v1.07 重滚）

> 撞号合流注记（六度）：本方 v1.07（5c2d183 进度条单调化）与对侧 v1.07（18197ef
> 五度撞号融合版）同号交叉；合流终树取两方并集——对侧 #boot-feedback 全屏层与
> 本方进度条单调化正交（下载段/解码段 vs 渲染段），版本重滚 v1.08 防倒挂。

### 12.1 现象与根因（用户原话：进页先有一根加载条跑完，之后才出现真正的资源加载条）

取证（scripts/bar-trace.py，证据 docs/bar-trace.json）：只有一根条（#loading-inner），
但宽度序列存在**回跳**——

| 场景 | 宽度序列 | 回跳 |
| --- | --- | --- |
| 首访 | 10% → 75% → **10.57%** → …重填… → 98% → 100% | 75→10.57 |
| 二访（IDB 命中） | 10% → 75% → **31.59%** → 75% → 98% → 100% | 75→31.59 |

根因：v1.00 口径里「素材段=真实逐文件下载」，与下载段共用 0.1→0.75 映射；
v1.04 引入包下载后两段撞段——包下载把条推到 75%（`interpolate(0.1,0.75,1)`），
随后第一个素材走内存切片交付，`reportProgress()` 落到素材分支
`interpolate(0.1,0.75, 1/328)≈10.2%`，**条被拉回 10% 重填**，视觉上像两根条。

### 12.2 修复（lib/project-loader.js / index.html / sw.js，运行时仍逐字节不动）

1. **段衔接**：pack 命中（packBuffer）时素材属「解码」而非「下载」，段映射改为
   0.75→0.98，与下载段无缝衔接；逐文件兜底（packFailed）仍为真实网络下载，
   保留 0.1→0.75 口径；
2. **单调闸 emitProgress**：loader 侧全部 setProgress（下载逐字节/素材逐件/
   storage.onprogress 三源）过 `v>last` 闸门，只进不退，交错汇报不再回跳；
3. **解码进度可见**：`__packState()` 增加 `assets:{loaded,total}`，加载屏
   素材包就绪后显示「解码素材 X%」（本地瞬时完成时该态一闪而过，真实网络可见）；
   解码完进入「正在构建桌面…」（vm.loadProject 长尾，无细分事件，诚实文案）；
4. **反馈层措辞**：#boot-feedback 渲染段文案「正在准备桌面素材 N%」→
   「正在渲染桌面 N%…（非下载；首次启动需渲染，之后更快）」，与下载/解码明确区分；
5. sw.js VERSION v1.08（壳层更新失效旧缓存；素材/分片未变，ASSET_CACHE 不动）。

### 12.3 验证（合流终树复跑）

- bar-trace.py：首访/二访宽度序列均单调不减（drops=0），verdict PASS；
- pack-verify.py 五场景（A 首访/B IDB 二访/C 逐文件兜底/E SW 兜底）全绿；
- 权威回归（regression-headless.py）：双版三检查点一致（targets 35→86、
  开机引导页 0→1、渲染进度→671），0 页面错误。

### 12.4 段位账（v1.08 后用户看到的进度条语义）

| 段 | 驱动 | 含义 |
| --- | --- | --- |
| 0→10% | app 层（原版逻辑） | 运行时初始化 |
| 10→75% | 分片字节进度 | 素材包下载（二访 IDB 秒过） |
| 75→98% | 素材逐件切片交付 | 解码素材 X% |
| 98→100% | vm.loadProject | 构建桌面（诚实文案，无细分事件） |
| 启动后 #boot-feedback | Scratch 变量「渲染的进度/渲染数」 | 渲染桌面（非下载） |

## 十三、v1.10 动画连贯性升级（帧率自适应匹配刷新率 · 2026-11-08）

> 任务源：用户实时指令「继续工作，重点修复打开关闭动画中间不连贯」（R131 窗，
> 认领帖 pixel-xxl#1 6718814556 先于动工）。

### 12.1 诊断实录（scripts/anim-probe.py 逐帧 trace + 积木链路精读）

- 动画机制：开/关应用 = cropURL 61 张预渲染裁切皮肤逐 tick 换肤
  （lmsSkins_setSkin，皮肤名 `{app}-APP{1..61}`）+ 逐 tick 指数逼近运动
  （填充图标宽 += (515-宽)/8 等）+ 壁纸 zoom（zz 角色 size→90/110 ÷/15）；
  皮肤全部在开机预渲染脚本 Z*（start_as_clone 身份==1）注册，运行时零实时裁切；
- **根因**：`lib/pixel-xxl-app.js` 原生 `if (vm.setFramerate) vm.setFramerate(120)`
  ——打包 app 120 tick/s（ANALYSIS §2 历史文档漏记，已补正）；多数设备 60Hz，
  TurboWarp 插值只平滑运动、**换肤不可插值**：每显示帧跨 2 tick，约一半皮肤
  状态从未上屏；中段裁切增量最快（Δ5~6px/张）且指数速度峰值处一 tick 跳多张，
  每显示帧合并 4~6 张 ⇒ 用户感知「中间不连贯」；
- 排除项（实测）：素材 fetch 动画窗口 0 次（328 素材开机全装载）、
  #boot-feedback（收层后 setInterval 已清零触碰）、qiaoqiaoMica 队列外无新增主线程任务。

### 12.2 修复机制（index.html 尾部追加 v1.10 块，骨架零改动先例同律）

1. **自适应帧率**：vm 就绪后实测 rAF 刷新率（40 个间隔取中位），吸附最近档
   [60/90/120]（实测不可用底线 60）——60Hz 屏 60 tick/s 让每 tick 换肤都上屏，
   120Hz 屏保持原生 120 零变化；
2. **覆写夺回守卫**：打包 app 初始化晚于 window.vm 可见且会一次性
   `setFramerate(120)`（四通道探针实证捕获），监听 `FRAMERATE_CHANGED`
   立即恢复目标值（上限 5 次）；看门狗内部变更打 internal 标志不自搏；
3. **弱机看门狗**（仅缺省路径）：包裹 runtime._step 采样，滚动 240 tick 中位
   间隔 > 1.6× 帧预算 → 一次性降半档（120→60 / 60→30，下限 30）；
   软渲染无头实测触发（中位 40ms > 预算 27ms）；
4. **逃生门**：`?fps=N`(10~120) 显式指定（看门狗豁免）；`?fps=orig` 完全不动
   （原始 120fps 节奏，双版像素对比回归基线通道不受影响）。

### 12.3 验证（docs/fps-probe-evidence.json，scripts/fps-probe.py）

四通道 PASS 零 pageerror：A 缺省 60→弱机降级 30 / B 显式 30 尊重 /
C orig 通道原生 120 零触碰 / D 显式 90 + 覆写夺回 + 看门狗豁免；
pack-verify 五场景回归另跑（本窗追加）。

### 12.4 影响面与回退

- 影响面：仅 VM tick 率（60Hz 设备 120→60，动画时长 ~2×，节奏更接近原生
  30fps 时代的体感但每 tick 均匀）；其余运行时行为零变化；
- 回退：`?fps=orig` 逐字节回原始节奏；删除尾部 v1.10 块即完全还原（无骨架改动）。
