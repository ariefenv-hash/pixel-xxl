/**
 * predictive.ts — 预测式返回（predictive back）
 *
 * 语义出处：AOSP SystemUI `BackPanelController.kt` + `EdgePanelParams.kt` + `values/dimens.xml`
 * （android-14.0.0_r1，本仓 docs/MOTION-SPEC.md 有逐值表）：
 *   · 触发：距屏幕边缘 24px 内按下（navigation_edge_action_drag_threshold 16dp 之上留余量）
 *   · 指示器：背景 48×48、圆角 24、距边 14；箭身 6.4、笔粗 4
 *     （navigation_edge_active_background_width / _edge_corners / _entry_margin）
 *   · 出现阈值 progress > 0.165 起显形（commonArrowDimensAlphaThreshold，factor 1.05）
 *   · 提交：progress > 0.32 或松手速度 > 0.9/s
 *
 * 视觉：拖动时当前窗口随进度缩小、横向让位、圆角增大、压暗；松手要么弹回（弹簧，
 * 可再次按下打断），要么收进图标（容器变换的逆向）。全程只写 transform / opacity。
 */

import { driver } from './driver';
import { Spring, makeSpringParams, TimedValue, EMPHASIZED_ACCELERATE } from './index';
import type { Rect } from './launch';

export interface PredictiveOptions {
  /** 手势承载元素（= 屏幕） */
  screen: HTMLElement;
  /** 当前窗口（无窗口时返回 null，手势不激活） */
  getWindow: () => HTMLElement | null;
  /** 源图标几何（窗口坐标系）；null 表示无图标可收（如从 Recents 打开） */
  getSource: () => Rect | null;
  /** 提交返回（收进图标动画结束后调用；调用方负责卸载窗口） */
  onCommit: () => void;
}

const EDGE = 24;
const PROGRESS_SPAN = 0.62; // 拖满进度所需横向距离 = 62% 屏宽
const COMMIT_P = 0.32;
const COMMIT_V_PX = 850; // 松手速度阈值（px/s，AOSP fling 量纲）

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

interface DragState {
  startX: number;
  startY: number;
  lastX: number;
  lastT: number;
  v: number;
  active: boolean;
  pointerId: number;
}

export function initPredictive(opts: PredictiveOptions): void {
  const { screen } = opts;
  let arrow: HTMLElement | null = null;
  let drag: DragState | null = null;
  let release: (() => void) | null = null;
  let p = 0;
  let side: 1 | -1 = 1;
  let arrowY = 0;

  function ensureArrow(): HTMLElement {
    if (arrow) return arrow;
    const node = document.createElement('div');
    node.className = 'back-arrow';
    node.innerHTML =
      '<span class="back-arrow__bg"></span>' +
      '<svg class="back-arrow__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    screen.append(node);
    arrow = node;
    return node;
  }

  /** 逐帧写入「返回进度」对应的窗口状态 */
  function apply(progress: number, dragDx = 0): void {
    const win = opts.getWindow();
    if (!win) return;
    p = clamp01(progress);
    const w = screen.clientWidth || 420;
    const shift = side * w * 0.09 * p + dragDx * 0.12;
    const scale = 1 - 0.08 * p;
    win.style.transformOrigin = 'center center';
    win.style.transform = `translate3d(${shift.toFixed(2)}px, 0, 0) scale(${scale.toFixed(4)})`;
    win.style.borderRadius = `${(24 + 10 * p).toFixed(1)}px`;
    win.style.setProperty('--back-dim', (0.24 * p).toFixed(3));
    // 让被遮住的桌面按进度显形（Android 里是「上一层」预览）
    screen.style.setProperty('--back-p', p.toFixed(3));

    const a = ensureArrow();
    const visible = p > 0.165 ? Math.min(1, (p - 0.165) * 4 * 1.05) : 0;
    a.dataset.side = side === 1 ? 'left' : 'right';
    a.style.setProperty('--p', p.toFixed(3));
    a.style.top = `${Math.round(arrowY - 24)}px`;
    a.style.opacity = visible.toFixed(3);
    a.style.transform = `scale(${(0.98 + 0.02 * p).toFixed(3)})`;
  }

  function clearWin(): void {
    screen.style.removeProperty('--back-p');
    const win = opts.getWindow();
    if (!win) return;
    win.style.transform = '';
    win.style.borderRadius = '';
    win.style.transformOrigin = '';
    win.style.removeProperty('--back-dim');
  }

  function hideArrow(): void {
    if (arrow) arrow.style.opacity = '0';
  }

  /** 弹回：弹簧把进度收回 0（可被再次按下打断） */
  function springBack(): void {
    release?.();
    const s = new Spring({
      ...makeSpringParams(0.3, 0.92, 1),
      initialValue: p,
      initialVelocity: -(Math.abs(drag?.v ?? 0) / ((screen.clientWidth || 420) * PROGRESS_SPAN)),
    });
    const anim = {
      update(dt: number): void {
        s.update(dt);
        apply(s.x);
        if (s.isSettled()) {
          driver.remove(anim);
          lease.stop();
          release = null;
          clearWin();
          hideArrow();
          p = 0;
        }
      },
    };
    driver.add(anim);
    const lease = driver.start();
    release = () => {
      driver.remove(anim);
      lease.stop();
      release = null;
    };
  }

  /** 提交：把窗口从当前形态收进图标（220ms 加速曲线），随后卸载 */
  function collapseAndCommit(): void {
    const win = opts.getWindow();
    const src = opts.getSource();
    if (!win || !src) {
      opts.onCommit();
      return;
    }
    const s = 1 - 0.08 * p;
    const base = win.getBoundingClientRect();
    const fullW = base.width / s;
    const fullH = base.height / s;
    const s0 = Math.max(0.06, src.w / fullW);
    const x0 = src.x + src.w / 2 - (fullW * s0) / 2;
    const y0 = src.y + src.h / 2 - (fullH * s0) / 2;
    const from = { s, x: side * (screen.clientWidth || 420) * 0.09 * p, y: 0, r: 24 + 10 * p };
    const to = { s: s0, x: x0, y: y0, r: src.w / 2 / s0 };

    const t = new TimedValue({ durationMs: 220, interpolator: EMPHASIZED_ACCELERATE, initialValue: 0, target: 1 });
    const anim = {
      update(dt: number): void {
        t.update(dt);
        const k = t.x;
        win.style.transformOrigin = '0 0';
        win.style.transform =
          `translate3d(${lerp(from.x, to.x, k).toFixed(2)}px, ${lerp(from.y, to.y, k).toFixed(2)}px, 0) ` +
          `scale(${lerp(from.s, to.s, k).toFixed(4)})`;
        win.style.borderRadius = `${lerp(from.r, to.r, k).toFixed(2)}px`;
        win.style.setProperty('--back-dim', (0.24 * (1 - k)).toFixed(3));
        if (t.isSettled()) {
          driver.remove(anim);
          lease.stop();
          release = null;
          opts.onCommit();
        }
      },
    };
    driver.add(anim);
    const lease = driver.start();
    release = () => {
      driver.remove(anim);
      lease.stop();
      release = null;
    };
  }

  function begin(e: PointerEvent): void {
    if (release) return;
    if (!opts.getWindow()) return;
    const rect = screen.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x <= EDGE) side = 1;
    else if (x >= rect.width - EDGE) side = -1;
    else return;
    drag = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastT: e.timeStamp, v: 0, active: false, pointerId: e.pointerId };
    arrowY = Math.round(e.clientY - rect.top);
  }

  function move(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.2) {
        drag = null; // 纵向手势让位给面板/滚动
        return;
      }
      drag.active = true;
      screen.dataset.edgeDrag = '1';
    }
    const span = (screen.clientWidth || 420) * PROGRESS_SPAN;
    const signed = side === 1 ? dx : -dx;
    const dt = Math.max(8, e.timeStamp - drag.lastT); // 钳 8ms：合成事件的 dt=0 会放大出荒谬速度
    const vPx = (((e.clientX - drag.lastX) / dt) * 1000) * (side === 1 ? 1 : -1);
    drag.v = vPx; // px/s，正 = 朝提交方向
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    const rect = screen.getBoundingClientRect();
    arrowY = Math.max(64, Math.min(rect.height - 64, e.clientY - rect.top));
    apply(clamp01(signed / span), dx);
  }

  function end(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    delete screen.dataset.edgeDrag;
    if (!d.active) return;
    if (p > COMMIT_P || d.v > COMMIT_V_PX) {
      collapseAndCommit();
      return;
    }
    drag = d; // springBack 需要初速度
    springBack();
    drag = null;
  }

  screen.addEventListener('pointerdown', begin, { passive: true });
  screen.addEventListener('pointermove', move, { passive: true });
  screen.addEventListener('pointerup', end, { passive: true });
  screen.addEventListener('pointercancel', (e) => {
    if (drag?.active && e.pointerId === drag.pointerId) {
      springBack();
    }
    drag = null;
  });
}
