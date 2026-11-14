/**
 * index.ts — 动画内核的单一出口
 *
 * vendor/ 下四个文件来自 md3 内核（`ariefenv-hash/md3`，与 v1 壳同源），**原样内嵌、
 * 不手改**：上游更新 = 覆盖文件。它们是「连续打断 + 并行动画」的实现基础：
 *
 *   vendor/spring.js                          阻尼谐振子解析闭式解（非 RK4 近似）
 *   vendor/animation-presets.js               动画预设 + 定时轴 TimedValue（AOSP 打断协议）
 *   vendor/aosp/interpolators.js              AOSP 原值曲线（emphasized / app_open_x …）
 *   vendor/aosp/interruptible-in-out-animator.js  Launcher3 IIO 1:1（反向从当前 progress 接续）
 *
 * 关键事实（本壳所有动效参数的出处）：
 *   - APP_LAUNCH_DURATION = 500ms、CLOSING_TRANSITION_DURATION = 250ms
 *     —— QuickstepTransitionManager 原值；
 *   - 主时间轴 emphasized（缩放/圆角/alpha）、X 位移 app_open_x 单独一条曲线；
 *   - 背景遮罩 MAX_SCRIM_ALPHA_LIGHT = 0.2 / MAX_SCRIM_ALPHA_DARK = 0.8。
 */

// @ts-ignore —— vendored JS（逻辑零改动，类型经 allowJs 推断）
export { Spring, makeSpringParams, OPEN_PARAMS, CLOSE_PARAMS } from './vendor/spring.js';
// @ts-ignore
export {
  TimedValue,
  Timed2D,
  ANIM_PRESETS,
  DEFAULT_PRESET_ID,
  APP_LAUNCH_DURATION_MS,
  CLOSING_TRANSITION_DURATION_MS,
  ANIMATION_COMPLETE_THRESHOLD,
  createTransitionRunner,
  getTransitionRunner,
  getAnimPreset,
  isTimedEngineActive,
} from './vendor/animation-presets.js';
// @ts-ignore
export {
  EMPHASIZED,
  EMPHASIZED_PATH,
  APP_OPEN_X,
  APP_OPEN_X_PATH,
  STANDARD,
  STANDARD_DECELERATE,
  EMPHASIZED_DECELERATE,
  EMPHASIZED_ACCELERATE,
  FAST_OUT_SLOW_IN,
  DECELERATE_1_5,
  cubicBezier,
  pathInterpolator,
} from './vendor/aosp/interpolators.js';
// @ts-ignore
export { InterruptibleInOutAnimator, IIOAnimator, DIRECTION } from './vendor/aosp/interruptible-in-out-animator.js';

export { driver, createFrameDriver } from './driver';
export type { FrameDriver, Updatable } from './driver';

/** 与 vendor/animation-presets.js 的 TimedValue 同形（结构性类型，便于本地消费） */
export interface LaunchValue {
  x: number;
  v: number;
  target: number;
  update(dt: number): void;
  isSettled(posEps?: number, velEps?: number): boolean;
}
