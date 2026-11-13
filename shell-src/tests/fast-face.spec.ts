/**
 * fast-face.spec.ts — 快速启动面契约（#23 fast-path Phase 1 · v1.21）
 *
 * 覆盖纯逻辑三层（DOM 装配层由 scripts/shell-probe.py 冒烟）：
 *  1. clockFace：24h 制两位补零 / 中文日期 / 跨日与单位数边界；
 *  2. isFastFaceEnabled：默认开 / ?fast=0 关 / 其它参数不干扰 / 大小写敏感豁免不引入；
 *  3. nextPhase 状态机：合法迁移 / dismiss 幂等锚 / 非法迁移拒绝（fail loud 语义）。
 */
import { describe, expect, it } from 'vitest';
import { clockFace, isFastFaceEnabled, nextPhase, FAST_FACE_FADE_MS } from '../src/shell/fast-face';

describe('clockFace（DOM 时钟面纯函数）', () => {
  it('24h 制两位补零：9:05 → 09:05', () => {
    expect(clockFace(new Date(2026, 10, 13, 9, 5, 3)).hhmm).toBe('09:05');
  });
  it('23:59 与 00:00 跨日边界', () => {
    expect(clockFace(new Date(2026, 10, 13, 23, 59)).hhmm).toBe('23:59');
    expect(clockFace(new Date(2026, 10, 14, 0, 0)).hhmm).toBe('00:00');
  });
  it('日期行中文格式：n月n日 周x', () => {
    // 2026-11-13 是周五
    expect(clockFace(new Date(2026, 10, 13, 8, 0)).date).toBe('11月13日 周五');
  });
  it('周一/周日锚点（周序表头尾）', () => {
    expect(clockFace(new Date(2026, 10, 9)).date).toBe('11月9日 周一');
    expect(clockFace(new Date(2026, 10, 15)).date).toBe('11月15日 周日');
  });
});

describe('isFastFaceEnabled（?fast=0 关断通道）', () => {
  it('空 search 默认启用', () => {
    expect(isFastFaceEnabled('')).toBe(true);
  });
  it('?fast=0 关断（fast-path 回退对照通道）', () => {
    expect(isFastFaceEnabled('?fast=0')).toBe(false);
  });
  it('?fast=0 与其它参数共存时仍关断', () => {
    expect(isFastFaceEnabled('?nofb=1&fast=0')).toBe(false);
    expect(isFastFaceEnabled('?fast=0&nofb=1')).toBe(false);
  });
  it('?fast=1 / 其它参数不影响默认启用', () => {
    expect(isFastFaceEnabled('?fast=1')).toBe(true);
    expect(isFastFaceEnabled('?nofb=1')).toBe(true);
  });
  it('?fastfill=0 不误伤（整词匹配，非前缀）', () => {
    expect(isFastFaceEnabled('?fastfill=0')).toBe(true);
  });
});

describe('nextPhase（dismiss 状态机）', () => {
  it('合法链：active → dismiss → dismissed', () => {
    expect(nextPhase('active', 'dismiss')).toBe('dismissing');
    expect(nextPhase('dismissing', 'fade-done')).toBe('dismissed');
  });
  it('dismiss 幂等锚：dismissing 再 dismiss = 原地（重复调用安全）', () => {
    expect(nextPhase('dismissing', 'dismiss')).toBe('dismissing');
  });
  it('dismissed 终态不再迁移', () => {
    expect(nextPhase('dismissed', 'dismiss')).toBe('dismissed');
    expect(nextPhase('dismissed', 'fade-done')).toBe('dismissed');
  });
  it('非法迁移 fail loud：active 直跳 fade-done = null（调用方不得静默吞）', () => {
    expect(nextPhase('active', 'fade-done')).toBeNull();
  });
});

describe('常量契约（探针/文档引用锚）', () => {
  it('淡出时长 480ms = CSS #fast-face transition 时长（SHELL.md §2 引用）', () => {
    expect(FAST_FACE_FADE_MS).toBe(480);
  });
});
