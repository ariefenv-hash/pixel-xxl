/**
 * shade-tokens.spec.ts — SPEC token 代码化出口的程序化断言（R136 · #18 L2 首批）
 *
 * 断言值全部对语料原文（R136 窗逐字重核）：
 *   - ShadeInterpolation.kt：interpolateEaseInOut 带 f′≤0→0 短路；scrim [0→0.5]、
 *     content [0.3→1.0] 为输入分数映射区间，返回系数 ∈ [0,1]；
 *   - DynamicAnimation.java：MIN_VISIBLE_CHANGE 1f / 1÷10 / 1÷256 / 1÷500；
 *   - integers.xml：fade 帧 14/58、percent_displacement 0.1066。
 */
import { describe, it, expect } from 'vitest';
import {
  interpolateEaseInOut,
  constrainedMap,
  getNotificationScrimAlpha,
  getShadeContentAlpha,
  SPRING_MIN_VISIBLE_PIXELS,
  SPRING_MIN_VISIBLE_ROTATION,
  SPRING_MIN_VISIBLE_ALPHA,
  SPRING_MIN_VISIBLE_SCALE,
  QS_FADE_OUT_COMPLETE_FRAME,
  QS_FADE_IN_START_FRAME,
  QS_PERCENT_DISPLACEMENT_AT_FADE_OUT,
  FRAME_60FPS_MS,
} from '../src/shell/shade-tokens';

describe('interpolateEaseInOut（motion.shade.ease-in-out.formula）', () => {
  it('f=0 → 0（语料 f′≤0 短路分支：f′=−0.2 ≤ 0）', () => {
    expect(interpolateEaseInOut(0)).toBe(0);
  });

  it('f=1 → 1（f′=1.0 → cos(0)=1 → 1−0.5×0）', () => {
    expect(interpolateEaseInOut(1)).toBeCloseTo(1, 12);
  });

  it('f′≤0 区间（f≤0.1666…）一律 0（短路分支语义）', () => {
    for (const f of [0.05, 0.1, 0.16]) {
      expect(interpolateEaseInOut(f)).toBe(0);
    }
  });

  it('f∈[0.2, 1] 单调递增（shade 展开单调性）', () => {
    let prev = -1;
    for (let f = 0.2; f <= 1.0001; f += 0.01) {
      const v = interpolateEaseInOut(Math.min(f, 1));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('公式逐点抽检：f=0.5 → 1−0.5×(1−cos(π×(1−0.4)²))', () => {
    const fPrime = 0.5 * 1.2 - 0.2; // 0.4
    const expected = 1 - 0.5 * (1 - Math.cos(Math.PI * (1 - fPrime) ** 2));
    expect(interpolateEaseInOut(0.5)).toBeCloseTo(expected, 12);
  });
});

describe('constrainedMap（MathUtils.constrainedMap 同构）', () => {
  it('线性映射', () => {
    expect(constrainedMap(0, 1, 0, 0.5, 0.25)).toBeCloseTo(0.5, 12);
    expect(constrainedMap(0, 1, 0.3, 1, 0.65)).toBeCloseTo(0.5, 12);
  });

  it('双侧 clamp', () => {
    expect(constrainedMap(0, 1, 0, 0.5, -0.3)).toBe(0);
    expect(constrainedMap(0, 1, 0, 0.5, 0.8)).toBe(1);
    expect(constrainedMap(0, 1, 0, 0.5, 2)).toBe(1);
  });

  it('退化区间（inMax===inMin）不除零', () => {
    expect(constrainedMap(0, 1, 0.4, 0.4, 0.3)).toBe(0);
    expect(constrainedMap(0, 1, 0.4, 0.4, 0.5)).toBe(1);
  });
});

describe('scrim/content alpha 曲线（motion.shade.*.map）', () => {
  it('scrim：输入 [0→0.5] 区间，0→0 且 0.5 后封顶 1', () => {
    expect(getNotificationScrimAlpha(0)).toBe(0);
    expect(getNotificationScrimAlpha(0.25)).toBe(interpolateEaseInOut(0.5));
    expect(getNotificationScrimAlpha(0.5)).toBe(1);
    expect(getNotificationScrimAlpha(1)).toBe(1);
  });

  it('scrim 单调（0→0.5 段）', () => {
    let prev = -1;
    for (let p = 0; p <= 0.5001; p += 0.01) {
      const v = getNotificationScrimAlpha(Math.min(p, 0.5));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('content：输入 [0.3→1.0] 区间，<0.3 全透明（两段互斥语义）', () => {
    expect(getShadeContentAlpha(0)).toBe(0);
    expect(getShadeContentAlpha(0.29)).toBe(0);
    expect(getShadeContentAlpha(0.3)).toBe(0);
    expect(getShadeContentAlpha(0.5)).toBe(interpolateEaseInOut((0.5 - 0.3) / 0.7));
    expect(getShadeContentAlpha(1)).toBe(1);
  });

  it('content 单调（0.3→1 段）', () => {
    let prev = -1;
    for (let p = 0.3; p <= 1.0001; p += 0.01) {
      const v = getShadeContentAlpha(Math.min(p, 1));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('spring min-visible 族（motion.spring.min-visible.*）', () => {
  it('四常量逐字吻合 DynamicAnimation.java', () => {
    expect(SPRING_MIN_VISIBLE_PIXELS).toBe(1);
    expect(SPRING_MIN_VISIBLE_ROTATION).toBeCloseTo(0.1, 15);
    expect(SPRING_MIN_VISIBLE_ALPHA).toBeCloseTo(1 / 256, 15);
    expect(SPRING_MIN_VISIBLE_SCALE).toBeCloseTo(1 / 500, 15);
  });
});

describe('QS Header 过渡锚（motion.qs.*）', () => {
  it('帧/位移三常量逐字吻合 integers.xml', () => {
    expect(QS_FADE_OUT_COMPLETE_FRAME).toBe(14);
    expect(QS_FADE_IN_START_FRAME).toBe(58);
    expect(QS_PERCENT_DISPLACEMENT_AT_FADE_OUT).toBeCloseTo(0.1066, 15);
  });

  it('60fps 帧锚换算基准', () => {
    expect(FRAME_60FPS_MS).toBeCloseTo(1000 / 60, 15);
    // 换算示例披露：14 帧 ≈ 233.3ms（60fps 时间轴）
    expect(QS_FADE_OUT_COMPLETE_FRAME * FRAME_60FPS_MS).toBeCloseTo(233.333, 2);
  });
});
