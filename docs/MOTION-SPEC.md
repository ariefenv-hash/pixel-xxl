# 动效规范（v2）

> 这份文档存在的理由：**动效是这次迁移唯一不可替代的资产。**
> 其余部分（图标、卡片、开关）都是空壳，谁都能重画；只有「点图标 → 展开成全屏」和
> 「边缘拖拽 → 预测式返回」这两段连续动画，是原工程真正的手艺，也是移植的全部意义。
> 所以这里每个数值都必须能追到出处，不许有「大概这样」的魔数。

三个来源，优先级从高到低：

1. **AOSP 源码**（`android-14.0.0_r1`，本仓内部副本见 `docs/aosp/`）—— 系统行为；
2. **md3 动画内核**（v1 沿用，`src/motion/vendor/`）—— AOSP 原值常量 + 连续打断协议；
3. **原 Scratch 工程**（`project.json`）—— 用户实际看到并认可的那一版的手感。

---

## 一、开 / 关应用：容器变换（container transform）

### 1.1 它是什么

不是「淡入 + 缩放」，而是**同一个矩形从图标位置长到全屏**：

```
p=0   图标那个正方形（56×56，圆角 = 半径 → 正圆）
p=1   全屏（420×910，圆角 24）
中途  矩形四边各自插值，圆角在屏幕像素域插值后再换回局部像素
```

### 1.2 参数出处

| 参数 | 值 | 出处 |
| --- | --- | --- |
| 打开时长 | **500 ms** | `APP_LAUNCH_DURATION`，QuickstepTransitionManager |
| 关闭时长 | **250 ms** | `CLOSING_TRANSITION_DURATION_MS`，同上 |
| 主时间轴曲线 | **emphasized** | `res/interpolator/emphasized.xml`：`M 0,0 C 0.05,0 0.133333,0.06 0.166666,0.4 C 0.208333,0.82 0.25,1 1,1` |
| X 位移曲线 | **app_open_x**（单独一条） | `res/interpolator/app_open_x.xml`：`M 0,0 C 0.1217,0.0462 0.15,0.4686 0.1667,0.66 C 0.1834,0.8878 0.1667,1 1,1` |
| 背景遮罩上限 | 亮 **0.2** / 暗 **0.8** | `MAX_SCRIM_ALPHA_LIGHT` / `_DARK` |
| 3D 倾斜 | **禁用** | `tiltDisabled: true`（原生无 rotate/skew） |
| 内容 alpha 起点 | **55%** | QuickstepTransitionManager 的 content alpha 后段才起 |

曲线实现是 vendored 的 `src/motion/vendor/aosp/interpolators.js`（逐条 `pathInterpolator`），
时长与预设来自 `vendor/animation-presets.js` 的 `native` 预设 —— **不是我在业务代码里手写的**。

### 1.3 几何公式

窗口始终按全屏尺寸布局，靠 transform 把它投影到目标矩形：

```
Vw(p) = lerp(icon.w, W, m(p))          m(p) 走 emphasized（尺寸）
Vh(p) = lerp(icon.h, H, m(p))
cx(p) = lerp(iconCx, W/2, x(p))        x(p) 走 app_open_x（中心点）
cy(p) = lerp(iconCy, H/2, m(p))
Vx = cx − Vw/2,  Vy = cy − Vh/2
sx = Vw/W, sy = Vh/H                   ← 非等比
r_local = lerp(iconR, winR, m(p)) / sx
```

**为什么插值中心点而不是左上角**：直接插值 `left/top` 时，宽度落后于位置，窗口会
「贴着左边走」、右侧露一大片空白。QSTM 的做法是 scale 与 position 两条独立通道 ——
矩形上对应的写法就是「尺寸一条曲线、中心点一条曲线」。

**为什么用非等比缩放（而不是 QSTM 的等比 + 裁切）**：起点矩形必须精确等于图标那个
正方形，否则你看到的是「从图标位置长出一个竖着的胶囊」，而不是「图标在长大」。
内容在 55% 之后才淡入，那时各向异性 < 6%，文字看不出拉伸 —— 用一点点几何失真换掉了
一整套 clip 动画。

### 1.4 三层叠加

| 层 | 作用 | 衰减 |
| --- | --- | --- |
| `--launch-tint`（`::before`） | 窗口起点用**图标自己的颜色**铺满 | `1 - smoothstep(0.28, 0.62, p)` |
| `.launch-ghost` | 真实图标节点的克隆，随窗口放大 18% | `1 - smoothstep(0.02, 0.42, p)` |

> 组件 / 任务卡的 ghost 走另一套（见 §7）：它逐帧贴住窗口矩形、自带壁纸切片、且 z 在
> 窗口**之上**；图标 ghost 仍是「原地拉长再淡出」并压在窗口之下。
| `--launch-content` | 真实内容（header / body） | `smoothstep(0.55, 1, p)` |

只有 color + ghost 一起走，才读得出「这块颜色就是那个图标」；只做缩放会像「一个小窗口在放大」。

### 1.5 关闭 = 打开的时间反向

不是换一条曲线，而是 `p_close(u) = I(1 − u)`：起点仍是满窗，尾段加速收进图标 ——
这正是 Launcher 的关闭手感（吸入图标）。

> 实现坑（已踩）：把值域设成 1→0 再叠镜像插值器，会在**第一帧**就塌到 0。
> 正确做法是值域保持 0→1，把镜像放进插值器。

### 1.6 代码位置

| 文件 | 职责 |
| --- | --- |
| `src/motion/launch.ts` | 几何 / 三层 / 开合两个播放器 |
| `src/motion/vendor/*` | 弹簧、定时轴、AOSP 曲线、IIO 打断内核（**不手改**） |
| `src/motion/driver.ts` | 唯一 rAF 宿主（引用计数启停） |
| `src/styles/shell.css` | `::before` 色块、ghost、scrim、`--launch-*` 变量 |

---

## 二、预测式返回（predictive back）

### 2.1 系统语义（AOSP）

`packages/SystemUI/src/com/android/systemui/navigationbar/gestural/BackPanelController.kt`
+ `EdgePanelParams.kt` + `res/values/dimens.xml`（android-14.0.0_r1，源码快照见
`docs/aosp/systemui/`；`grep -n navigation_edge docs/aosp/systemui/dimens.xml` 可逐条复核）：

| 参数 | 值 | 资源名 |
| --- | --- | --- |
| 边缘热区宽度 | **105dp**（整块 panel，不是 24px） | `navigation_edge_panel_width` |
| 面板高度 | 268dp | `navigation_edge_panel_height` |
| 激活阈值 | 横向 **16dp** | `navigation_edge_action_drag_threshold` |
| 满进度距离 | `min(屏宽, 412dp)` | `navigation_edge_action_progress_threshold` |
| 指示器中心 | 指尖 y **−64dp**，最低 64dp | `navigation_edge_finger_offset` / `_arrow_min_y` |
| 笔粗 | **4dp** | `navigation_edge_arrow_thickness` |
| 出现阈值 | progress **> 0.165**，斜率 1.05 | `commonArrowDimensAlphaThreshold` / `_Factor` |
| 提交 | 进度 **> 0.14** 或松手速度 **> 700px/s** | AOSP 由 IIO commit 判定；此处取可复现的等效值 |

**指示器不是固定 48×48 的圆。** `EdgePanelParams` 定义了五组 dimens，`BackPanel.setStretch`
在组间插值，`BackPanelController` 再用 `updateArrowState` 切状态：

| 状态 | 宽×高 | 圆角（近边/远边） | 距边 | scale | 箭头 长×总高 |
| --- | --- | --- | --- | --- | --- |
| entry | 0×48 | 6 / 6 | 4 | 0.98 | 8.6 × 5（α0） |
| pre-threshold | 51×46 | 16 / 20 | 4 | 0.98 | 8 × 5.6 |
| active | 48×48 | 24 / 24 | 14 | 1.00 | 6.4 × 7.2 |
| stretch（拖满） | 60×48 | 24 / 24 | 18 | 1.00 | 5.6 × 8 |
| committed | 保留宽度 | 24 / 24 | — | **0.86**、背景 α→0 | 保留 |

实现：`motion/back-indicator.ts`。宽/高/圆角/位移/scale 各跑一条解析弹簧（刚度与阻尼比取
`EdgePanelParams` 的 `createSpring` 原值：active 850/.75、committed 1400/1…），所以状态切换
会**弹一下**，而不是匀速放大。拉伸量走 `PathInterpolator(.19,1.27,.71,.86)` 的近似曲线。

三个状态必须**依次可达**才算复刻对：横向意图成立（≥8px）先给 pre-threshold 的 peek
（51×46、圆角 16/20、距边 4dp），越过 16dp 才收成 48×48 的整圆，再随进度拉长。少了
peek 这一段，小球就是「凭空出现一个圆」，这也是上一版观感差异最大的地方。
逐 6px 采样的实测序列（420×910，u=1.069）：

```
  6px  0×51.3   α0      ← entry（宽 0，只剩一条缝）
 12px 11.2×50.9 α.21    ← peek 态（高 46dp）
 24px 40.0×50.8 α.80    ← 长出来
 36px 53.2×51.2 α1      ← active（48dp 整圆 + 拉伸量）
 72px 57.1×51.3 α1      ← 继续拉长（终点 60dp）
```

### 2.2 拖动时的画面

```
窗口：scale 1 → 0.90（-0.10·p）
      横向让位 ±12% 屏宽·p（朝手势反方向）
      圆角 24 → 34
      压暗 0 → 0.24（::after）
桌面：图标/组件/Dock 由 --back-p 重新显形（不是只露壁纸）
小球：entry(0×48) → peek(51×46) → active(48×48) → stretch(60×48)
      位置 y = 指尖 −64dp；p>0.165 起显形；提交时 scale .86、背景 α→0
```

松手两条路：

- **提交**：小球进入 committed（0.86 收束），窗口 250ms `EMPHASIZED_ACCELERATE` 收进图标后卸载；
- **取消**：弹簧（600 / ζ0.9）把 p 弹回 0，小球回到 pre-threshold 再消失，途中可再次按下。

### 2.3 触发率为什么从「50 次中 1 次」变成稳定命中

上一版只认距边 **24px** 的 `pointerdown`，且要求 `|dx|>8` 时立刻锁定；真实手指落点常在
30~60px，于是绝大多数起手被丢弃。现在：

1. 热区改为 `min(105dp, 30% 屏宽)`（Pixel 上 ≈112px），按 `navigation_edge_panel_width`；
2. 起手后先进入 ENTRY，横向位移 8px 才锁定；纵向占优则**让位给滚动**（不会误触）；
3. 锁定后 `setPointerCapture`，手指移出面板/窗口也不丢事件；
4. 进度按 412dp 归一，提交只需 14%，短拖（约 70px）即可返回；
5. `.app-window { touch-action: pan-y }` + `overscroll-behavior` 阻止浏览器把横滑当成历史导航。

实测：420×910、鼠标/触摸模拟，10 次 154px 横拖 **10 次提交成功**（此前 1/10 左右）。

### 2.4 与原工程的对应关系

原工程 `应用` 角色的 `后台运动` 过程给的是一套**卡片栈**参数（多层窗口错位叠放）：

```
宽 = 200 + 90·e^(−0.1·(i−1))        i = 该 app 在后台列表里的层号
x  = −80 + 90·e^(−0.81·(i−1))
亮度 = clamp(x/5 − 10, −50, 0)
尺寸% = 宽 / 515 × 100
```

即：越深的窗口越窄、越靠左、越暗 —— 这是「多任务栈」的视觉。v2 单窗口场景下，
这组公式退化成 `scale → 0.92 / 位移 / 压暗`，与 AOSP 的单窗口预测式返回同构；
多窗口栈要等 Recents 真做出来再启用（参数已在此留档，别丢）。

---

## 三、连续打断（为什么敢边拖边改主意）

内核里有两套引擎，共同点是**都能中途改道**：

- `Spring`（`vendor/spring.js`）：阻尼谐振子**解析闭式解**，任意 dt 都是真解，掉帧不发散；
  目标改道 / 参数重配 / 外部直写 x·v 都会惰性重锚（手势速度接力）。
- `TimedValue`（`vendor/animation-presets.js`）：定时轴 + AOSP 打断协议 ——
  在飞时改目标，起点取当前值、剩余时长按已播比例折算；进度 > 95% 直接收尾
  （`ANIMATION_COMPLETE_THRESHOLD`，消灭尾巴拖帧）。

预测式返回的「取消」用弹簧（要有回弹的物理感），开合窗用定时轴（要精确 500/250ms），
两者共用同一个 rAF 宿主（`driver.ts`），不各建循环。

---

## 四、验收方法（可复现，不接受「看着还行」）

```bash
npm run build && npm run gate        # 预算：可交互 <1000ms / FCP <1500ms / 首传 <200KB
```

逐帧检视（慢放只拉伸时间轴，不改曲线）：

```js
window.__launchSpeed = 0.1   // 500ms → 5000ms
```

实测（Chromium 420×910，**CPU 4× 节流**）：

| 项 | 结果 |
| --- | --- |
| 开窗期间帧间隔 | 恒定 17 ms（60fps），>25ms 的帧 **0** |
| 10 次开/关 + 一次预测式拖拽 | 长任务 **0** |
| 动效内核体积 | **+5.35 KB gzip**（10.70 → 16.05） |
| 首屏可交互 | 418 ms（预算 1000） |

> 为什么不用 `transform` 之外的东西做形变：`border-radius` 逐帧写确实触发重绘，
> 但实测 4× 节流下仍是满帧 —— 因为被重绘的只有一个元素且面积递减。
> 如果哪天掉帧，退路是「圆角只在 3 个档位跳变 + ghost 遮住」，已写在注释里。

---

## 五、上滑 / 上滑长按：前台 → 后台

原工程反编译（`应用` 角色的打开循环之后）：

```
按住向上滑   → 填充图标长 → 340、宽随 mouseY 收缩、窗口跟随手指
停在判定带   → 后台，手势判断 每帧 +1，累计 30 帧（≈0.5s）→ 后台手势结果 = 1
松手         → 结果为 1 进后台；否则回桌面
```

本壳实现（`motion/handoff.ts`）：

| 阶段 | 行为 |
| --- | --- |
| 起手 | 屏幕最底部 **72px**、避开左右 36px（让给返回手势） |
| 拖动 | `k = -dy / (42% 屏高)`；窗口 `scale 1→0.74`、上移 2%、圆角 24→34、轻微淡出 |
| 长按 | 进入 12% 进度后计时 **320ms** → 锁定 recents（原工程 30 帧，60fps ≈ 500ms，取更跟手的 320） |
| 松手 | `k>0.34` 或已长按 → 收起成卡片；`k>0.16` → 送下屏幕回桌面；否则弹簧回全屏 |

进入后台不是「截图再淡入」：`shell/apps.ts` 保留**同一个窗口实例**，用
`motion/window-morph.ts` 从当前手势中的矩形连续吸到第一张卡（320ms emphasized），
再 140ms 交叉淡出到卡片。点卡片则反向拉回全屏（336ms，`RECENTS_LAUNCH_DURATION`）。

> **原工程移动端 bug 的根因（已修）**：点卡片走的是 `后台触控计算()`（反编译
> `应用` 角色 DEFINE 后台触控计算）——它拿 `8,2W7...` 触摸表与 `后台列表` 逐个比
> 图层序，只要手指落点不在「恰好是当前卡」的那一层，就把 `结果记录` 置 0 并
> `stop this script`，后面整段 `if 结果=1` 的恢复分支不会执行。移动端卡片间距小、
> 手指有半径，命中率因此很低。本壳改为卡片自身承担点击，且恢复复用已挂载窗口，
> 不再经过图层判定。
>
> 空白退出同理：原工程 `后台` 状态里没有空白区 handler（`触控` 角色只处理上滑手势），
> 退出只能点卡片或返回键；现在整个 `#recents` 背景可点，退出到桌面。

---

## 六、All Apps 抽屉

原工程 `All Apps` 角色：显示 y `−695 → 0`，跟手阻尼 `/6`，松手阈值 ±50；桌面图标同时
`宽→0.9×、长→0、GHOST→100`。AOSP 对应 `AllAppsTransitionController`（拖动进度 1=关、
0=开；弹簧 600/0.9；内容 alpha 217ms、scale 350ms）。

本壳（`shell/drawer.ts`）用一个 `p` 同时驱动：

```
面板      translateY((1−p)·屏高)
背景      opacity p；backdrop-filter blur(30px)（低端机降级实色）
桌面      opacity 1−p、上移 18px·p、scale 1−0.05p
抽屉图标  opacity clamp((p − i·0.018)·8)；translateY 26px·(1−p)   ← 错峰 18ms
```

松手用弹簧 600/0.9（`AllAppsTransitionController` 原值），可中途反向。

---

## 七、小组件（时钟）

AOSP `QuickstepTransitionManager.getOpeningWindowAnimatorsForWidget`
（commit d159e611，已取证）：

| 属性 | 区间 | 说明 |
| --- | --- | --- |
| 总时长 | 500ms | `APP_LAUNCH_DURATION` |
| 组件前景 α | 1→0，前 **62.5ms** | `WIDGET_CROSSFADE_DURATION_MILLIS/2` |
| 窗口预览 α | 0→1，**62.5→125ms** | 同上 |
| 圆角 | `max(w,h)/2` → 24 | 起点是组件自身的胶囊圆角 |
| 窗口/背景 bounds | 组件中心/尺寸 → 全屏 | `mDx/mDy/mWidth/mHeight` |

本壳按同一条**合成顺序**复刻，而不是「淡入淡出」：

```
窗口（opaque，第一帧就是 app 自己的底色与内容）
  └ 组件快照（z 更高，逐帧贴住窗口矩形，α 1→0 收尾 62.5ms）
```

三个关键点，少一个就会露出破绽（上一版的两种破绽都踩过）：

1. **快照必须自带壁纸像素**。组件是「玻璃压在壁纸上」，`backdrop-filter` 若取到的是
   下方不透明的 app 窗口，整块会变成灰色板。QSTM 放大的是含壁纸的位图；这里用**壁纸
   切片**替代：把 `.wallpaper` 按屏幕尺寸克隆进快照、负偏移对齐到组件位置、`overflow:
   hidden` + 同半径裁剪，于是放大时壁纸跟着一起放大（与位图放大同构，也正好复刻
   「组件连背景一起长」的观感）。
2. **快照逐帧贴住窗口矩形**（`translate3d(vx−rect.x, vy−rect.y) scale(vw/rect.w, vh/rect.h)`，
   `transform-origin: 0 0`）。图标那套「原地轻微拉伸」用在组件上会变成「小卡片浮在深色
   大窗里」。圆角按屏幕像素反算（`rScreen/scale`），放大途中视觉圆角与窗口一致。
3. **窗口从不半透明**。若让窗口底色从 0 拉起「透出下面的克隆体」，中途就会看到桌面图标
   浮在窗口内部（浑浊帧）。窗口 opaque + 快照在上面渐隐，才是原版那种「组件溶解成 app」。

关闭是同一时间轴的逆向（250ms）：快照用更长的 0.55 进度区间渐显，收尾不跳；窗口缩到
组件矩形时快照正好 α=1 且与真实组件对齐，交接无跳变。

---

## 八、图标 / Dock / 遮罩联动

- **图标按压**：`scale(.9)` + `brightness(.94)` + 中心径向高光（180/260ms emphasized）。
  对应 Launcher3 的 icon press 反馈；不再是「整个按钮连标签一起缩」。
- **图标形变**：开窗时克隆体 `scaleX 1→1.12 / scaleY 1→1.28`，先纵向拉长再淡出，
  对应原工程 `多层图标()` 的 9-slice 拉伸（图标是被拉长，不是整块放大）。
- **Dock**：随 `--launch-icons` 从 1→0 退出（0~34% 开窗进度），关闭时反向回归。
  QSTM 把 hotseat 并入 workspace 内容动画、一起缩放/淡出，本壳同构。
- **遮罩**：`launch-scrim` 按 `MAX_SCRIM_ALPHA_LIGHT .2 / DARK .8` 随进度压暗桌面。

---

## 九、明确没做的（以及为什么）

1. **3D 倾斜 / 透视漏斗**：原生 preset 明确 `tiltDisabled`，不做「果冻」；
2. **多窗口卡片栈**：单窗口「同一个 DOM 收成卡片」已做；多窗口叠放仍按 §2.4 的公式留档；
3. **返回时内容快照**：Android 会冻结上一帧做缩放，我们直接缩放活 DOM ——
   代价是缩放中的文字会重新栅格化，观感上更「软」，但不占额外内存；
4. **手势导航条**：只画了 AOSP 的 home handle（108×4dp），没有做「上滑到一半松手回弹」以外的三键导航。
