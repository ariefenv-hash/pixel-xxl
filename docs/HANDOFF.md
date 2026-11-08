# HANDOFF —— 跨轮次交接文档（供定时任务代理续作）

> 本文件是 pixel-xxl 仓库的上下文交接入口。每轮任务开始时先读本文件与 `docs/analysis-original.md`。

## 项目一句话

把用户的 Scratch 工程「Pixel XXL」（324×720 手机 OS 模拟器，6,162 块积木）原生重写为
多文件 Web 项目，发布在 GitHub Pages。**不是积木块转换**，是按反编译伪代码逐条还原机制的全新实现。

## 关键坐标

- 仓库：`ariefenv-hash/pixel-xxl`（main 分支 = Pages 源，根目录）
- 线上：https://ariefenv-hash.github.io/pixel-xxl/
- 上游参考：`ariefenv-hash/md3`（原分析材料所在；用户已明确：**不再处理 md3 的议题**，工作重心在本仓库）
- 版本约定：沿用 `vX.YZ` 格式 tag（当前 v1.00）

## 架构速记

- 逻辑视口 324×720（Scratch 系坐标 y 向上，换算 cssY = 360 - scratchY），`#screen` transform scale 适配
- `js/store.js` state 全局单例；`js/bus.js` 事件总线（对应原工程 8 个广播）
- 手势仲裁：`js/input.js` handlers Map，**注册顺序 = 优先级**（recents-swipe 先于 back-zone）
- 应用窗口：`window-manager.js` FLIP 变焦 + `curveStyle 0/1` 双曲线 + md3e 返回柄（起手 x>120、预告 x<80、提交 x<140）
- Monet：`monet.js` k-means 基色 → tonal 50~900（极端 ×0.8 饱和）→ CSS 变量；亮度模式 100/500/600/800

## 已知实现注记（勿当 bug 修）

1. 分页阈值判定必须 **else-if**（两阈值分属不同起手页分支，串联会互相抵消）。
2. 后台卡片公式值域 200~290 需 -230 校准才入屏（原 costume 带旋转中心偏移）。
3. 时钟大件 y=200（原 170），避免与首行图标重叠的刻意偏移。
4. 音乐/音效全部 WebAudio 合成 —— 原 MP3 涉版权，**不要**尝试从原工程提取音频入库。
5. 运行态不持久化（只存壁纸/亮度模式/曲线风格）—— 原工程脏存档教训（分析报告 §7.5）。

## 每轮 SOP

1. 读本文件 + `git log --oneline -5` 确认断点
2. `python3 -m http.server` + 无头浏览器冒烟（开机→桌面→开应用→返回）
3. 从下述候选项认领一项，完成后 `node --input-type=module --check` 全量语法检查 + 冒烟
4. **每轮完成立即 push**（防沙箱清空），tag `vX.Y+1`
5. 在本文件追加变更记录

## 候选任务池（按价值排序）

- [ ] AOD 锁屏加通知表盘与小件；锁屏壁纸模糊层级
- [ ] 快捷设置下拉面板（现控制中心瓷砖在「通知」应用内，可升级为顶部下拉 shade）
- [ ] 相册查看器加缩放/滑动切换；照片即壁纸的实时预览
- [ ] music 加播放队列/循环模式；通知媒体样式卡点击跳回播放器
- [ ] 动态图标扩展：music 图标播放时跳动（原工程动态图标语义）
- [ ] 曲线风格 0/1 视觉差异打磨（现 0=逐帧指数、1=CSS emphasized）
- [ ] 双指捏合桌面网格编辑模式（原工程未实现，属合理增强）
- [ ] 性能：壁纸模糊改用 OffscreenCanvas 预渲染 12 级缓存（对应原工程 blurExportPro ×12）
- [ ] i18n：界面文案抽离为 locale 文件

## 变更记录

- v1.00（2026-11-08）：首版。壳层全链路 + 11 应用 + Monet + 合成音频，无头回归通过。
