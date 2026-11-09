/**
 * tests/qs-header.spec.ts — header 双态过渡纯函数（L3 Header 过渡轮 · v1.19 · R139）
 *
 * 语料锚点（md3 语料 systemui/volume-dialog/integers.xml 原文，R139 实拉）：
 *   <!-- Values for transition of QS Headers -->
 *   fade_out_complete_frame = 14 / fade_in_start_frame = 58
 *   <!-- Percentage of displacement for items in QQS to guarantee matching with
 *        bottom of clock at fade_out_complete_frame -->
 *   percent_displacement_at_fade_out = 0.1066
 * 标定等式：帧 14 ≡ 位移 0.1066（语料注释直接给出）；帧 58 线性换算 ≈ 0.4416。
 */
import { describe, it, expect } from 'vitest';
import {
  QS_PERCENT_DISPLACEMENT_AT_FADE_OUT,
  QS_FADE_OUT_COMPLETE_FRAME,
  QS_FADE_IN_START_FRAME,
  QS_FRAME_TO_PROGRESS,
  QS_FADE_IN_START_PROGRESS,
  qsFrameToProgress,
} from '../src/shell/shade-tokens';
import { headerOldAlpha, headerNewAlpha } from '../src/shell/qs-panel';

describe('shade-tokens 帧锚标定换算', () => {
  it('标定等式：帧 14 ≡ 位移 0.1066（语料注释原文直接给出）', () => {
    expect(qsFrameToProgress(QS_FADE_OUT_COMPLETE_FRAME)).toBeCloseTo(
      QS_PERCENT_DISPLACEMENT_AT_FADE_OUT,
      12,
    );
  });

  it('帧步长 = 0.1066/14（单标定点线性外推，self: 披露）', () => {
    expect(QS_FRAME_TO_PROGRESS).toBeCloseTo(0.1066 / 14, 15);
  });

  it('帧 58 淡入起点 ≈ 0.4416（58 × 0.1066 / 14）', () => {
    expect(QS_FADE_IN_START_PROGRESS).toBeCloseTo((58 * 0.1066) / 14, 12);
    expect(QS_FADE_IN_START_PROGRESS).toBeCloseTo(0.4416, 4);
  });

  it('帧序天然保证：淡入起点(帧58) > 淡出完成点(帧14=0.1066) —— 空窗存在', () => {
    expect(QS_FADE_IN_START_PROGRESS).toBeGreaterThan(QS_PERCENT_DISPLACEMENT_AT_FADE_OUT);
    expect(QS_FADE_IN_START_FRAME).toBeGreaterThan(QS_FADE_OUT_COMPLETE_FRAME);
  });
});

describe('header 旧态（通知）alpha：线性 [0→0.1066] 淡出，完成点=语料标定点', () => {
  it('边界：p=0 全显 / p=0.1066 完成淡出 / p≥0.1066 保持 0', () => {
    expect(headerOldAlpha(0)).toBe(1);
    expect(headerOldAlpha(QS_PERCENT_DISPLACEMENT_AT_FADE_OUT)).toBe(0);
    expect(headerOldAlpha(0.5)).toBe(0);
    expect(headerOldAlpha(1)).toBe(0);
  });

  it('中点线性：p=0.0533（0.1066/2）→ alpha 0.5', () => {
    expect(headerOldAlpha(0.1066 / 2)).toBeCloseTo(0.5, 12);
  });
});

describe('header 新态（QS）alpha：线性 [0.4416→1] 淡入，完成点=满展开', () => {
  it('边界：起点前全隐 / 起点=0 / p=1 全显 / p>1 clamp', () => {
    expect(headerNewAlpha(0)).toBe(0);
    expect(headerNewAlpha(0.3)).toBe(0);
    expect(headerNewAlpha(QS_FADE_IN_START_PROGRESS)).toBe(0);
    expect(headerNewAlpha(1)).toBe(1);
  });

  it('中点线性：p=(1+0.4416…)/2 → alpha 0.5', () => {
    const mid = (1 + QS_FADE_IN_START_PROGRESS) / 2;
    expect(headerNewAlpha(mid)).toBeCloseTo(0.5, 12);
  });
});

describe('双态互斥（帧锚天然导出：淡出完成帧 14 < 淡入起始帧 58）', () => {
  it('全程扫描 [0,1] 步进 0.001：新旧 alpha 无重叠（空窗期双态皆隐）', () => {
    let sawGap = false;
    for (let p = 0; p <= 1.0000001; p += 0.001) {
      const oldA = headerOldAlpha(p);
      const newA = headerNewAlpha(p);
      expect(Math.min(oldA, newA)).toBe(0);
      if (oldA <= 0 && newA <= 0) sawGap = true;
    }
    expect(sawGap).toBe(true); // [0.1066→0.4416] 空窗实测存在
  });
});
