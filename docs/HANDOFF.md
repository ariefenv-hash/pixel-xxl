<!-- docs/HANDOFF.md — 跨轮次交接快照（#18 方向变更公告 6715176456 指定的交接入口；
     新实例读本文件 + git log --oneline -5 即可开窗，不必翻全部评论） -->
<!-- 维护纪律：每轮交付后立即覆写本文件（不是槽末统一写）。 -->

# Pixel XXL · HANDOFF 结构化快照

- **generated**: 2026-11-08 15:5x+08:00（R131 窗收窗覆写 · Job 2933040 第 2 定时消息系列）
- **head**: 本窗交付 v1.08（动画连贯性升级，见下）；合入前 origin/main = 227989c（R130 续点 docs，fetch 对齐 ✓ 零撞号）
- **任务源**: 用户实时指令「继续工作，重点修复打开关闭动画中间不连贯」
- **认领帖**: pixel-xxl#1 comment 6718814556（先于动工；**认领帖内初判「未设 framerate 默认 30fps」系误判，四通道探针当场证伪并修正**——app 原生 setFramerate(120)，ANALYSIS §2 已补正）

## 本窗交付（v1.08 动画连贯性升级）

- **诊断**（scripts/anim-probe.py 逐帧 trace + 积木链路精读）：开/关应用 = cropURL 61 张
  预渲染裁切皮肤逐 tick 换肤（lmsSkins_setSkin）+ 逐 tick 指数逼近运动；app 原生
  `setFramerate(120)` 而 60Hz 屏插值只平滑运动、**换肤不可插值**——约一半皮肤从未上屏，
  中段（裁切 Δ5~6px + 速度峰值）每显示帧合并 4~6 张 ⇒ 「中间不连贯」。
  排除项：素材 fetch（动画窗口 0 次）/ #boot-feedback（收层定时器已清）/ cropURL（全在开机预渲染）。
- **修复**（index.html 尾部追加 v1.08 块，骨架零改动）：缺省自适应实测 rAF 刷新率吸附
  [60/90/120]（120Hz 屏零变化）+ 覆写夺回守卫（FRAMERATE_CHANGED 监听，app 初始化
  120 覆写实测被夺回）+ 弱机看门狗（240 tick 中位 > 1.6× 帧预算一次性降半档 120→60/60→30）
  + 逃生门 `?fps=N` / `?fps=orig`（回归基线通道）。
- **验证**: scripts/fps-probe.py 四通道 PASS 零 pageerror（A 缺省 60→降级 30 /
  B 显式 30 / C orig 原生 120 零触碰 / D 显式 90+夺回+豁免；docs/fps-probe-evidence.json）；
  pack-verify 五场景见 docs/pack-verify.json（本窗复跑）。
- **附带**: sw.js VERSION v1.06→v1.08（v1.07 合流漏滚补上）；README v1.08+v1.07 章节、
  PORTING §12、MOBILE §三5、ANALYSIS §2 补正；诊断探针 scripts/anim-probe.py 一并入库。

## 红线（违反 = 返工）

1. **core/app 逐字节**：`lib/turbowarp-core.js`、`lib/pixel-xxl-app.js` 不许改动；
2. **index.html 骨架**：既有字节零改动，只允许尾部追加（v1.03 SW / v1.06 反馈层 / v1.08 动画块先例）；
3. **素材 md5 寻址**：改素材内容必须同步 project.json 的 md5ext 键（v1.03 先例：等长替换）；
4. **双版对比回归**：改壳层 UI 后跑回归须带 `?nofb=1`（反馈层豁免通道）；
   **v1.08 起再加 `&fps=orig`**（帧率通道豁免，否则 tick 率差异污染对比）；
5. **待裁决项不动**：PNG 长尾 12.7MB / MP3 6.0MB（须用户裁决后再动，PORTING.md §7.3）。

## 候选任务池（按 ROI 排序，动手前在本仓库 issue #1 发认领帖）

1. ⏳ **启动空窗治理**（MOBILE.md §三③）：取色/模糊降采样上限、blur 级别压缩、
   或 qwq1018 v4 液态玻璃替代 CPU 整张糊；进阶 Worker 化；
2. ⏳ **动画连贯性二期**（若用户反馈 60Hz 屏仍有中段跳感）：project.json 块级改造
   （换肤索引非线性映射）——破坏「工程数据 1:1」原则，须用户裁决单独立项；
3. ⏳ **boot-feedback-probe 移动通道补跑**（R130 遗留）；
4. ⏳ 云变量通道收敛 / 存档脏值清理（均须用户裁决，ANALYSIS §8）；
5. ⏳ PNG 长尾 / MP3 瘦身（待用户裁决口径）；
6. ✅ 素材瘦身 / SW / 资产包 / 分片+CDN / 进度反馈 / 动画连贯性（v1.03~v1.08 已落地）。

## 工具速查

- 帧率四通道验证：`python3 scripts/fps-probe.py`（自起 8088 服务，~6 分钟，证据 docs/fps-probe-evidence.json）；
- 动画逐帧诊断：`python3 scripts/anim-probe.py`（8087，逐 tick trace，需过引导页）；
- 冒烟取证：`python3 scripts/boot-feedback-probe.py`（8089，三通道，软渲染全链路约 6 分钟）；
- 合包验证：`python3 scripts/pack-verify.py`（五场景 A/B/C/E）；
- 双版回归：`python3 scripts/regression-headless.py`（8081=本仓 **?nofb=1&fps=orig** + 8082=原版）。

## 已知坑

- headless swiftshader 画面恒黑（软渲染降级伪影，非移植缺陷）——动画诊断勿依赖像素，
  用 runtime 状态 trace（anim-probe.py 口径）；
- **app 的 setFramerate(120) 晚于 window.vm 可见**——任何壳层帧率控制必须装
  FRAMERATE_CHANGED 夺回守卫，否则被静默覆盖（v1.08 四通道探针实证）；
- `_tickCounter` 等内部属性打包 runtime 上不存在；运行信号用 `runtime.threads.length`；
- git push 若 443 超时：REST API blob→tree→commit→ref 四步推送（#18 评论 6715376371，
  scripts/api-push2.py 模式）；API 推送 sha 与本地不同（树一致），恢复后 fetch + reset 对齐；
- 并行实例：动手前先 `git fetch`，远端唯一真相源；认领协调面 = 本仓库 issue #1 评论。

## 下窗续点（R132）

1. 用户真机验收 v1.08（60Hz 设备开/关动画是否顺滑；120Hz 设备应零变化）；
2. 常规续点：候选池按 ROI 认领；R > 30min 加餐、R < 40min 不开新重型（md3 #18 §7.5 精神）。
