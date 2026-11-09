/**
 * shell/tile-states.ts — QS 磁贴三态状态机（L2 首批 · #18）
 *
 * AOSP 语义对照（QSTile 同族三态）：active（开启，高亮）/ inactive（关闭）/
 * unavailable（不可用）。工程内无 Wi-Fi/蓝牙等实体服务，磁贴状态由壳层自持
 * （SystemUI 的 QS tiles 本就是 SystemUI 自持状态机——L2 从零补齐口径），
 * **不写任何工程变量**（L0：不新增 project.json 变量，写通道收敛纪律不变）。
 *
 * unavailable 触发面（唯一的工程数据联动，只读）：锁屏锁定（「锁屏」=1，只读
 * bridge.getVar）时，网络/系统设置类磁贴锁定为 unavailable；手电筒/亮暗切换
 * 始终可用（锁屏 shade 手电筒可用惯例）。该映射为壳层模拟语义（self: 登记
 * docs/SHELL.md），非 AOSP 原样（AOSP 锁屏磁贴为「点击请求解锁」而非不可用）。
 */
import type { VMBridge } from '../bridge/runtime';

export type TileState = 'active' | 'inactive' | 'unavailable';

export interface ToggleOpts {
  /** 无状态记录时的初始态 */
  readonly initial: Exclude<TileState, 'unavailable'>;
  /** unavailable 判定（只读通道；bridge 未就绪时不判定） */
  readonly unavailableWhen?: (bridge: VMBridge) => boolean;
  /** 状态变化回调（active=true 进入开启；false 回到关闭） */
  readonly onToggle?: (active: boolean) => void;
}

const states = new Map<string, TileState>();

function isLockedOut(opts: ToggleOpts, bridge?: VMBridge): boolean {
  return !!(opts.unavailableWhen && bridge && opts.unavailableWhen(bridge));
}

/** 读磁贴当前态（锁屏联动：锁定解除后 unavailable → inactive 回落） */
export function getTileState(id: string, opts: ToggleOpts, bridge?: VMBridge): TileState {
  const cur = states.get(id);
  if (cur === 'unavailable') {
    if (!isLockedOut(opts, bridge)) {
      states.set(id, 'inactive');
      return 'inactive';
    }
    return 'unavailable';
  }
  if (cur) return cur;
  if (isLockedOut(opts, bridge)) return 'unavailable';
  states.set(id, opts.initial);
  return opts.initial;
}

/**
 * 切换 toggle 磁贴（点击）。
 * unavailable → 不切换，返回 'unavailable'（调用方给「不可用」反馈）；
 * 否则 active↔inactive 翻转，并触发 onToggle 回调（dark-mode 主题换肤消费）。
 */
export function toggleTileState(id: string, opts: ToggleOpts, bridge?: VMBridge): TileState {
  const cur = getTileState(id, opts, bridge);
  if (cur === 'unavailable') return cur;
  const next: TileState = cur === 'active' ? 'inactive' : 'active';
  states.set(id, next);
  opts.onToggle?.(next === 'active');
  return next;
}

/** 测试隔离口：清空壳层自持状态（vitest beforeEach 用；生产不调用） */
export function resetTileStates(): void {
  states.clear();
}
