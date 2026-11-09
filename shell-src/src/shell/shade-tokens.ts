/**
 * shell/shade-tokens.ts — DESIGN-SPEC v1.0 token 的代码化出口（单一事实源）
 *
 * 引用制纪律（#6 冻结令 · #2 设计冻结登记 6725419755）：
 *   本文件每个常量/函数逐字转录 docs/DESIGN-SPEC.md 对应 token（token 名与出处
 *   行内标注）；SPEC 无对应 token 的壳层自有值一律不进本文件（self: 值登记在
 *   docs/SHELL.md token 账目）。
 *
 * 语料原文重核（R136 窗 · Job 2933110 · md3@main 逐字重核，零漂移）：
 *   - ShadeInterpolation.kt（md3 docs/reference/frameworks-base/SystemUI/animation/）
 *     —— 注意其 interpolateEaseInOut 带 mappedFraction≤0 → 0f 短路分支（f=0 边界
 *     返回 0 而非余弦延拓值）；scrim/content 的区间映射为输入分数侧
 *     （MathUtils.constrainedMap(retMin, retMax, inMin, inMax, fraction)），
 *     返回 alpha 系数 ∈ [0,1]；
 *   - DynamicAnimation.java —— MIN_VISIBLE_CHANGE 四常量 1f / 1÷10 / 1÷256 / 1÷500；
 *   - systemui integers.xml（volume-dialog/integers.xml，2677B 含头注释）
 *     —— fade_out_complete_frame=14 / fade_in_start_frame=58 /
 *     percent_displacement_at_fade_out=0.1066。
 */

/* ---------- §3.2 通知面板 / QS 插值（aosp:ShadeInterpolation.kt） ---------- */

/**
 * motion.shade.ease-in-out.formula（ShadeInterpolation.interpolateEaseInOut）：
 * f′=f×1.2−0.2；f′≤0 → 0；否则 α=1−0.5×(1−cos(π×(1−f′)²))。
 * 语料原文含 ≤0 短路分支（保证输入 0 → 输出 0）。
 */
export function interpolateEaseInOut(fraction: number): number {
  const mapped = fraction * 1.2 - 0.2;
  if (mapped <= 0) return 0;
  const oneMinus = 1 - mapped;
  return 1 - 0.5 * (1 - Math.cos(Math.PI * oneMinus * oneMinus));
}

/**
 * android.util.MathUtils.constrainedMap(retMin, retMax, inMin, inMax, value) 的
 * 纯函数同构：输入区间 [inMin,inMax] 线性映射到 [retMin,retMax]，双侧 clamp。
 * 仅 shade 插值消费，不出 SPEC token 表（framework 工具函数）。
 */
export function constrainedMap(
  retMin: number,
  retMax: number,
  inMin: number,
  inMax: number,
  value: number,
): number {
  if (inMax === inMin) return value <= inMin ? retMin : retMax;
  const t = (value - inMin) / (inMax - inMin);
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return retMin + (retMax - retMin) * clamped;
}

/**
 * motion.shade.scrim-alpha.map（ShadeInterpolation.getNotificationScrimAlpha）：
 * 展开分数输入区间 [0→0.5] 映射到 [0,1] 后 ease-in-out；
 * 返回通知背景 scrim 的 alpha 系数 ∈ [0,1]（1 = 全量暗化）。
 */
export function getNotificationScrimAlpha(shadeExpansion: number): number {
  return interpolateEaseInOut(constrainedMap(0, 1, 0, 0.5, shadeExpansion));
}

/**
 * motion.shade.content-alpha.map（ShadeInterpolation.getContentAlpha）：
 * 展开分数输入区间 [0.3→1.0] 映射到 [0,1] 后 ease-in-out；
 * 返回 shade 内容的 alpha 系数 ∈ [0,1]（<0.3 全透明 —— QS 段在通知段期间不可见）。
 */
export function getShadeContentAlpha(shadeExpansion: number): number {
  return interpolateEaseInOut(constrainedMap(0, 1, 0.3, 1, shadeExpansion));
}

/* ---------- §3.3 spring 数值边界（aosp:DynamicAnimation.java） ---------- */

/** motion.spring.min-visible.pixels = 1f（DynamicAnimation.MIN_VISIBLE_CHANGE_PIXELS） */
export const SPRING_MIN_VISIBLE_PIXELS = 1;
/** motion.spring.min-visible.rotation = 1/10（MIN_VISIBLE_CHANGE_ROTATION_DEGREES） */
export const SPRING_MIN_VISIBLE_ROTATION = 1 / 10;
/** motion.spring.min-visible.alpha = 1/256（MIN_VISIBLE_CHANGE_ALPHA） */
export const SPRING_MIN_VISIBLE_ALPHA = 1 / 256;
/**
 * motion.spring.min-visible.scale = 1/500（MIN_VISIBLE_CHANGE_SCALE）。
 * tile-bounce 收敛判定消费点：|x−target| < 1/500 即不可见 → 动画结束
 * （DynamicAnimation 的 min visible change 语义：低于该变化量视为静止）。
 */
export const SPRING_MIN_VISIBLE_SCALE = 1 / 500;

/* ---------- §3.4 QS Header 过渡（aosp:SystemUI integers.xml） ---------- */

/** motion.qs.fade-out-complete-frame = 14（60fps 帧锚：旧内容完全淡出帧） */
export const QS_FADE_OUT_COMPLETE_FRAME = 14;
/** motion.qs.fade-in-start-frame = 58（60fps 帧锚：新内容开始淡入帧） */
export const QS_FADE_IN_START_FRAME = 58;
/**
 * motion.qs.percent-displacement-at-fade-out = 0.1066。
 * drag 跟手场景消费点（R139 语义修正）：语料注释原文「Percentage of displacement
 * for items in QQS to guarantee matching with bottom of clock AT fade_out_complete_frame」
 * —— 0.1066 是淡出**完成**时刻（帧 14）的位移标定值，非淡出起点。
 */
export const QS_PERCENT_DISPLACEMENT_AT_FADE_OUT = 0.1066;

/** 60fps 帧锚 → 毫秒换算基准（披露：AOSP RenderThread 帧编号按 60fps 时间轴标注） */
export const FRAME_60FPS_MS = 1000 / 60;

/* ---------- §3.4 帧锚 → 位移轴标定换算（R139 L3 Header 过渡轮 · 语料注释派生） ---------- */

/**
 * 语料标定等式：fade_out_complete_frame(14) ≡ 位移 0.1066
 * （integers.xml 注释原文直接给出该对应关系——时间轴↔位移轴唯一标定点）。
 * 帧步长 = 0.1066 / 14 ≈ 0.007614 位移/帧；帧 0 ≡ 位移 0（时间轴零点 = 展开起点，
 * 「matching at fade_out_complete_frame」保证语义下的最自然读法，self: 披露）。
 * 语料仅此一标定点，帧→位移全程线性外推（self: 披露，docs/SHELL.md §6.1）。
 */
export const QS_FRAME_TO_PROGRESS =
  QS_PERCENT_DISPLACEMENT_AT_FADE_OUT / QS_FADE_OUT_COMPLETE_FRAME;

/** 帧锚 → 位移轴换算（线性标定，见 QS_FRAME_TO_PROGRESS 注释） */
export function qsFrameToProgress(frames: number): number {
  return frames * QS_FRAME_TO_PROGRESS;
}

/**
 * 帧 58（fade_in_start_frame）→ 位移轴淡入起点 ≈ 0.4416
 * （= 58 × 0.1066 / 14，线性外推披露）。
 * 淡入完成点：语料无 fade-in 完成帧 token，不可证 → 取满展开（p=1，几何必要性：
 * 满展开时新 header 必须全量可见），self: 披露。
 */
export const QS_FADE_IN_START_PROGRESS = qsFrameToProgress(QS_FADE_IN_START_FRAME);
