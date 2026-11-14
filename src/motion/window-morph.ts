/**
 * window-morph.ts — 把已挂载的窗口在「全屏 ↔ 卡片矩形」之间连续变形
 *
 * 与 launch.ts 的区别：那个负责窗口的**第一次**出现（图标/组件 → 全屏，带克隆体与色调），
 * 这个负责已经在跑的窗口在任务视图里的进出（全屏 ↔ 最近任务卡），不重建 DOM，
 * 因此 app 的滚动位置、播放状态都不会丢 —— 这正是原工程移动端「点卡片回不到全屏」
 * 那个 bug 的修法：不是重新 open() 一个实例，而是把同一个窗口拉回来。
 *
 * 坐标一律用 viewport 矩形（getBoundingClientRect），窗口布局尺寸用 offsetWidth/Height，
 * 因此与当前 transform 无关，可以从任意手势中途状态接上。
 */

import { driver } from './driver';
import { TimedValue, EMPHASIZED, EMPHASIZED_ACCELERATE } from './index';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MorphOptions {
  durationMs?: number;
  radius?: number;
  /** 结束时清掉内联 transform（回到全屏布局） */
  resetAtEnd?: boolean;
  /** 加速曲线（收起用）；默认 emphasized */
  accelerate?: boolean;
  fade?: number;
}

export function animateWindowRect(win: HTMLElement, to: Box, opts: MorphOptions = {}): Promise<void> {
  const durationMs = opts.durationMs ?? 320;
  const radius = opts.radius ?? 26;
  const origin = (win.parentElement ?? win).getBoundingClientRect();
  const baseW = win.offsetWidth || 1;
  const baseH = win.offsetHeight || 1;
  const start = win.getBoundingClientRect();

  const s0x = start.width / baseW;
  const s0y = start.height / baseH;
  const s1x = to.w / baseW;
  const s1y = to.h / baseH;
  const t0x = start.left - origin.left;
  const t0y = start.top - origin.top;
  const t1x = to.x - origin.left;
  const t1y = to.y - origin.top;
  const r0 = parseFloat(getComputedStyle(win).borderTopLeftRadius) || 24;

  win.style.transformOrigin = '0 0';
  win.style.willChange = 'transform, border-radius, opacity';

  const t = new TimedValue({
    durationMs,
    interpolator: opts.accelerate ? EMPHASIZED_ACCELERATE : EMPHASIZED,
    initialValue: 0,
    target: 1,
  });
  const startOpacity = parseFloat(getComputedStyle(win).opacity) || 1;

  return new Promise((resolve) => {
    const anim = {
      update(dt: number): void {
        t.update(dt);
        const k = t.x;
        const sx = s0x + (s1x - s0x) * k;
        const sy = s0y + (s1y - s0y) * k;
        win.style.transform = `translate3d(${(t0x + (t1x - t0x) * k).toFixed(2)}px, ${(t0y + (t1y - t0y) * k).toFixed(2)}px, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
        win.style.borderRadius = `${(r0 + (radius - r0) * k).toFixed(2)}px`;
        if (opts.fade != null) win.style.opacity = String(startOpacity + (opts.fade - startOpacity) * k);
        if (t.isSettled()) {
          driver.remove(anim);
          lease.stop();
          win.style.willChange = '';
          if (opts.resetAtEnd) {
            win.style.transform = '';
            win.style.borderRadius = '';
            win.style.transformOrigin = '';
            win.style.opacity = '';
          }
          resolve();
        }
      },
    };
    driver.add(anim);
    const lease = driver.start();
  });
}
