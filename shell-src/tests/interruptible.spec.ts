/**
 * interruptible.spec.ts — vendored md3 InterruptibleInOutAnimator（连续打断内核）契约测试
 *
 * 锁定 Launcher3 语义（#103 议题三条件）：
 *  1. 反向触发从当前 progress 接续——out() mid-in() 无位置跳变；
 *  2. 距离分数时长缩放——半程反向的时长 = 满程 × 剩余距离分数；
 *  3. 边界 onStop 单次回调；setProgress 瞬置不触发回调（cancel 语义）。
 */
import { describe, expect, it } from 'vitest';
import { InterruptibleInOutAnimator } from '../src/motion/md3/aosp/interruptible-in-out-animator.js';

/** 推进 n 帧并返回 progress 序列 */
function run(a: InterruptibleInOutAnimator, dt: number, frames: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < frames; i++) out.push(a.update(dt));
  return out;
}

describe('md3 InterruptibleInOutAnimator（vendored 零改动契约）', () => {
  it('in() 全程：线性插值下 progress 单调升至 1，边界回调恰一次', () => {
    let stops = 0;
    const a = new InterruptibleInOutAnimator({ durationMs: 300, onStop: (b) => {
      if (b === 'in') stops++;
    } });
    a.in();
    const seq = run(a, 1 / 60, 40);
    expect(seq[0]!).toBeGreaterThan(0);
    expect(seq[seq.length - 1]!).toBeCloseTo(1, 3);
    expect(stops).toBe(1);
  });

  it('连续打断：in 半程改 out——接续无跳变，方向时长按距离分数缩放', () => {
    const a = new InterruptibleInOutAnimator({ durationMs: 300 });
    a.in();
    run(a, 1 / 60, 9); // ~0.15s → 线性半程 ≈0.5
    const at = a.progress;
    expect(at).toBeGreaterThan(0.4);
    expect(at).toBeLessThan(0.6);
    a.out();
    // 半程反向：满程 300ms × (0.5/1) = 150ms → 0.083s 后应到 ≈0.25
    const p = run(a, 1 / 60, 5); // ~0.083s
    expect(p[p.length - 1]!).toBeGreaterThan(0.15);
    expect(p[p.length - 1]!).toBeLessThan(0.35);
    // 接续性：反向首帧从 at 出发单调下降，不得跳回 0 附近（先 end 再 start 的反例形态）。
    // 单帧位移上界 = dt / scaled = (1/60) / 0.15 ≈ 11.1%（>容差 0.05，故用 0.12 档：
    // r20261108 容差修正——首帧步进口径按当段 scaled 时长折算，内核语义不变）。
    expect(p[0]!).toBeLessThan(at);
    expect(p[0]!).toBeGreaterThan(at - 0.12);
  });

  it('setProgress 瞬置：冻结任意值且不触发边界回调；随后 in() 从该值接续', () => {
    let stops = 0;
    const a = new InterruptibleInOutAnimator({ durationMs: 300, onStop: () => stops++ });
    a.in();
    run(a, 1 / 60, 5);
    const frozen = a.setProgress(0.3);
    expect(frozen).toBeCloseTo(0.3, 6);
    expect(stops).toBe(0);
    a.in();
    const p = run(a, 1 / 60, 3);
    expect(p[0]!).toBeGreaterThanOrEqual(0.3); // 从冻结值出发，不回跳
    expect(stops).toBe(0); // 未到边界
  });

  it('out() 到 0 边界回调恰一次（outDurationMs 独立生效）', () => {
    let stops = 0;
    const a = new InterruptibleInOutAnimator({
      durationMs: 300,
      outDurationMs: 100,
      initialValue: 1,
      onStop: (b) => {
        if (b === 'out') stops++;
      },
    });
    a.out();
    run(a, 1 / 60, 20); // 100ms < 20 帧
    expect(a.progress).toBeCloseTo(0, 3);
    expect(stops).toBe(1);
  });

  it('在飞中重复同向触发：从当前值重新锚定，不重置到起点', () => {
    const a = new InterruptibleInOutAnimator({ durationMs: 300 });
    a.in();
    run(a, 1 / 60, 6); // ~0.1s → ≈0.33
    const at = a.progress;
    a.in(); // 同向重复（连点）
    const p = run(a, 1 / 60, 1);
    expect(p[0]!).toBeGreaterThanOrEqual(at - 1e-6);
  });
});
