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

## 三、修复路线（按 ROI，待立项）

1. **素材瘦身**：5 张壁纸 SVG（base64 照片壳，3.6~8.9MB/张，30MB+）→ WebP/AVIF，
   57MB → <10MB（需画质口径裁决）。
2. **Service Worker + 缓存头**：328 素材二次访问秒开（Pages 默认 max-age=600 太短）。
3. **启动空窗治理**：取色/模糊降采样上限、blur 级别压缩、或 GPU 液态玻璃方案
   （extensions-extra/qwq1018 v4）替代 CPU 整张糊；进阶为 Worker 化。
4. **启动屏进度反馈**：空窗期把「渲染的进度/渲染数」映射到 HTML 进度条，
   消除"黑屏点不动"体感（改 index.html 壳层，不动 project.json）。

## 四、复现入口

```bash
python3 scripts/mobile-probe.py          # 手机仿真全链路取证（几何/触控/状态）
python3 scripts/mobile-probe3.py         # 空窗解剖（线程/AudioContext/逐2s采样）
python3 scripts/mobile-probe4-desktop-ctrl.py  # 桌面对照（黑屏伪影判定）
```

真机待确认项：浏览器型号（微信内置/X5 内核需单独验证）；
"拉伸"若在真机仍复现，请提供浏览器名与截图。
