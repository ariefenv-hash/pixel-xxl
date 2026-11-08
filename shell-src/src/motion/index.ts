/**
 * motion/index.ts — md3 动画内核的类型化出口 + 共享 rAF 驱动
 *
 * Vendored（零改动内嵌，来源 ariefenv-hash/md3 @ main，相对路径布局原样保留）：
 *   md3/spring.js                          Spring —— 阻尼谐振子解析闭式解
 *   md3/animation-presets.js               TimedValue / 预设 / 倍率（依赖 ./spring.js、./aosp/interpolators.js）
 *   md3/aosp/interpolators.js              AOSP 插值器（EMPHASIZED 等）
 *   md3/aosp/interruptible-in-out-animator.js  Launcher3 InterruptibleInOutAnimator 1:1
 *                                              ——「连续打断」内核（反向从当前 progress
 *                                              接续，不先 end 再 start；距离分数时长缩放）
 *
 * 复用纪律（用户既定方针「md3 的连续打断与并行动画逻辑直接复用」）：
 *   - vendored 文件永不手改；md3 上游更新 = 原样覆盖四个文件（相对导入不变）；
 *   - 本壳所有面板/层动画一律经本出口消费同一实例族，宿主只跑一个 rAF 循环
 *     （md3 同律：动画器不自建循环，update(dt) 由宿主驱动）；
 *   - app 开/关动画（动画攻坚实例的工作面）后续把 OPEN_PARAMS/CLOSE_PARAMS 与
 *     IIOAnimator 换到根入口运行时层时，API 形状即此处形状，零翻译成本。
 */
// @ts-ignore —— vendored JS（md3 CI 同款 @ts-check 件，类型经 allowJs 推断供消费面）
export { Spring, makeSpringParams, OPEN_PARAMS, CLOSE_PARAMS } from './md3/spring.js';
// @ts-ignore —— vendored JS
export { TimedValue } from './md3/animation-presets.js';
// @ts-ignore —— vendored JS
export { InterruptibleInOutAnimator, IIOAnimator, DIRECTION, MIN_SCALED_MS } from './md3/aosp/interruptible-in-out-animator.js';

import type { InterruptibleInOutAnimator as IIO } from './md3/aosp/interruptible-in-out-animator.js';

/** md3 spring.js SpringParams 的 TS 结构类型镜像（vendored @typedef 的本地声明） */
export interface SpringParams {
  /** 质量 m（影响惯性） */
  mass: number;
  /** 刚度 k（越大到位越快） */
  stiffness: number;
  /** 阻尼 c（耗散能量，决定是否回弹） */
  damping: number;
}

export type { IIO as InterruptibleInOutAnimatorLike };

/** 宿主循环句柄（stop 后句柄失效，重复 stop 幂等） */
export interface FrameDriver {
  stop(): void;
}

type Updatable = { update(dt: number): unknown };

/**
 * 单一 rAF 驱动：注册的动画器共享一个循环（md3「不复制驱动面」纪律）。
 * 引用计数启停：任一消费者 start() 即运行，全部释放才停（并行动画的宿主面）；
 * 页面隐藏时 rAF 自动暂停（浏览器行为），无额外节流逻辑。
 */
export function createFrameDriver(): {
  /** 注册动画器（幂等；与 start/stop 解耦，stop 不清注册表） */
  add(a: Updatable): void;
  remove(a: Updatable): void;
  /** 获取运行租约；全部租约释放后循环自停 */
  start(): FrameDriver;
} {
  const set = new Set<Updatable>();
  let handle = 0;
  let last = 0;
  let running = false;
  let leases = 0;

  const tick = (now: number): void => {
    if (!running) return;
    const dt = last > 0 ? Math.min((now - last) / 1000, 0.1) : 0; // 钳 100ms 防后台回来跳帧
    last = now;
    for (const a of set) a.update(dt);
    handle = requestAnimationFrame(tick);
  };

  const run = (): void => {
    if (running || set.size === 0) return;
    running = true;
    last = 0;
    handle = requestAnimationFrame(tick);
  };

  const halt = (): void => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(handle);
  };

  return {
    add(a): void {
      set.add(a);
    },
    remove(a): void {
      set.delete(a);
    },
    start(): FrameDriver {
      leases++;
      run();
      let released = false;
      return {
        stop(): void {
          if (released) return;
          released = true;
          leases = Math.max(0, leases - 1);
          if (leases === 0) halt();
        },
      };
    },
  };
}
