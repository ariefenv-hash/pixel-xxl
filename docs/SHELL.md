# SHELL.md — 新壳（#23 结构性混合渲染）架构与边界

> 新壳 = 仓库内可选第二入口：`/pixel-xxl/shell/`（产物目录 `shell/`，源码目录
> `shell-src/`）。根入口 `/pixel-xxl/` 保持零构建忠实态，一字不动。
> 立项依据：ANALYSIS.md §10 中期路线 + 议题 #23（用户 2026-11-08 指示
> 「先做项目迁移，md3 的连续打断与并行动画逻辑直接复用」）。

## 1. 双入口地图

| 入口 | URL | 内容 | 构建态 |
| --- | --- | --- | --- |
| L0 忠实态（主入口） | `/pixel-xxl/` | 根 index.html + lib 三件套 + assets + project.json + sw.js | **零构建**（v1.00 起原样） |
| 新壳（可选入口） | `/pixel-xxl/shell/` | shell/index.html（iframe 嵌根入口）+ 壳层 JS/CSS bundle | Vite+TS（`shell-src/` → `shell/`） |

- 双入口共用同一批运行时文件与素材（iframe 的 `../index.html` 解析回根入口）；
- 新壳发版不触碰 L0；L0 版本演进自动被新壳继承（iframe 直载）；
- 红线继承：core/app 逐字节、根 index.html 骨架零改动、素材 md5 寻址、
  待裁决项不动（docs/HANDOFF.md）。

## 2. 架构：iframe 原样嵌根入口

```
shell/index.html
├── <iframe id="runtime" src="../index.html">   ← 根入口 100% 原样（启动序列零复制）
├── <div id="qs-root">                          ← 壳层覆盖层（pointer-events: none）
│     └── QsPanel（面板 + 拉出条，可交互子元素 pointer-events: auto）
└── <div id="bridge-status">                    ← 桥接状态胶囊（纯文本，pointer-events: none）
```

- **零复制**：运行时三件套、run() 启动序列、加载屏/启动屏/错误屏全部只在
  根入口存在一份；新壳不重写任何运行时行为，根入口演进零同步成本；
- **事件分层**：`#qs-root` 不拦截事件，未接管的指针事件穿透给 iframe 内
  Canvas（stage 交互不受壳层存在影响）；仅拉出条/磁贴自身 `pointer-events: auto`；
- **URL 参数透传**：壳层把 `location.search` 原样拼进 iframe src——
  `?nofb=1` 回归豁免通道在 iframe 内生效（壳层自身无反馈层，
  双版像素对比基线不受污染）。

## 3. 桥接协议（src/bridge/）

### 3.1 读通道（零限制，v1.05/v1.06 已验证零红线）

| 出口 | 来源锚点 | 用途 |
| --- | --- | --- |
| `window.vm` | lib/pixel-xxl-app.js 显式挂载 | targets/threads 计数、舞台变量读取 |
| `window.__packState()` | lib/project-loader.js L671-679 | 素材包状态（source/ready/下载/解码） |
| `window.__packSource()` | 同上 | 来源标记（idb/cdn/origin/files） |

跨 frame 访问经 `bindFrame()` 唯一取窗点（iframe.contentWindow，同源）；
全部读取 try/catch 静默降级（运行时未就绪绝不打断壳层）。

### 3.2 写通道（收敛在 VMBridge 三方法，语义纪律见 §5）

| 方法 | 语义 | 失败呈现 |
| --- | --- | --- |
| `getVar(name)` | 舞台全局变量按名读取 | null（未就绪/不存在） |
| `setVar(name, value)` | 写舞台全局变量（catalog 校验 + 空壳保护） | false / 空壳变量抛错 |
| `broadcast(name)` | `runtime.startHats('event_whenbroadcastreceived', {BROADCAST_OPTION})` | 返回启动线程数（0 = 无接收者） |

- 挂载前对账（`VMBridge.attach()`）：catalog 舞台变量目录 ↔ 运行时实际
  变量集合，漂移 fail loud（阻断面板挂载）——catalog 由
  `scripts/gen-bridge-catalog.py` 从 project.json blocks 图机器实证生成
  （真源指纹 PROJECT_SHA256_16 生成期锁定）；
- **本轮写通道仅服务磁贴动作**（tiles.ts 复刻工程事件链），磁贴写通后
  全链路真实生效（如亮度模式切换 → 广播「壁纸」→ zz → 取色 → 13 target 重染）。

### 3.3 变量目录（catalog.ts，自动生成禁手改）

94 个舞台全局变量全量 + refs/writes 计数 + 8 个广播的发送/接收 target 图。
用途：磁贴绑定校验（§5）、空壳识别（§5）、后续子系统的状态面索引。

## 4. 素材包状态可见性

壳层胶囊显示 `__packSource()`；加载期四态文案仍由根入口内部呈现
（iframe 原样）——壳层不重复实现下载进度面（根入口 v1.06/v1.08 已完整）。

## 5. 空壳变量纪律（catalog 头注同款，磁贴绑定校验的依据）

refs=0 的变量 = 「声明但未使用」（用户「空壳」观察的第一层机器实证，
共 41 个，含控制中心五变量）。纪律：

1. **DOM 壳不得对空壳变量发明语义**——不绑定、不写入、不展示假状态；
2. 控制中心正是「工程内未实现」子系统（#18）：DOM 侧开关状态由壳层自持，
   不写「控制中心打开？」等空壳变量；
3. 动作磁贴只允许复用工程既有事件链（catalog 广播图）：
   亮度模式/壁纸编号 → 写变量 + 广播「壁纸」（个性化APP 同款序列）；
   曲线风格 → 仅写变量（「应用」target 逐帧直读，工程内原样无广播）；
4. `validateTilesAgainstCatalog()` 启动期校验，漂移即抛（fail loud）。

## 6. 手势模型与 shade 两段（qs-panel）

- v1 = 顶部拉出条 pointerdown → 面板 1:1 跟手（setProgress 瞬置锚）→
  松手按「位置过半 + 最近方向」投票进/出；
- **速度接力（Spring.setTarget(target, v) 通道）不做**——留给 app 开/关
  动画轮（动画攻坚实例的工作面）；本 POC 边界到此（md3 手势速度合成
  语义未考证前不做）；
- 连续打断语义由 vendored 内核保证：反向触发从当前 progress 接续，
  快速连拉/连推不丢动画（tests/interruptible.spec.ts 契约锁定）。

### 6.1 shade 两段模型（v1.16 · #18 L2 首批）

- progress 0→1 = shade 展开全程（drag 跟手与 IIO 程序动画共用 syncDom 单源）：
  一段（0→0.5）= 通知段（时钟大字 + 日期 + 前台/锁屏只读卡 + 通知 0 条占位卡），
  二段（0.5→1.0）= QS 磁贴网格；
- **token 曲线（引用制，DESIGN-SPEC v1.0）**：scrim alpha =
  `motion.shade.scrim-alpha.map`（输入 [0→0.5] → ease-in-out）；QS 段 alpha =
  `motion.shade.content-alpha.map`（输入 [0.3→1.0]，<0.3 全透明 = 两段互斥由语料
  曲线本身保证）；公式出口 = `shell-src/src/shell/shade-tokens.ts`
  （f′≤0→0 短路分支逐字转录 md3 语料 ShadeInterpolation.kt，R136 重核零漂移）；
- **header 双态过渡（L3 Header 过渡轮 · R139）** = `motion.qs.fade-*` 帧锚消费：
  语料标定等式（integers.xml 注释原文「Percentage of displacement for items in
  QQS to guarantee matching with bottom of clock AT fade_out_complete_frame」）——
  **帧 14 ≡ 位移 0.1066**，为语料自身给出的时间轴↔位移轴唯一标定点；据此帧锚
  经标定点换算到位移轴消费（drag 跟手纯函数，不引入固定 ms 时长）：旧态
  （通知）淡出 [0→0.1066]（帧 0→14，完成点=标定点）、新态（控制中心）淡入
  [0.4416→1]（起点 = 帧 58 线性换算 58×0.1066/14）、空窗 [0.1066→0.4416]
  双态皆隐（帧序 14<58 天然导出）。**「1s 变形时间轴」定谳**：60fps 下帧 58 ≈
  967ms，过渡时间轴跨度 ≥58 帧 ≈ 1s 量级（可证下限）；淡入完成帧/总时长语料
  无 token 不可证 → 不在时间轴消费帧锚，IIO 320/260ms 不匹配问题随位移轴
  消费消解。self: 披露：淡出窗口起点取时间轴零点（帧 0 ≡ 位移 0）、帧→位移
  线性外推（语料仅此一标定点）、淡入完成点取满展开（几何必要性）。
  #31 修正：v1.16 消费为「副标题 start@0.1066」，与语料注释对照为
  complete@0.1066，本窗对齐（探针 D11 实断言，含反向对称）；
- 通知段淡出曲线 [0.5→0.72] 线性 = self:（SPEC 无对应 token）；
- **面板位移两段模型（R137 修正）**：p≤0.5 为滑入段（0.5 时恰好全落贴顶），
  p>0.5 保持贴顶不动、仅内容过渡（通知淡出/QS 淡入）——AOSP 一段 shade =
  通知面板贴顶全量可见。R136 恒定位移 translateY(-(1-p)×105%) 在一段时露出
  的是面板底部（QS 尾部），通知段/clock 从未入视口（探针 D7a 实测发现，
  #31 即修即录）；105% 滑出余量保留（self:）；
- **折叠态磁贴行（#18 任务 1「折叠态显示 N 个」· R137）**：通知段顶部常驻
  一行 N=4 磁贴（QuickQSPanel 同构位；N 为 self: 值——SPEC 附注二留空项，
  md3 语料树 1588 blob 实查无 SystemUI 原生 QS dimens，防编造不标 aosp:）；
  行磁贴与网格共享同一状态机（toggle 双实例同刷）；可见性随通知段
  notifFade 曲线（一段全量可见、二段隐藏 = AOSP 语义；SPEC 无折叠行专用
  token，复用通知段曲线按 self: 登记）；
- 通知段内容为壳层演示语义（self:）：工程内无通知子系统（#18 现状口径），
  占位卡不声称 AOSP 通知面。

### 6.2 三态磁贴（tile-states.ts，#18 首批六磁贴）

- #18 对照稿首批清单：WLAN/蓝牙/手电筒/自动旋转/深色主题/飞行模式
  （kind=toggle，AOSP QSTile 同族三态 active/inactive/unavailable）；
- 状态由壳层自持（SystemUI QS tiles 本即 SystemUI 自持状态机），**不写任何
  工程变量**（L0：不新增 project.json 变量；写通道收敛纪律不变）；
- unavailable 触发面 = 锁屏只读联动（「锁屏」=1 → WLAN/蓝牙/自动旋转/飞行模式
  锁定；手电筒/深色主题始终可用）——**壳层模拟语义（self:）**，非 AOSP 原样
  （AOSP 锁屏磁贴为「点击请求解锁」；模拟器无解锁请求通道，三态简化披露于此）；
- **锁定语义修正（R137，探针 D 场景补锁屏分支时发现，#31 即修即录）**：
  R136 版只在「无记录」与「已存 unavailable」两路判定锁定，已 active/inactive
  磁贴锁定时仍显示原态（缺口）；unavailable 存储态无写入路径（死分支）。
  修正后：**锁定 → 一律显示 unavailable（内部态保留）；解锁 → 恢复内部态**
  （无记录走 initial）——贴近真实设备「解锁后磁贴保持用户先前选择」；
  探针 D6 实断言（锁 unavailable/手电筒可用/解锁恢复 inactive）；
- **长按磁贴详情（#18 对照稿深化项 · R137）**：长按磁贴 400ms → 详情卡
  （AOSP tile dialog 同构位：标题 + 开关钮；action/status 详情只读）；
  点击开关钮后对话框保持打开且文案实刷新（AOSP 语义）；点 scrim 关卡；
  长按阈值 400ms = framework ViewConfiguration 惯例值，语料未入库按 self:
  登记（不标 aosp:）；工程内无设置页 → 详情卡不放设置入口（self: 裁剪）；
  文案为壳层演示语义（self:）；
- 深色主题磁贴副作用 = 壳层主题换肤（html[data-shade-theme] 切 style.css
  变量组，亮色变量组为 self: 值），零工程侵入；
- **tile-bounce（按压反馈）** = vendored Spring 解析闭式解：
  squash 起点 0.92 / response 0.28s / ζ 0.55（self: 手感值——SPEC 附注二留空项
  SpringForce 劲度/阻尼语料未入库不编造），收敛判定消费
  `motion.spring.min-visible.scale`（1/500，DynamicAnimation 语义）；
  bounce 期间 .qs-tile-bouncing 禁 CSS transition（spring 全权接管 transform，
  防双重插值）。

### 6.3 token 账目（self: 值集中登记）

| 值 | 位置 | 性质 |
| --- | --- | --- |
| PANEL_IN_MS=320 / PANEL_OUT_MS=260 | qs-panel.ts | self:（SPEC 无 shade 时长 token；IIO 内核参数） |
| GRAB_STRIP_H=28 | qs-panel.ts / style.css | self: |
| POLL_MS=500 / FEEDBACK_MS=4000 | qs-panel.ts | self: |
| BOUNCE 参数（response 0.28s / ζ 0.55 / squash 0.92 / release v 1.6） | qs-panel.ts | self:（SpringForce 语料未入库，附注二留空项） |
| 通知段淡出 [0.5→0.72] 线性 | qs-panel.ts notifFade | self: |
| 折叠行 N=4 | tiles.ts QUICK_ROW_COUNT | self:（附注二留空项：语料无 QS 原生值，R137 实查披露） |
| 长按阈值 400ms / 取消位移 8px | qs-panel.ts LONG_PRESS_MS | self:（framework 惯例值，语料未入库） |
| QS 段滚动窗 max-height min(56vh, 460px) | style.css .shade-qs | self:（附注二留空项：语料无 QS 段高度 token） |
| 滑入段位移 105% 余量（p≤0.5 线性×2） | qs-panel.ts syncDom | self:（R137 修正披露） |
| 编辑页起拖阈值 6px / FLIP 补位 180ms | qs-panel.ts EDIT_DRAG_START_PX / EDIT_FLIP_MS | self:（R138，语料无对应 token） |
| header 旧态淡出 [0→0.1066] 线性 / 新态淡入 [0.4416→1] 线性 | qs-panel.ts headerOldAlpha / headerNewAlpha | self: 窗口（锚点语料标定：帧14≡0.1066、帧58 线性换算≈0.4416；完成点=满展开披露，R139） |
| 帧锚位移步长 0.1066/14（线性外推） | shade-tokens.ts QS_FRAME_TO_PROGRESS | self:（语料仅帧 14 单标定点，全程映射不可证，R139 披露） |
| 编辑页卡尺寸 min(86vw,340px) / max-height 76vh | style.css .qs-edit-card | self:（R138） |
| 磁贴序会话级不落盘 | qs-panel.ts this.order | self:（与 tile-states states Map 同律：工程 reload 不残留；AOSP 经 Settings 持久化，本壳无设置页不落盘） |
| 亮色主题变量组 | style.css | self: |
| scrim/content/公式/0.1066/1÷500/14/58 | shade-tokens.ts | **SPEC token 引用**（aosp: 出处行内标注） |

### 6.4 QS 展开编辑页（tile-order.ts + qs-panel 编辑覆层，#18 对照稿余项 · R138）

- **入口**：QS 段网格下方「编辑磁贴」钮（AOSP 编辑页 footer pencil 同构位，self:）
  → 覆层卡（scrim + role=dialog：标题/拖动提示/完成钮 + 磁贴列表）；
- **整卡拖动重排**（AOSP 编辑页同构语义）：pointerdown 记锚 → 位移超 6px
  （self:）起拖 → 随指跟随（拖动项布局位 offsetLeft/Top 锚 + translate 补差，
  reflow 后重钉）→ 目标格 live reflow（gridIndexForPoint 纯几何：格宽高+gap
  步进，悬停格位 = 最终格位，FLIP 180ms self: 补位动画）→ drop 提交工作序
  （normalizeOrder 兜底：剔未知/去重/补缺失）；pointer capture 保移出跟手
  （合成事件捕获失败不阻断——探针惯例）；
- **提交后跟随**：网格 + 折叠行 + 编辑列表全 rebuild；**折叠行 = 当前磁贴序
  前 4 个 toggle 族**（QuickQSPanel 同构语义：显示用户自定序前 N 个；本壳限定
  toggle 族——mini 变体三态展示位，action/status 不入折叠行，self: 裁剪披露）；
  **三态状态机跨 rebuild 保留**（tile-states 的 states Map 会话自持，rebuild
  只重建 DOM 不动状态，探针 D10 实断言）；
- **编辑态不翻转**：编辑列表项为 div 无点击语义（AOSP 编辑页磁贴不响应开关）；
- **裁剪披露（self:）**：无「可添加磁贴」池（全部 12 磁贴常驻 active，只重排
  不增删）；磁贴序会话级不落盘（AOSP 经 Settings 持久化，本壳工程内无设置页）；
- **#31 即修即录（D10 探针暴露的 v1.16 潜伏缺陷）**：`.qs-tile-detail` 自带
  display:flex（author origin 压过 UA 级 `[hidden]{display:none}`），hidden
  属性卡片照常渲染并可拦截点击——v1.16/v1.17 未触发只因后续无点击落在卡域；
  修复 = 补作者级 `[hidden] { display: none !important; }` 规则组
  （detail/edit 卡与双 scrim 四件）；
- 纯函数模块 tile-order.ts（defaultTileOrder/normalizeOrder/moveTile/
  gridIndexForPoint/getQuickRowTiles/orderToDefs）vitest 直测 20 例。

## 7. 动画基建（vendored md3 内核，用户方针「连续打断与并行动画直接复用」）

| 模块（shell-src/src/motion/） | 内容 | 纪律 |
| --- | --- | --- |
| md3/spring.js | 阻尼谐振子解析闭式解 | vendored 零改动 |
| md3/animation-presets.js | TimedValue / 预设 / 倍率 | vendored 零改动 |
| md3/aosp/interpolators.js | AOSP 插值器（EMPHASIZED 等） | vendored 零改动 |
| md3/aosp/interruptible-in-out-animator.js | Launcher3 IIOAnimator 1:1（连续打断内核） | vendored 零改动 + 旁路 .d.ts 镜像 |
| shell/shade-tokens.ts | SPEC v1.0 token 代码化出口（shade 插值 + spring 边界 + QS 锚） | 引用制单一事实源（self: 值禁入） |
| shell/tile-states.ts | 三态磁贴状态机（active/inactive/unavailable） | 壳层自持，不写工程变量 |
| index.ts | 类型化出口 + createFrameDriver（单一 rAF 宿主，租约制启停） | 壳层动画唯一消费面 |

- 宿主只跑一个 rAF 循环：动画器不自建循环，`update(dt)` 由宿主驱动；
  引用计数启停（任一消费者 start() 即运行，全部释放才停）——并行动画
  的宿主面与 md3 同律；
- **app 开/关动画换装路线**：动画攻坚实例把 OPEN_PARAMS/CLOSE_PARAMS 与
  IIOAnimator 接到根入口运行时层时，API 形状即此处形状（零翻译成本）；
- 契约测试：`npm test`（vitest，68 例 = spring 5 + interruptible 5 +
  shade-tokens 15（SPEC token 曲线程序化断言）+ tile-states 8（含 R137
  锁定语义修正 2 例）+ quick-row 6（折叠行/详情纯函数）+ tile-order 20
  （R138）+ qs-header 9（header 双态过渡纯函数，R139））；

## 8. 已知边界与坑

1. **壳层不注册 SW**：根入口 sw.js 的 navigate 分支会把 HTML 响应写进
   `index.html` 缓存键——若 /shell/ 页面也注册同一 SW，/shell/index.html
   会污染根入口的离线回退键。新壳发版（bundle 名随内容变）+ iframe 直载
   根入口，壳层自身无需 SW；lib/assets 缓存由 iframe 内根入口注册的
   SW 覆盖（scope=/，天然生效）。
2. **dev 模式 iframe**：`npm run dev` 的 dev server root=shell-src，
   iframe `../index.html` 需 vite fs.allow（已配置）；若 dev server 对
   上层 HTML 解析异常，dev 时可把 iframe src 临时指向绝对地址
   （如 http://127.0.0.1:8081/index.html 的静态服务）。部署态（Pages）
   无此问题——验证一律以 `npm run build` 产物 + 静态服务为准。
3. **Pages 路径**：产物在 `/pixel-xxl/shell/`（shell/ 目录即产物 +
   本文档所在 docs/ 分离）；根入口 URL 不变。
4. **零构建红线**：任何「改壳顺手改根」都是违规——根 index.html 只允许
   尾部追加（v1.03/v1.06 先例），新壳需求一律落在 shell-src/。

## 9. 构建与验证

```bash
cd shell-src
npm install        # vite + typescript + vitest
npm test           # vendored 内核契约测试（10 例）
npx tsc --noEmit   # 类型闸门
npx vite build     # 产物 → ../shell/（Pages 双入口之二）
```

- 新壳探针：`python3 scripts/shell-probe.py`（A 壳层骨架与桥接挂载 /
  B iframe 根入口加载与 vm 就绪 / C 磁贴动作写通道真实生效 /
  D shade 两段 + 三态磁贴 + token 曲线实值 + 锁屏 unavailable 分支（D6）
  + 折叠行同步（D7）+ 长按详情闭环（D8）+ 滚动窗（D9），五通道 VERDICT）；
- L0 回归不变：`python3 scripts/pack-verify.py` 五场景（新壳不改根，
  理论零影响，发版前后各跑一遍留证）；
- 双版像素对比基线（regression-headless.py）只在 L0 路径强制（#23 任务 4）。

## 10. 边界盘点清单（#23 任务 2：静态 UI 搬 DOM/CSS 的可行性盘点）

| UI 面 | 现状载体 | 可否 DOM 化 | 说明 |
| --- | --- | --- | --- |
| 启动屏（绿旗）/加载屏/错误屏 | 根入口 HTML（L0 层） | 已在 DOM 层 | 无需搬——v1.00 起即 HTML 层 |
| #loading-note 四态文案 / #boot-feedback 全屏层 | 根入口 HTML（L0 层） | 已在 DOM 层 | v1.06/v1.08 交付 |
| 控制中心（QS 磁贴） | **工程内未实现**（空壳变量组） | **本轮 DOM 化**（qs-panel POC） | #18 的真实载体；L2 化须逐项 AOSP 考证 |
| 状态栏时钟（状态磁贴版） | 工程内（三针克隆） | 壳层可并行提供（tiles clock） | #19 考证后统一 |
| 桌面/图标/All Apps/Recents/锁屏/开机动画 | Scratch stage（Canvas） | **暂不搬** | 状态全部由工程积木驱动（catalog 变量/广播图），DOM 化须先接管语义并逐项立项（#13/#14/#15/#16/#17/#20） |
| 云母模糊壁纸 | Canvas（qiaoqiaoMica CPU 模糊） | 不搬 | GPU 方案裁决在 #21/#22（unsandboxed 依赖） |
| 音乐播放器等应用 UI | Scratch stage | 暂不搬 | 空壳占位 APP 处置在 #27/#28/#29 |

> 盘点口径：「可搬」= 工程内未实现或纯展示层；「暂不搬」= 工程积木
> 驱动的动态内容——DOM 版本必须先经议题立项裁决接管策略（写变量/
> 广播序列与工程对齐），否则两套并存语义冲突。
