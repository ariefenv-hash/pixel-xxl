<!-- docs/HANDOFF.md — 跨轮次交接快照（#18 方向变更公告 6715176456 指定的交接入口；
     新实例读本文件 + git log --oneline -5 即可开窗，不必翻全部评论） -->
<!-- 维护纪律：每轮交付后立即覆写本文件（不是槽末统一写）。 -->

# Pixel XXL · HANDOFF 结构化快照

- **generated**: 2026-11-10 06:00+08:00（R140 窗收窗覆写 · Job 2933110 · 本窗 = ② L3 通知面接入第一批（#18 任务 4 · 方案先登记后动工）；R139 = ② motion.qs.fade-* L3 Header 过渡轮；R138 = ② QS 展开编辑页；R137 = ② QS 磁贴收尾与深化第一批）
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
- **head**: **v1.20 = ② L3 通知面接入第一批（R140）**：通知面本体最小闭环（占位卡 → notifications.ts 状态机 + 通知卡真结构 + 媒体卡 MediaStyle 同构位 + 空态「无通知」+ 清除全部钮 + swipe X 消除通道阈值 64px self:）+ 数据源防发明实证（music播放状态 "0"/"1" / 当前播放music "歌手 - 曲名"，usic APP 写块 project.json 实证，只读轮询零新增写通道）+ ongoing 不可消除语义 + vitest 78 例 + 探针 D1-D12——上一版 v1.19 = ② motion.qs.fade-* L3 Header 过渡轮（帧 14/58 经语料标定等式位移轴消费 + header 双态实例 + 「1s 变形时间轴」定谳 + vitest 68 例 + 探针 D11）；再上 v1.18 = ② QS 展开编辑页（tile-order 纯函数 + 编辑覆层整卡拖动重排 + vitest 59 例 + 探针 D10）；再上 v1.17 = ② QS 磁贴收尾与深化第一批；再上 v1.16 = ② QS 磁贴 L2 化首批；再上 v1.15 = #4 CI 双红修复；再上 v1.14 = DESIGN-SPEC 复核冻结 v1.0；再上 v1.13 = 设计规范 v1.0-draft + CI 双闸；再上 v1.12 = #4 CI 基线；再上 v1.11 = 八度撞号合流终树
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

## 本窗交付（v1.20 ② L3 通知面接入第一批 · R140）

- **评估轮（#18 纪律执行：方案先登记后动工）**：① 工程现状口径维持（原工程无通知
  子系统，ANDROID-PORTING §2 对照表无通知栏对应物 + ANALYSIS grep 零命中 +「通知」APP
  = #27 六个 213 块同构占位壳之一）→ 通知面本体只能壳层自持；② 语料证据面：
  ShadeInterpolation.kt 两曲线均已代码化且消费（scrim/QS 段）；通知面本体结构
  （NotificationStackScrollLayout/NotificationSummaryAdapter）md3 语料树无源码（R140
  实查同律）——卡结构走「同构位」纪律不标 aosp: 结构 token；③ 数据源实证（catalog
  + project.json 写块逐个扫描）：`music播放状态` refs=8 值域 "0"/"1"（usic APP 写块
  8 处全为字面量，播放中="1"）、`当前播放music` refs=2 = "歌手 - 曲名" 字符串（写入方
  = usic APP 本体）——媒体播放事件链真实存在，MediaStyle 通知卡有真实数据源；方案
  帖已发 #18（id 6752774760）先于动工。
- **通知面本体（notifications.ts 新 + qs-panel.ts + style.css）**：通知卡列表真结构
  （app 行/title/text 三行）替换占位卡；**媒体卡 = MediaStyle 同构位**（app=音乐 /
  title=曲名原样不加工 / 正文=正在播放，ongoing 语义）播放中→卡出现、停止→撤除；
  空态「无通知」（AOSP 空态语义）；清除全部钮（AOSP CLEAR ALL 同构位，无可消除卡时
  隐藏）；swipe X 消除通道（双向跟手，阈值 64px self:；本批可消除源暂空——唯一源
  = ongoing 媒体卡不绑，通道与测试先就位）；upsert 保位更新（AOSP 同 id 通知 update
  不重排）；媒体源 diff 缓存（变化才重渲——防每拍重建 DOM）。状态机纯函数零 DOM
  （vitest 直测），内存自持零工程变量写入（L0 同律）。
- **动效零新增**：通知列表可见性维持 notifFade（self: 曲线不变，防动效回归）；
  卡弹回/撤除过渡 120ms self: 登记 §6.3。
- **测试（铁律三全过）**：tsc 零错 + vitest **78/78**（+10：notifications.spec——
  upsert 保位/尾部追加/纯函数不 mutate/remove 引用短路/ongoing 保护/CLEAR ALL
  ongoing 保留/媒体卡字段）+ vite build 产物落 shell/（新 hash 对
  index-BEDlk27u.js/index-B7jZckrQ.css，旧对 git rm）+ check-inline-js 4/4 +
  shell-probe 五通道 VERDICT: PASS（**D 场景扩为 D1-D12**：D12 媒体卡全生命周期
  真浏览器实断言——空态→播放卡出现（app=音乐/title=曲名/正文=正在播放）→换曲
  upsert 保位→ongoing 卡 swipe 100px 不消除→停播撤除回空态；清除全部钮显隐
  语义随行）+ pack-verify 五场景 VERDICT: PASS（根入口零影响实证）。
- **零根入口触碰声明**：diff = shell-src 五件（notifications.ts 新/qs-panel.ts/
  style.css/tests/notifications.spec.ts 新 + tsconfig 未动）+ shell 产物三件
  （index.html + 新 hash 对，旧对 git rm）+ scripts/shell-probe.py（D12）+ docs
  （SHELL.md §6.1/§6.3/§7 + HANDOFF/shell-evidence）。sw VERSION 保持 v1.11
  （shell 页面不注册 SW）；L0 红线零触碰（core/app/index.html/project.json/素材
  零 diff）；新 self: 值集中登记 SHELL.md §6.3（swipe 阈值 64px/过渡 120ms/媒体卡
  文案/空态文案）。
- **撞号协调**：v1.20 已于 #3 领号（id 6752774196）先于动工；开窗 fetch 对齐
  origin/main = 64218c5（v1.19，CI run 42692311738 + Pages 42692310914 全绿，API
  实证）；#3 全量 15 条评论实读零撞号（最新 6750678333 = R139 收窗登记）；
  本窗实开（02:00/04:00 窗摘要滞后修正）：v1.19 已由 R139 窗交付，本窗接续 R140。

## 本窗交付（v1.19 ② motion.qs.fade-* L3 Header 过渡轮 · R139）

- **语料实拉定谳（消费前先证，R139 续点首项）**：md3 语料树实查（blob 1606，
  较 R137 +18）——SystemUI 原生 Header 过渡消费方源码（NotificationPanel 等）
  **不在语料**（GitHub code search 全库 fade_out_complete_frame 零消费方）；唯一
  帧锚出处 = systemui/volume-dialog/integers.xml 注释块：`<!-- Values for
  transition of QS Headers -->` fade_out_complete_frame=14 / fade_in_start_frame=58
  / percent_displacement_at_fade_out=0.1066（注释原文「Percentage of displacement
  for items in QQS to guarantee matching with bottom of clock AT
  fade_out_complete_frame」）。
- **「1s 变形时间轴」定谳（R139 续点悬案收口）**：60fps 下帧 58 ≈ 967ms——
  过渡时间轴跨度 ≥58 帧 ≈ 1s 量级（可证下限）；淡入完成帧/总时长语料无 token
  **不可证** → 帧锚不在时间轴消费，改经语料标定等式（**帧 14 ≡ 位移 0.1066**，
  注释原文直接给出）换算到**位移轴**消费（drag 跟手纯函数，不引入固定 ms
  时长）——R136 披露的「IIO 320/260ms 时间轴不匹配」问题随位移轴消费消解。
- **header 双态过渡落地（qs-panel.ts + style.css）**：单实例文本切换 + 副标题
  独立淡出 → 双态实例（.qs-header-state[data-state=notif|qs]，grid 同格叠放，
  alpha 驱动可见性）：旧态（通知）淡出 [0→0.1066]（帧 0→14，完成点=标定点）、
  新态（控制中心）淡入 [0.4416→1]（起点=帧 58 线性换算）、空窗 [0.1066→0.4416]
  双态皆隐（帧序 14<58 天然导出）；纯函数出口 headerOldAlpha/headerNewAlpha
  （qs-panel.ts 导出，vitest 直测）。
- **#31 即修即录（R139 两项）**：① v1.16 副标题淡出消费为「start@0.1066」，
  与语料注释原文对照为 **complete@0.1066**（0.1066 是淡出完成时刻的位移
  标定值，非起点）——本窗对齐语料原义；② R138 SHELL.md §7 测试数陈旧
  （39 例未随 59 例更新）——顺手修正为 68 例。
- **测试（铁律三全过）**：tsc 零错 + vitest **68/68**（+9：qs-header.spec——
  标定等式/帧步长/帧 58 换算/双态窗口边界/中点线性/空窗互斥全程扫描）+
  vite build 产物落 shell/（新 hash 对 index-BAEo2yh2.js/index-CLoIxw7P.css，
  旧对 git rm；docstring 修订后重建 hash 不变 = 构建可复现）+ check-inline-js
  4/4 + shell-probe 五通道 VERDICT: PASS（**D 场景扩为 D1-D11**：D11 header
  过渡真浏览器实值断言——old@p=0.05=0.531（理论 0.5310）/完成点 0.1066 归零/
  空窗双隐/new@p=0.5=0.105（理论 0.1045）/满展开=1/反向对称恢复）+
  pack-verify 五场景 VERDICT: PASS（根入口零影响实证）。
- **零根入口触碰声明**：diff = shell-src 四件（shade-tokens/qs-panel/style.css
  /tests/qs-header.spec 新）+ shell 产物三件（index.html + 新 hash 对，旧对
  git rm）+ scripts/shell-probe.py（D11）+ docs（SHELL.md §6.1/§6.3/§7 +
  HANDOFF/shell-evidence）。sw VERSION 保持 v1.11（shell 页面不注册 SW）；
  L0 红线零触碰（core/app/index.html/project.json/素材零 diff）；新 self: 值
  集中登记 SHELL.md §6.3（header 双态窗口/帧锚位移步长）。
- **撞号协调**：v1.19 已于 #3 领号（id 6750097822）+ #1 认领帖（6750098306）
  先于动工；开窗 fetch 对齐 origin/main = 806f876（v1.18，CI run 42657481575
  全绿）；#3 全量 13 条评论实读零撞号（最新 6745804795 = R138 收窗登记）。

## 本窗交付（v1.18 ② QS 展开编辑页 · R138）

- **tile-order.ts（新，纯函数模块 vitest 直测 20 例）**：defaultTileOrder/
  normalizeOrder（剔未知/去重保首/缺失按定义序补尾）/moveTile（悬停格位=最终
  格位语义，越界 clamp，不 mutate 入参）/gridIndexForPoint（指针→网格格位
  纯几何 clamped）/getQuickRowTiles（当前序前 4 toggle 族派生）/orderToDefs；
  tiles.ts 同步：QUICK_ROW_TILES 静态表移除，QUICK_ROW_COUNT 保留，新增
  TILE_IDS（全量 id 序锚）。
- **编辑覆层（qs-panel.ts + style.css，AOSP 编辑页同构位）**：QS 段网格下方
  「编辑磁贴」入口钮（footer pencil 同构位 self:）→ scrim+卡（role=dialog：
  标题/拖动提示/完成钮 + 磁贴列表）→ 整卡拖动重排：pointerdown 记锚 → 位移
  超 6px（self:）起拖 → 随指跟随（拖动项布局位 offsetLeft/Top 锚 + translate
  补差，reflow 后重钉防跳格）→ 目标格 live reflow（gridIndexForPoint 纯几何
  + FLIP 180ms self: 补位）→ drop 提交工作序（normalizeOrder 兜底）；
  pointer capture 保移出跟手；编辑项为 div 无点击语义（编辑态不翻转，AOSP
  编辑页磁贴不响应开关同构）。
- **提交后跟随（QuickQSPanel 语义落地）**：网格 + 折叠行 + 编辑列表全 rebuild；
  **折叠行 = 当前磁贴序前 4 个 toggle 族**（R137 静态表 → 动态派生；action/
  status 不入折叠行 self: 裁剪披露）；**三态状态机跨 rebuild 保留**（tile-states
  states Map 会话自持，rebuild 只重建 DOM 不动状态，探针 D10 实断言）；磁贴序
  会话级不落盘（AOSP 经 Settings 持久化，本壳无设置页，self: 披露 §6.4）。
- **#31 即修即录（D10 探针暴露的 v1.16 潜伏缺陷）**：`.qs-tile-detail` 自带
  display:flex（author origin 压过 UA 级 `[hidden]{display:none}`）——hidden
  属性卡片照常渲染并可拦截点击，v1.16/v1.17 未触发只因后续无点击落在卡域；
  修复 = 补作者级 `[hidden]{display:none!important}` 规则组（detail/edit 卡与
  双 scrim 四件）；另有探针 D 场景两轮试错入坑（默认序签名误判尾位=airplane
  实为位 5/clock 收尾；拖动方向写反——debug 脚本逐步观察 live reflow 定谳，
  引擎无缺陷纯探针脚本错，修复后 D10 全绿）。
- **测试（铁律三全过）**：tsc 零错 + vitest **59/59**（+20：tile-order.spec；
  quick-row.spec 改函数化断言）+ vite build 产物落 shell/（新 hash 对
  index-DYqEzof7.js/index-RcL-RxNY.css，旧对 git rm）+ check-inline-js 4/4 +
  shell-probe 五通道 VERDICT: PASS（D 场景扩为 D1-D10：真指针 8 步拖动重排
  →drop 提交→网格/折叠行跟随→状态保留→反向拖回还原默认序）+ pack-verify
  五场景 VERDICT: PASS（根入口零影响实证）。
- **零根入口触碰声明**：diff = shell-src 六件（qs-panel/tiles/tile-order 新/
  style.css/tests×2）+ shell 产物四件 + scripts/shell-probe.py（D10）+
  docs（SHELL.md §6.4 新节+§6.3 账目 4 行/HANDOFF/shell-evidence）。sw VERSION
  保持 v1.11（shell 页面不注册 SW）；L0 红线零触碰（core/app/index.html/
  project.json/素材零 diff）；新 self: 值集中登记 SHELL.md §6.3/§6.4（起拖 6px/
  FLIP 180ms/卡尺寸/序会话级）。
- **撞号协调**：v1.18 已于 #3 领号（id 6744827078）+ #1 认领帖先于动工；
  开窗 fetch 对齐 origin/main = f1a12ca（v1.17，CI run 42602129619 全绿）；
  #3 全量 11 条评论实读零撞号；R137 收窗两帖（#3 交付登记 6744727478 +
  #18 凭证 6744728029）本窗补发清偿（20:00 窗沙箱故障零操作顺延）。

## 本窗交付（v1.17 ② QS 磁贴收尾与深化第一批 · R137）

- **探针 D 场景补锁屏 unavailable 分支（R137 续点 1 首项）**：写「锁屏」=1（工程既有变量，
  写通道纪律内）→ 网络类磁贴 unavailable + 手电筒锁屏可用（惯例 self:）→ 解锁恢复。
  **顺带定谳两处 R136 缺口（#31 即修即录）**：① tile-states 锁定语义——R136 只在
  「无记录/已存 unavailable」两路判定，已 active 磁贴锁定时仍显示原态，且 unavailable
  存储态无写入路径（死分支）；修正后锁定→一律显示 unavailable（内部态保留）、
  解锁→恢复先前选择（贴近真实设备）；② 面板位移模型——R136 恒定位移
  translateY(-(1-p)×105%) 在一段时露出面板底部，通知段/clock/折叠行从未入视口
  （notifFade 淡出窗 [0.5→0.72] 与内容入视口窗错开）；修正为两段模型：p≤0.5 滑入段
  （0.5 恰好贴顶）+ p>0.5 贴顶过渡，一段 = 通知面板贴顶全量可见（AOSP 语义），
  探针 D7a 实断言 clock_top∈[0,844)。
- **#18 对照稿深化项三项（R137 续点 1 交付面）**：① 折叠态磁贴行（任务 1
  「折叠态显示 N 个」）＝通知段顶部常驻 N=4 磁贴行（QuickQSPanel 同构位；
  **N 为 self: 值**——SPEC 附注二留空项，md3 语料树 1588 blob 实查无 SystemUI
  原生 QS dimens，防编造不标 aosp:，实查披露）；与网格共享同一状态机
  （toggle 双实例同刷，探针 D7 实断言折叠行点击→网格同步）；② 长按磁贴详情
  （AOSP tile dialog 同构位）：pointerdown 400ms（framework 惯例值 self:）→
  详情卡（标题/状态/说明/开关钮；action/status 详情只读；点击钮后 dialog 保持
  打开文案实刷新；点 scrim 关；同磁贴尾随 click 吞用防竞态）；工程内无设置页 →
  不放设置入口（self: 裁剪披露）；③ QS 段超高滚动窗（面板高度长尾）：
  .shade-qs max-height min(56vh,460px) + overflow-y auto（self: 值，附注二
  留空项不编造），探针 D9 computed 断言。
- **QS 网格 px 实拉结论（R137 续点 4 随动工实拉项）**：md3 语料树 1588 blob
  全量实查——SystemUI 原生 QS dimens/网格尺寸**不在语料**（仅 md3 ios-desktop
  参考实现 + quickaffordance.md，按 #18 任务 3 只作数值参考不标 aosp:）→
  SPEC 附注二留空项维持留空，折叠行 N/滚动窗高度按 self: 登记披露。
- **探针/测试扩容（铁律三全过）**：vitest 39/39（tile-states 8 含 R137 修正 2 例 +
  新 quick-row.spec 6 例：折叠行数量/成员/共享状态机前缀 + describeTile 三类磁贴
  详情纯函数）；shell-probe 五通道 VERDICT: PASS（D 场景扩为 D1-D9：三态翻转/
  换肤/token 曲线实值/锁屏 unavailable 分支/折叠行同步+一段可见性/长按详情闭环/
  滚动窗，wifi 选择器加 .qs-grid 限定——折叠行同 id 实例共存后无限定选择器会命中
  二段不可见的折叠行实例）；pack-verify 五场景 VERDICT: PASS（根入口零影响实证）；
  tsc 零错 + check-inline-js 4/4。
- **零根入口触碰声明**：diff = shell-src 五件（qs-panel/tile-states/tiles/style.css/
  tests×2）+ shell 产物四件（index.html + assets 新 hash 对，旧 hash 对 git rm）+
  scripts/shell-probe.py + docs（SHELL.md §6 披露扩容/HANDOFF/shell-evidence）。
  sw VERSION 保持 v1.11（shell 页面不注册 SW）；L0 红线零触碰
  （core/app/index.html/project.json/素材零 diff）；新 self: 值集中登记
  SHELL.md §6.3（折叠行 N=4/长按 400ms/滚动窗 max-height/滑入段 105% 余量）。
- **撞号协调**：v1.17 已于 #3 领号（id 6737312543）+ #1 认领帖（6737313021）先于动工；
  开窗 fetch 对齐 origin/main = 913031f（v1.16，CI run 42586781425 全绿）；
  #3 全量 9 条评论实读零撞号。

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

## 下窗续点（R141）

0. **开窗入口已切换**：置顶议题 #2（SOP·铁律）+ #30 读完再动手闸门 + 本文件 +
   git log --oneline -5；认领登记按 #2 §一4（认领 + 预计版本号，后到者跳号 #3）；
   **基座纪律（R140 实证）**：沙箱重建后本地仓可能是陈旧快照——开窗先 `git fetch` +
   `git reset --hard origin/main` 对齐远端再核树（R140 本地一度停在 v1.10 快照 +
   海量脏文件，fetch 增量 + hard reset 修复）；git 协议慢时 tarball API（api.github.com
   /tarball/<sha>，只读核验用）；
1. **② L3 通知面第二批（R140 已交第一批：媒体卡全生命周期 + 空态 + 清除全部 +
   swipe 通道就位）**，候选面（动工前在 #18 登记批次方案）：
   - 可消除事件源扩展（swipe 通道本批已就位暂空——后续批次接源零结构改动）；
   - 锁屏通知联动（#17 关联，锁屏页通知列表评估）；
   - heads-up 横幅（范围大，独立批次评估后再动）；
   - SPEC 附注二留空项维持（待用户侧 sources jar 渠道）；
2. **③ app 开/关动画接 vendored 内核**：**对侧 2933040 动画工作面，继续避开**——
   除非对侧 #1 明示转交；API 形状 = shell-src/src/motion/ 出口；
3. **锚点治理议题跟踪**：android-17.0.0_r1 可达性恢复时（镜像补全/用户侧 sources
   jar），按 SPEC 附注一纪律逐项回核 aosp: 值，有差异即修订 SPEC 并披露；
4. **SPEC 附注二留空项补考**：SpringForce 劲度/阻尼（sources jar）· Launcher3 栅格
   px（#13 对照稿）· QS 磁贴网格尺寸（#18 对照稿，语料内无，维持留空）——随议题
   动工实拉；
5. 用户真机验收（60Hz 顺滑/120Hz 零变化 + /shell/ 面板两段手势 + 折叠行 +
   长按详情 + 编辑页拖动重排 + header 双态过渡 + **媒体通知卡全生命周期（新增：
   打开 music APP 播放→下拉一段看媒体卡，换曲/停播实变化）**）；
6. **#4 CI 收尾**：持续观察 schedule boot-probe 与 shell-gates 时长漂移；
   regression-headless 入 CI 仍缓行；
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
| v1.16 | Job 2933110（R136） | ② QS 磁贴 L2 化首批（#18 对照稿交付：shade 两段 + 六磁贴三态 + tile-bounce spring + SPEC token 代码化 shade-tokens.ts + 探针 D 场景 + vitest 31 例） | 未 tag（shell-src 新壳面 + shell/ 产物，零根入口触碰；sw VERSION 保持 v1.11） |
| v1.17 | Job 2933110（R137） | ② QS 磁贴收尾与深化第一批（#18：探针 D 锁屏分支 + 折叠行 N=4 + 长按详情 + QS 段滚动窗 + 位移两段模型修正 + tile-states 锁定语义修正 + vitest 39 例） | 未 tag（shell-src 新壳面 + shell/ 产物 + scripts 探针，零根入口触碰；sw VERSION 保持 v1.11） |
| v1.18 | Job 2933110（R138） | ② QS 展开编辑页（#18 对照稿余项：tile-order 纯函数模块 + 编辑覆层整卡拖动重排 + 折叠行跟随磁贴序 + 状态机跨 rebuild 保留 + hidden×flex 缺陷修复 + vitest 59 例 + 探针 D10） | 未 tag（shell-src 新壳面 + shell/ 产物 + scripts 探针，零根入口触碰；sw VERSION 保持 v1.11） |
| v1.19 | Job 2933110（R139） | ② motion.qs.fade-* L3 Header 过渡轮（帧 14/58 经语料标定点位移轴消费 + header 双态实例 grid 叠放 + 「1s 变形时间轴」定谳 + start→complete 语义修正 + vitest 68 例 + 探针 D11） | 未 tag（shell-src 新壳面 + shell/ 产物 + scripts 探针，零根入口触碰；sw VERSION 保持 v1.11） |
| v1.20 | Job 2933110（R140） | ② L3 通知面接入第一批（#18 任务 4：notifications.ts 状态机 + 通知卡真结构 + 媒体卡 MediaStyle 同构位（数据源防发明实证 music播放状态/当前播放music）+ 空态 + 清除全部 + swipe 消除通道就位 + ongoing 语义 + vitest 78 例 + 探针 D12） | 未 tag（shell-src 新壳面 + shell/ 产物 + scripts 探针，零根入口触碰；sw VERSION 保持 v1.11） |

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
