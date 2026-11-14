/**
 * predictive.ts — 预测式返回（predictive back）
 *
 * 出处：AOSP SystemUI `BackPanelController.kt` + `EdgePanelParams.kt` + `values/dimens.xml`
 * （android-14.0.0_r1；逐值表见 docs/MOTION-SPEC.md §4，源码快照在 docs/aosp/systemui/）
 *
 * 原版手势的三个关键值（也是上一版「滑 50 次才成功一次」的原因）：
 *   · navigation_edge_panel_width = 105dp —— 边缘热区是**整块 105dp 面板**，不是 24px；
 *   · navigation_edge_action_drag_threshold = 16dp —— 越过 16dp 才算激活；
 *   · navigation_edge_action_progress_threshold = 412dp —— 进度按「屏宽 min 412dp」归一。
 * 另外指示器中心固定比指尖高 64dp（navigation_edge_finger_offset），不压在手指下面。
 *
 * 状态机：ENTRY（碰边）→ ACTIVE（过阈值）↔ INACTIVE（往回拖）→ COMMITTED/CANCELLED。
 * 形态与弹簧全部在 motion/back-indicator.ts；这里只负责手势、窗口让位与提交。
 */

import { driver } from './driver';
import { BackIndicator, type BackSide } from './back-indicator';
import { Spring, TimedValue, EMPHASIZED_ACCELERATE } from './index';
import type { Rect } from './launch';

export interface PredictiveOptions {
  screen: HTMLElement;
  getWindow: () => HTMLElement | null;
  getSource: () => Rect | null;
  onCommit: () => void;
}

/** AOSP 原值（dp） */
const PANEL_DP = 105;
const DRAG_DP = 16;
const PROGRESS_DP = 412;
/** 提交阈值：进度 14% 或松手速度 700px/s（AOSP 由 IIO 的 commit 判定，取可复现的等效值） */
const COMMIT_P = 0.14;
const COMMIT_V = 700;
/** 横向锁定：纵向分量超过横向 1.2 倍则让位给滚动 */
const LOCK_RATIO = 1.2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface Pending {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastT: number;
  v: number;
  side: BackSide;
  active: boolean;
}

export function initPredictive(opts: PredictiveOptions): void {
  const { screen } = opts;
  const indicator = new BackIndicator(screen);
  let pending: Pending | null = null;
  let side: BackSide = 'left';
  let p = 0;
  let phase: 'idle' | 'drag' | 'settle' | 'commit' = 'idle';
  let spring: Spring | null = null;
  let timed: TimedValue | null = null;

  const unit = (): number => {
    const w = screen.clientWidth || 400;
    return Math.min(1.15, Math.max(0.86, w / 393));
  };

  /* ------------------------------ 窗口让位 ------------------------------ */

  function apply(progress: number): void {
    const win = opts.getWindow();
    if (!win) return;
    p = clamp01(progress);
    const w = screen.clientWidth || 420;
    const shift = (side === 'right' ? -1 : 1) * w * 0.12 * p;
    const scale = 1 - 0.1 * p;
    win.style.transformOrigin = 'center center';
    win.style.transform = `translate3d(${shift.toFixed(2)}px, 0, 0) scale(${scale.toFixed(4)})`;
    win.style.borderRadius = `${(24 + 10 * p).toFixed(2)}px`;
    win.style.setProperty('--back-dim', (0.24 * p).toFixed(3));
    // 上一层（桌面）按进度显形，而不是直接切黑
    screen.style.setProperty('--back-p', p.toFixed(3));
  }

  function clearWindow(): void {
    screen.style.removeProperty('--back-p');
    const win = opts.getWindow();
    if (!win) return;
    win.style.transform = '';
    win.style.borderRadius = '';
    win.style.transformOrigin = '';
    win.style.removeProperty('--back-dim');
  }

  /* -------------------------------- 提交 -------------------------------- */

  function commit(): void {
    const win = opts.getWindow();
    const src = opts.getSource();
    if (!win || !src) {
      finish();
      return;
    }
    const s = 1 - 0.1 * p;
    const base = win.getBoundingClientRect();
    const fullW = base.width / s;
    const fullH = base.height / s;
    const s0 = Math.max(0.06, src.w / fullW);
    // 收回图标：非等比，起点精确是图标矩形
    const s0y = Math.max(0.06, src.h / fullH);
    const x0 = src.x + src.w / 2 - (fullW * s0) / 2;
    const y0 = src.y + src.h / 2 - (fullH * s0y) / 2;
    // 收回图标要保持图标比例：scaleX/scaleY 各走一条
    const fromX = (side === 'right' ? -1 : 1) * (screen.clientWidth || 420) * 0.12 * p;
    const startScaleX = s;
    const startScaleY = s;
    const endScaleX = s0;
    const endScaleY = s0y;

    indicator.setState('committed');
    timed = new TimedValue({ durationMs: 250, interpolator: EMPHASIZED_ACCELERATE, initialValue: 0, target: 1 });
    phase = 'commit';
    const anim = {
      update(dt: number): void {
        timed!.update(dt);
        const k = timed!.x;
        const sx = lerp(startScaleX, endScaleX, k);
        const sy = lerp(startScaleY, endScaleY, k);
        win.style.transformOrigin = '0 0';
        win.style.transform =
          `translate3d(${lerp(fromX, x0, k).toFixed(2)}px, ${lerp(0, y0, k).toFixed(2)}px, 0) ` +
          `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
        win.style.borderRadius = `${lerp(24 + 10 * p, src.w / 2 / Math.max(0.06, s0), k).toFixed(2)}px`;
        win.style.setProperty('--back-dim', (0.24 * (1 - k)).toFixed(3));
        if (timed!.isSettled()) {
          cleanupAnim();
          // 先卸载窗口，再清 transform：避免「已经收进图标又弹回全屏」的一帧
          opts.onCommit();
          finish();
        }
      },
    };
    addAnim(anim);
  }

  function finish(): void {
    phase = 'idle';
    p = 0;
    clearWindow();
    indicator.setState('gone');
    // 不给小球留残影：下一次手势从 entry 重新长出来
    window.setTimeout(() => {
      if (phase === 'idle' && !indicator.visible) indicator.snap();
    }, 260);
  }

  /* ------------------------------- 弹簧回弹 ------------------------------- */

  function cancel(): void {
    const v0 = -(Math.abs(pending?.v ?? 0) / (Math.min(screen.clientWidth || 420, PROGRESS_DP * unit()) * 0.86));
    const s = new Spring({
      mass: 1,
      stiffness: 600,
      damping: 2 * 0.9 * Math.sqrt(600),
      initialValue: p,
      initialVelocity: v0,
    });
    s.setTarget(0);
    spring = s;
    indicator.setState('inactive');
    phase = 'settle';
    ensureLoop();
  }

  function settleStep(dt: number): void {
    if (!spring) return;
    spring.update(dt);
    apply(spring.x);
    indicator.setProgress(spring.x);
    if (spring.isSettled(0.002, 6)) {
      spring = null;
      finish();
    }
  }

  /* ------------------------------- rAF 宿主 ------------------------------- */

  let lease: (() => void) | null = null;
  let anim: { update(dt: number): void } | null = null;

  function addAnim(a: { update(dt: number): void }): void {
    anim = a;
    ensureLoop();
  }

  function cleanupAnim(): void {
    anim = null;
  }

  function ensureLoop(): void {
    if (lease) return;
    const task = {
      update(dt: number): void {
        const moving = indicator.update(dt);
        if (anim) anim.update(dt);
        else if (phase === 'settle') settleStep(dt);
        if (phase === 'idle' && !moving && !anim) {
          lease?.();
          lease = null;
        }
      },
    };
    driver.add(task);
    const l = driver.start();
    lease = () => {
      driver.remove(task);
      l.stop();
    };
  }

  /* -------------------------------- 手势 -------------------------------- */

  function begin(e: PointerEvent): void {
    if (phase !== 'idle' || !opts.getWindow()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = screen.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const u = unit();
    const panel = Math.min(PANEL_DP * u, rect.width * 0.3);
    let hit: BackSide | null = null;
    if (x <= panel) hit = 'left';
    else if (x >= rect.width - panel) hit = 'right';
    if (!hit) return;
    side = hit;

    indicator.setUnit(rect.width);
    indicator.setSide(hit);
    indicator.setPointerY(e.clientY, rect.top);
    indicator.setProgress(0);
    indicator.setState('entry');
    pending = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: e.timeStamp,
      v: 0,
      side,
      active: false,
    };
    ensureLoop();
  }

  function move(e: PointerEvent): void {
    if (!pending || e.pointerId !== pending.pointerId) return;
    const dx = e.clientX - pending.startX;
    const dy = e.clientY - pending.startY;

    if (!pending.active) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) * LOCK_RATIO) {
        // 纵向手势：让位给滚动，指示器缩回去
        indicator.setState('gone');
        pending = null;
        return;
      }
      pending.active = true;
      phase = 'drag';
      try {
        screen.setPointerCapture(e.pointerId);
      } catch {
        /* 合成事件没有活动指针 */
      }
      screen.dataset.backGesture = '1';
      // 横向意图已成立但还没过 16dp：AOSP 这时给的是「peek」态（51×46、圆角 16/20、
      // 距边 4dp），越过阈值才收成 48×48 的整圆。少了这一段，小球就是「凭空出现」。
      indicator.setState('inactive');
    }

    const u = unit();
    const signed = pending.side === 'left' ? dx : -dx;
    const dt = Math.max(8, e.timeStamp - pending.lastT);
    pending.v = ((e.clientX - pending.lastX) / dt) * 1000 * (pending.side === 'left' ? 1 : -1);
    pending.lastX = e.clientX;
    pending.lastT = e.timeStamp;

    const span = Math.min(screen.clientWidth || 420, PROGRESS_DP * u);
    const progress = clamp01((signed - DRAG_DP * u) / span);
    indicator.setPointerY(e.clientY, screen.getBoundingClientRect().top);
    indicator.setProgress(progress);
    indicator.setState(signed > DRAG_DP * u ? 'active' : 'inactive');
    apply(progress);
  }

  function end(e: PointerEvent): void {
    if (!pending || e.pointerId !== pending.pointerId) return;
    const d = pending;
    pending = null;
    delete screen.dataset.backGesture;
    if (!d.active) {
      indicator.setState('gone');
      return;
    }
    if (p > COMMIT_P || d.v > COMMIT_V) {
      commit();
      return;
    }
    pending = d; // cancel 需要初速度
    cancel();
    pending = null;
  }

  screen.addEventListener('pointerdown', begin, { passive: true });
  // move/up 挂 window：触摸在按钮上起手时浏览器会给按钮隐式指针捕获，事件不一定回到 screen
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', end, { passive: true });
  window.addEventListener('pointercancel', (e) => {
    if (!pending || e.pointerId !== pending.pointerId) return;
    const d = pending;
    pending = null;
    delete screen.dataset.backGesture;
    if (d.active) {
      pending = d;
      cancel();
      pending = null;
    } else {
      indicator.setState('gone');
    }
  });
}
