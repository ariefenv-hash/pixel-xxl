/**
 * interruptible-in-out-animator.d.ts — vendored JS 的旁路类型声明
 * （vendored 文件本体零改动纪律；TS 对「解构默认参数 + @param JSDoc」的推断
 * 在 checkJs:false 下不完整，故按其头注 JSDoc 逐字镜像成 .d.ts。
 * 镜像来源锚点：interruptible-in-out-animator.js L33-45（cfg JSDoc）与
 * L46-142（类体）。vendored 上游更新时须同步核对本文件。）
 */
export declare const DIRECTION: Readonly<{ IN: 'in'; OUT: 'out' }>;

/** 距离比例缩放下限（ms）——剩余距离趋零时钳最短动画窗。 */
export declare const MIN_SCALED_MS: number;

export interface IIOConfig {
  /** 满程时长（in 方向基准；Launcher3 mOriginalDuration） */
  durationMs?: number;
  /** out 方向满程覆写（开/关不对称时序面），缺省同 durationMs */
  outDurationMs?: number | null;
  /** in 方向插值器（缺省 LINEAR） */
  interpolator?: (t: number) => number;
  /** out 方向插值器覆写，缺省同 interpolator */
  outInterpolator?: ((t: number) => number) | null;
  /** 初始 progress（0=收起态） */
  initialValue?: number;
  /** 边界回调（中途被打断不回调——下一段 in()/out() 重置边界记录） */
  onStop?: (boundary: 'in' | 'out' | null, x: number) => void;
}

export declare class InterruptibleInOutAnimator {
  constructor(cfg?: IIOConfig);
  /** 当前 progress（Launcher3 getAnimatedFraction 同义，0..1 值域） */
  readonly progress: number;
  direction: 'in' | 'out';
  onStop: ((boundary: 'in' | 'out' | null, x: number) => void) | null;
  /** 瞬置 progress（cancel+setCurrentFraction 语义），返回钳位后的值 */
  setProgress(v: number): number;
  /** 向 1（展开/进入）接续播放 */
  in(): this;
  /** 向 0（收起/退出）接续播放 */
  out(): this;
  /** 帧推进（宿主 rAF 调用；dt 秒），返回当前 progress */
  update(dt: number): number;
  /** 冻结在当前值（Launcher3 cancel 语义） */
  cancel(): void;
  /** 在飞否（宿主编排判断用；待播态不算 settled） */
  isSettled(posEps?: number): boolean;
}

/** 具名短别名（Launcher3 类名即本名）。 */
export { InterruptibleInOutAnimator as IIOAnimator };
