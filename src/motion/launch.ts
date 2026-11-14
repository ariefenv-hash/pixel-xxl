/**
 * launch.ts — 图标 → 全屏 的容器变换（container transform）
 *
 * 语义与参数出处：Launcher3 `QuickstepTransitionManager`（AOSP）
 *   · 时长：开 500ms / 关 250ms（APP_LAUNCH_DURATION / CLOSING_TRANSITION_DURATION_MS）
 *   · 主时间轴：emphasized（缩放 / 圆角 / 内容 alpha 共用）
 *   · X 位移：app_open_x 单独一条曲线（mOpeningXInterpolator）
 *   · 背景遮罩：MAX_SCRIM_ALPHA_LIGHT 0.2 / DARK 0.8
 *   · 关闭 = 打开曲线在时间上反向播放，时长缩短（不是换一条新曲线）
 *
 * 几何（与 QSTM 的 setScale + setPosition 同构）：
 *   窗口始终按全屏尺寸布局，靠 `transform: translate() scale()` 把它「投影」到图标位置：
 *     s₀ = 图标宽 / 窗口宽
 *     起点位移 = 图标中心 − 缩放后窗口的一半
 *   圆角在**屏幕像素**域插值（图标 28px 圆形 → 窗口 24px），再除以 scale 换回局部像素，
 *   因此起点视觉上是正圆、终点是 24px 圆角矩形 —— 形状连续，不是淡入淡出。
 *
 * 内容 alpha 只走最后 45%：前一截由图标色块本身承担，避免「文字从芝麻大小涨上来」。
 */

import { driver } from './driver';
import { TimedValue, getTransitionRunner } from './index';

/** 定时轴运行器的结构类型（native 预设；spring 分支在本壳不使用） */
interface TimedRunner {
  durationMs: number;
  main: (u: number) => number;
  x: (u: number) => number;
}
const timedRunner = (phase: 'open' | 'close'): TimedRunner => getTransitionRunner(phase) as unknown as TimedRunner;

/** 设计检视用慢放：`__launchSpeed = 0.1` → 时长 ×10（只拉伸时间轴，不改曲线） */
const reduceMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const speedFactor = (): number =>
  Number((globalThis as unknown as { __launchSpeed?: number }).__launchSpeed) || 1;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 图标本身是圆形（桌面图标）→ 起点圆角取 w/2 */
  round: boolean;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 平滑阶跃：0 以下恒 0，1 以上恒 1，中间三次曲线（内容淡入不抢头段） */
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function rectOf(node: Element, origin: DOMRect, round = true): Rect {
  // 桌面图标按钮比色块大（含标签），几何一律以色块为准，否则克隆体被拉成方块
  const tile = node.querySelector('.icon__tile') ?? node;
  const r = tile.getBoundingClientRect();
  return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height, round };
}

interface Layer {
  ghost: HTMLElement;
  scrim: HTMLElement;
  /** 源图标色（克隆体与窗口起点共用，保证「同一块颜色在长大」） */
  tint: string;
}

function buildLayers(parent: HTMLElement, rect: Rect, iconNode: Element | null): Layer {
  const scrim = document.createElement('div');
  scrim.className = 'launch-scrim';
  scrim.style.opacity = '0';

  const ghost = document.createElement('div');
  ghost.className = 'launch-ghost';
  ghost.style.left = `${rect.x}px`;
  ghost.style.top = `${rect.y}px`;
  ghost.style.width = `${rect.w}px`;
  ghost.style.height = `${rect.h}px`;

  // 图标本体（渐变球 + 字形）整体搬到 ghost 里，缩放途中不重排任何真实节点。
  // 尺寸写死为源图标像素：百分比高度在 grid 容器里会退化成 SVG 默认的 150px。
  const tile = iconNode?.querySelector<HTMLElement>('.icon__tile') ?? (iconNode as HTMLElement | null);
  let tint = 'transparent';
  if (tile) {
    // 克隆体脱离 .icon[data-app] 祖先会丢配色，必须把计算后的背景内联过去
    const cs = getComputedStyle(tile);
    tint = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : cs.backgroundColor;
    const clone = tile.cloneNode(true) as HTMLElement;
    clone.style.width = `${rect.w}px`;
    clone.style.height = `${rect.h}px`;
    clone.style.background = tint;
    ghost.append(clone);
  }

  parent.append(scrim, ghost);
  return { ghost, scrim, tint };
}

interface Geometry {
  baseW: number;
  baseH: number;
  /** 源图标矩形（窗口坐标系） */
  icon: { x: number; y: number; w: number; h: number };
  iconR: number;
  winR: number;
}

function geometry(win: HTMLElement, rect: Rect): Geometry {
  const base = win.getBoundingClientRect();
  const winR = parseFloat(getComputedStyle(win).borderTopLeftRadius) || 24;
  return {
    baseW: base.width,
    baseH: base.height,
    icon: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    iconR: rect.round ? rect.w / 2 : Math.min(rect.w, rect.h) * 0.22,
    winR,
  };
}

/**
 * 把几何状态写到 DOM 上。
 *
 * 这里用**非等比缩放**（sx≠sy）而不是 QSTM 的等比 + 裁切：起点矩形必须精确等于图标
 * 那个正方形，否则你会看到一个胶囊而不是图标。内容在 55% 之后才淡入，那时各向异性
 * 已小于 6%，文字看不出拉伸。
 */
function paint(
  win: HTMLElement,
  g: Geometry,
  layer: Layer,
  pm: number,
  px: number,
  scrimMax: number
): void {
  const vx = lerp(g.icon.x, 0, px);
  const vy = lerp(g.icon.y, 0, pm);
  const vw = lerp(g.icon.w, g.baseW, pm);
  const vh = lerp(g.icon.h, g.baseH, pm);
  const sx = vw / g.baseW;
  const sy = vh / g.baseH;
  // 圆角在屏幕像素域插值，再换回局部像素（起点 = 正圆）
  const rScreen = lerp(g.iconR, g.winR, pm);
  win.style.transform = `translate3d(${vx.toFixed(2)}px, ${vy.toFixed(2)}px, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
  win.style.borderRadius = `${(rScreen / sx).toFixed(2)}px`;
  win.style.setProperty('--launch-content', smoothstep(0.55, 1, pm).toFixed(3));
  layer.scrim.style.opacity = (scrimMax * pm).toFixed(3);
  layer.ghost.style.opacity = (1 - smoothstep(0.02, 0.55, pm)).toFixed(3);
  layer.ghost.style.transform = `scale(${(1 + 0.18 * pm).toFixed(3)})`;
  // 窗口起点用图标色铺满，再淡出交给真实内容 —— 「图标变成窗口」的读感靠这一层
  win.style.setProperty('--launch-tint-a', (1 - smoothstep(0.28, 0.62, pm)).toFixed(3));
}

function reset(win: HTMLElement): void {
  win.style.transform = '';
  win.style.borderRadius = '';
  win.style.removeProperty('--launch-content');
  win.style.removeProperty('--launch-tint-a');
  win.style.removeProperty('--launch-tint');
  win.style.willChange = '';
}

/**
 * 播放入场。返回 Promise 在动画收敛后 resolve（内容挂载可与之并行，不必等）。
 * @param win 目标窗口（已插入、尚未显示内容）
 * @param rect 源图标几何（窗口坐标系）
 * @param iconNode 源图标节点（用于取色块与字形）
 */
export function playOpen(win: HTMLElement, rect: Rect, iconNode: Element | null): Promise<void> {
  // 尊重「减少动效」：直接给终态，不做位移动画（功能不变）
  if (reduceMotion()) {
    win.style.setProperty('--launch-content', '1');
    return Promise.resolve();
  }
  const parent = win.parentElement as HTMLElement;
  const g = geometry(win, rect);
  const layer = buildLayers(parent, rect, iconNode);
  const runner = timedRunner('open');

  const scrimMax = document.documentElement.dataset.theme === 'dark' ? 0.8 : 0.2;

  win.style.transformOrigin = '0 0';
  win.style.willChange = 'transform, border-radius';
  win.style.setProperty('--launch-tint', layer.tint);

  const dur = runner.durationMs / speedFactor();
  const main = new TimedValue({ durationMs: dur, interpolator: runner.main, initialValue: 0, target: 1 });
  const xAxis = new TimedValue({ durationMs: dur, interpolator: runner.x, initialValue: 0, target: 1 });

  paint(win, g, layer, 0, 0, scrimMax);

  return new Promise<void>((resolve) => {
    const anim = {
      update(dt: number): void {
        main.update(dt);
        xAxis.update(dt);
        paint(win, g, layer, main.x, xAxis.x, scrimMax);
        if (main.isSettled() && xAxis.isSettled()) {
          reset(win);
          layer.ghost.remove();
          layer.scrim.remove();
          driver.remove(anim);
          lease.stop();
          resolve();
        }
      },
    };
    driver.add(anim);
    const lease = driver.start();
  });
}

/**
 * 播放退场（打开曲线的反向 + 250ms）。
 * 结束后窗口仍留在原位（调用方负责 remove），便于上层做资源清理。
 */
export function playClose(win: HTMLElement, rect: Rect, iconNode: Element | null): Promise<void> {
  if (reduceMotion()) return Promise.resolve();
  const parent = win.parentElement as HTMLElement;
  const g = geometry(win, rect);
  const layer = buildLayers(parent, rect, iconNode);
  const runner = timedRunner('close');
  const scrimMax = document.documentElement.dataset.theme === 'dark' ? 0.8 : 0.2;

  win.style.transformOrigin = '0 0';
  win.style.willChange = 'transform, border-radius';

  // 反向：以打开曲线在时间上取镜像 —— I(1−u)。端点 1→0，形状与开窗严格对称。
  const mirror = (fn: (u: number) => number) => (u: number): number => fn(1 - u);

  const dur = runner.durationMs / speedFactor();
  // 值域仍用 0→1：把「镜像」放在插值器里（e = I(1−u)），于是 u=0 时 e=1（满窗）、
  // u=1 时 e=0（收进图标）。若反过来把值域设成 1→0，会在开头一帧就塌缩。
  const main = new TimedValue({ durationMs: dur, interpolator: mirror(runner.main), initialValue: 0, target: 1 });
  const xAxis = new TimedValue({ durationMs: dur, interpolator: mirror(runner.x), initialValue: 0, target: 1 });

  return new Promise<void>((resolve) => {
    const anim = {
      update(dt: number): void {
        main.update(dt);
        xAxis.update(dt);
        paint(win, g, layer, main.x, xAxis.x, scrimMax);
        if (main.isSettled() && xAxis.isSettled()) {
          layer.ghost.remove();
          layer.scrim.remove();
          driver.remove(anim);
          lease.stop();
          reset(win);
          resolve();
        }
      },
    };
    driver.add(anim);
    const lease = driver.start();
  });
}
