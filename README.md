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

## 目录结构

```
├── index.html              # 入口（骨架与原版逐字节一致）
├── project.json            # Scratch 工程 1:1（1,054,272B）
├── assets/                 # 328 个素材 1:1（175 PNG + 151 SVG + 2 MP3，md5 命名）
├── lib/
│   ├── turbowarp-core.js   # 运行时 core（与原版逐字节一致）
│   ├── pixel-xxl-app.js    # 脚手架配置 + 11 扩展装载（与原版逐字节一致）
│   └── project-loader.js   # 真实文件加载层（唯一语义重写层，替换 base85+zip）
├── extensions/             # 11 个扩展解码后的真实源码副本（5 自写 + 6 官方）+ manifest.json
├── extensions-extra/       # qwq1018.js（GPU 液态玻璃 v4，原构建未集成，未启用）
├── _original/README.md     # 原始文件来源与全部 SHA-256 指纹
├── docs/
│   ├── PORTING.md          # 移植映射表（原 HTML 哪一段 → 本仓哪个文件）+ 校验记录
│   └── ANALYSIS.md         # 详细分析报告（移植完成后撰写）
└── scripts/                # 本仓库自带的回归脚本
```

## 运行时配置（与原版一致，见 lib/pixel-xxl-app.js）

- 舞台 324×720（9:20 手机比例），`preserve-ratio` 缩放
- 云变量：`wss://clouddata.turbowarp.org` / `wss://clouddata.turbowarp.xyz`（项目名 `p4-@Pixel XXL.sb3`）
- Turbo 模式关、插值开启、`editableLists=false`
- 用户名 `player####`（随机数字）、强调色 `#ff4c4c`

## 许可

MIT。原始 Scratch 工程创意归其作者所有；本仓库为其忠实 Web 移植。
