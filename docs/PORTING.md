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

## 八、v1.04 启动屏进度反馈版（2026-11-08）

背景：修复路线 #4（docs/MOBILE.md §三）——点击绿旗后进入运行时编译/软渲染空窗
（低端设备实测约 144 秒），屏幕全黑零反馈，用户体感「黑屏点不动」。
上轮 §7.3 记载的顾虑是「门控计数器在 app bundle 闭包内无全局出口，动它需要触碰
app 层红线」——本轮方案**绕开红线**：不改 app bundle 内部任何逻辑，改为
**纯追加外部观察层**，用运行时可观察信号间接推断启动阶段。

### 8.1 方案（index.html 尾部追加 script，v1.03 SW 注册先例同律，骨架逐字节零改动）

- **触发**：MutationObserver 监听 `#launch` 的 `hidden` 属性——点击绿旗瞬间
  （launchScreen.hidden = true）叠加 `#boot-feedback` 全屏反馈层（z-index 9999，
  黑底 + 标题 + 阶段文案 aria-live=polite + 已启动秒数 + 阶段进度条 + 脉冲动画点）；
- **阶段推断**（watchdog 每秒轮询外部信号，零 app 层触碰）：
  `window.vm` 未出现 →「运行时启动中…」；targets < 3 →「装载舞台与角色…」；
  targets 就绪但 `runtime.threads` 空 →「编译工程数据…」；threads 非空 →「渲染首帧…」；
- **收层四通道**：①画面点亮（drawImage 64×48 采样非黑像素占比 > 0.5% 连续 2 次
  防抖 → 350ms 后收层）②像素通道失效（drawImage/getImageData 抛错）时保守放行
  （threads 曾非空 + 100s）③全局兜底 300s 强制收层（任何渲染栈下反馈层不允许
  超过 5 分钟）④`#error` 屏显示立即收层（错误信息优先）；
- **长空窗提示**：>45s 显示「低性能设备首次启动可能需要 1~3 分钟」；>150s 显示
  「长时间未点亮」建议行；
- **回归兼容**：URL 带 `?nofb=1` 不安装（节点不创建、行为与 v1.03 逐字节一致）
  ——双版像素对比回归（scripts/regression-headless.py）走此通道。

### 8.2 实测证据（scripts/boot-feedback-probe.py → docs/boot-feedback-evidence.json）

- A（nofb 豁免）：installed=false、fb 节点不存在、vm 正常启动 targets=24、零 pageerror；
- B（桌面 720×900 全链路）：点击 1.5s 内层出现（阶段「渲染首帧…」threads=14）、
  计时/进度条正常推进、hint 48.2s 准时出现、301s 全局兜底收层、收层后不重挂、
  零 pageerror；
- C（移动仿真 390×844 DPR3 touch）：层出现、阶段文案正常、零 pageerror；
- verdict=PASS。desktop_lit=false 系 headless swiftshader 黑屏伪影
  （docs/MOBILE.md §一），真机 GPU 下像素点亮通道待真机验收。

### 8.3 已知边界

- headless swiftshader 下画面恒黑（伪影），点亮通道不触发 → 300s 兜底收层是
  设计内正确行为；真机 GPU 下画面点亮即收（350ms 防抖）。
- `_tickCounter` 属性在打包 runtime 上不存在（实测恒 undefined），运行信号采用
  `runtime.threads.length`（scratch-vm 稳定 API）。
