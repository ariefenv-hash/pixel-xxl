# HANDOFF — v2 交接

> generated: 2026-11-14 · 本窗 = 从 Scratch 运行时整体切换到纯 Web 重写（#35）

## 一、这一窗发生了什么

v1 是「Scratch（TurboWarp）工程的拆分移植」：能跑，但初始化要 60~120 秒（低端机 144 秒）。
逐层优化到最后发现根因是结构性的——**每次打开都在重算一遍本该在构建期算完的东西**：
671 帧皮肤（`toDataURL` PNG 往返，单帧 46ms）、壁纸取色、全部渲染都在设备上现场跑。

v2 的做法不是继续打补丁，而是整体换掉运行时：

- **删除**：`project.json`、`lib/`（scratch-vm + renderer）、`extensions/`（11 个扩展）、
  `assets/`（358 件 Scratch 素材包）、`shell/`、`shell-src/`、旧 `sw.js`、19 个旧探针脚本；
- **保留**：`docs/DESIGN-SPEC.md`（设计令牌单一真源）、`DESIGN-SPEC-AUDIT`、`ANALYSIS.md`、
  `PORTING.md`、`MOBILE.md`、`ANDROID-PORTING.md`（作为「为什么重写」的取证材料）；
- **新建**：`src/`（零框架 TS）、`scripts/`（HCT 调色板烘焙 / 壁纸转码 / 性能门禁）、
  `docs/ARCHITECTURE.md`、`docs/PERF.md`。

## 二、结果

| | v1 | v2 |
| --- | --- | --- |
| 首次可交互 | 60~120 s | **0.39 s** |
| 首屏传输 | 22 MB + 1.8 MB 运行时 | **50.7 KB** |
| 长任务 | — | **0** |

实测条件：Chromium 420×910，4G 1.6Mbps / RTT 150ms，CPU 4x 节流。CI 每个 push 都量。

## 三、外部待确认

1. **GitHub Pages 部署方式已从 legacy 改为 GitHub Actions**（`build_type=workflow`）。
   旧模式从 main 根目录直出，v2 的产物在 `dist/`，必须走 Actions。
   若 Pages 面板显示异常，检查 Settings → Pages → Source 是否为 "GitHub Actions"。
2. **素材版权**：壁纸与音频来自原 Scratch 工程（`pixel-xxl`），未做版权登记。
   v2 只转码不新增，若对外分发需按原工程口径处理（参照 #24/#28 的登记要求）。
3. **9 个占位 app**：原工程这 9 个也是 213 块的同构占位，v2 保持同等诚实度（占位页 +
   功能计划），未伪造界面。

## 四、下窗续点

1. **占位 app 真功能化**：建议顺序 相册 → 视频 → 电话（都有明确 AOSP 参照）；
2. **Recents 真快照**：目前是图标水印，真缩略图需要离屏渲染或 `html2canvas` 类方案，
   需先评估开销是否值得；
3. **锁屏完整化**：当前 `?lock=1` 才进锁屏，默认直接桌面。若要默认锁屏，
   需要把「桌面可见」预算改成分阶段预算；
4. **字体一致性**：中文在部分 Android WebView 上字重偏细，可考虑 subset 后的
   单字重 woff2（约 8KB），但会破「零 Web Font」，需权衡。

## 五、纪律（沿用 v1）

- 设计值必须标出处（`aosp:` / `material:` / `self:`），不得有无出处的魔数；
- 性能预算改动必须同时改 `scripts/perf-gate.py` 的 BUDGET 与 `docs/PERF.md`；
- 任何新增 app 必须实现卸载函数（清定时器/音频/监听），否则会在 Recents 里泄漏。
