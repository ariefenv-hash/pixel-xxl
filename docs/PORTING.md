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
