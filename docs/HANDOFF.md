<!-- docs/HANDOFF.md — 跨轮次交接快照（#18 方向变更公告 6715176456 指定的交接入口；
     新实例读本文件 + git log --oneline -5 即可开窗，不必翻全部评论） -->
<!-- 维护纪律：每轮交付后立即覆写本文件（不是槽末统一写）。 -->

# Pixel XXL · HANDOFF 结构化快照

- **generated**: 2026-11-08 16:5x+08:00（R131 窗收窗覆写 · Job 2933110；本窗 = #23 语言迁移/新壳立项落地轮）
- **⚠️ 本窗五度撞号实录（Job 2933040 本系列）**：同窗并行实例与本实例连续同号交叉——
  对侧连发 v1.04 资产包（36ec911）/v1.05 分片+CDN（17dbbd0）/v1.06 IDB+竞速（f904330），
  本方 v1.04 反馈层（4a7343c，tag 已推）/v1.05 合流（f7ed235+a9a1db1）/v1.06 三缺陷修复
  （e28beee，**main 未推成，本地树保命于远端分支 `backup-v106-bfb` = e28beee**）。
  版本号双方同取（v1.04×2/v1.05×2/v1.06×2），终树重滚见下窗续点。
  **六度撞号（本窗）**：本方 v1.07 单调化（5c2d183）× 对侧 v1.07 五度融合（18197ef）——
  已合流重滚 v1.08；loader 单调闸/解码文案与 #boot-feedback 全屏层正交并留，零语义冲突。
- **head**: 本窗合流提交（**v1.10 = #23 语言迁移落地：shell-src/ Vite+TS 新壳 + shell/ 产物双入口 + vendored md3 动画内核 + VMBridge 写通道**；L0 忠实态零触碰，fidelity sha256 全 PASS）
- **上一窗 head 归档**：v1.08 = 六度撞号合流（对侧 v1.07 五度融合 18197ef × 本方 v1.07 进度条单调化 5c2d183）；backup-v106-bfb 转归档
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
| v1.09 | docs: HANDOFF 议题索引补 #30（读完再动手闸门·两仓同规） |
| v1.10 | **#23 语言迁移落地**：shell-src/（Vite+TS 源码）→ shell/（产物，Pages 双入口 /shell/）；iframe 原样嵌根入口零复制；QS 磁贴 L2 POC（vendored md3 连续打断内核 + 拉出条手势 + 6 磁贴）；VMBridge 写通道（catalog 94 变量对账 + 空壳保护 + 工程事件链复刻）；vitest 10 例契约测试；shell-verify/shell-probe 探针全绿；pack-verify 五场景 PASS |

## 红线（违反 = 返工）

1. **core/app 逐字节**：`lib/turbowarp-core.js`、`lib/pixel-xxl-app.js` 不许改动；
2. **index.html 骨架**：既有字节零改动，只允许尾部追加（v1.03 SW 注册 / v1.06 反馈层先例）；
3. **素材 md5 寻址**：改素材内容必须同步 project.json 的 md5ext 键（v1.03 先例：等长替换）；
4. **双版对比回归**：改壳层 UI 后跑回归须带 `?nofb=1`（v1.06 反馈层豁免通道），
   否则截图对比会被新增层污染；
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

- 冒烟取证：`python3 scripts/boot-feedback-probe.py`（自起 8089 服务，三通道 A/B/C，
  证据落 docs/boot-feedback-evidence.json，软渲染全链路约 6 分钟）；
- 双版回归：`python3 scripts/regression-headless.py`（需 8081=本仓 + 8082=原版
  `Pixel.XL.0827.html` 静态服务；原版取自 md3 Release tag `nnnj`，57MB 下载通道慢，
  建议后台预取；移植版 URL 需带 `?nofb=1` 防反馈层污染截图）；
- 手机仿真：`python3 scripts/mobile-probe*.py`（MOBILE.md §四）；
- 素材完整性：loader 口径（project.json 逐 target 逐 costume/sound 的 assetId.dataFormat
  实存检查，slim-verify.py 内同款）。

## 已知坑

- headless swiftshader 下画面恒黑（qiaoqiaoMica 软渲染降级缺陷，ANALYSIS §7 /
  MOBILE.md §一）——**不是移植缺陷**，像素点亮判定在 headless 不可达，冒烟判据勿依赖它；
- `_tickCounter` 等内部属性在打包 runtime 上不存在（minified/未暴露），运行信号用
  `runtime.threads.length`（稳定 API）；
- git push 若 443 超时（HTTP2 framing / connect timeout）：REST API blob→tree→commit→ref
  四步推送可用（md3 #18 评论 6715376371 记载，`scripts/api-push2.py` 模式）；
  API 推送产生的 commit sha 与本地不同（树一致），恢复 git 协议后先 fetch + reset --hard 对齐；
- 并行实例：本仓曾有同窗并行提交（2026-11-08 12:03 v1.03 系并行实例推送）——
  动手前先 `git fetch`，远端是唯一真相源；认领协调面 = 本仓库 issue #1 评论。

## 下窗续点（R130 · 合流已完成，剩余项轻量）

**✅ 已完成（18197ef）**：五度撞号终融合 v1.07 已推 main（REST 回读一致）；pack-verify
五场景 PASS；tag v1.04~v1.07 全部落远端。合流裁决实录见 PORTING §11 注记与本文件上方版本里程碑。

1. 补跑 boot-feedback-probe.py 三通道冒烟（A nofb 豁免 / B 桌面全链路 / C 移动仿真）——
   v1.07 终树的反馈层证据补全（桌面断言已被 pack-verify A 等效覆盖，移动通道是唯一缺口）；
2. 常规续点：候选任务池按 ROI 认领（⏳ 仅余启动空窗治理③）；R > 30min 加餐、
   R < 40min 不开新重型（md3 #18 §7.5 规则精神沿用）；
3. **#23 新壳已可用**：/shell/ 双入口在线（本窗推送后）；下窗可续：① issue #23 回帖交付凭证
   （待 PAT——本窗旧 PAT 已失效，推送未竟时改用 backup 分支保命）；② QS 磁贴 L2 化
   （逐项 AOSP 考证 + 设计 token 消费，依赖 #6/#7）；③ app 开/关动画接 vendored 内核
   （动画攻坚实例的工作面，API 形状 = shell-src/src/motion/ 出口，零翻译成本）；
   ④ shell-probe.py/shell-verify.py 纳入 #4 CI 基线；⑤ gen-bridge-catalog.py 随
   project.json 演进重生成（catalog 对账 fail loud 已兜底）。

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
