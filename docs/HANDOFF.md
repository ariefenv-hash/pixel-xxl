<!-- docs/HANDOFF.md — 跨轮次交接快照（#18 方向变更公告 6715176456 指定的交接入口；
     新实例读本文件 + git log --oneline -5 即可开窗，不必翻全部评论） -->
<!-- 维护纪律：每轮交付后立即覆写本文件（不是槽末统一写）。 -->

# Pixel XXL · HANDOFF 结构化快照

- **generated**: 2026-11-09 14:00+08:00（R135 窗收窗覆写 · Job 2933110 · 本窗 = #4 CI 双红修复（快环境竞态：pack-verify 百分比轮询 + boot-probe hint 条件断言）；R134 = 设计冻结复核审计 + 锚点定谳）
- **⚠️ 本窗五度撞号实录（Job 2933040 本系列）**：同窗并行实例与本实例连续同号交叉——
  对侧连发 v1.04 资产包（36ec911）/v1.05 分片+CDN（17dbbd0）/v1.06 IDB+竞速（f904330），
  本方 v1.04 反馈层（4a7343c，tag 已推）/v1.05 合流（f7ed235+a9a1db1）/v1.06 三缺陷修复
  （e28beee，**main 未推成，本地树保命于远端分支 `backup-v106-bfb` = e28beee**）。
  版本号双方同取（v1.04×2/v1.05×2/v1.06×2），终树重滚见下窗续点。
  **六度撞号（对侧窗）**：本方 v1.07 单调化（5c2d183）× 对侧 v1.07 五度融合（18197ef）——
  已合流重滚 v1.08；loader 单调闸/解码文案与 #boot-feedback 全屏层正交并留，零语义冲突。
  **七度撞号（R131 对方窗，4a181d3 已落远端 tag v1.10）**：本方 v1.08 动画连贯性升级
  （本地 8c22e39，443 中断未及推）× 对侧 v1.08 进度条单调化合流树（46646d0b+81762208）
  + 对侧 v1.09 docs（4e69b826）——功能面正交（本方 index 尾部块/ANALYSIS/新探针 ×
  对侧 loader/index 中段/docs 索引），API base_tree 合流，重滚 v1.10 防倒挂（v1.09 已被占用）。
  **八度撞号（本窗合流）**：本方 v1.10 #23 语言迁移（d32f5e9，shell-src Vite+TS 新壳）×
  对方 v1.10 动画连贯性（4a181d3）——同号双树，功能面完全正交（本方 shell-src/、shell/ 产物、
  docs/SHELL.md、shell 系探针 × 对方 index 尾部 fps 块、sw.js、PORTING/MOBILE/ANALYSIS §2、
  anim/fps 探针），仅 docs/HANDOFF 覆写相撞（docs/ANALYSIS 自动合并成功），合流重滚 **v1.11** 防倒挂。
- **head**: **v1.15 = #4 CI 双红修复（快环境竞态：pack-verify 百分比轮询采样 + boot-probe hint 条件断言）+ CI 触发面观测入坑（workflow_dispatch = 全量四 job 手动验证通道）**——上一版 v1.14 = DESIGN-SPEC 复核冻结 v1.0（76/76 审计 PASS）+ 锚点定谳 + 锚点治理议题（docs/DESIGN-SPEC-AUDIT.md + docs/design-spec-audit.json；#2 设计冻结登记）；再上 v1.13 = 设计规范 v1.0-draft + CI 双闸；再上 v1.12 = #4 CI 基线；再上 v1.11 = 八度撞号合流终树（对方动画 4a181d3 × 本方语言迁移 d32f5e9 并档；L0 忠实态零触碰 + fps 修复双双保留）
- **上一窗 head 归档**：对方 v1.10 = 动画连贯性升级（4a181d3，tag v1.10）× 本方 v1.10 = #23 语言迁移（d32f5e9，未 tag，撞号让号并入 v1.11）；v1.08 = 六度撞号合流（46646d0b+81762208）；backup-v106-bfb 转归档
- **本窗事故记录（#30 规则六首条外新增）**：开窗时误判 shell-src/ 为空白目录，在未盘点未跟踪遗留半成品（上一截断窗 08:01~08:11 的 motion/catalog/shell 组件）前先行写入，覆盖 package.json/package-lock/vite.config/tsconfig/index.html/bridge/runtime.ts 共 6 个文件——发现后按"旧版为主干恢复 + 新增作补充"合流，重建 3 个被覆盖文件（runtime.ts/index.html/配置），损失部分不可逆（旧 index.html/main 原始版未找回，按 style.css+qs-panel 引用面重建）；教训已入 #30 返工表
- **基线核验**: v1.07 终树 pack-verify 五场景 PASS（A 同源竞速命中+IDB 写入+feedback 真实百分比/auto_hidden/vm=80、B 二访零请求 pack_source=idb、C 360 逐文件兜底、E SW 零网络+IDB 重写）；boot-feedback-probe 移动通道证据留下窗补跑（原注：
  auto_hidden/vm=80，B SW 双分片 transferSize=0,0，C 360 逐文件兜底）；
  boot-feedback-probe 因 CDN 波动窗口超时未补跑，桌面全链路断言已被 pack-verify A 等效覆盖）
- **基线核验**: 冒烟取证三通道 PASS（`python3 scripts/boot-feedback-probe.py` →
  `docs/boot-feedback-evidence.json`，verdict 字段）
- **执行方式真源**: md3 仓库 #18 评论 6715176456（2026-11-08 00:41 用户指示的方向变更公告）——
  **不要再解决 md3 的议题**，工作重心转移至本仓库；md3 侧冻结但不放弃
  （#235 CI 红告警 run #502~#504 留待用户回流时处置）

## 项目一句话

用户的 Scratch 工程「Pixel XXL」（324×720 手机 OS 模拟器，6,162 块积木）的
TurboWarp 单文件打包产物（57.4MB）→ **忠实多文件 Web 移植**（非积木转换、非重写）：
运行时 core/app 逐字节一致，工程数据 1:1 落盘，唯一重写层 = 加载层（fetch 真实文件）。
线上：<https://ariefenv-hash.github.io/pixel-xxl/>

## 版本里程碑

| 版本 | 内容 |
| --- | --- |
| v1.00 | 逐代码逐资源解包移植（674 base85 分块 → 328 素材 + project.json，CRC 全过） |
| v1.01 | 文档补全（ANALYSIS / ANDROID-PORTING） |
| v1.02 | 移动端体检（MOBILE.md：15 分钟构成 / 触控链路 / 黑屏伪影判定） |
| v1.03 | 加载性能（素材 52.8→22.34MB -58% + Service Worker 二访零网络） |
| v1.04 | 资产合并包（首访素材请求 328→1，对侧并行实例交付；撞号合流实录见 PORTING §9） |
| v1.05 | 分片包 + CDN 前置（对侧并行实例：22.34MB 拆 2 片适配 jsDelivr 20MB 上限 + CDN 优先/6s 超时切源/逐文件兜底 + 真实启动进度条） |
| v1.06 | 启动屏进度反馈完整版（全屏层 + 双数据源：真实变量「渲染的进度/渲染数」优先 + 阶段推断兜底；收层五通道；超集覆盖对侧 #boot-hint，二度撞号合流） |
| v1.07 | 五度撞号终融合（18197ef：loader/sw 取 IDB+竞速版、index.html 正交融合 #boot-feedback+#loading-note、pack-verify 环境无关口径） |
| v1.08 | 进度条单调化（六度撞号合流：下载段/素材段撞段修复 0.75→0.98 衔接 + 单调闸 + 「解码素材 X%」+ 反馈层「正在渲染桌面（非下载）」措辞） |
| v1.09 | docs: HANDOFF 议题索引补 #30（读完再动手闸门·两仓同规，4e69b826） |
| v1.10 | **双树撞号**：对方动画连贯性升级（4a181d3：帧率自适应匹配刷新率 + 覆写夺回守卫 + 弱机看门狗；「打开/关闭动画中间不连贯」根因 = app 原生 120tick/s × 60Hz 屏换肤不可插值；tag v1.10）× 本方 #23 语言迁移落地（d32f5e9：shell-src/ Vite+TS 源码 → shell/ 产物 Pages 双入口 /shell/；iframe 原样嵌根入口零复制；QS 磁贴 L2 POC（vendored md3 连续打断内核 + 拉出条手势 + 6 磁贴）；VMBridge 写通道（catalog 94 变量对账 + 空壳保护 + 工程事件链复刻）；vitest 10 例契约测试；shell 探针全绿） |
| v1.11 | **八度撞号合流终树**（动画连贯性 × #23 语言迁移并档；sw VERSION v1.10→v1.11 防倒挂） |

## 本窗交付（v1.10 动画连贯性升级 · 对方窗并档）

- **诊断**（scripts/anim-probe.py 逐帧 trace + 积木链路精读）：开/关应用 = cropURL 61 张
  预渲染裁切皮肤逐 tick 换肤（lmsSkins_setSkin）+ 逐 tick 指数逼近运动；app 原生
  `setFramerate(120)` 而 60Hz 屏插值只平滑运动、**换肤不可插值**——约一半皮肤从未上屏，
  中段（裁切 Δ5~6px + 速度峰值）每显示帧合并 4~6 张 ⇒ 「中间不连贯」。
  排除项：素材 fetch（动画窗口 0 次）/ #boot-feedback（收层定时器已清）/ cropURL（全在开机预渲染）。
- **修复**（index.html 尾部追加 v1.10 块，骨架零改动）：缺省自适应实测 rAF 刷新率吸附
  [60/90/120]（120Hz 屏零变化）+ 覆写夺回守卫（FRAMERATE_CHANGED 监听，app 初始化
  120 覆写实测被夺回）+ 弱机看门狗（240 tick 中位 > 1.6× 帧预算一次性降半档 120→60/60→30）
  + 逃生门 `?fps=N` / `?fps=orig`（回归基线通道）。
- **验证**: scripts/fps-probe.py 四通道 PASS 零 pageerror（A 缺省 60→降级 30 /
  B 显式 30 / C orig 原生 120 零触碰 / D 显式 90+夺回+豁免；docs/fps-probe-evidence.json）；
  pack-verify 五场景见 docs/pack-verify.json（本窗复跑）。
- **附带**: sw.js VERSION v1.06→v1.10（七度撞号重滚）；README v1.10+v1.07 章节、
  PORTING §12、MOBILE §三5、ANALYSIS §2 补正；诊断探针 scripts/anim-probe.py 一并入库。

## 本窗交付（v1.10 #23 语言迁移 · 本方窗并档）

- **交付**：shell-src/（Vite+TS 源码：src/motion/ = vendored md3 连续打断内核 + spring +
  presets；src/bridge/ = catalog 94 变量对账 + 写通道 + 空壳保护；src/shell/ = tiles/qs-panel）
  → shell/（构建产物）；根入口 L0 忠实态零触碰（iframe 原样嵌入零复制），fidelity sha256 全 PASS。
- **验证**：tsc + vitest 10/10 PASS；scripts/shell-verify.py（构建完整性 + 根入口保真）与
  scripts/shell-probe.py（Playwright 启动链路）全绿；证据 docs/shell-evidence.{json,png}；
  pack-verify 五场景 PASS（本窗复跑）。
- **动画接入点**：app 开/关动画接 vendored 内核时，API 形状 = shell-src/src/motion/ 出口
  （零翻译成本）；与对方 v1.10 帧率自适应共存——壳层动画走 DOM/合成器自绘、不占 VM tick，
  两条修复路线互不干扰。
- **详见**：docs/SHELL.md（#23 交付正文）。

## 本窗交付（v1.12 #4 CI 基线 · 本方）

- **交付**：`.github/workflows/regression.yml` 三 job——① static-gates（push：check-inline-js
  内联 JS 逐块语法闸 + shell-src `npm ci`/`tsc --noEmit`/vitest 10 例/`vite build`）；
  ② pack-verify（push：五场景 VERDICT 红绿闸 + 证据 artifact）；③ boot-probe（每日
  05:30+08 schedule + workflow_dispatch：三通道 verdict 红绿闸 + artifact）；红灯
  GITHUB_TOKEN 自动回帖 #2（零 PAT 依赖）。
- **#30 实证修正**：#4 原文「pack-verify 纯 Python 不依赖浏览器」系误判——三脚本均
  import playwright 并断言 SW transferSize/IndexedDB（本窗依赖面 100% 通读实证），
  CI 按 playwright==1.57.0 + chromium 真浏览器落地。
- **物化补账（1a97a66 声明 vs 树差异，#30 返工表精神）**：对方 fixup 声明的
  `scripts/check-inline-js.py` 与「已知坑：API 合流 index.html 须逐块语法校验」均未落库
  ——本窗按其描述物化脚本（4 内联块全过 = 其口径复现）并补记已知坑。
- **推送前测试（铁律三）**：本地 pack-verify 五场景 VERDICT: PASS（A 反馈层「正在渲染
  桌面 32%…（非下载）」/B idb 零请求/C 360 兕底/E transferSize=0,0+IDB 重写2）；
  语法闸 4/4；tsc + vitest 10/10 + build 产物哈希与库内 shell/ 一致（构建可复现）。
- **缺口披露**：regression-headless（57MB 原版 8082 对照源）暂缓入 CI，workflow 注释 +
  下窗续点留痕，不隐瞒。

## 本窗交付（v1.13 设计规范 v1.0-draft + CI 双闸 · 本方）

- **主交付：docs/DESIGN-SPEC.md（#6 冻结令交付稿）**——纯文档零代码零构建：
  §2 颜色系统（#9：Monet 五调色板 chroma + CAM16 观察条件 + dark/light 角色→tone
  映射 16×2 全量 + 亮暗口径 + 强调色 #ff4c4c 兜底定位 + 失效回落链）；§3 动效
  （BackAnimationSpec 族 ST1~ST4 margin/min-scale/easing + ShadeInterpolation
  alpha 映射公式 + DynamicAnimation MIN_VISIBLE_CHANGE 族 + integers.xml 杂项）;
  §4 布局图标（notif 上限族）· §5 字体（Roboto Flex 三轴/ROND 不做）· §6 形状
  （28dp/endGap 8dp/highlight 0.26 部分实证标注）· §7 组件形态清单八节
  （状态栏/导航栏/锁屏/桌面/抽屉/对话框/QS 磁贴/通知，各节现状→AOSP 对照→目标
  形态+级别）· §8 self:自创隔离区 6 项 · §9 裁剪声明 6 条 · §10 评审冻结与附注。
  token 表行 69 项（程序化点数：非自创 63 + self: 6），出处 100%（#7 验收 ≥40）。
- **语料纪律**：aosp: 值全部经 md3@main vendored 副本**逐文件复核**（本窗精读 14 件：
  back 三件套/ShadeInterpolation/TransitionAnimator/DynamicAnimation/Force/
  AllAppsTransitionController/DeviceProfile/ClockSize/ThemedBatteryDrawable/
  volume integers/monet.js/theme-color.js/ui-detail-baseline/visual-token-adoption）;
  语料副本拉自 aosp-mirror main 分支——android-17.0.0_r1 逐值回核列为下窗续点
  （SPEC §10 附注一）；语料未含的值（SpringForce 劲度/Launcher3 栅格 px/QS 网格）
  刻意留空不编造（附注二）。md3 方向性决策零搬运（红线 4）。
- **加餐④⑤：CI 双闸**——static-gates 增 `gen-bridge-catalog.py --check`
  （catalog 随 project.json 漂移即红灯）+ 新 job shell-gates（shell-probe 三通道
  + 红线 sha256 保真，脚本自带退出码闸，playwright==1.57.0 同版）+ 证据 artifact。
- **推送前测试（铁律三）**：语法闸 4/4；catalog --check PASS（sha16=ce5d8400cb42b1c8）;
  workflow YAML parse OK（4 job）；本地 shell-probe 全链路 VERDICT: PASS
  （fidelity PASS/A shell-load PASS/B bridge PASS 壁纸编号初值 3/C qs-tiles PASS
  壁纸 3→4 亮度 500→600）。
- **状态**：SPEC 为 v1.0-draft 待 #8 评审冻结——冻结前不作为实现依据（#6 验收
  口径：评审通过后在交接议题登记「设计冻结」）。
  → **R134 已复核冻结，见下节。**

## 本窗交付（v1.15 #4 CI 双红修复 · R135）

- **诊断（CI 日志 + artifact 实证，非推测）**：v1.14 起双红——① push 面 pack-verify
  （run 42510593772）：五场景仅 `A.feedback_pct_shown=false`（sleep(30) 单次采样时
  feedback_text 已变「画面已就绪」；runner 快启动 <30s 收层，本地慢机无此竞态；其余
  A/B/C/E 全 PASS：vm_targets=80、CDN 分片 2/2、C 360 兕底、E transferSize 0,0+IDB 重写 2）；
  ② schedule 面 boot-probe（run 42543903303，09:08+08 延迟触发）：仅 B 通道 `any(hint)`
  断言失败——应用侧 hint 阈值 = sec>45（index.html showHint），32.0s 收层的快启动无
  触发窗口。**同族根因：慢环境时序写死进断言，快环境必红；本地绿 = 本地慢。**
- **修复（全 scripts 面，零运行时字节）**：pack-verify.py 百分比单次采样 → 轮询采样
  （每 0.5s 至收层/240s 截止，任一可见样本命中 \d+% 即 PASS，保留「反假百分比」本意，
  新增 feedback_samples 证据字段）；boot-feedback-probe.py hint 改条件断言
  （收层 ≤45s 快启动豁免 hint_expected=False；>45s 慢启动 hint 必须出现——不编造
  不恒真，新增 hint_expected/hint_seen 字段）。
- **CI 触发面观测（新已知坑素材）**：regression push 触发在 v1.12/v1.13 两次推送未触发
  （run 列表实测 0），v1.14 起恢复；schedule 21:30Z 到期点漏跑、于 01:08Z 延迟补跑
  （GitHub 高负载丢弃/延迟为文档化行为）——**操作规：每窗推送后核验 run 已触发；
  未触发或需全量验证（含 boot-probe）一律 workflow_dispatch**（四 job 门 =
  `!='schedule'` ∪ schedule/dispatch，dispatch 即全量验证通道）。
- **推送前测试（铁律三）**：py_compile 双脚本过；check-inline-js 4/4；本地 pack-verify
  五场景复跑 **VERDICT: PASS**（轮询版 pct_shown=true / 87 采样 / B idb 零请求 /
  C 360 兜底 / E transferSize 0,0+IDB 重写 2）；本地 boot-feedback-probe **verdict PASS**
  （52.1s 慢启动 >45s → hint_expected=True 且 hint_seen=True@47.1s——hint 功能在位路径
  实测；快启动豁免分支由 runner 32s 实测覆盖，两分支均有实证）；docs/boot-feedback-evidence.json
  随窗更新；CI 绿灯确证走 workflow_dispatch 全量复跑，结果回帖 #3/#2 打点。
- **零运行时声明**：本窗 diff = scripts/pack-verify.py + scripts/boot-feedback-probe.py
  + docs/boot-feedback-evidence.json（探针证据更新）+ 本文件；sw VERSION 保持 v1.11；
  L0 红线零触碰（core/app/index.html/project.json/素材零 diff）。
- **撞号协调**：v1.15 已于 #3 领号（14:06+08，id 6733486416）+ #1 开窗同步；领号前
  4 小时空窗增量实查零新提交零新领号；沙箱故障 22:00+08 起七窗，本窗恢复补跑积压。

## 本窗交付（v1.14 设计冻结复核 · 本方 R134）

- **审计主交付**：DESIGN-SPEC v1.0-draft 复核审计——**76/76 程序化断言全 PASS**
  （§2.2 monet 45（含角色→tone 表 32/32 全对，语料实含 40 行、SPEC 收录 16×2 子集）
  + §3.1 back 13 + §3.2 shade 3 + §3.3 spring 4 + §3.4/§4 integers 10 + SPEC 自证 1）；
  证据 docs/design-spec-audit.json（逐条含语料原文证据）+ 报告 docs/DESIGN-SPEC-AUDIT.md。
- **provenance 链实证**：md3 语料 integers.xml 剥头注释后与镜像 main
  packages/SystemUI/res/values/integers.xml **逐字节一致（2392B）**——语料出处
  声明（实拉自 aosp-mirror main 2026-11-06）获得直接实证。
- **锚点定谳（附注一回核的替代结论）**：android-17.0.0_r1 在本执行环境双通道均
  不可达——① 镜像 aosp-mirror/platform_frameworks_base：无任何 android-17 系 tag
  （PAT matching-refs 空集，最新 = 16.0.0_r1/r2/r3），main 冻结 2025-03-27
  （1cdfff555f，与 googlesource main 探测 HEAD 同 sha），SystemUI animation 包
  main/r1/r2/r3 均 404（镜像为扁平化抽样残缺副本）；② googlesource：间歇可达
  （1 次 info/refs 200），tag 枚举不可达（广告体 443 超时 / gitiles JSON 空响应）。
  **处置**：aosp: 项按 §9-3 口径持续有效；锚点差异风险 + 补救路径（镜像补全 /
  用户侧 sources jar / cs.android.com 人工通道）转锚点治理议题长期跟踪。
- **冻结动作**：SPEC 标题/状态行固化 v1.0（冻结版），附注一按审计结论更新；
  交接议题 #2 登记「设计冻结」（复核实例口径依 #6 验收，用户保留撤销权）；
  token 引用制自冻结起生效——解锁 R135 候选② QS 磁贴 L2 化。
- **推送前测试（铁律三）**：审计脚本三通道断言可复现（76/76）；SPEC/HANDOFF/AUDIT
  纯 docs 面 diff，零运行时字节；check-inline-js 语法闸不涉及（未触 index.html）；
  gen-bridge-catalog --check 与 CI 面零改动。
- **零运行时声明**：本窗 diff = docs/DESIGN-SPEC.md（附注一+状态行+页脚）+
  docs/DESIGN-SPEC-AUDIT.md（新）+ docs/design-spec-audit.json（新）+ 本文件；
  sw VERSION 保持 v1.11（v1.09/v1.12/v1.13 docs-only 先例同律）；L0 红线零触碰。

## 红线（违反 = 返工）

1. **core/app 逐字节**：`lib/turbowarp-core.js`、`lib/pixel-xxl-app.js` 不许改动；
2. **index.html 骨架**：既有字节零改动，只允许尾部追加（v1.03 SW 注册 / v1.06 反馈层先例）；
3. **素材 md5 寻址**：改素材内容必须同步 project.json 的 md5ext 键（v1.03 先例：等长替换）；
4. **双版对比回归**：改壳层 UI 后跑回归须带 `?nofb=1&fps=orig`（v1.06 反馈层豁免 +
   v1.10 帧率豁免，否则 tick 率/新增层差异污染对比）；
5. **待裁决项不动**：PNG 长尾 12.7MB（dataFormat 语义需改）/ MP3 6.0MB（音质口径）——
   须用户裁决后再动（PORTING.md §7.3）。

## 候选任务池（按 ROI 排序，动手前在本仓库 issue #1 发认领帖）

1. ⏳ **启动空窗治理**（MOBILE.md §三③）：取色/模糊降采样上限、blur 级别压缩、
   或 qwq1018 v4 液态玻璃替代 CPU 整张糊；进阶 Worker 化。
   ⚠️ 与 qiaoqiaoMica「整张糊」是两套并存方案，unsandboxed 依赖（ANALYSIS §8）；
2. ⏳ **启动链路真实加速**（中期路线 ANALYSIS §10）：结构性混合渲染（静态 UI 搬 DOM/CSS）
   ——动工须先用 Vite+TS 搭新壳立项，运行时保持原样；
3. ⏳ **云变量通道收敛**（ANALYSIS §8）：双 wss 端点 → 单端点 + 离线静默降级（现状 try/catch 已兜底）；
4. ⏳ **存档脏值清理**（ANALYSIS §8）：开机引导页/锁屏随包保存的脏值——清理需重打包
   project.json（破坏"逐字节"原则，须单独立项 + 用户裁决）；
5. ⏳ **PNG 长尾 12.7MB / MP3 6.0MB 瘦身**（待用户裁决口径，PORTING §7.3）；
6. ✅ 素材瘦身 / ✅ Service Worker / ✅ 资产合并包 / ✅ 分片+CDN 前置 / ✅ 启动屏进度反馈完整版
   （v1.03~v1.06 已落地；含修复路线①②④，余 §三③ 空窗治理）。
7. ⏳ **进度同步回首屏 HTML 进度条**（0.75→0.98 段）——对侧 v1.05 评估"价值低，不再单独立项"。

## 工具速查

- CI 基线（#4，v1.12 初建 · R135 修复双红）：push 自动跑 static-gates + pack-verify +
  shell-gates，schedule/dispatch 跑 boot-probe；**workflow_dispatch = 全量四 job 手动验证
  通道**（push/schedule 触发不稳时用它，R135 观测：v1.12/v1.13 push 未触发、schedule
  漏跑后延迟补跑）；证据在 run artifact；红灯自动回帖 #2；
- 帧率四通道验证：`python3 scripts/fps-probe.py`（8088，A 缺省 60→降级 30 / B 显式 /
  C orig / D 显式+夺回，证据 docs/fps-probe-evidence.json）；
- 动画逐帧诊断：`python3 scripts/anim-probe.py`（8087，逐 tick trace，需过引导页）；
- 进度条取证：`python3 scripts/bar-trace.py`（对侧 v1.08 交付）；
- 冒烟取证：`python3 scripts/boot-feedback-probe.py`（自起 8089 服务，三通道 A/B/C，
  证据落 docs/boot-feedback-evidence.json，软渲染全链路约 6 分钟）；
- 双版回归：`python3 scripts/regression-headless.py`（需 8081=本仓 + 8082=原版
  `Pixel.XL.0827.html` 静态服务；原版取自 md3 Release tag `nnnj`，57MB 下载通道慢，
  建议后台预取；移植版 URL 需带 `?nofb=1` 防反馈层污染截图）；
- 手机仿真：`python3 scripts/mobile-probe*.py`（MOBILE.md §四）；
- 素材完整性：loader 口径（project.json 逐 target 逐 costume/sound 的 assetId.dataFormat
  实存检查，slim-verify.py 内同款）。

## 已知坑

- **app 的 setFramerate(120) 晚于 window.vm 可见**——任何壳层帧率控制必须装
  FRAMERATE_CHANGED 夺回守卫，否则被静默覆盖（v1.10 四通道探针实证）；
- headless swiftshader 下画面恒黑（qiaoqiaoMica 软渲染降级缺陷，ANALYSIS §7 /
  MOBILE.md §一）——**不是移植缺陷**，像素点亮判定在 headless 不可达，冒烟判据勿依赖它；
- `_tickCounter` 等内部属性在打包 runtime 上不存在（minified/未暴露），运行信号用
  `runtime.threads.length`（稳定 API）；
- git push 若 443 超时（HTTP2 framing / connect timeout）：REST API blob→tree→commit→ref
  四步推送可用（md3 #18 评论 6715376371 记载，`scripts/api-push2.py` 模式）；
  API 推送产生的 commit sha 与本地不同（树一致），恢复 git 协议后先 fetch + reset --hard 对齐；
- 并行实例：本仓曾有同窗并行提交（2026-11-08 12:03 v1.03 系并行实例推送）——
  动手前先 `git fetch`，远端是唯一真相源；认领协调面 = 本仓库 issue #1 评论。
- **API 合流的 index.html 必须跑逐块语法校验后才可推**（1a97a66 教训，其声明未落库，
  本窗补记并物化闸：`python3 scripts/check-inline-js.py`，4 内联块须全过）；
- **沙箱回收后工作树全树 mode 假变化**（644→755、numstat 全 0 行）——先
  `git config core.fileMode false` 再合并/提交，勿误判为内容改动（R132 实测）。
- **Bash 工具输出通道会吞方括号序列**（如 `[main]` 显示成 `ain]`、`[i]` 吞成空）
  ——bash cat/grep/repr 看到的括号内容不可信；磁盘文件本身无损（printf 55 字节
  实证 + Read 工具括号保真）。核对括号内容用 Read 工具或 base64 传输；字节级断言
  用 python count（R133 实测：误判 CI branches 为缺陷，白耗 ~15 分钟后经字节偏移
  1152 处 `main]` 证实为 `[main]` 完好）。
- **探针/闸脚本断言禁止写死慢环境时序**（R135 双红实证）：CI runner 快启动（CDN 分片
  数秒 + 渲染 32s 收层）使 sleep(30) 单次采样错过百分比阶段、hint（应用侧 >45s 阈值）
  无触发窗口——时序相关断言一律轮询采样或按触发条件豁免（环境自适应）；
  本地绿 ≠ runner 绿，CI 结论以 runner 日志/artifact 为准；
- **免认证 WebFetch 摘要有漏报风险**（R135 实测）：issues 列表摘要漏报 #2 新评论与
  schedule run——事实性断言（增量核查/状态判定）用认证 API + python 解析。

## 下窗续点（R136）

0. **开窗入口已切换**：置顶议题 #2（SOP·铁律）+ #30 读完再动手闸门 + 本文件 +
   git log --oneline -5；认领登记按 #2 §一4（认领 + 预计版本号，后到者跳号 #3）；
1. **② QS 磁贴 L2 化（设计冻结已解锁，R136 首选；R135 已完成引用面备料）**：#18 对照稿
   三栏表 → 首批磁贴清单（Wi-Fi/蓝牙/手电筒/自动旋转/亮暗切换/飞行模式，开关态可切换 +
   按压反馈），消费 SPEC v1.0 token（引用制生效）：面板 alpha 用 motion.shade.*
  （scrim [0→0.5] / content [0.3→1.0] / f′=f×1.2−0.2+cos 曲线）、Header 过渡用
   motion.qs.fade-*（帧 14/58、displacement 0.1066）、tile-bounce 走 spring
   MIN_VISIBLE_CHANGE 族（1 / 1÷10 / 1÷256 / 1÷500）；语料：motion.shade.* +
   motion.qs.fade-* + systemui-docs/quickaffordance.md；落点 = shell-src 新壳
   （qs-panel.ts 现有 320/260ms/28px/420ms 等 8 处魔数 token 化或登记 self:/measured: +
   tiles.ts 六磁贴 POC 升级），写通道只复用工程既有事件链（VMBridge catalog 对账）；
   **新磁贴不新增 project.json 变量（L0），引擎联动仅限既有变量**；QS 网格 px 属
   附注二留空项随动工实拉；
2. **③ app 开/关动画接 vendored 内核**：**对侧 2933040 动画工作面，继续避开**——
   除非对侧 #1 明示转交；API 形状 = shell-src/src/motion/ 出口；
3. **锚点治理议题跟踪**：android-17.0.0_r1 可达性恢复时（镜像补全/用户侧 sources
   jar），按 SPEC 附注一纪律逐项回核 aosp: 值，有差异即修订 SPEC 并披露；
4. **SPEC 附注二留空项补考**：SpringForce 劲度/阻尼（sources jar）· Launcher3
   栅格 px（#13 对照稿）· QS 磁贴网格尺寸（#18 对照稿）——各自随议题动工实拉；
5. 用户真机验收 v1.10 动画（60Hz 设备开/关动画是否顺滑；120Hz 设备应零变化）；
   boot-feedback-probe 移动通道已入 CI 并修复（R135），真机复核仍以用户侧为准；
6. **#4 CI 收尾**：R135 dispatch 全量绿灯确证后，持续观察 schedule boot-probe 与
   shell-gates 时长漂移；regression-headless 入 CI 仍缓行（actions/cache 预热 57MB 原版
   + 8081/8082 双服务，外部大文件依赖脆）；
7. **#31 方针持续执行**：测试发现的问题即修即录；无议题时自行批量立议题
   （填充内容类优先级最低）。

## 版本号登记表（#3 领号制 · 与 git tags 实测同步）

| 版本 | 领用方 | 内容 | tag |
| --- | --- | --- | --- |
| v1.00~v1.07 | 各窗实例 | 见版本里程碑 | v1.00~v1.07 已落 |
| v1.08 | 对侧合流实例（46646d0b） | 进度条单调化合流终树 | v1.08 已落 |
| v1.09 | 对侧实例（4e69b826） | docs 议题索引 #30 | 未 tag |
| v1.10 | Job 2933040（R131） | 动画连贯性升级（七度撞号重滚） | v1.10 已落远端 |
| v1.10 | Job 2933110（R131 并行窗） | #23 语言迁移（shell-src，d32f5e9） | 未 tag（撞号让号，并入 v1.11） |
| v1.11 | 本窗合流（Job 2933110 收窗） | 八度撞号合流终树（动画 × 语言迁移并档） | v1.11 本窗落 |
| v1.12 | Job 2933110（R132） | #4 CI 基线（regression.yml 三 job + check-inline-js 物化 + 已知坑补记） | 未 tag（docs/CI 面，零运行时；v1.09 先例同律） |
| v1.13 | Job 2933110（R133） | 设计规范 v1.0-draft（DESIGN-SPEC.md 69 token）+ CI 双闸（shell-gates job + catalog 对账闸） | 未 tag（docs/CI 面，零运行时；v1.09/v1.12 先例同律） |
| v1.14 | Job 2933110（R134） | 设计冻结复核（76/76 审计 PASS + SPEC 固化 v1.0 + #2 冻结登记）+ 锚点定谳（android-17.0.0_r1 不可达）+ 锚点治理议题 | 未 tag（docs 面，零运行时；v1.09/v1.12/v1.13 先例同律） |
| v1.15 | Job 2933110（R135） | #4 CI 双红修复（pack-verify 百分比轮询采样 + boot-probe hint 条件断言，快环境竞态同族根因）+ CI 触发面观测入坑（dispatch 全量通道） | 未 tag（scripts/CI 面，零运行时；v1.09/v1.12/v1.13/v1.14 先例同律） |

## 议题索引（2026-11-08 · 新立 29 个议题 #2~#30（含 #30 读完再动手闸门），已回读核对 + #2 已置顶）

> 用户方针：**先一锤定音把设计弄好（设计先行），再贯彻全方位代码移植**；
> md3 内容只借"已考证的值 + 纪律 + 语料索引"，不搬繁重与方向性决策。
> 开窗入口改为：**置顶议题 #2（含开窗 SOP 与铁律）+ 本文件 + git log --oneline -5**。

| 区段 | 议题 |
| --- | --- |
| 交接/治理 | #2 上下文交接专项（SOP·铁律·置顶）· #3 撞号治理（领号制）· #4 CI 基线 · #5 Pages 一致性 · #30 读完再动手闸门 · #31 自主迭代方针 · #32 AOSP 源锚点治理 |
| 设计先行 | #6 设计冻结令（DESIGN-SPEC v1.0）· #7 token 清单与出处 · #8 设计对照稿评审 · #9 亮暗/tone 口径 |
| 语料 | #10 md3 AOSP 语料按需引入（防膨胀） |
| 真移植 | #11 总纲 L0~L3 · #12 Monet · #13 桌面栅格 · #14 All Apps · #15 Recents · #16 返回手势 · #17 锁屏 · #18 QS 磁贴 · #19 时钟 · #20 开机动画 · #21 云母模糊 |
| 性能 | #22 启动空窗治理 · #23 混合渲染主干（Vite+TS 新壳） |
| 资源/裁决 | #24 PNG/MP3 瘦身口径 · #25 云变量收敛 · #26 存档脏值清理 |
| 应用 | #27 六个 213 块同构占位 APP 处置 · #28 music 专项 · #29 计算器/时钟/个性化盘点 |

> 实测新发现（project.json 21 targets 逐个盘点）：相册/商店/通知/视频/电话/bilibili 六个
> APP 完全同构（均 213 块、2 造型）= 占位壳，处置见 #27。
