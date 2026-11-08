# MOBILE.md — 移动端体检报告（2026-11-08，v1.02）

> 背景：用户真机反馈"加载 15 分钟 / 显示拉伸 / 触控点不动"。
> 方法：Playwright 手机仿真（390×844、DPR 3、touch、移动 UA）+ 桌面上下文对照，
> 探针脚本 `scripts/mobile-probe*.py`，逐 2s 采样运行时状态/线程/事件计数/截图。

## 一、结论总表

| 疑问 | 实测结论 | 证据 |
| --- | --- | --- |
| 线上是不是移植版？ | **是**（三重验证） | core/asset SHA-256 与本地全等；`project.json` content-length 1,054,272B 全等；Pages 构建时间=v1.01 提交后 40s。此前"大小不符"系弱网下载截断假象 |
| 显示拉伸？ | **仿真下零拉伸** | 画布 380×844，ratio 0.4498（=324/720 信箱适配），visualViewport scale=1，无溢出 |
| 触控失灵？ | **触控链路全通** | tap→touchstart/pointerdown/click 全部送达；启动屏 0.5s 内隐藏；引导页点按 0→1 推进 |
| 为什么"点不动"？ | **启动空窗期主线程被像素处理占满，输入被吞** | 空窗期 14 条绿旗线程全在跑（status=0），`WebGL: GPU stall due to ReadPixels`；空窗结束后引导页点按立即生效 |
| 为什么 15 分钟？ | **56MB 首载 + 启动像素处理空窗 + 门控** | 56MB@弱网约 10~14 分钟；DPR 3 下空窗实测 ~144s（桌面 DPR1 明显更短）；门控 671 计数 ~60s |
| 黑屏是坏了吗？ | **swiftshader 伪影，非项目问题** | 桌面上下文（DPR1+鼠标）同一时序截图同样全黑（非黑像素 0.00%），对应 ANALYSIS §7 已记录的 qiaoqiaoMica 软渲染降级缺陷；启动屏（HTML 层）正常渲染（非黑 95.6%） |

## 二、启动链实测时序（手机仿真，软渲染）

```
点击启动屏 → 绿旗线程立即运行(14条) → [空窗 ~144s：壁纸取色/云母/预渲染，
  大量 GPU→CPU ReadPixels，DPR3 加剧] → 开机动画 → 门控计数 671 (~60s)
→ 引导页(点按推进 0→1→…) → 桌面
```

真机构成 = 上述链路 + 56MB 素材下载（弱网主导）+ 真机 GPU（空窗远短于软渲染，但仍可感）。

## 三、修复路线（按 ROI）

1. ✅ **素材瘦身**（v1.03 已落地，scripts/slim_assets.py）：10 张大 SVG 壳内 base64 照片
   → WebP q90 原分辨率重嵌入；assets 52.8MB → 22.34MB（-58%）；
   保真度实测 mean diff ≤0.63/255、差值>24 像素占比 0.000%（docs/PORTING.md §7.1）。
2. ✅ **Service Worker**（v1.03 已落地，sw.js）：素材 md5 内容寻址 → cache-first；
   壳层 SWR；实测二次访问 246/246 素材零网络（transferSize=0）；
   弱网"第二次打开"从 ~10 分钟级 → 秒开。
   ➕ v1.04 合并包 / **v1.05 分片+CDN**（PORTING §8/§9）：首访素材请求 328 → 2 分片，
   jsDelivr CDN 优先 + 首字节 6s 超时自动切源 + 失败逐文件兜底。
   ➕ **v1.06 持久化双保险 + 双源竞速**（PORTING §10）：修复 v1.05 两处——
   SW fetch handler 跨域放行使「CDN 分片入缓存」永不生效（二访重下 22MB）；
   CDN 慢速流（首字节快、body 极慢）6s 超时防不住。现为：分片完整后写入
   **IndexedDB**（不依赖 SW，iOS Safari 配额逐出/微信内核禁 SW 均可靠）+
   `navigator.storage.persist()`；二访 IDB 命中 ⇒ 分片 0 网络请求（pack-verify B/E
   场景断言）；下载改**双源竞速**（同源/CDN 并行，先完成者胜）；加载屏四态真实文案。
3. ⏳ **启动空窗治理**：取色/模糊降采样上限、blur 级别压缩、或 GPU 液态玻璃方案
   （extensions-extra/qwq1018 v4）替代 CPU 整张糊；进阶为 Worker 化。
4. ✅ **启动屏进度反馈完整版**（v1.06 融合落地，双方双数据源合一）：壳层 #boot-feedback
   全屏反馈层（index.html 尾部纯追加，零红线触碰）——标题/阶段文案 aria-live=polite/
   已启动秒数/进度条/动画点 + >45s 低性能设备提示；**进度数据源双通道**：优先读运行时
   Scratch 变量「渲染的进度/渲染数」（`window.vm` 全局可读——v1.05 对侧修正 v1.02
   "闭包内无全局出口"误判，无需触碰 app 层红线），显示「正在准备桌面素材 N%…」；
   变量不可读时退回运行时阶段推断（vm → targets → runtime.threads）；
   收层五通道 = 像素点亮 / 进度满~4s / 保守放行 / 180s 硬封顶 / #error 立即收层；
   回归豁免 `?nofb=1`。实测三通道 PASS（nofb 豁免/桌面全链路/移动仿真）+
   pack-verify 三场景 PASS，证据 docs/boot-feedback-evidence.json + docs/pack-verify.json；
   方案细节 docs/PORTING.md §10；对侧 #boot-hint 提示条被本层超集覆盖移除（二度撞号合流）。
   v1.08：渲染段文案升级为「正在渲染桌面 N%…（非下载；首次启动需渲染，之后更快）」，
   与首屏进度条的下载/解码段（进度条单调化，见 PORTING §12）明确区分。

## 四、复现入口

```bash
python3 scripts/mobile-probe.py          # 手机仿真全链路取证（几何/触控/状态）
python3 scripts/mobile-probe3.py         # 空窗解剖（线程/AudioContext/逐2s采样）
python3 scripts/mobile-probe4-desktop-ctrl.py  # 桌面对照（黑屏伪影判定）
```

真机待确认项：浏览器型号（微信内置/X5 内核需单独验证）；
"拉伸"若在真机仍复现，请提供浏览器名与截图。
