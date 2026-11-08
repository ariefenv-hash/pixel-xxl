# Pixel XXL 设计规范 v1.0（#6 冻结令交付稿 · R134 复核冻结版）

> 定位：本仓库一切"安卓真实化"改动的设计单一真源。冻结后，任何真移植议题的
> 验收标准必须引用本文档的 token 名，不得出现无出处魔数（#6 验收）。
>
> 状态：**v1.0（冻结版）**——纯文档零代码零构建，不引入任何组件库（#6 交付物约束）；
> 经复核实例（R134 窗）逐值审计通过后于交接议题登记"设计冻结"（#2 评论留痕）；
> 冻结后本文件版本号固化，修订走新对照稿。审计证据：docs/DESIGN-SPEC-AUDIT.md +
> docs/design-spec-audit.json（76 项程序化断言全 PASS）；用户保留撤销权。
>
> 出处约定（#7 规则 1）：
> - `aosp:` = AOSP 源码文件（本窗经 md3@main 语料 vendored 副本**逐文件复核**，
>   复核日期 2026-11-08；md3 文档只作索引，不作为值的来源）；
> - `jar:` = 依赖库 sources jar 实证（md3 #18 已考证）；
> - `md3:` = md3 仓库的已考证值/同构实现（AOSP 无源码直读时的索引级出处）；
> - `measured:` = 本仓库文档在案的项目实测值（现状，非目标）；
> - `self:` = 工程自创/超越 AOSP——**隔离分区（§8），不得与 aosp 1:1 项混排**
>   （ANDROID-PORTING §4 红线 2）。
>
> 引用纪律（#7 规则 3）：引用 AOSP 值前先到 md3 语料路径或 cs.android.com 的
> android-17 分支复核。本文档标注的 `aosp:` 值均已完成语料副本逐文件复核；
> **语料副本拉自 aosp-mirror main 分支**（integers.xml 头注释"实拉入库 2026-11-06"
> 实证），与基准锚点 android-17.0.0_r1 的逐值差异回核列为下窗续点（§10 附注）。

## 1. 分级标尺（#11 总纲，组件标注共用）

| 级别 | 含义 | 现状 |
| --- | --- | --- |
| L0 忠实模拟 | Scratch 工程逐字节运行，像素级等价 | 全部现状（红线，main 永久保留） |
| L1 行为等价 | 行为/数值与 AOSP 一致，实现载体不限 | 无 |
| L2 结构重建 | 子系统搬到 DOM/CSS/JS 真实现，运行时仅存数据 | /shell/ 新壳载体已立项（#23），子系统未动 |
| L3 AOSP 1:1 | L2 + 逐值对齐 AOSP17 源码（动效/布局/曲线） | 无（未完成 §7 token 考证前禁止自称） |

## 2. 颜色系统（#9 口径）

### 2.1 现状管线（measured:docs/ANALYSIS.md:60，照实盘点）

壁纸 SVG → materialPalettePro（average/median/kmeans 三算法）→ light/dark 两套
tonal palette → 按 `亮度模式`（实测默认 **500**）选 tone → lmsLooksPlus
`replaceColors` 逐控件重染 → `壁纸编号`（实测默认 **3**）切换时全链重跑。
强调色 `#ff4c4c` 写死在运行时配置（measured:docs/ANALYSIS.md:29）。

### 2.2 目标 tone 映射表（Monet 权威结构）

Monet 五调色板 chroma 常量与 CAM16 观察条件（md3 同构实现，
`md3:ios-desktop/js/aosp/monet.js`——自注同构
`aosp:packages/SystemUI/monet/ColorScheme.java` TONAL_SPOT 风格 + material-color-utils；
**实现前须回 cs.android.com android-17 逐值复核**，本表为索引级出处）：

| token | 值 | 出处 |
| --- | --- | --- |
| `monet.palette.accent1.chroma` | max(seedChroma, 48) | md3:monet.js（ColorScheme.java 同构） |
| `monet.palette.accent2.chroma` | 16 | 同上 |
| `monet.palette.accent3.chroma` | 32 @ hue+60 | 同上 |
| `monet.palette.neutral1.chroma` | 4 | 同上 |
| `monet.palette.neutral2.chroma` | 8 | 同上 |
| `monet.cam16.white-point` | D65 = (95.047, 100, 108.883) | md3:monet.js（material-color-utils 默认） |
| `monet.cam16.adapting-luminance` | 200/π ≈ 63.619 | 同上 |
| `monet.cam16.background-lstar` | 50 | 同上 |
| `monet.tone.definition` | tone = CIE L*（Y=100 尺度） | 同上（Hct.java 语义同构） |

角色→tone 映射（Material 动态色稳定映射，dark/light 两态全量；
`md3:monet.js MD3_TONE_MAP`——同一索引级出处纪律适用）：

| token（dark） | tone | token（light） | tone |
| --- | --- | --- | --- |
| `color.role.dark.primary` | a1·80 | `color.role.light.primary` | a1·40 |
| `color.role.dark.on-primary` | a1·20 | `color.role.light.on-primary` | a1·100 |
| `color.role.dark.primary-container` | a1·30 | `color.role.light.primary-container` | a1·90 |
| `color.role.dark.on-primary-container` | a1·90 | `color.role.light.on-primary-container` | a1·10 |
| `color.role.dark.secondary` | a2·80 | `color.role.light.secondary` | a2·40 |
| `color.role.dark.secondary-container` | a2·30 | `color.role.light.secondary-container` | a2·90 |
| `color.role.dark.tertiary` | a3·80 | `color.role.light.tertiary` | a3·40 |
| `color.role.dark.tertiary-container` | a3·30 | `color.role.light.tertiary-container` | a3·90 |
| `color.role.dark.surface` | n1·06 | `color.role.light.surface` | n1·98 |
| `color.role.dark.surface-container` | n1·12 | `color.role.light.surface-container` | n1·94 |
| `color.role.dark.surface-container-high` | n1·17 | `color.role.light.surface-container-high` | n1·90 |
| `color.role.dark.on-surface` | n1·90 | `color.role.light.on-surface` | n1·10 |
| `color.role.dark.on-surface-variant` | n2·80 | `color.role.light.on-surface-variant` | n2·30 |
| `color.role.dark.outline` | n2·60 | `color.role.light.outline` | n2·50 |
| `color.role.dark.outline-variant` | n1·30 | `color.role.light.outline-variant` | n1·80 |
| `color.role.dark.accent` | a1·80 | `color.role.light.accent` | a1·40 |

### 2.3 亮暗两态与强调色口径（#9 待定义项的裁决建议，评审确认后生效）

1. **tone 选档现状拆解**：工程"全控件一个亮度模式 500"→ 目标改为上表角色化
   tone 映射；`亮度模式` 变量（Scratch 层）保留为用户级明暗入口，映射到
   light/dark 两套角色表（不逐控件插值）。
2. **强调色优先级链**：动态取色成功 → 壁纸派生色（`color.role.*.accent`）；
   取色失败/壁纸缺失 → 回落兜底强调色 `#ff4c4c`（`color.accent.fallback`，
   measured:docs/ANALYSIS.md:29）。`#ff4c4c` 定位 = **兜底色**，不覆盖动态取色。
3. **失效回落链**（参考 md3 音频回退"失败静默回落"裁决风格，
   measured:ANDROID-PORTING §1.2）：
   - 量化失败/空像素 → monet 语义中性灰兜底（tone 折算，`md3:monet.js` solver 出域语义）；
   - 壁纸加载失败 → 上一次成功色板缓存 + `color.accent.fallback`；
   - 全链失败 → light/dark 角色表按默认 tone 值直出（本表 §2.2），静默不阻塞 UI。
4. **云母模糊**：现状 qiaoqiaoMica 0↔16 级（`blur.mica.levels`，
   measured:docs/ANALYSIS.md:61）；真移植目标 = SystemUI BlurUtils/DepthController
   语义对齐（#21，对照稿另立，本表只冻结级数现状）。

## 3. 动效系统（AOSP SystemUI/wm-shell 实证）

### 3.1 返回手势（#16 对标，目标 L3）

出处均为 `aosp:platform_frameworks_base main · packages/SystemUI/src/com/android/
systemui/animation/back/`（经 md3@main docs/reference/.../back/ 语料副本逐文件复核）：

| token | 值 | 出处 |
| --- | --- | --- |
| `motion.back.dismiss-app.margin` | 8dp × 8dp | BackAnimationSpecForSysUi.kt（ST1 dismissAppForSysUi） |
| `motion.back.dismiss-app.min-scale` | 0.8 | 同上 |
| `motion.back.cross-task.margin` | 8dp × 8dp | 同上（ST2 crossTaskForSysUi） |
| `motion.back.cross-task.min-scale` | 0.8 | 同上 |
| `motion.back.inner-area-dismiss.margin` | 0dp × 0dp | 同上（ST3 innerAreaDismissForSysUi） |
| `motion.back.inner-area-dismiss.min-scale` | 0.9 | 同上 |
| `motion.back.floating-surfaces.margin` | 8dp × 8dp | 同上（ST4 floatingSystemSurfacesForSysUi） |
| `motion.back.floating-surfaces.min-scale` | 0.9 | 同上 |
| `motion.back.easing.translate-x` | Interpolators.BACK_GESTURE | BackAnimationSpec.kt（createFloatingSurfaceAnimationSpec 缺省实参） |
| `motion.back.easing.translate-y` | Interpolators.LINEAR | 同上 |
| `motion.back.easing.scale` | Interpolators.BACK_GESTURE | 同上 |
| `motion.back.sysui-flags-threshold` | 0.20 | wm-shell/back/BackAnimationConstants.java（UPDATE_SYSUI_FLAGS_THRESHOLD） |

几何换算公式（同文件，防止实现走样）：maxTranslationX =
(screenW − screenW×minScale)/2 − maxMarginX；scale = 1 − ratioScale×(1−minScale)。

### 3.2 通知面板 / QS 插值（#18 对标，目标 L2→L3）

出处 `aosp:.../SystemUI/animation/ShadeInterpolation.kt`（同上复核纪律）：

| token | 值 | 出处 |
| --- | --- | --- |
| `motion.shade.scrim-alpha.map` | 展开分数 [0→0.5] 区间映射后 ease-in-out | ShadeInterpolation.getNotificationScrimAlpha |
| `motion.shade.content-alpha.map` | 展开分数 [0.3→1.0] 区间映射后 ease-in-out | ShadeInterpolation.getContentAlpha |
| `motion.shade.ease-in-out.formula` | f′=f×1.2−0.2；α=1−0.5×(1−cos(π(1−f′)²)) | ShadeInterpolation.interpolateEaseInOut |

### 3.3 spring 数值边界（framework dynamic-animation）

出处 `aosp:frameworks/base · DynamicAnimation.java`（md3 语料 dynamic-animation/
副本逐文件复核；SpringForce 劲度/阻尼常量语料未入库，**不在本表编造**，
实现时拉 sources jar 补考）：

| token | 值 | 出处 |
| --- | --- | --- |
| `motion.spring.min-visible.pixels` | 1f | DynamicAnimation.MIN_VISIBLE_CHANGE_PIXELS |
| `motion.spring.min-visible.rotation` | 1/10 | 同上（ROTATION_DEGREES） |
| `motion.spring.min-visible.alpha` | 1/256 | 同上（ALPHA） |
| `motion.spring.min-visible.scale` | 1/500 | 同上（SCALE） |

### 3.4 窗口/对话框/锁屏杂项（SystemUI integers.xml 实拉语料）

出处 `aosp:platform_frameworks_base main · packages/SystemUI/res/values/integers.xml`
（md3 实拉入库 2026-11-06 #112，本窗逐文件复核）：

| token | 值 | 出处 |
| --- | --- | --- |
| `motion.volume.dialog-gravity` | 21 = RIGHT\|CENTER_VERTICAL | volume_dialog_gravity（#112 权威证据） |
| `motion.dock.enter-exit` | 250ms | dock_enter_exit_duration |
| `motion.lockscreen.shade-overscroll-release` | 0ms | lockscreen_shade_over_scroll_release_duration |
| `motion.qs.fade-out-complete-frame` | 14 | fade_out_complete_frame（QS Header 过渡） |
| `motion.qs.fade-in-start-frame` | 58 | fade_in_start_frame（同上） |
| `motion.qs.percent-displacement-at-fade-out` | 0.1066 | percent_displacement_at_fade_out |

## 4. 布局与图标

| token | 值 | 出处 |
| --- | --- | --- |
| `notif.status-bar.max-static-icons` | 4（不含溢出点） | integers.xml max_notif_static_icons |
| `notif.lockscreen.max-icons` | 3 | 同上（max_notif_icons_on_lockscreen） |
| `notif.aod.max-icons` | 3 | 同上（max_notif_icons_on_aod） |
| `qs.security-footer.max-lines` | 2 | 同上（qs_security_footer_maxLines） |
| `canvas.stage` | 324×720（9:20，preserve-ratio） | measured:docs/ANALYSIS.md:24 |
| `canvas.letterbox-ratio` | 0.4498 = 324/720 | measured:docs/MOBILE.md:12 |

栅格/图标尺寸（Launcher3 `DeviceProfile`/`CellLayout`）：语料已入库
（`md3:docs/reference/launcher3/`，67 件索引）但具体 px 值随设备配置资源而变，
**本表不预写数值**——#13 对照稿动工时按"三栏表"（#8 流程）逐项实拉
android-17 分支后再入表。此处只冻结：现状桌面双页魔数坐标为 self:自创（§8）。

## 5. 字体

| token | 值 | 出处 |
| --- | --- | --- |
| `type.lockscreen.font` | Roboto Flex 可变字体（完整 Chrome UA 取 wght/wdth/opsz 三轴） | md3:#18 已裁决（ANDROID-PORTING §1.2 转录） |
| `type.lockscreen.rond-axis` | **不做**（ROND 为 Google 专有轴，开源字体均无） | 同上 |
| `type.subapp.serif` | Noto Serif SC 300/400/600/700（md3 子应用同款加载契约） | md3:ios-desktop/apps/_shared/md3-tokens.css 头注（结构参考，非 AOSP 值） |

## 6. 形状与控件细节（md3 已考证转录）

| token | 值 | 出处 |
| --- | --- | --- |
| `shape.large-corner` | 28dp | md3:#18§7.2b（已确证可直接落地） |
| `control.slider.end-gap` | 8dp | jar:material3@1.4.0 sources jar（md3#18§7.2；v7.90 凭记忆写 6dp→v7.93 实证纠正的教训案例） |
| `state.selected.highlight-alpha` | primary @ alpha 0.26（**部分实证**：源注释注明"非原值"） | aosp:preference_highlight_color.xml（经 md3#18§7.2 转录） |
| `audio.fallback.strategy` | Ogg 默认 + 统一回退开关（自动/强制资源/强制合成），失败静默回落合成音 | 用户裁决（md3 采纳，ANDROID-PORTING §1.2 转录） |

## 7. 组件形态清单（#6 交付物 2：现状 → AOSP17 对照 → 目标形态）

每节格式：现状（工程实测）→ AOSP17 对照（语料索引/已复核值）→ 目标形态（token + 级别）。
对照稿三栏细表（`现值 | AOSP17 实证值 | 目标值(token)`）按 #8 流程在各子系统议题
动工前逐项补齐——本节是**形态裁决**，不是实现规格。

### 7.1 状态栏
- 现状：Scratch 层绘制的状态栏元素，通知图标数量无上限约束（measured:工程现状）。
- 对照：`notif.status-bar.max-static-icons` = 4（integers.xml，已复核）。
- 目标：L1——静态图标上限 4、溢出点语义；数据仍走 VM（L0 红线不动）。

### 7.2 导航栏
- 现状：三键 sysbar 图标（工程素材）；手势模式未独立实现。
- 对照：语料 `md3:docs/reference/frameworks-base/systemui/navbar-icons/`
  （ic_sysbar_back/home/recent XML 实拉副本）+ 手势返回 = §3.1 BackAnimationSpec 族。
- 目标：L2——返回手势阈值替换 self:`gesture.back.threshold`（y<−320）为
  `motion.back.*` 实证族（#16 对照稿先行）；三键形态保持 L0。

### 7.3 锁屏
- 现状：a/d 键冻结的简化态（measured:ANDROID-PORTING §2）。
- 对照：语料 keyguard-ripple 三件套 + KeyguardClockSwitch（ClockSize SMALL/LARGE、
  ClockSizeSetting DYNAMIC(1)/SMALL(0)，已复核 ClockSize.kt）+ systemui-docs/
  keyguard、bouncer、doze 索引。
- 目标：L2——涟漪解锁 + KeyguardClockSwitch 大钟变体（#17/#19 对照稿先行）；
  字体用 `type.lockscreen.font`。

### 7.4 桌面
- 现状：克隆 + 魔数坐标双页栅格（measured:ANDROID-PORTING §2）。
- 对照：Launcher3 workspace/CellLayout/DeviceProfile（语料 67 件索引，值待 #13 实拉）。
- 目标：L2——栅格参数对照稿后逐值对齐；长按弹层对齐 popup/ 语料。

### 7.5 All Apps 抽屉
- 现状：−695 滑入 + 阻尼（self:`drawer.allapps.slide-in`，§8）。
- 对照：Launcher3 allapps/（AlphabeticalAppsList、AllAppsTransitionController 等索引）。
- 目标：L2→L3——滑入位移/弹簧参数对照稿后替换；搜索行为对齐 SearchRecyclerView。

### 7.6 对话框（音量/生物识别样板）
- 现状：Scratch 层对话框，无 gravity/时长语义。
- 对照：`motion.volume.dialog-gravity` = 21（RIGHT|CENTER_VERTICAL，已复核）；
  VolumeDialogImpl.java、biometric integers 同文件（语料在库）。
- 目标：L2——gravity/时长 token 化；dialog 进出场对齐 DialogTransitionAnimator
  索引（语料在库，值待对照稿）。

### 7.7 控制中心 / QS 磁贴（#18，目标 L2，工程内未见独立实现）
- 现状：无独立实现（工程空白）——shell-src qs-panel 为 L2 POC 载体（measured:#23 交付）。
- 对照：磁贴网格/折叠态/编辑页 + tile-bounce 联动；QS Header 过渡帧
  `motion.qs.fade-*`（已复核）；面板 alpha 用 `motion.shade.*`（已复核）；
  快捷 affordance 语义参照 systemui-docs/quickaffordance.md（语料索引）。
- 目标：L2——首批磁贴（Wi-Fi/蓝牙/手电筒/自动旋转/亮暗切换/飞行模式）开关态可切换
  + 按压反馈；写通道只复用工程既有事件链（VMBridge catalog 对账，#23 协议）；
  md3 ios-desktop QS 实现只作数值参考（ANDROID-PORTING §2 分工裁决）。

### 7.8 通知
- 现状：工程内通知行为简化（无独立 stack）。
- 对照：语料 statusbar/notification/stack 索引（NotificationStackSizeCalculator、
  NotificationRoundnessManager 等）；锁屏/AOD 图标上限 §4。
- 目标：L2——stack 语义对照稿后立项；scrim/content alpha 用 `motion.shade.*`。

## 8. self:自创/超越 隔离区（现状值，不得与 §2~§6 混排）

以下为工程现状实测的**自创参数**（AOSP 无对应公式/魔数）。保留期间显式标注；
对应子系统做真移植时，一律走 #8 对照稿评审后替换，替换前不得声称 AOSP 1:1：

| token | 现状值 | 处置方向 |
| --- | --- | --- |
| `self:recents.card.formula` | 后台卡片布局 200+90·e^(…) 指数公式 | ANDROID-PORTING §4 红线 2 实例；#15 对照稿裁决去留 |
| `self:gesture.back.threshold` | 返回手势 y<−320 | 目标替换为 §3.1 `motion.back.*`（#16） |
| `self:drawer.allapps.slide-in` | 抽屉 −695 滑入 | 目标替换为 Launcher3 allapps 实证（#14） |
| `self:anim.app.fill-easing` | 开/关应用逐 tick 指数逼近（填充宽 += (515−宽)/8 族） | 续点③接 shell-src/src/motion/ vendored 内核后由 presets 表驱动 |
| `self:anim.wallpaper.zoom` | 壁纸 zoom size→90/110 ÷/15 | 同上 |
| `self:anim.app.skin-cycling` | 61 张裁切皮肤逐 tick 换肤（{app}-APP{1..61}，measured:docs/PORTING.md:393） | 机制为工程原创（预渲染换肤）；帧率面已由 v1.10 自适应修复 |

（`self:` 各项的"现状值"本身同时是 measured 事实——出处行已标
`measured:` 对应文档；分区意义在于**目标值不得沿用**，须经对照稿。）

## 9. 裁剪声明（#6 交付物 3：本仓库不引入什么）

1. **不引入**组件库、前端框架、构建链扩张、重型状态管理——零构建零依赖原则
   （shell-src 的 Vite 仅服务 /shell/ 新壳源码，产物为静态件，根入口 L0 不受影响）；
2. **不搬** md3 的方向性决策（ANDROID-PORTING §1 警告 + §3 分工：md3 做
   SystemUI 1:1 Web 移植主战场，本仓只借"已考证的值 + 纪律 + 语料索引"）；
3. **不声称**未复核的 AOSP 1:1（红线：未完成 §10 附注所述 android-17 回核前，
   本表 aosp: 项一律按"经语料副本复核"口径引用）；
4. **不 bulk-copy** md3 语料进本仓（#10 按需引入：引用路径与值，语料留在 md3 仓）；
5. **不改**运行时字节：本规范为纯文档（#6 红线），core/app 逐字节、
   project.json/素材零改动不受影响；
6. 素材新增（QS 磁贴图标等）须同步 project.json md5ext 账目（#18 验收注、红线 3）。

## 10. 评审、冻结与附注

- **评审流程**（#8）：本文档在 #6 议题回帖交付凭证 → 用户/复核实例确认 →
  交接议题登记"设计冻结"；冻结后本文件版本号 v1.0 固化，修订走新对照稿。
- **附注一（语料分支披露 · R134 审计后更新）**：md3 语料 vendored 副本拉自
  aosp-mirror main（integers.xml 头注释"实拉入库 2026-11-06"，R134 实证其与镜像
  main `packages/SystemUI/res/values/integers.xml` 剥头注释后逐字节一致 2392B）。
  本仓基准锚点为 android-17.0.0_r1；**R134 锚点可达性定谳：本环境双通道均不可达**——
  ① GitHub 镜像 aosp-mirror/platform_frameworks_base 无任何 android-17 系 tag
  （authenticated matching-refs 空集，最新 = android-16.0.0_r1/r2/r3），main 冻结于
  2025-03-27（HEAD 1cdfff555f，与 googlesource main 探测 HEAD 同 sha），且 SystemUI
  animation 包不在其抽样树上（src/com/android/systemui/animation main/r1/r2/r3 均 404）；
  ② android.googlesource.com 间歇可达（1 次 info/refs 200 成功），tag 枚举不可达
  （refs 广告体超大 443 超时 / gitiles JSON 空响应）。
  **处置**：aosp: 项口径按 §9-3 持续有效（"经语料副本复核"，本审计 76/76 PASS 覆盖
  §2.2/§3/§4 全部 aosp:·md3: 可验证值）；android-17 锚点差异风险与锚点治理
  （镜像补全 / 用户侧 sources jar / cs.android.com 人工通道）转锚点治理议题长期跟踪，
  有差异即修订本表并披露。
- **附注二（未考证不编造）**：SpringForce 劲度/阻尼、Launcher3 栅格 px、
  QS 磁贴网格尺寸等语料未含或不随分支稳定的值，本表**刻意留空**（§3.3/§4/§7.7），
  待各子系统 #8 对照稿实拉后入表——宁可空缺，不可编造。
- **附注三（本表 token 总数）**：§2~§8 表行合计 **69 项**（程序化点数：非自创
  63 行 + self: 隔离区 6 行；点数口径 = 表首列为 token 名的行，2026-11-08 实测），
  满足 #7 验收 ≥40 项；出处字段 100% 填写（逐行标注或逐表在表头处集中声明，
  §2.2 角色表为后者）；自创项全部隔离于 §8。

---

*生成：Job 2933110 · R133 窗 · 2026-11-08 20:26+08:00 · commit 本窗 v1.13*
*语料复核快照：md3@main docs/reference/（frameworks-base 92 件 / launcher3 67 件 /
deskclock 26 件 / systemui-docs 6 件）· 本窗逐文件精读 14 件*
*R134 复核冻结记录：2026-11-09 · Job 2933110 R134 窗——转录保真审计 76/76 PASS
（§2.2 monet 45 断言 + §3.1 back 13 + §3.2 shade 3 + §3.3 spring 4 + §3.4/§4 integers
10 + SPEC 自证 1），证据 docs/design-spec-audit.json；语料 integers.xml 与镜像 main
逐字节一致（provenance 链实证）；android-17.0.0_r1 锚点不可达定谳入附注一。
复核实例口径依 #6 验收（"文档评审通过后，在交接议题登记设计冻结"）执行。*
