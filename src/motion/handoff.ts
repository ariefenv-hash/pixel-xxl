/**
 * handoff.ts — 前台窗口上滑 / 上滑长按 → 后台
 *
 * 原工程语义（反编译 `应用` 角色的 进程-打开动画 后续循环 + 后台运动）：
 *   · 打开 app 后按住向上滑，窗口本身（不是缩略图）开始变宽变矮、跟随手指；
 *   · 停在底部判定带里累计 30 帧（≈0.5s）→ 后台手势结果=1 → 松手进入后台；
 *   · 没有长按 → 松手回桌面；未过阈值 → 回到 app。
 *
 * AOSP 对应：Launcher3 `PortraitStatesTouchController` / `BaseActivityInterface`
 * 的 swipe-up 手势，松手目标为 HOME 或 RECENTS；`RECENTS_LAUNCH_DURATION = 336ms`。
 *
 * 本文件只做「手势 + 窗口连续变形」，进入后台后的卡片布局由 shell/apps.ts 接手。
 */

import { driver } from '../motion/driver';
import { Spring } from '../motion';

export interface HandoffOptions {
  screen: HTMLElement;
  getWindow: () => HTMLElement | null;
  /** 松手进入后台（窗口仍处于变形中，调用方接着把它吸到卡片） */
  onRecents: () => void;
  /** 松手回桌面 */
  onHome: () => void;
}

/** 底部手势带：AOSP 的 home handle 区域，避开左右边缘返回热区 */
const BAND = 72;
/** 长按判定 */
const LONG_PRESS = 320;
/** 拖满进度所需距离 = 42% 屏高 */
const SPAN = 0.42;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export function initHandoff(opts: HandoffOptions): void {
  const { screen } = opts;
  let pointerId = -1;
  let startY = 0;
  let startX = 0;
  let k = 0;
  let active = false;
  let intent = false;
  let longPress = 0;
  let spring: Spring | null = null;
  let lease: (() => void) | null = null;
  let loop: { update(dt: number): void } | null = null;

  function apply(progress: number): void {
    const win = opts.getWindow();
    if (!win) return;
    k = clamp01(progress);
    const h = screen.clientHeight || 800;
    const scale = 1 - 0.26 * k;
    win.style.transformOrigin = '50% 50%';
    win.style.transform = `translate3d(0, ${(-h * 0.02 * k).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    win.style.borderRadius = `${(24 + 10 * k).toFixed(1)}px`;
    win.style.opacity = `${(1 - 0.12 * k).toFixed(3)}`;
    screen.style.setProperty('--handoff-p', k.toFixed(3));
  }

  function clear(): void {
    const win = opts.getWindow();
    screen.style.removeProperty('--handoff-p');
    if (!win) return;
    win.style.transform = '';
    win.style.borderRadius = '';
    win.style.transformOrigin = '';
    win.style.opacity = '';
  }

  function stopLoop(): void {
    if (loop) driver.remove(loop);
    loop = null;
    lease?.();
    lease = null;
  }

  function springBack(): void {
    spring = new Spring({ mass: 1, stiffness: 700, damping: 2 * 0.9 * Math.sqrt(700), initialValue: k });
    spring.setTarget(0);
    if (!loop) {
      loop = {
        update(dt: number): void {
          if (!spring) return;
          spring.update(dt);
          apply(spring.x);
          if (spring.isSettled(0.002, 0.01)) {
            stopLoop();
            spring = null;
            clear();
          }
        },
      };
      driver.add(loop);
      const l = driver.start();
      lease = () => {
        if (loop) driver.remove(loop);
        l.stop();
      };
    }
  }

  function begin(e: PointerEvent): void {
    if (active || !opts.getWindow()) return;
    const rect = screen.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (y < rect.height - BAND) return;
    if (x < 36 || x > rect.width - 36) return; // 让给边缘返回
    pointerId = e.pointerId;
    startY = e.clientY;
    startX = e.clientX;
    k = 0;
    intent = false;
    active = true;
  }

  function move(e: PointerEvent): void {
    if (!active || e.pointerId !== pointerId) return;
    const dy = e.clientY - startY;
    const dx = e.clientX - startX;
    if (k === 0 && dy > -12) return;
    if (k === 0 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      active = false;
      return;
    }
    try {
      screen.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件 */
    }
    const h = screen.clientHeight || 800;
    const next = clamp(-dy / (h * SPAN), 0, 1);
    apply(next);
    // 长按判定：进入判定带后计时，退回则取消
    if (next > 0.12 && !intent && !longPress) {
      longPress = window.setTimeout(() => {
        intent = true;
        screen.dataset.handoff = 'recents';
        // 到点给一个很轻的「吸住」反馈（窗口再缩 2%）
        apply(Math.min(1, k + 0.02));
      }, LONG_PRESS);
    } else if (next < 0.08 && longPress && !intent) {
      window.clearTimeout(longPress);
      longPress = 0;
    }
  }

  function end(e: PointerEvent): void {
    if (!active || e.pointerId !== pointerId) return;
    active = false;
    pointerId = -1;
    if (longPress) window.clearTimeout(longPress);
    longPress = 0;
    delete screen.dataset.handoff;

    if (intent || k > 0.34) {
      stopLoop();
      opts.onRecents();
      return;
    }
    if (k > 0.16) {
      // 不清 transform：调用方要接着把当前这个缩小的窗口送下去，避免跳回全屏
      opts.onHome();
      return;
    }
    springBack();
  }

  screen.addEventListener('pointerdown', begin, { passive: true });
  // 同 predictive：window 级监听，避开触摸的隐式指针捕获
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', end, { passive: true });
  window.addEventListener('pointercancel', () => {
    if (!active) return;
    active = false;
    if (longPress) window.clearTimeout(longPress);
    longPress = 0;
    delete screen.dataset.handoff;
    springBack();
  });
}
