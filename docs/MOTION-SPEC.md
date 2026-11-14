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
Vx(p) = lerp(icon.x, 0, x(p))          x(p) 走 app_open_x
Vy(p) = lerp(icon.y, 0, m(p))          m(p) 走 emphasized
Vw(p) = lerp(icon.w, W, m(p))
Vh(p) = lerp(icon.h, H, m(p))
sx = Vw/W, sy = Vh/H                   ← 非等比
r_local = lerp(iconR, winR, m(p)) / sx
```

**为什么用非等比缩放（而不是 QSTM 的等比 + 裁切）**：起点矩形必须精确等于图标那个
正方形，否则你看到的是「从图标位置长出一个竖着的胶囊」，而不是「图标在长大」。
内容在 55% 之后才淡入，那时各向异性 < 6%，文字看不出拉伸 —— 用一点点几何失真换掉了
一整套 clip 动画。

### 1.4 三层叠加

| 层 | 作用 | 衰减 |
| --- | --- | --- |
| `--launch-tint`（`::before`） | 窗口起点用**图标自己的颜色**铺满 | `1 - smoothstep(0.28, 0.62, p)` |
| `.launch-ghost` | 真实图标节点的克隆，随窗口放大 18% | `1 - smoothstep(0.02, 0.55, p)` |
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
+ `EdgePanelParams.kt` + `res/values/dimens.xml`（android-14.0.0_r1）：

| 参数 | 值 | 资源名 |
| --- | --- | --- |
| 触发边距 | **24 px**（阈值 16dp 之上留余量） | `navigation_edge_action_drag_threshold` 16dp |
| 满进度拖动距离 | **62% 屏宽** | `navigation_edge_action_progress_threshold` 412dp 的归一化改写 |
| 指示器出现阈值 | **progress > 0.165** | `commonArrowDimensAlphaThreshold = .165f` |
| 出现斜率 | 1.05 | `commonArrowDimensAlphaFactor` |
| 指示器底 | **48×48**，圆角 **24** | `navigation_edge_active_background_width` / `_edge_corners` |
| 指示器距边 | **14** | `navigation_edge_active_margin` |
| 箭身 | **6.4** 长 / 笔粗 **4** | `navigation_edge_active_arrow_length` / `navigation_edge_arrow_thickness` |
| 箭头纵向钳制 | **64** 起 | `navigation_edge_arrow_min_y` |
| 提交阈值 | progress > **0.32** 或速度 > **850 px/s** | `swipeProgressThreshold` 的等价改写 |

### 2.2 拖动时的画面

```
窗口：scale 1 → 0.92（-0.08·p）
      横向让位 ±9% 屏宽·p（朝手势反方向）
      圆角 24 → 34
      压暗 0 → 0.24（::after）
桌面：opacity 0 → 1，scale 0.94 → 1    ← 「上一层」预览
箭头：48×48，随 p 缩放 0.55→1，p>0.165 起显形
```

松手两条路：

- **提交**：窗口用 `EMPHASIZED_ACCELERATE` 在 220 ms 内收进图标，然后卸载；
- **取消**：弹簧（response 0.3 / ζ 0.92）把 p 弹回 0，途中再按下可**从当前 p 接着拖**。

### 2.3 与原工程的对应关系

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

## 五、明确没做的

1. **3D 倾斜 / 透视漏斗**：原生 preset 明确 `tiltDisabled`，不做「果冻」；
2. **多窗口卡片栈**：等 Recents 真做（现在 Recents 还是图标水印卡）；
3. **返回时内容快照**：Android 会冻结上一帧做缩放，我们直接缩放活 DOM ——
   代价是缩放中的文字会重新栅格化，观感上更「软」，但不占额外内存；
4. **手势导航条（pill）**：没有底部手势条，返回只靠边缘拖拽 + 返回键。
