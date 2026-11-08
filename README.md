# Pixel XXL · 忠实多文件移植版

> 来源：TurboWarp Packager 单文件打包产物 `Pixel.XL.0827.html`（57.4MB，md3 仓库 Release `nnnj`）
> 本仓库 = 该网页的**逐代码、逐资源解包移植**：运行时与原版逐字节一致，
> 工程数据（project.json + 328 个素材文件）1:1 落为真实文件，纯静态、零构建。

**这不是重写，也不是格式转换器，而是"解包"**：把打包器内联的一切还原成它本来的
真实多文件 Web 形态——Scratch 工程本来的存放方式（`project.json` + `assets/<md5>.<ext>`）。

## 与单文件版的关系

| 层 | 单文件打包态 | 本仓库（真实多文件态） | 一致性 |
| --- | --- | --- | --- |
| 页面骨架/CSS/启动屏 | 内联于 HTML | `index.html`（程序化重建，除加载层外逐字节一致） | 逐字节 |
| 运行时 core（VM/渲染器/存储） | 内联 script[2] 1,796,250B | `lib/turbowarp-core.js` | **逐字节** |
| 运行时 app（脚手架配置+扩展装载） | 内联 script[3] 456,746B | `lib/pixel-xxl-app.js` | **逐字节** |
| 工程数据 | 674 个 base85 分块 → zip | `project.json` + `assets/`（328 文件） | **逐字节**（zip CRC 全过） |
| 数据加载层 | base85 解码 + JSZip 内存解包 | `lib/project-loader.js`（fetch 真实文件） | 语义等价重写（唯一重写层） |
| 11 个扩展 | base64/dataURL 内嵌于 script[3] | 随 `lib/pixel-xxl-app.js` 原样装载；解码副本在 `extensions/` | **逐字节** |

## 运行

任意静态服务器即可（素材按 md5 文件名加载，必须走 http，不能 file:// 双击）：

```bash
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080/
# 点击绿旗启动屏 → 174 帧开机动画 → 三页引导 → 桌面
```

键盘：`A` 锁屏 / `D` 解锁 / `←→` 翻页 / `Esc` 返回 / `space` 回桌面；全部手势支持鼠标/触屏。

## v1.03 加载性能版（2026-11-08）

- 素材瘦身：10 张大 SVG（含 5 张壁纸）壳内 base64 照片 → WebP q90 原分辨率重嵌入，
  assets 52.8MB → 22.34MB（-58%）；新旧渲染像素差 mean ≤0.63/255、高阈值差 0.000%；
- Service Worker（`sw.js`）：素材 cache-first（md5 内容寻址=不可变）、壳层 SWR，
  二次访问素材零网络；发版递增 VERSION。
- 详见 `docs/PORTING.md` §7、`docs/MOBILE.md` §三。

## v1.04 资产合并包版（2026-11-08）

- 合并包：328 个素材拼接为单个内容寻址包 `assets/pack-2a59a28a.bin`（22.34MB），
  **首访素材请求 328 → 1**，弱网下每请求排队/握手的延迟大头消除；
- 加载层：模块初始化即并行下载包，流式读取、进度直驱进度条；
  包清单命中切片交付（零拷贝），包不可用/失败自动回退逐文件 fetch（v1.00 语义）；
- 壳层：新增 `#boot-hint` 启动空窗提示条（不拦截点击，画布亮帧或 20s 封顶隐藏）；
- 验证：pack-verify 三场景全绿（docs/pack-verify.json）+ 权威回归双版三检查点一致。
- 详见 `docs/PORTING.md` §8。素材变更后重跑 `python3 scripts/build-pack.py` 再生包。

## v1.05 启动屏进度反馈版（撞号合流重滚 · 2026-11-08）

- 消除"黑屏点不动"：点击绿旗后的编译/软渲染空窗（低端设备实测约 144s）叠加
  启动反馈层（阶段文案 + 已启动秒数 + 进度条 + 低性能设备提示），画面点亮自动收层；
- 纯追加观察层：core/app 逐字节红线不动、app bundle 内部门控计数器不触碰；
- 回归兼容：`?nofb=1` 不安装（双版像素对比回归通道，行为与 v1.03 一致）；
- 详见 `docs/PORTING.md` §9、`docs/MOBILE.md` §三④。

## 交接入口

跨轮次/跨会话交接快照见 **`docs/HANDOFF.md`**（head/基线/候选任务池/续点）。
- 对侧 v1.04 #boot-hint 轻量提示条已被本层超集覆盖合并（对账实录见 PORTING §9 注记）。


## 目录结构

```
├── index.html              # 入口（骨架与原版逐字节一致；v1.03 尾部 SW 注册、v1.05 尾部启动反馈层完整版）
├── project.json            # Scratch 工程 1:1（1,054,272B；v1.03 同步 10 处 md5 键）
├── assets/                 # 素材 1:1（md5 命名；v1.03 起 10 张 SVG 内嵌照片为 WebP 载荷；
│                           #   v1.04 起含合并包 pack-<sha8>.bin，由 scripts/build-pack.py 生成）
├── sw.js                   # Service Worker 缓存层（v1.04）
├── lib/
│   ├── turbowarp-core.js   # 运行时 core（与原版逐字节一致）
│   ├── pixel-xxl-app.js    # 脚手架配置 + 11 扩展装载（与原版逐字节一致）
│   └── project-loader.js   # 真实文件加载层（唯一语义重写层：v1.00 fetch 真实文件 →
│                           #   v1.04 追加合并包切片+逐文件兜底，进度直驱进度条）
├── extensions/             # 11 个扩展解码后的真实源码副本（5 自写 + 6 官方）+ manifest.json
├── extensions-extra/       # qwq1018.js（GPU 液态玻璃 v4，原构建未集成，未启用）
├── _original/README.md     # 原始文件来源与全部 SHA-256 指纹
├── docs/
│   ├── PORTING.md          # 移植映射表（原 HTML 哪一段 → 本仓哪个文件）+ 校验记录 + v1.03 记录
│   ├── ANALYSIS.md         # 详细分析报告（含 §10 架构演进决策）
│   ├── ANDROID-PORTING.md  # md3 借鉴清单与 AOSP 对照
│   ├── MOBILE.md           # 移动端体检报告（15 分钟构成/触控链路/修复路线）
│   ├── HANDOFF.md          # 跨轮次交接快照（head/基线/候选池/续点）
│   ├── slim-verify.json    # v1.03 瘦身保真度与 SW 实测证据
│   ├── pack-verify.json    # 合并包三场景验证证据
│   └── boot-feedback-evidence.json # 启动反馈层冒烟证据（三通道 A/B/C）
└── scripts/                # 本仓库自带的回归/瘦身/合包/冒烟脚本（regression-headless、
                            #   mobile-probe*、slim_assets、slim-verify、build-pack、pack-verify、
                            #   boot-feedback-probe）
```

## 运行时配置（与原版一致，见 lib/pixel-xxl-app.js）

- 舞台 324×720（9:20 手机比例），`preserve-ratio` 缩放
- 云变量：`wss://clouddata.turbowarp.org` / `wss://clouddata.turbowarp.xyz`（项目名 `p4-@Pixel XXL.sb3`）
- Turbo 模式关、插值开启、`editableLists=false`
- 用户名 `player####`（随机数字）、强调色 `#ff4c4c`

## 许可

MIT。原始 Scratch 工程创意归其作者所有；本仓库为其忠实 Web 移植。
