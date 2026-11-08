/**
 * shell/qs-panel.ts — 控制中心面板（L2 PoC）
 *
 * 动画内核 = vendored md3 InterruptibleInOutAnimator（Launcher3 连续打断 1:1）：
 *   - 反向触发从当前 progress 接续（不先 end 再 start）——快速连拉/连推不丢动画；
 *   - 距离分数时长缩放——完整翻转慢、贴边微调快；
 *   - setProgress 瞬置 = 手指跟随之锚（Launcher3 cancel+setCurrentFraction 语义）。
 * 宿主唯一 rAF：createFrameDriver 租约制（并行动画宿主面，与 md3 同律）。
 *
 * 手势模型（v1）：顶部拉出条 pointerdown → 面板 1:1 跟手 → 松手按位置+最近方向
 * 投票进/出。速度接力（Spring.setTarget(target, v) 通道）留给 app 开/关动画轮
 * （动画攻坚实例的工作面），本 PoC 不做速度合成——边界在 docs/SHELL.md §6 登记。
 */
import { createFrameDriver, InterruptibleInOutAnimator } from '../motion';
// vendored AOSP 插值器（_MD3_ 内核直引；Easing.emphasized 同族曲线）
// @ts-ignore —— vendored JS
import { EMPHASIZED } from '../motion/md3/aosp/interpolators.js';
import type { VMBridge } from '../bridge/runtime';
import { TILES, validateTilesAgainstCatalog } from './tiles';
import type { TileDef } from './tiles';

const PANEL_IN_MS = 320;
const PANEL_OUT_MS = 260;
/** 轮询周期（面板开启时刷新只读值；关闭即停——零空闲成本纪律） */
const POLL_MS = 500;
/** 拉出条高度（CSS 同值；手势判定用） */
export const GRAB_STRIP_H = 28;

export class QsPanel {
  private readonly bridge: VMBridge;
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly animator: InterruptibleInOutAnimator;
  private readonly driver = createFrameDriver();
  private lease: { stop(): void } | null = null;
  private pollTimer: number | null = null;
  private feedbackTimer: number | null = null;
  /** 手势态：跟随手指中 */
  private dragging = false;
  private dragStartY = 0;
  private dragProgressAtStart = 0;
  private recentDy = 0;

  constructor(bridge: VMBridge, root: HTMLElement) {
    this.bridge = bridge;
    this.root = root;

    validateTilesAgainstCatalog();

    // ---- DOM 组装（全部壳层自有，零侵入 iframe 文档） ----
    this.panel = document.createElement('div');
    this.panel.className = 'qs-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', '控制中心');

    const header = document.createElement('div');
    header.className = 'qs-header';
    const title = document.createElement('span');
    title.textContent = '控制中心';
    const source = document.createElement('span');
    source.className = 'qs-source';
    source.textContent = 'DOM 壳层 · 桥接 TurboWarp 运行时';
    header.append(title, source);

    const grid = document.createElement('div');
    grid.className = 'qs-grid';
    for (const tile of TILES) grid.appendChild(this.buildTile(tile));

    // 动作反馈行（r20261108：apply 返回文案改独立显示——原先直接覆盖磁贴文本，
    // 随后被 refreshTiles 抹去，反馈永远不可见；现独立成行，4s 淡出）
    this.feedback = document.createElement('div');
    this.feedback.className = 'qs-feedback';
    this.feedback.hidden = true;

    this.panel.append(header, grid, this.feedback);

    this.strip = document.createElement('div');
    this.strip.className = 'qs-grab-strip';
    this.strip.setAttribute('role', 'button');
    this.strip.setAttribute('aria-label', '下拉打开控制中心');
    const handle = document.createElement('div');
    handle.className = 'qs-handle';
    this.strip.appendChild(handle);

    this.root.append(this.panel, this.strip);

    // ---- 动画：连续打断内核（vendored md3） ----
    this.animator = new InterruptibleInOutAnimator({
      durationMs: PANEL_IN_MS,
      outDurationMs: PANEL_OUT_MS,
      interpolator: EMPHASIZED as (t: number) => number,
      initialValue: 0,
      onStop: (boundary) => {
        if (this.lease) {
          this.lease.stop();
          this.lease = null;
        }
        this.syncDom(this.animator.progress);
        this.syncPolling(boundary === 'in');
      },
    });
    this.driver.add(this.animator);

    this.bindGestures();
    this.syncDom(0);
    this.syncPolling(false);
  }

  /* ---------------- DOM ---------------- */

  private buildTile(def: TileDef): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'qs-tile';
    el.dataset.tileId = def.id;
    el.setAttribute('aria-label', def.label);

    const dot = document.createElement('span');
    dot.className = 'qs-tile-dot';
    const text = document.createElement('span');
    text.className = 'qs-tile-text';
    el.append(dot, text);

    if (def.kind === 'action' && def.apply) {
      el.addEventListener('click', () => {
        const feedback = def.apply!(this.bridge);
        // 反馈独立成行（不再覆盖磁贴文本）；空反馈不占位
        if (feedback) {
          this.feedback.textContent = feedback;
          this.feedback.hidden = false;
          if (this.feedbackTimer !== null) window.clearTimeout(this.feedbackTimer);
          this.feedbackTimer = window.setTimeout(() => {
            this.feedback.hidden = true;
            this.feedbackTimer = null;
          }, 4000);
        }
        el.classList.add('qs-tile-flash');
        window.setTimeout(() => el.classList.remove('qs-tile-flash'), 420);
        // 动作后立即刷一次只读磁贴（不等下个轮询拍）
        this.refreshTiles();
      });
      // 动作磁贴初始也展示当前值
      text.textContent = def.render ? def.render(this.snapshotSync(def)) : def.label;
    } else {
      text.textContent = def.render ? def.render(this.snapshotSync(def)) : def.label;
      el.disabled = true;
    }
    return el;
  }

  private snapshotSync(def: TileDef): Record<string, string> {
    const out: Record<string, string> = {};
    for (const n of def.valueNames) {
      const v = this.bridge.getVar(n);
      if (v !== null) out[n] = String(v);
    }
    return out;
  }

  private refreshTiles(): void {
    for (const def of TILES) {
      const el = this.root.querySelector<HTMLElement>(`.qs-tile[data-tile-id="${def.id}"]`);
      if (!el || !def.render) continue;
      const text = el.querySelector<HTMLElement>('.qs-tile-text');
      if (text) text.textContent = def.render(this.snapshotSync(def));
    }
  }

  /* ---------------- 轮询（开启时才跑） ---------------- */

  private syncPolling(open: boolean): void {
    if (open && this.pollTimer === null) {
      this.pollTimer = window.setInterval(() => this.refreshTiles(), POLL_MS);
      this.refreshTiles();
    } else if (!open && this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /* ---------------- 动画/手势 ---------------- */

  /** progress(0..1) → 面板位移（1 = 完全展开；0 = 收起于屏外） */
  private syncDom(progress: number): void {
    const pct = Math.round((1 - progress) * 105);
    this.panel.style.transform = `translateY(-${pct}%)`;
    this.panel.style.visibility = progress <= 0.001 ? 'hidden' : 'visible';
    // 拉出条把手跟随轻微放大（展开时隐藏——面板头部接管视觉）
    this.strip.style.opacity = String(Math.max(0, 1 - progress * 3));
  }

  private bindGestures(): void {
    this.strip.addEventListener('pointerdown', (e) => this.onGrabStart(e));
    this.strip.addEventListener('pointermove', (e) => this.onGrabMove(e));
    this.strip.addEventListener('pointerup', (e) => this.onGrabEnd(e));
    this.strip.addEventListener('pointercancel', (e) => this.onGrabEnd(e));
  }

  private onGrabStart(e: PointerEvent): void {
    // 连续打断：在飞中再次抓取 = 从当前 progress 接续（内核语义，无需特殊处理）
    this.dragging = true;
    this.dragStartY = e.clientY;
    this.dragProgressAtStart = this.animator.progress;
    this.recentDy = 0;
    if (this.lease) this.lease.stop();
    this.lease = this.driver.start();
    this.animator.setProgress(this.animator.progress); // 冻结在飞段（cancel 语义）
    try {
      this.strip.setPointerCapture(e.pointerId);
    } catch {
      // 合成事件（探针 dispatchEvent）无活动指针：捕获失败不阻断手势
    }
    e.preventDefault();
  }

  private onGrabMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const dy = e.clientY - this.dragStartY;
    this.recentDy = dy;
    const h = Math.max(1, this.panel.offsetHeight);
    const p = Math.max(0, Math.min(1, this.dragProgressAtStart + dy / h));
    this.animator.setProgress(p); // 跟手（瞬置锚）
    this.syncDom(p);
  }

  private onGrabEnd(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      this.strip.releasePointerCapture(e.pointerId);
    } catch {
      /* 指针已释放：忽略 */
    }
    // 方向投票：过半展开或松手前仍在下拉 → 进；否则出。
    // r20261108 补充：无位移纯点击 = 切换（点击把手即开/关意图——AOSP 顶部下拉
    // 交互惯例；同时使点击路径的自动化断言可预期）。
    const moved = Math.abs(this.recentDy) > 4;
    const p = this.animator.progress;
    const pullDown = this.recentDy > 0;
    if (!moved) {
      if (p >= 0.5) {
        this.animator.out();
      } else {
        this.animator.in();
      }
    } else if (p > 0.5 || (pullDown && p < 1)) {
      this.animator.in();
    } else {
      this.animator.out();
    }
  }

  /** 探针/自动化入口：以动画路径开面板（连续打断语义下幂等） */
  open(): void {
    if (this.lease) this.lease.stop();
    this.lease = this.driver.start();
    this.animator.in();
  }

  close(): void {
    if (this.lease) this.lease.stop();
    this.lease = this.driver.start();
    this.animator.out();
  }

  get isOpen(): boolean {
    return this.animator.progress > 0.999;
  }

  /** 供探针断言：面板是否处于在飞（非 settled） */
  get animating(): boolean {
    return !this.animator.isSettled();
  }
}
