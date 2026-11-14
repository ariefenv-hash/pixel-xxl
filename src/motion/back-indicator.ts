/**
 * back-indicator.ts — 预测式返回的「小球」（AOSP EdgePanel 指示器）
 *
 * 出处：frameworks/base/packages/SystemUI/src/com/android/systemui/navigationbar/gestural/
 *       EdgePanelParams.kt + BackPanel.kt + BackPanelController.kt + values/dimens.xml
 *       （android-14.0.0_r1，逐值表见 docs/MOTION-SPEC.md §4）
 *
 * 原版不是「一个固定 48×48 的圆 + 图标」，而是**五个形态之间连续形变**：
 *
 *   entry        宽 0   高 48   圆角 6/6     距边 4   箭头 α0   ← 刚碰到边缘，只剩一条缝
 *   pre-threshold 宽 51  高 46   圆角 16/20   距边 4   箭头 8×5.6
 *   active       宽 48  高 48   圆角 24/24   距边 14  箭头 6.4×7.2  ← 完整的小球
 *   stretch      宽 60  高 48   圆角 24/24   距边 18  箭头 5.6×8    ← 拖到底时被拉长
 *   committed    scale .86、背景 α→0，箭头保留  ← 提交时「吸进去」
 *
 * 宽/高/圆角/位移/scale/箭头各自跑一条 AOSP 弹簧（刚度与阻尼比见 EdgePanelParams），
 * 所以形态切换带轻微过冲，和原版那颗会「弹一下」的小球一致。
 * 指针位置不是直接跟指尖：y = 指尖 y − 64dp（navigation_edge_finger_offset），
 * 避免手指挡住指示器。
 */

import { Spring, cubicBezier } from './index';

export type BackSide = 'left' | 'right';
export type BackState = 'gone' | 'entry' | 'inactive' | 'active' | 'committed';

interface Dims {
  /** 背景宽（dp） */
  w: number;
  /** 背景高（dp） */
  h: number;
  /** 近边圆角（贴屏幕那侧） */
  edgeR: number;
  /** 远边圆角 */
  farR: number;
  /** 距屏幕边（dp） */
  margin: number;
  scale: number;
  /** 箭头水平长度（dp） */
  arrowL: number;
  /** 箭头半高（dp；总高 = 2×） */
  arrowH: number;
  arrowA: number;
  bgA: number;
}

/** 直接抄 dimens：navigation_edge_* 五组 */
const STATES: Record<BackState, Dims> = {
  gone: { w: 0, h: 48, edgeR: 6, farR: 6, margin: 4, scale: 0.98, arrowL: 8.6, arrowH: 2.5, arrowA: 0, bgA: 0 },
  entry: { w: 0, h: 48, edgeR: 6, farR: 6, margin: 4, scale: 0.98, arrowL: 8.6, arrowH: 2.5, arrowA: 0, bgA: 1 },
  inactive: { w: 51, h: 46, edgeR: 16, farR: 20, margin: 4, scale: 0.98, arrowL: 8, arrowH: 2.8, arrowA: 1, bgA: 1 },
  active: { w: 48, h: 48, edgeR: 24, farR: 24, margin: 14, scale: 1, arrowL: 6.4, arrowH: 3.6, arrowA: 1, bgA: 1 },
  committed: { w: 48, h: 48, edgeR: 24, farR: 24, margin: 14, scale: 0.86, arrowL: 6.4, arrowH: 3.6, arrowA: 1, bgA: 0 },
};

/** 完全拉伸态（navigation_edge_stretch_*） */
const STRETCH: Dims = { w: 60, h: 48, edgeR: 24, farR: 24, margin: 18, scale: 1, arrowL: 5.6, arrowH: 4, arrowA: 1, bgA: 1 };

/** 各形态的弹簧刚度/阻尼比（EdgePanelParams 的 createSpring 原值） */
const SPRING: Record<BackState, { k: number; z: number }> = {
  gone: { k: 120, z: 0.8 },
  entry: { k: 120, z: 0.8 },
  inactive: { k: 650, z: 0.9 },
  active: { k: 850, z: 0.75 },
  committed: { k: 1400, z: 1 },
};

/** 拉伸量曲线：AOSP 的 PathInterpolator(.19,1.27,.71,.86)，收敛到 1 的一小段过冲 */
const stretchEase = cubicBezier(0.19, 1.0, 0.71, 1.0);

const DIM_KEYS = ['w', 'h', 'edgeR', 'farR', 'margin', 'scale', 'arrowL', 'arrowH', 'arrowA', 'bgA'] as const;
type DimKey = (typeof DIM_KEYS)[number];

export class BackIndicator {
  readonly el: HTMLElement;
  private bg: HTMLElement;
  private chev: HTMLElement;
  private springs: Record<DimKey, Spring>;
  private side: BackSide = 'left';
  private state: BackState = 'gone';
  private progress = 0;
  private centerY = 0;
  private unit = 1;
  private lastPaint = '';

  constructor(screen: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'back-arrow';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML =
      '<span class="back-arrow__bg"></span>' +
      '<span class="back-arrow__chev">' +
      '<svg viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M8 2 L2 10 L8 18" /></svg></span>';
    this.bg = this.el.querySelector('.back-arrow__bg')!;
    this.chev = this.el.querySelector('.back-arrow__chev')!;
    screen.append(this.el);

    const base = STATES.gone;
    this.springs = {} as Record<DimKey, Spring>;
    for (const k of DIM_KEYS) {
      this.springs[k] = new Spring({
        mass: 1,
        stiffness: SPRING.gone.k,
        damping: 2 * SPRING.gone.z * Math.sqrt(SPRING.gone.k),
        initialValue: base[k],
      });
    }
    this.el.style.opacity = '0';
  }

  /** dp→px：以 393dp 逻辑宽为基准，桌面预览更宽时按比例放大 */
  setUnit(screenWidth: number): void {
    this.unit = Math.min(1.15, Math.max(0.86, screenWidth / 393));
  }

  setSide(side: BackSide): void {
    this.side = side;
    this.el.dataset.side = side;
  }

  /** 指尖 y（屏幕坐标）→ 指示器中心：上移 64dp，最高不低于 64dp */
  setPointerY(clientY: number, screenTop: number): void {
    const u = this.unit;
    this.centerY = Math.max(64 * u, clientY - screenTop - 64 * u);
  }

  setState(next: BackState): void {
    if (this.state === next) return;
    this.state = next;
    const target = STATES[next];
    const { k, z } = SPRING[next];
    const damping = 2 * z * Math.sqrt(k);
    for (const key of DIM_KEYS) {
      const s = this.springs[key];
      s.stiffness = k;
      s.damping = damping;
      s.setTarget(target[key]);
    }
    if (next === 'entry' || next === 'gone') this.progress = 0;
  }

  setProgress(p: number): void {
    this.progress = p <= 0 ? 0 : p >= 1 ? 1 : p;
  }

  get visible(): boolean {
    return this.state !== 'gone';
  }

  /** 每帧推进弹簧并写样式；返回 true 表示还在动 */
  update(dt: number): boolean {
    let moving = false;
    for (const key of DIM_KEYS) {
      const s = this.springs[key];
      s.update(dt);
      if (!s.isSettled(0.002, 0.5)) moving = true;
    }
    this.render();
    return moving || this.state !== 'gone';
  }

  /** 立刻落到目标形态（首帧、或 reduced-motion） */
  snap(): void {
    const target = STATES[this.state];
    for (const key of DIM_KEYS) {
      const s = this.springs[key];
      s.x = target[key];
      s.v = 0;
      s.setTarget(target[key]);
    }
    this.render();
  }

  private render(): void {
    const u = this.unit;
    const g = (key: DimKey): number => (this.springs[key].x as number) * u;
    const p = this.progress;
    const e = stretchEase(p);

    const w = g('w') + (STRETCH.w * u - g('w')) * e;
    const h = g('h') + (STRETCH.h * u - g('h')) * e;
    const edgeR = g('edgeR') + (STRETCH.edgeR * u - g('edgeR')) * e;
    const farR = g('farR') + (STRETCH.farR * u - g('farR')) * e;
    const margin = g('margin') + (STRETCH.margin * u - g('margin')) * e;
    const scale = g('scale') + (STRETCH.scale - g('scale')) * e;
    const arrowL = g('arrowL') + (STRETCH.arrowL * u - g('arrowL')) * e;
    const arrowH = g('arrowH') + (STRETCH.arrowH * u - g('arrowH')) * e;
    const alpha = this.springs.bgA.x;
    const arrowA = this.springs.arrowA.x * alpha;

    // 只在值真的变化时写 DOM（拖动时每帧都会变，静止时零写入）
    const key = `${w.toFixed(2)}|${h.toFixed(2)}|${margin.toFixed(2)}|${scale.toFixed(3)}|${this.centerY.toFixed(1)}|${arrowL.toFixed(2)}|${arrowH.toFixed(2)}|${alpha.toFixed(3)}|${this.progress.toFixed(3)}|${this.side}`;
    if (key === this.lastPaint) return;
    this.lastPaint = key;

    const st = this.el.style;
    st.width = `${w.toFixed(2)}px`;
    st.height = `${h.toFixed(2)}px`;
    st.top = `${(this.centerY - h / 2).toFixed(2)}px`;
    st.opacity = alpha.toFixed(3);
    if (this.side === 'left') {
      st.left = `${margin.toFixed(2)}px`;
      st.right = '';
    } else {
      st.right = `${margin.toFixed(2)}px`;
      st.left = '';
    }
    // 缩放锚在远边：小球「长出来」时贴边那侧不动（AOSP scalePivotX）
    st.transformOrigin = this.side === 'left' ? `${w.toFixed(2)}px 50%` : `0 50%`;
    st.transform = `scale(${scale.toFixed(4)})`;

    const b = this.bg.style;
    b.opacity = '1';
    b.borderRadius =
      this.side === 'left'
        ? `${edgeR.toFixed(2)}px ${farR.toFixed(2)}px ${farR.toFixed(2)}px ${edgeR.toFixed(2)}px`
        : `${farR.toFixed(2)}px ${edgeR.toFixed(2)}px ${edgeR.toFixed(2)}px ${farR.toFixed(2)}px`;

    const c = this.chev.style;
    c.width = `${arrowL.toFixed(2)}px`;
    c.height = `${(arrowH * 2).toFixed(2)}px`;
    c.opacity = arrowA.toFixed(3);
    c.left = `${((w - arrowL) / 2).toFixed(2)}px`;
    c.top = `${((h - arrowH * 2) / 2).toFixed(2)}px`;
    // 左缘面板的箭头指向屏幕外（<）；右缘镜像成 >（AOSP canvas 里按 isLeftPanel 翻转）
    c.transform = this.side === 'right' ? 'scaleX(-1)' : '';
  }
}
