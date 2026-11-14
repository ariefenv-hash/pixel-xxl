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
/** rgb()/rgba() → 三元组（用于逐帧写窗口底色的 alpha） */
const parseRgb = (v: string): [number, number, number] | null => {
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((x) => Number(x.trim()));
  return p.length >= 3 ? [p[0], p[1], p[2]] : null;
};
/** 平滑阶跃：0 以下恒 0，1 以上恒 1，中间三次曲线（内容淡入不抢头段） */
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export type LaunchKind = 'icon' | 'widget' | 'card';

export function rectOf(node: Element, origin: DOMRect, round = true): Rect {
  // 桌面图标按钮比色块大（含标签），几何一律以色块为准，否则克隆体被拉成方块；
  // 小组件/最近任务卡没有 .icon__tile，直接用自己的矩形。
  const tile = node.querySelector('.icon__tile') ?? node;
  const r = tile.getBoundingClientRect();
  return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height, round };
}

export function kindOf(node: Element | null): LaunchKind {
  if (node instanceof Element && node.classList.contains('widget')) return 'widget';
  if (node instanceof Element && node.classList.contains('recent-card')) return 'card';
  return 'icon';
}

interface Layer {
  ghost: HTMLElement;
  scrim: HTMLElement;
  /** 源图标色（克隆体与窗口起点共用，保证「同一块颜色在长大」） */
  tint: string;
  /** 组件克隆体：和 ghost 同尺寸，圆角要跟 ghost 一起反向缩放 */
  inner?: HTMLElement;
}

function buildLayers(
  parent: HTMLElement,
  rect: Rect,
  iconNode: Element | null,
  kind: LaunchKind = 'icon'
): Layer {
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
  const tile = iconNode?.querySelector<HTMLElement>('.icon__tile') ?? null;
  let tint = 'transparent';
  let inner: HTMLElement | undefined;
  if (tile) {
    // 克隆体脱离 .icon[data-app] 祖先会丢配色，必须把计算后的背景内联过去
    const cs = getComputedStyle(tile);
    tint = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : cs.backgroundColor;
    const clone = tile.cloneNode(true) as HTMLElement;
    clone.style.width = `${rect.w}px`;
    clone.style.height = `${rect.h}px`;
    clone.style.background = tint;
    ghost.append(clone);
  } else if (iconNode) {
    // 小组件 / 最近任务卡：保留原样式克隆，尺寸按源矩形硬给（.widget 的 height 是
    // 156px 定值，跨容器后若沿用会被撑出 rect，克隆体就偏出半个身位）。
    tint = 'transparent';
    const src = getComputedStyle(iconNode);
    if (kind === 'widget') {
      // 组件是「玻璃压在壁纸上」——克隆体一旦浮在窗口之上，backdrop-filter 取到的
      // 就是 app 的深色底，整块会变成灰色板（上一版正是这个症状）。QSTM 的做法是拿
      // 一张**含壁纸像素的位图**去放大：这里用「壁纸切片」代替位图 —— 把壁纸按屏幕
      // 尺寸搬进克隆体、再用负偏移对齐到组件位置，于是克隆体自带正确的背景像素，
      // 放大时壁纸跟着一起放大（和原版快照放大完全同构）。
      const wp =
        parent.querySelector<HTMLElement>('.wallpaper') ??
        parent.closest<HTMLElement>('.screen')?.querySelector<HTMLElement>('.wallpaper') ??
        document.querySelector<HTMLElement>('.wallpaper');
      if (wp) {
        const pr = parent.getBoundingClientRect();
        const wr = wp.getBoundingClientRect();
        const slice = wp.cloneNode(false) as HTMLElement;
        slice.style.cssText +=
          `position:absolute;left:${(wr.left - pr.left - rect.x).toFixed(2)}px;` +
          `top:${(wr.top - pr.top - rect.y).toFixed(2)}px;` +
          `width:${wr.width.toFixed(2)}px;height:${wr.height.toFixed(2)}px;` +
          'transform:none;transition:none;z-index:0;pointer-events:none';
        ghost.append(slice);
      }
      // 圆角 + 裁剪：切片是矩形，不裁就会在圆角外露出一圈方角壁纸
      ghost.style.overflow = 'hidden';
      ghost.style.borderRadius = src.borderTopLeftRadius;
    }
    const clone = iconNode.cloneNode(true) as HTMLElement;
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.flex = 'none';
    ghost.append(clone);
    inner = clone;
  }

  if (kind !== 'icon') ghost.dataset.kind = kind;
  parent.append(scrim, ghost);
  return { ghost, scrim, tint, inner };
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
  scrimMax: number,
  kind: LaunchKind,
  bg: [number, number, number] | null,
  dir: 1 | -1 = 1
): void {
  // 尺寸走主曲线，中心点走 X/Y 曲线（QSTM 的 scale+position 语义在矩形上的等价物）。
  // 若直接插值 left/top，宽度落后于位置时窗口会「贴着左边走」，右侧露出大片空白。
  const vw = lerp(g.icon.w, g.baseW, pm);
  const vh = lerp(g.icon.h, g.baseH, pm);
  const cx = lerp(g.icon.x + g.icon.w / 2, g.baseW / 2, px);
  const cy = lerp(g.icon.y + g.icon.h / 2, g.baseH / 2, pm);
  const vx = cx - vw / 2;
  const vy = cy - vh / 2;
  const sx = vw / g.baseW;
  const sy = vh / g.baseH;
  // 圆角在屏幕像素域插值，再换回局部像素（起点 = 正圆）
  const rScreen = lerp(g.iconR, g.winR, pm);
  win.style.transform = `translate3d(${vx.toFixed(2)}px, ${vy.toFixed(2)}px, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
  win.style.borderRadius = `${(rScreen / sx).toFixed(2)}px`;
  // 组件打开走 QSTM getOpeningWindowAnimatorsForWidget 的预览时间轴：组件快照整体
  // 压在**已经完全不透明的**窗口之上，交叉淡出 125ms。窗口自己从不半透明 —— 它下面
  // 是桌面，一旦透出来就会看到「图标浮在窗口里」（上一版的浑浊帧就是这么来的）。
  const content =
    kind === 'widget'
      ? 1
      : kind === 'card'
        ? smoothstep(0.2, 0.55, pm) // RECENTS_LAUNCH_DURATION = 336：卡片内容更早露头
        : smoothstep(0.55, 1, pm);
  win.style.setProperty('--launch-content', content.toFixed(3));
  if (bg) {
    const a = kind === 'widget' ? 1 : smoothstep(0.06, 0.25, pm);
    win.style.backgroundColor = `rgba(${bg[0]}, ${bg[1]}, ${bg[2]}, ${a.toFixed(3)})`;
  }
  layer.scrim.style.opacity = (scrimMax * pm).toFixed(3);
  // 桌面图标与 Dock 在开窗头段退出（Launcher3 把 hotseat 一起缩放/淡出，不留在窗口边缘）
  const shell = win.closest<HTMLElement>('.screen');
  shell?.style.setProperty('--launch-icons', (1 - smoothstep(0, 0.34, pm)).toFixed(3));
  // 图标克隆体跟着窗口中心走（而不是钉在原来那一格），否则中途会变成「卡片里飘着一个
  // 偏上的图标」。淡化也提前收尾，别让人看到它停在半空。
  // 组件：前景在 62.5ms 内淡完；图标：0.42 前淡完。克隆体随窗口中心平移并轻微纵向拉伸，
  // 对应原工程 多层图标() 的 9-slice 拉伸（图标是「被拉长」而不是整块放大）。
  // 组件：快照的交叉淡出。开窗时按 QSTM 的 62.5ms 收尾（≈主曲线 0.22 处），
  // 关窗方向反过来 —— 用更长的 0.55 让组件在中段就渐渐「显影」成快照，收尾不跳。
  const ghostOut =
    kind === 'widget' ? smoothstep(0, dir > 0 ? 0.22 : 0.55, pm) : smoothstep(0.02, 0.42, pm);
  layer.ghost.style.opacity = (1 - ghostOut).toFixed(3);
  if (kind === 'widget') {
    // 组件克隆体逐帧**贴住窗口矩形**：它是「组件的快照」，必须和窗口一起长成整屏，
    // 而不是像图标那样原地轻微拉伸（那样会变成「小卡片浮在深色大窗里」）。
    // 圆角按屏幕像素反算，保证放大过程中视觉圆角与窗口一致。
    const gsx = vw / Math.max(1, g.icon.w);
    const gsy = vh / Math.max(1, g.icon.h);
    layer.ghost.style.transformOrigin = '0 0';
    layer.ghost.style.transform =
      `translate3d(${(vx - g.icon.x).toFixed(2)}px, ${(vy - g.icon.y).toFixed(2)}px, 0) ` +
      `scale(${gsx.toFixed(4)}, ${gsy.toFixed(4)})`;
    const lr = `${(rScreen / gsx).toFixed(2)}px`;
    layer.ghost.style.borderRadius = lr;
    if (layer.inner) layer.inner.style.borderRadius = lr;
  } else {
    const gdx = cx - (g.icon.x + g.icon.w / 2);
    const gdy = cy - (g.icon.y + g.icon.h / 2);
    const stretch = 1 + 0.28 * smoothstep(0, 0.3, pm);
    layer.ghost.style.transform =
      `translate3d(${gdx.toFixed(2)}px, ${gdy.toFixed(2)}px, 0) scale(${(1 + 0.12 * pm).toFixed(3)}, ${stretch.toFixed(3)})`;
  }
  // 窗口起点用图标色铺满，再淡出交给真实内容 —— 「图标变成窗口」的读感靠这一层。
  // 组件不需要这层：窗口从第一帧就是 app 自己的底色，组件切片负责「像」。
  win.style.setProperty(
    '--launch-tint-a',
    kind === 'widget' ? '0' : (1 - smoothstep(0.28, 0.62, pm)).toFixed(3)
  );
}

function reset(win: HTMLElement): void {
  win.closest<HTMLElement>('.screen')?.style.removeProperty('--launch-icons');
  win.style.backgroundColor = '';
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
export function playOpen(win: HTMLElement, rect: Rect, iconNode: Element | null, kind: LaunchKind = 'icon'): Promise<void> {
  // 尊重「减少动效」：直接给终态，不做位移动画（功能不变）
  if (reduceMotion()) {
    win.style.setProperty('--launch-content', '1');
    return Promise.resolve();
  }
  const parent = win.parentElement as HTMLElement;
  const g = geometry(win, rect);
  const layer = buildLayers(parent, rect, iconNode, kind);
  const runner = kind === 'card' ? { ...timedRunner('open'), durationMs: 336 } : timedRunner('open');

  const scrimMax = document.documentElement.dataset.theme === 'dark' ? 0.8 : 0.2;

  win.style.transformOrigin = '0 0';
  win.style.willChange = 'transform, border-radius';
  win.style.setProperty('--launch-tint', layer.tint);
  // 组件/卡片：窗口自身底色从透明拉起，先让「下面那层组件克隆」透出来
  const bg = kind === 'icon' ? null : parseRgb(getComputedStyle(win).backgroundColor);

  const dur = runner.durationMs / speedFactor();
  const main = new TimedValue({ durationMs: dur, interpolator: runner.main, initialValue: 0, target: 1 });
  const xAxis = new TimedValue({ durationMs: dur, interpolator: runner.x, initialValue: 0, target: 1 });

  paint(win, g, layer, 0, 0, scrimMax, kind, bg, 1);

  return new Promise<void>((resolve) => {
    const anim = {
      update(dt: number): void {
        main.update(dt);
        xAxis.update(dt);
        paint(win, g, layer, main.x, xAxis.x, scrimMax, kind, bg, 1);
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
export function playClose(win: HTMLElement, rect: Rect, iconNode: Element | null, kind: LaunchKind = 'icon'): Promise<void> {
  if (reduceMotion()) return Promise.resolve();
  const parent = win.parentElement as HTMLElement;
  const g = geometry(win, rect);
  const layer = buildLayers(parent, rect, iconNode, kind);
  const runner = kind === 'card' ? { ...timedRunner('close'), durationMs: 336 } : timedRunner('close');
  const scrimMax = document.documentElement.dataset.theme === 'dark' ? 0.8 : 0.2;
  const bg = kind === 'icon' ? null : parseRgb(getComputedStyle(win).backgroundColor);

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
        paint(win, g, layer, main.x, xAxis.x, scrimMax, kind, bg, -1);
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
