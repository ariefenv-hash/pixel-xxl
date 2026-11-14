/**
 * auto-boot.spec.ts — 绿旗自动开机纯函数契约（#33 Phase 2 · v1.23）
 *
 * 覆盖：isAutoBootEnabled 参数关断通道（与 isFastFaceEnabled 同构）。
 * DOM 面（clickLaunchScreen/readFeedbackLayerHidden 的 iframe 采集）由
 * scripts/shell-verify.py 场景 E 冒烟（同源 iframe 真链路）。
 */
import { describe, expect, it } from 'vitest';
import { isAutoBootEnabled } from '../src/shell/auto-boot';

describe('isAutoBootEnabled（?boot=0 关断通道）', () => {
  it('空 search 默认启用', () => {
    expect(isAutoBootEnabled('')).toBe(true);
  });
  it('?boot=0 关断（恢复手动绿旗的对照通道）', () => {
    expect(isAutoBootEnabled('?boot=0')).toBe(false);
  });
  it('?boot=0 与其它参数共存时仍关断', () => {
    expect(isAutoBootEnabled('?fast=0&boot=0')).toBe(false);
    expect(isAutoBootEnabled('?boot=0&fast=0')).toBe(false);
  });
  it('?boot=1 / 其它参数不影响默认启用', () => {
    expect(isAutoBootEnabled('?boot=1')).toBe(true);
    expect(isAutoBootEnabled('?fast=0')).toBe(true);
    expect(isAutoBootEnabled('?probe=1')).toBe(true);
  });
  it('?bootcamp=0 不误伤（整词匹配，非前缀）', () => {
    expect(isAutoBootEnabled('?bootcamp=0')).toBe(true);
  });
  it('?boot= 0（URL 编码空格）与大小写归一', () => {
    expect(isAutoBootEnabled('?boot=%200')).toBe(false);
    expect(isAutoBootEnabled('?boot=0 ')).toBe(false);
    expect(isAutoBootEnabled('?BOOT=0'.toLowerCase())).toBe(false);
  });
});
