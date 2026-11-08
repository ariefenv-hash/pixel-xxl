# DESIGN-SPEC v1.0-draft 复核审计报告（R134 · 复核实例评审）

- **审计窗**：Job 2933110 · R134 窗 · 2026-11-09 02:00+08:00
- **被审对象**：docs/DESIGN-SPEC.md v1.0-draft（v1.13 / ddb7bab 交付，R133 窗）
- **审计性质**：#6 冻结令评审流程（#8）的复核实例确认环节；#30 读完再动手闸门适用
- **结论先行**：**通过（76/76 断言 PASS）**——转录保真面零缺陷；外部锚点
  （android-17.0.0_r1）在本环境不可达，已定谳并转锚点治理长期跟踪，不阻塞冻结
  （SPEC 自身 §9-3 口径已限定"未回核不声称 1:1"）。

## 1. 审计范围与方法

- **范围**：SPEC 全部 aosp: / md3: 出处行的可验证值。measured:（现状值）与 self:
  （§8 隔离区）不属 AOSP 回核范围；jar: 项维持 md3#18 原 sources jar 实证。
- **方法**：md3@main vendored 语料副本（树快照 22e7ac9）与 SPEC 逐值程序化断言
  （显式子串 / XML 解析 / 结构化解析三通道），脚本化可复现，证据落
  docs/design-spec-audit.json（76 项断言逐条含语料原文证据）。
- **语料文件**（7 件，sha256 见 audit JSON）：
  BackAnimationSpec.kt · BackAnimationSpecForSysUi.kt · BackAnimationConstants.java ·
  ShadeInterpolation.kt · DynamicAnimation.java · integers.xml · monet.js

## 2. 逐节结论

| 节 | 断言数 | 结论 | 要点 |
| --- | --- | --- | --- |
| §2.2 颜色（monet.js） | 45 | **PASS** | 五调色板 chroma（a1=max(seed,48)/a2=16/a3=32@hue+60/n1=4/n2=8）、CAM16 D65 白点 (95.047,100,108.883)、La=200/π、背景 L*=50、tone=CIE L*；角色→tone 表 32/32 全对（语料实含 40 行，SPEC 收录 16×2 子集，多出 8 行为 on-secondary/on-tertiary 族，无冲突） |
| §3.1 返回手势 | 13 | **PASS** | ST1~ST4 margin/minScale（8/8/0.8、8/8/0.8、0/0/0.9、8/8/0.9）、easing 缺省实参（BACK_GESTURE/LINEAR/BACK_GESTURE）、几何公式两行、UPDATE_SYSUI_FLAGS_THRESHOLD=0.20f |
| §3.2 Shade 插值 | 3 | **PASS** | scrim [0→0.5]、content [0.3→1.0]、f′=f×1.2−0.2 + α=1−0.5×(1−cos(π(1−f′)²)) 逐字吻合 |
| §3.3 spring 边界 | 4 | **PASS** | MIN_VISIBLE_CHANGE 族 1f / 1÷10 / 1÷256 / 1÷500 |
| §3.4 + §4 integers | 10 | **PASS** | volume_dialog_gravity=21、dock=250、overscroll-release=0、QS fade 帧 14/58、displacement=0.1066（dimen float）、notif 上限 4/3/3、qs_security_footer_maxLines=2 |
| SPEC 自证 | 1 | **PASS** | SPEC 本地文本含关键期望值字面量抽查 |

## 3. Provenance 链实证（抽样）

- **integers.xml 逐字节测试**：md3 语料副本剥去 4 行 md3 出处头注释后，与
  aosp-mirror/platform_frameworks_base main 分支
  `packages/SystemUI/res/values/integers.xml` **逐字节一致（2392B）**——语料
  "实拉自 aosp-mirror main 2026-11-06"的出处声明获得直接实证。
- 其余 6 件语料为 AOSP 版权头 + 原包路径原件（package 声明与 AOSP 目录约定一致），
  provenance 与 integers.xml 同机制。

## 4. 锚点环境定谳（附注一回核的替代结论）

原续点要求"逐项回核 android-17.0.0_r1 分支差异"。R134 以三通道实测定谳：
**android-17.0.0_r1 在本执行环境不可达**，回核无法按原口径执行：

1. **GitHub 镜像**（aosp-mirror/platform_frameworks_base）：
   - authenticated `matching-refs/tags/android-17` = **空集**；最新版本 tag =
     android-16.0.0_r1 / r2 / r3；
   - main HEAD = 1cdfff555f（提交日期 2025-03-27，repo pushed_at 2025-11-12）；
   - `src/com/android/systemui/animation` 包在 main / r1 / r2 / r3 **均 404**；
     systemui/、statusbar/、keyguard/ 目录均为零子目录扁平化抽样树——该镜像为
     残缺副本，不构成完整 AOSP 对照面；
   - 字符串级代码搜索（ShadeInterpolation / UPDATE_SYSUI_FLAGS_THRESHOLD /
     percent_displacement_at_fade_out）全部 0 命中。
2. **android.googlesource.com**（权威源）：间歇可达——1 次 info/refs HTTP 200 成功
   （HEAD symref → main @ 1cdfff555f，与镜像 main 同 sha）；refs 广告体超大导致
   ls-remote 443 超时（129s）、gitiles JSON 端点空响应，tag 枚举不可达。
3. **推论**：镜像 main 与 googlesource main 同 commit sha ⇒ 两者同树；在该树上
   SystemUI animation 包缺席，语料文件的直接来源树不可复访。

**处置**（已回写 SPEC §10 附注一）：
- aosp: 项口径按 §9-3 持续有效——"经语料副本复核"（本审计 76/76 PASS）；
- android-17 锚点差异风险 + 三条补救路径（镜像补全 / 用户侧 sources jar /
  cs.android.com 人工通道）转**锚点治理议题**长期跟踪；
- 若锚点未来可达且发现差异：按 SPEC 附注一既定纪律"修订本表并披露"。

## 5. 复核实例裁决

1. **评审通过**：#6 验收口径（"文档评审通过后，在交接议题登记设计冻结"）满足；
2. **固化 v1.0**：SPEC 标题与状态行已由本窗改为 v1.0（冻结版），附注一按 §4 更新；
3. **登记设计冻结**：于交接议题 #2 评论留痕（含本报告与 audit JSON 引用）；
4. **用户保留撤销权**：冻结为复核实例口径，用户可随时以评论撤销并回滚本文件；
5. **解锁效应**：token 引用制自冻结起生效——② QS 磁贴 L2 化（R135 候选）验收
   标准必须引用 SPEC token 名。

## 6. 审计局限性披露

- 语料树快照 22e7ac9 与审计时点 md3@main 可能漂移（md3 侧后续提交不在本次范围）；
- monet.js 为 md3 同构实现（非 AOSP 原文件），§2.2 断言的是"SPEC↔md3 语料一致"，
  其与 AOSP ColorScheme.java 的同构正确性维持 R133"逐文件复核"口径 + 附注一锚点跟踪；
- 本环境对 googlesource 的可达性随时间波动，锚点定谳为"当前环境不可达"而非
  "android-17.0.0_r1 不存在"。

---

*审计：Job 2933110 · R134 窗 · 2026-11-09 · 证据 docs/design-spec-audit.json（76 断言，逐条含语料原文证据，可独立复核）*
*语料快照 md3@main 树 22e7ac9 · 断言方法三通道（显式子串 / XML 解析 / 结构化解析）*
