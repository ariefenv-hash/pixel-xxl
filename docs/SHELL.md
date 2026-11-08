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

## 6. 手势模型边界（qs-panel v1）

- v1 = 顶部拉出条 pointerdown → 面板 1:1 跟手（setProgress 瞬置锚）→
  松手按「位置过半 + 最近方向」投票进/出；
- **速度接力（Spring.setTarget(target, v) 通道）不做**——留给 app 开/关
  动画轮（动画攻坚实例的工作面）；本 POC 边界到此（md3 手势速度合成
  语义未考证前不做）；
- 连续打断语义由 vendored 内核保证：反向触发从当前 progress 接续，
  快速连拉/连推不丢动画（tests/interruptible.spec.ts 契约锁定）。

## 7. 动画基建（vendored md3 内核，用户方针「连续打断与并行动画直接复用」）

| 模块（shell-src/src/motion/） | 内容 | 纪律 |
| --- | --- | --- |
| md3/spring.js | 阻尼谐振子解析闭式解 | vendored 零改动 |
| md3/animation-presets.js | TimedValue / 预设 / 倍率 | vendored 零改动 |
| md3/aosp/interpolators.js | AOSP 插值器（EMPHASIZED 等） | vendored 零改动 |
| md3/aosp/interruptible-in-out-animator.js | Launcher3 IIOAnimator 1:1（连续打断内核） | vendored 零改动 + 旁路 .d.ts 镜像 |
| index.ts | 类型化出口 + createFrameDriver（单一 rAF 宿主，租约制启停） | 壳层动画唯一消费面 |

- 宿主只跑一个 rAF 循环：动画器不自建循环，`update(dt)` 由宿主驱动；
  引用计数启停（任一消费者 start() 即运行，全部释放才停）——并行动画
  的宿主面与 md3 同律；
- **app 开/关动画换装路线**：动画攻坚实例把 OPEN_PARAMS/CLOSE_PARAMS 与
  IIOAnimator 接到根入口运行时层时，API 形状即此处形状（零翻译成本）；
- 契约测试：`npm test`（vitest，spring 5 例 + interruptible 5 例；
  r20261108 修正 interruptible 用例首帧步进容差口径——按当段 scaled
  时长折算单帧位移上界，内核语义不变）。

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

- 新壳探针：`python3 scripts/shell-verify.py`（A 壳层骨架与桥接挂载 /
  B iframe 根入口加载与 vm 就绪 / C 磁贴动作写通道真实生效）；
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
