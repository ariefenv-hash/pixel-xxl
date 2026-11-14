# HANDOFF — v2 交接

> generated: 2026-11-14 · 本窗 = 从 Scratch 运行时整体切换到纯 Web 重写（#35）

## 〇、已发布状态（2026-11-14 收窗）

| 项 | 值 |
| --- | --- |
| 版本 | **v2.2.0**（v2.0 整仓重写 → v2.1 动效重建 → v2.2 固件对齐） |
| commit | `866b928`（重写）→ `3c2ae78`（图标去重）→ `d855559`（窗口按中心插值）→ **`03d7091`（v2.2 主体）** |
| 线上 | <https://ariefenv-hash.github.io/pixel-xxl/>（Pages `build_type=workflow`，产物 `index-BAIbUF9N.js`） |
| CI | `43596155611`：`gates` ✅（typecheck / build / perf-gate）+ `deploy` ✅ |
| 交接 | 议题 **#35**（兼 CI 红灯登记处）· 交付记录 议题 #34 |
| 实测 | 可交互 **555 ms** · FCP **344 ms** · 首传 **63.6 KB** · 长任务 1（128 ms）· 页面错误 0 · **PASS** |

> 本次推送走的是 **Git Data API**（blob → tree → commit → `PATCH refs/heads/main`），
> 因为沙箱到 `github.com` 的 git-pack 传输被限到 <1 KB/s（`curl 28` / `Operation too slow`），
> 而 `api.github.com` 正常。仓库内容与产物一致，历史以远端 `d855559` 为父提交，没有强推。

`npm run gate` 可直接在本地复跑同一套门禁（需 `pip install playwright && playwright install chromium`）；
门禁不通过退出码 1，不要绕过，改预算要同时改 `src/core/perf.ts`、`scripts/perf-gate.py`、`docs/PERF.md` 三处。

## 〇·二、动效（v2.1，用户点名的重点）

**这一版之前我把开/关动画砍成了「淡入 + 缩放」，被用户直接指出——那是削掉了整个项目
唯一不可替代的东西。** 现已按 AOSP 与 md3 内核重建：

- `src/motion/launch.ts` —— 容器变换：窗口从图标的那个正方形长到全屏，
  开 500ms / 关 250ms、主曲线 emphasized、X 走 app_open_x、图标色块 + 图标克隆 + 内容
  三层叠加；关窗是开窗曲线的时间镜像。
- `src/motion/predictive.ts` + `back-indicator.ts` —— 预测式返回：**105dp 边缘面板**起手、
  16dp 激活、412dp 归一进度、指示器比指尖高 64dp；小球在 entry(0×48)/pre(51×46)/
  active(48×48)/stretch(60×48)/committed(0.86) 五态间走 AOSP 弹簧形变。
- `src/motion/vendor/` —— md3 内核原样内嵌（解析解弹簧、定时轴打断协议、AOSP 曲线、IIO）。
- `docs/MOTION-SPEC.md` —— 每个数值的出处（AOSP 资源名 / md3 常量 / 原 Scratch 公式）；
  `docs/aosp/` 存了 AOSP 原始文件，可直接 grep 验证。

慢放检视：`window.__launchSpeed = 0.1`。4× CPU 节流实测开窗恒定 17ms/帧、10 次开合 0 长任务。

## 〇·三、v2.2（2026-11-14 返工）

用户点名四件事，逐项补齐（细节在 `docs/MOTION-SPEC.md` §二、§五~§八）：

1. **返回手势触发太难**：热区 24px → 105dp（`navigation_edge_panel_width`），加 pointer capture、
   纵向让位、按 412dp 归一；实测 10/10 提交。小球不再固定 48×48，改为 AOSP 五态形变。
2. **小组件开合**：桌面加模拟/数字两个时钟组件，按 QSTM `getOpeningWindowAnimatorsForWidget`
   的 500ms 时间轴（前景 62.5ms 淡出、预览 62.5ms 淡入、圆角 max(w,h)/2→24）打开与收回。
3. **All Apps / Dock / 图标遮罩与形变**：上滑抽屉（跟手 + 弹簧 600/0.9 + 错峰淡入）；
   开窗头段 Dock 与图标随 `--launch-icons` 一起退场；图标按压 scale(.9)+径向高光，
   克隆体纵向 9-slice 拉伸。
4. **上滑 / 长按进后台 + Recents bug**：窗口跟手缩小，320ms 长按判定，松手吸成卡片；
   卡片恢复复用同一窗口（336ms），点空白退出。原工程「点卡片没反应」的根因写在 MOTION-SPEC §五。
5. **扩展迁移**：11+1 个扩展按能力重构，对照表见 `docs/EXTENSIONS.md`。

## 〇·四、v2.2 复盘（收窗前的最后一轮）

用户对上一轮的回答是「触发还是难、小球跟原版差得远、小组件开合没做、抽屉没做、Dock/图标
联动没做」——**这些都是「有没有对着固件做」的问题，不是「做没做」的问题**。这一轮的做法：

- 先把原工程 `project.json` 反编译（`/tmp/dump.py`），拿到真实公式（All Apps 的 y/阻尼、
  `后台=0.5` 由 `触控` 角色写入、`后台触控计算()` 的图层序判定），再改代码；
- 再按 `docs/aosp/` 里的 SystemUI / Launcher3 快照逐值对齐，数值一律写成资源名；
- 三轮返工里改掉的两个**自身破绽**（都已写进 MOTION-SPEC，避免下次重犯）：
  1. 组件开窗曾把「组件克隆体」放到窗口下面、让窗口底色从 0 拉起 —— 中途能看到桌面图标
     浮在窗口内部。正解是 **窗口第一帧就不透明 + 含壁纸像素的组件快照压在上面渐隐**（§七）；
  2. 小球曾一锁定就跳 `active`，pre-threshold 的 51×46 peek 态不可达 —— 观感就是「凭空
     出现一个圆」。现在 8px 给 peek、16dp 才收成整圆（§2.1）。

**取证边界（本轮如实登记）**：沙箱直连 `raw.githubusercontent.com` /
`android.googlesource.com` 全部超时（curl exit 28），AOSP 侧依据是
`docs/aosp/systemui/{EdgePanelParams.kt, BackPanelController.kt, BackPanel.kt, dimens.xml}`
的仓内快照 + WebSearch 摘要 + WebFetch 取到的 QSTM 页面。**凡是标了 `aosp:` 的值都能在
`docs/aosp/` 里 grep 到**；QSTM 的 widget / All Apps 时间轴是二手来源（页面抓取），已在
MOTION-SPEC 里注明出处与 commit。

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
2. **Recents 真快照**：现在同一窗口会实时收成卡片，但落位后交叉淡出到占位卡；
   要保留活预览就得让窗口跟着卡片横向滚动，需再评估（或在停车时冻结一帧）；
3. **锁屏完整化**：当前 `?lock=1` 才进锁屏，默认直接桌面。若要默认锁屏，
   需要把「桌面可见」预算改成分阶段预算；
4. **字体一致性**：中文在部分 Android WebView 上字重偏细，可考虑 subset 后的
   单字重 woff2（约 8KB），但会破「零 Web Font」，需权衡。

## 五、纪律（沿用 v1）

- 设计值必须标出处（`aosp:` / `material:` / `self:`），不得有无出处的魔数；
- 性能预算改动必须同时改 `scripts/perf-gate.py` 的 BUDGET 与 `docs/PERF.md`；
- 任何新增 app 必须实现卸载函数（清定时器/音频/监听），否则会在 Recents 里泄漏。
