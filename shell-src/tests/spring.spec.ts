/**
 * spring.spec.ts — vendored md3 Spring 内核契约测试
 *
 * 锁定三个语义（md3 v7.92 解析闭式解纪律）：
 *  1. 欠阻尼过冲比 = 理论值 exp(−ζπ/√(1−ζ²))（ζ0.6 → 9.48%）；
 *  2. 帧率无关性：dt=1/240 与 dt=1/60 的轨迹误差极小（闭式解为真解，无累积误差）；
 *  3. 惰性重锚：外部直写 x（手势速度接力通道）在下帧被接住、无跳变。
 */
import { describe, expect, it } from 'vitest';
import { Spring, makeSpringParams } from '../src/motion/md3/spring.js';

/** 从 x0=1 落向 0，返回 (过冲比, 最小 x)；模拟到速度/位移双双收敛 */
function overshootRatio(params: ReturnType<typeof makeSpringParams>, dt: number): number {
  const s = new Spring({ ...params, initialValue: 1, initialVelocity: 0 });
  s.target = 0;
  let minX = 1;
  for (let i = 0; i < 20000; i++) {
    s.update(dt);
    if (s.x < minX) minX = s.x;
    if (Math.abs(s.x - s.target) < 1e-6 && Math.abs(s.v) < 1e-6) break;
  }
  return Math.abs(minX - 0) / 1;
}

describe('md3 Spring（vendored 零改动契约）', () => {
  it('makeSpringParams：response/dampingRatio → 刚度与阻尼（ζ 还原）', () => {
    const p = makeSpringParams(0.4, 0.6, 1);
    const zeta = p.damping / (2 * Math.sqrt(p.stiffness * p.mass));
    expect(zeta).toBeCloseTo(0.6, 10);
    // ω0 = 2π/response
    const w0 = Math.sqrt(p.stiffness / p.mass);
    expect(w0).toBeCloseTo((2 * Math.PI) / 0.4, 10);
  });

  it('欠阻尼过冲比 = 理论值（ζ0.6 → 9.48%）', () => {
    const p = makeSpringParams(0.4, 0.6, 1);
    const theory = Math.exp((-0.6 * Math.PI) / Math.sqrt(1 - 0.36));
    const got = overshootRatio(p, 1 / 240);
    expect(got).toBeGreaterThan(theory - 0.004);
    expect(got).toBeLessThan(theory + 0.004);
    expect(theory).toBeCloseTo(0.0948, 3);
  });

  it('临界阻尼无过冲', () => {
    const p = makeSpringParams(0.4, 1.0, 1);
    const s = new Spring({ ...p, initialValue: 1, initialVelocity: 0 });
    s.target = 0;
    let minX = 1;
    for (let i = 0; i < 20000; i++) {
      s.update(1 / 60);
      if (s.x < minX) minX = s.x;
      if (Math.abs(s.x) < 1e-6 && Math.abs(s.v) < 1e-6) break;
    }
    expect(minX).toBeGreaterThanOrEqual(-1e-6);
  });

  it('帧率无关性：1/240 与 1/60 步进落点一致（闭式解无累积误差）', () => {
    const p = makeSpringParams(0.38, 0.8, 1);
    const fine = overshootRatio(p, 1 / 240);
    const coarse = overshootRatio(p, 1 / 60);
    expect(Math.abs(fine - coarse)).toBeLessThan(1e-3);
  });

  it('惰性重锚：外部直写 x 后下帧无缝接续（速度接力通道）', () => {
    const p = makeSpringParams(0.38, 0.8, 1);
    const s = new Spring({ ...p, initialValue: 0, initialVelocity: 0 });
    s.target = 1;
    s.update(0.05);
    const before = s.x;
    // 外部直写（手势速度接力协议：直接改 x/v，引擎下帧抓到）
    s.x = 0.5;
    s.update(1 / 240);
    // 重锚后首帧从 0.5 出发向 1 移动——无跳回旧轨迹、无爆冲
    expect(s.x).toBeGreaterThan(0.5);
    expect(s.x).toBeLessThan(0.5 + 0.05 + 1e-6);
    expect(Math.abs(s.x - before)).toBeLessThan(0.5); // 无位置突变
  });
});
