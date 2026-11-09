/**
 * tile-states.spec.ts — 三态磁贴状态机（L2 首批 · #18）
 *
 * 覆盖：active↔inactive 翻转、unavailable（锁屏只读联动）不切换且解锁回落、
 * onToggle 回调、resetTileStates 隔离；R137 语义修正：锁定 → 一律显示
 * unavailable（内部态保留），解锁 → 恢复内部态。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getTileState, toggleTileState, resetTileStates } from '../src/shell/tile-states';
import type { ToggleOpts } from '../src/shell/tile-states';
import type { VMBridge } from '../src/bridge/runtime';

/** VMBridge 测试替身：只实现 getVar 的变量桩（状态机只走只读通道） */
function fakeBridge(vars: Record<string, unknown>): VMBridge {
  return {
    getVar: (name: string) => (name in vars ? vars[name] : null),
    setVar: () => {
      throw new Error('状态机测试禁止写通道');
    },
    broadcast: () => {
      throw new Error('状态机测试禁止广播');
    },
  } as unknown as VMBridge;
}

const plain: ToggleOpts = { initial: 'inactive' };
const lockable: ToggleOpts = { initial: 'inactive', unavailableWhen: (b) => b.getVar('锁屏') === '1' };

describe('toggle 三态状态机', () => {
  beforeEach(() => resetTileStates());

  it('无记录 → 初始态；两次点击 = active↔inactive 翻转', () => {
    expect(getTileState('wifi', plain)).toBe('inactive');
    expect(toggleTileState('wifi', plain)).toBe('active');
    expect(toggleTileState('wifi', plain)).toBe('inactive');
    expect(toggleTileState('wifi', plain)).toBe('active');
  });

  it('unavailable（锁屏「锁屏」=1）→ 点击不切换', () => {
    const bridge = fakeBridge({ 锁屏: '1' });
    expect(getTileState('wifi', lockable, bridge)).toBe('unavailable');
    expect(toggleTileState('wifi', lockable, bridge)).toBe('unavailable');
    // 状态不残留（解锁后从初始态起步）
    expect(getTileState('wifi', lockable, fakeBridge({}))).toBe('inactive');
  });

  it('解锁回落：unavailable → 读到解锁 → inactive', () => {
    const locked = fakeBridge({ 锁屏: '1' });
    expect(getTileState('bluetooth', lockable, locked)).toBe('unavailable');
    // 解锁（同一模块状态表内回落）
    const unlocked = fakeBridge({});
    expect(getTileState('bluetooth', lockable, unlocked)).toBe('inactive');
    expect(toggleTileState('bluetooth', lockable, unlocked)).toBe('active');
  });

  it('onToggle 回调随翻转触发（dark-mode 壳层换肤消费面）', () => {
    const calls: boolean[] = [];
    const opts: ToggleOpts = { initial: 'inactive', onToggle: (a) => calls.push(a) };
    toggleTileState('dark-mode', opts);
    toggleTileState('dark-mode', opts);
    expect(calls).toEqual([true, false]);
  });

  it('unavailable 时不触发 onToggle', () => {
    const calls: boolean[] = [];
    const opts: ToggleOpts = { initial: 'inactive', unavailableWhen: () => true, onToggle: (a) => calls.push(a) };
    // unavailable 判定走只读通道（bridge 桩），须传入才会判定
    expect(toggleTileState('airplane', opts, fakeBridge({}))).toBe('unavailable');
    expect(calls).toEqual([]);
  });

  it('R137 修正：锁定显示 unavailable 且内部态保留，解锁恢复 active', () => {
    const unlocked = fakeBridge({});
    const locked = fakeBridge({ 锁屏: '1' });
    toggleTileState('wifi', lockable, unlocked); // → active
    expect(getTileState('wifi', lockable, locked)).toBe('unavailable'); // 锁定显示（不丢内部态）
    expect(getTileState('wifi', lockable, unlocked)).toBe('active');   // 解锁恢复先前选择
  });

  it('R137 修正：锁定时点击不切换且不写内部态', () => {
    const locked = fakeBridge({ 锁屏: '1' });
    expect(toggleTileState('wifi', lockable, locked)).toBe('unavailable');
    // 解锁后从初始态起步（锁定期间零写入）
    expect(getTileState('wifi', lockable, fakeBridge({}))).toBe('inactive');
  });

  it('resetTileStates 清空壳层自持态（工程 reload 不残留）', () => {
    toggleTileState('flashlight', plain); // → active
    expect(getTileState('flashlight', plain)).toBe('active');
    resetTileStates();
    expect(getTileState('flashlight', plain)).toBe('inactive');
  });
});
