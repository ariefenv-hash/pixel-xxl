# ANDROID-PORTING.md — 安卓移植参考底座（md3 部分借鉴 + AOSP17 对齐）

> 定位：**本仓库（Pixel XXL 忠实移植）的"安卓真实化"参考文档，未动工、不含实现。**
> 依据用户指令：移植工作彻底完成后，将 md3 中安卓移植方面的成果**部分借鉴**搬来，
> 避免重复劳动；**最终依据 AOSP 17 源码与 Android 17 类原生系统**，md3 仅为参考之一。
> ⚠️ 用户明确警告：md3 项目因体量原因已出现较大方向偏离——本文档只借"已考证的值与纪律"，
> 不背书 md3 的方向性决策。

## 1. 从 md3 搬来的成果（部分借鉴清单，注明出处）

### 1.1 移植纪律（md3 issue #18 §2 铁律，直接采纳）

1. **旧项目代码只可参考，一切以 AOSP 源码考证为准**：拉 sources jar 实证，勿凭记忆。
   ——md3 实录案例：v7.90 凭记忆把滑条 endGap 写 6dp，v7.93 拉 material3 1.4.0 sources jar
   实证纠正为 8dp。本仓库任何"安卓真实化"改动照此执行。
2. **源码有提升空间的地方要超越源码**（超越须显式标注，不与"移植"混同）。
3. 版本号 vX.YZ 递增写 commit message 首部；测试全绿 + 无头回归通过才推送
   （本仓库已沿用 v1.00 / v1.01…惯例）。

### 1.2 md3 已考证、可直接引用的值（出处 = md3 issue #18 §7.2/§7.2b）

| 项 | 考证结论 | 状态 |
| --- | --- | --- |
| 滑条 endGap | material3 1.4.0 sources jar 实证 **8dp** | 已实证 |
| 选中态色值 | `preference_highlight_color.xml` → **alpha 0.26 的 primary**（注释注明"非原值"） | 部分实证 |
| 圆角 28dp / 双栏 padding | 已确证，可直接落地 | 已实证 |
| 锁屏字体 | Roboto Flex，**必须完整 Chrome UA** 取可变字体（wght/wdth/opsz 三轴；ROND 为 Google 专有轴，开源字体均无，**不做**） | 已裁决 |
| 音频回退 | Ogg 默认 + 统一回退开关（自动/强制资源/强制合成），失败静默回落合成音 | 用户裁决 |

### 1.3 md3 的 AOSP 参考库（真源路径，供后续考证直接拉取）

`ariefenv-hash/md3@main` 内已入库的 AOSP 实证语料：

- `docs/reference/frameworks-base/SystemUI/animation/`（TransitionAnimator、ShadeInterpolation、back/BackAnimationSpec 等 34 项）
- `docs/reference/frameworks-base/systemui/keyguard*`（KeyguardClockSwitch、keyguard-ripple 三件套）
- `docs/reference/frameworks-base/dynamic-animation/`、`wm-shell/`
- `docs/reference/launcher3/`（allapps / dragndrop / folder / popup / quickstep / touch —— 桌面与抽屉的权威参照）
- `docs/reference/packages-apps-settings/color-and-motion/`（Monet 调色权威）
- `docs/reference/deskclock/`、`systemui-docs/`
- `ios-desktop/js/aosp/`：100+ 个以 AOSP 命名对齐的 JS 模块（monet、edge-effect、expressive-ripple、clock-faces、back-animation、battery-drawable-state……）

**基准锚点：AOSP `android-17.0.0_r1`（Cinnamon Bun）。** 任何值引用前先到以上路径或
cs.android.com 复核 android-17 分支现状，md3 文档仅作索引。

## 2. Pixel XXL 子系统 ↔ AOSP17 真实对应物（对照表，未实现）

| Pixel XXL（Scratch 层） | 现实现 | AOSP17 真实对应物 | 参照源 |
| --- | --- | --- | --- |
| 桌面双页图标栅格 | 克隆 + 魔数坐标 | Launcher3 `workspace`/`CellLayout` | docs/reference/launcher3/ |
| All Apps 抽屉（-695 滑入、阻尼） | 自写 | Launcher3 `allapps/AlphabeticalAppsList`+`SearchRecyclerView` | launcher3/allapps |
| 后台卡片指数布局 | `200+90·e^(…)` 自创公式 | SystemUI `RecentsView`/wm-shell 概览 | wm-shell |
| 底部返回手势（y<-320） | 自写阈值 | SystemUI `back/BackAnimationSpec` + FlingOnBackAnimationCallback | SystemUI/animation/back |
| 锁屏（a/d 键冻结） | 简化态 | KeyguardStateController + keyguard-ripple 解锁涟漪 | systemui/keyguard-ripple |
| Monet 取色 | materialPalettePro（average/median/kmeans 自创混合） | framework `monet/` + settings `color-and-motion/`（权威算法） | packages-apps-settings/color-and-motion |
| 云母模糊 0↔16 级 | qiaoqiaoMica | SystemUI shade blur（BlurUtils/DepthController） | SystemUI |
| 开机动画 174 帧 | 帧序列 | SystemServer 阶段 + SystemUI boot shake / ROM 开机动画 | systemui-docs |
| 控制中心磁贴 | 工程内未见独立实现 | SystemUI QS tiles + tile-bounce 类联动（md3 已超越实现可参考） | md3 ios-desktop |
| 时钟 | 三针克隆实时旋转 | deskclock + KeyguardClockSwitch（大钟变体） | deskclock |

## 3. 类原生基准（用户口径：各路 Android 17 类原生）

- 视觉基准取 **AOSP17 逐值对齐 + 视频实测帧**（md3 历史方法，采纳）；
- 类原生（Pixel 系风格 ROM）只作**交互形态**参照，不作数值真源——
  厂商魔改值一律回到 AOSP 源码或 sources jar 实证后再用；
- 与 md3 的分工：md3（ios-desktop）继续做"SystemUI 1:1 Web 移植"主战场；
  本仓库先保证 Scratch 工程的忠实运行，**不抢跑 UI 重写**。

## 4. 升级红线（承接 ANALYSIS.md §8，重申）

1. 未完成对应 AOSP17 源码考证前，**不得**在本仓库声称任何 UI 为"AOSP 1:1"；
2. 超越项必须显式标注"自创/超越"（如后台卡片指数公式即属自创，AOSP 无此公式）；
3. 一切"真实化"改动以**不破坏 v1.00 忠实移植态**为前提——建议后续以分支/可选层推进，
   main 始终保留与原版逐字节等价的运行路径；
4. md3 的偏离教训（用户警告）：**方向性决策不搬**，只搬"已考证的值 + 纪律 + 语料索引"。

## 5. 后续工作建议顺序（供下轮定时任务接手）

1. `?` 挂起项核对：确认 Pages 线上版与仓库 main 一致（本版发布时已实测 200/字节正确）；
2. 若用户要求"安卓真实化"：先从 §2 对照表选单一子系统立项（建议先 Monet——
   md3 的 color-and-motion 语料最全，且 Pixel XXL 已有 materialPalettePro 可逐值对照）；
3. 每项动工前：拉 sources jar / cs.android.com android-17 实证 → 立项评论 → 实现 → 回归 → vX.YZ 推送。
