<!-- docs/HANDOFF.md — 跨轮次交接快照（#18 方向变更公告 6715176456 指定的交接入口；
     新实例读本文件 + git log --oneline -5 即可开窗，不必翻全部评论） -->
<!-- 维护纪律：每轮交付后立即覆写本文件（不是槽末统一写）。 -->

# Pixel XXL · HANDOFF 结构化快照

- **generated**: 2026-11-08 18:45+08:00（R132 窗收窗覆写 · Job 2933110 · 本窗 = #4 CI 基线；R131 = 八度撞号合流 v1.11）
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
- **head**: **v1.12 = #4 CI 基线**（regression.yml：push=static-gates+pack-verify 五场景、schedule=boot-probe 三通道、红灯 GITHUB_TOKEN 回帖 #2；+ 1a97a66 声明物化 check-inline-js.py）——上一版 v1.11 = 八度撞号合流终树（对方动画 4a181d3 × 本方语言迁移 d32f5e9 并档；L0 忠实态零触碰 + fps 修复双双保留）
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

- CI 基线（#4，v1.12）：push 自动跑 static-gates + pack-verify，每日 05:30+08 自动跑
  boot-probe 三通道（Actions → regression workflow，证据在 run artifact）；红灯自动回帖 #2；
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

## 下窗续点（R133）

**✅ 已完成（18197ef）**：五度撞号终融合 v1.07 已推 main（REST 回读一致）；pack-verify
五场景 PASS；tag v1.04~v1.07 全部落远端。合流裁决实录见 PORTING §11 注记与本文件上方版本里程碑。

0. **开窗入口已切换**：置顶议题 #2（SOP·铁律）+ #30 读完再动手闸门 + 本文件 +
   git log --oneline -5；认领登记按 #2 §一4（认领 + 预计版本号，后到者跳号 #3）；
1. 用户真机验收 v1.10 动画（60Hz 设备开/关动画是否顺滑；120Hz 设备应零变化）；
2. 补跑 boot-feedback-probe.py 移动通道（R130 遗留；桌面断言已被 pack-verify A 等效覆盖）；
3. **#23 新壳已可用**：/shell/ 双入口在线（本窗推送后）；下窗可续：
   ① issue #23 回帖交付凭证（本窗已回帖；若 PAT 失效改 backup 分支保命）；
   ② QS 磁贴 L2 化（逐项 AOSP 考证 + 设计 token 消费，依赖 #6/#7）；
   ③ app 开/关动画接 vendored 内核（动画攻坚工作面，API 形状 = shell-src/src/motion/ 出口，
   零翻译成本；与对方 v1.10 帧率自适应共存——壳层动画走 DOM/合成器不占 VM tick，互不干扰）；
   ④ shell-probe.py/shell-verify.py 纳入 #4 CI 基线；
   ⑤ gen-bridge-catalog.py 随 project.json 演进重生成（catalog 对账 fail loud 已兜底）；
4. 议题池按优先级认领（设计先行 #6 冻结令优先）；R > 30min 加餐、R < 40min 不开新重型；
5. **#4 CI 收尾**：regression-headless 入 CI（actions/cache 预热 57MB 原版 + 8081/8082
   双服务）；首周观察 schedule boot-probe 软渲染在 runner 上的时长漂移是否稳定绿灯。

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

## 议题索引（2026-11-08 · 新立 29 个议题 #2~#30（含 #30 读完再动手闸门），已回读核对 + #2 已置顶）

> 用户方针：**先一锤定音把设计弄好（设计先行），再贯彻全方位代码移植**；
> md3 内容只借"已考证的值 + 纪律 + 语料索引"，不搬繁重与方向性决策。
> 开窗入口改为：**置顶议题 #2（含开窗 SOP 与铁律）+ 本文件 + git log --oneline -5**。

| 区段 | 议题 |
| --- | --- |
| 交接/治理 | #2 上下文交接专项（SOP·铁律·置顶）· #3 撞号治理（领号制）· #4 CI 基线 · #5 Pages 一致性 · #30 读完再动手闸门 |
| 设计先行 | #6 设计冻结令（DESIGN-SPEC v1.0）· #7 token 清单与出处 · #8 设计对照稿评审 · #9 亮暗/tone 口径 |
| 语料 | #10 md3 AOSP 语料按需引入（防膨胀） |
| 真移植 | #11 总纲 L0~L3 · #12 Monet · #13 桌面栅格 · #14 All Apps · #15 Recents · #16 返回手势 · #17 锁屏 · #18 QS 磁贴 · #19 时钟 · #20 开机动画 · #21 云母模糊 |
| 性能 | #22 启动空窗治理 · #23 混合渲染主干（Vite+TS 新壳） |
| 资源/裁决 | #24 PNG/MP3 瘦身口径 · #25 云变量收敛 · #26 存档脏值清理 |
| 应用 | #27 六个 213 块同构占位 APP 处置 · #28 music 专项 · #29 计算器/时钟/个性化盘点 |

> 实测新发现（project.json 21 targets 逐个盘点）：相册/商店/通知/视频/电话/bilibili 六个
> APP 完全同构（均 213 块、2 造型）= 占位壳，处置见 #27。
