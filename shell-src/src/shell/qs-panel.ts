/**
 * shell/qs-panel.ts — 控制中心 / 通知 shade 面板（L2 首批 · #18）
 *
 * 两段 shade 模型（#18 任务 4「下拉一段=通知、二段=QS」）+ SPEC token 曲线：
 *   progress 0→1 = shade 展开全程（drag 跟手与程序动画共用同一 syncDom）；
 *   - scrim（全屏黑遮罩）alpha = motion.shade.scrim-alpha.map
 *     （输入 [0→0.5] 映射 → interpolateEaseInOut，aosp:ShadeInterpolation.kt 原样）；
 *   - QS 段 alpha = motion.shade.content-alpha.map（输入 [0.3→1.0]，<0.3 全透明
 *     → 通知段期间 QS 网格自然不可见，两段过渡即语料曲线本身）；
 *   - header 副标题淡出门槛 = motion.qs.percent-displacement-at-fade-out（0.1066，
 *     drag 跟手消费；motion.qs.fade-* 帧锚 14/58 为 60fps 时间轴锚点，与本面板
 *     IIO 320/260ms 时间轴不匹配，token 常量已暴露留 L3 Header 过渡轮消费，
 *     不硬套——docs/SHELL.md §6 披露）。
 *
 * 动画内核 = vendored md3 InterruptibleInOutAnimator（Launcher3 连续打断 1:1）：
 *   - 反向触发从当前 progress 接续（不先 end 再 start）——快速连拉/连推不丢动画；
 *   - setProgress 瞬置 = 手指跟随之锚（cancel 语义）。
 * tile-bounce = vendored md3 Spring（解析闭式解），收敛阈值消费
 *   motion.spring.min-visible.scale（1/500）；spring 参数为壳层手感值（self: 登记
 *   docs/SHELL.md——SPEC 附注二留空项 SpringForce 劲度/阻尼语料未入库不编造）。
 * 宿主唯一 rAF：createFrameDriver 租约制（并行动画宿主面，与 md3 同律）。
 *
 * 通知段内容（self: 壳层演示语义）：时钟大字 + 日期 + 前台/锁屏只读卡 +
 * 「通知 0 条」占位卡（工程内无通知子系统——#18 现状口径；L3 轮接通知面）。
 */
import { createFrameDriver, InterruptibleInOutAnimator, Spring, makeSpringParams } from '../motion';
// vendored AOSP 插值器（_MD3_ 内核直引；Easing.emphasized 同族曲线）
// @ts-ignore —— vendored JS
import { EMPHASIZED } from '../motion/md3/aosp/interpolators.js';
import type { VMBridge } from '../bridge/runtime';
import { TILES, validateTilesAgainstCatalog, renderToggleState } from './tiles';
import type { TileDef } from './tiles';
import { resetTileStates, getTileState, toggleTileState } from './tile-states';
import {
  getNotificationScrimAlpha,
  getShadeContentAlpha,
  QS_PERCENT_DISPLACEMENT_AT_FADE_OUT,
  SPRING_MIN_VISIBLE_SCALE,
} from './shade-tokens';

/* ---------- 壳层时长/尺寸账目（self: 值——SPEC 无对应 token，登记 docs/SHELL.md） ---------- */
const PANEL_IN_MS = 320; // self: 面板展开时长（IIO 内核 in）
const PANEL_OUT_MS = 260; // self: 面板收起时长（IIO 内核 out）
/** 轮询周期（面板开启时刷新只读值；关闭即停——零空闲成本纪律） */
const POLL_MS = 500; // self:
/** 拉出条高度（CSS 同值；手势判定用） */
export const GRAB_STRIP_H = 28; // self:
/** 动作反馈行淡出延时 */
const FEEDBACK_MS = 4000; // self:
/** bounce spring 参数（self: 手感值；response 秒 / ζ 阻尼比 / 点击释放初速度） */
const BOUNCE_RESPONSE_S = 0.28;
const BOUNCE_DAMPING_RATIO = 0.55;
const BOUNCE_RELEASE_V = 1.6;

export class QsPanel {
  private readonly bridge: VMBridge;
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly scrim: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly notifSection: HTMLElement;
  private readonly qsSection: HTMLElement;
  private readonly headerTitle: HTMLElement;
  private readonly headerSource: HTMLElement;
  private readonly clockText: HTMLElement;
  private readonly dateText: HTMLElement;
  private readonly animator: InterruptibleInOutAnimator;
  private readonly driver = createFrameDriver();
  private lease: { stop(): void } | null = null;
  private pollTimer: number | null = null;
  private feedbackTimer: number | null = null;
  private clockTimer: number | null = null;
  /** bounce 弹簧（当前弹跳中的磁贴；单实例即可——同刻只有一次新按压） */
  private bounceSpring: Spring | null = null;
  private bounceEl: HTMLElement | null = null;
  private bounceLease: { stop(): void } | null = null;
  /**
   * bounce 控制器（driver tick 回调：推进弹簧 → 应用 transform → 收敛复位）。
   * 收敛判定 = motion.spring.min-visible.scale（1/500，DynamicAnimation 语义：
   * 低于该变化量视为不可见即结束）。
   */
  private readonly bounceController = {
    update: (dt: number): void => {
      const s = this.bounceSpring;
      const el = this.bounceEl;
      if (!s || !el) return;
      s.update(dt);
      el.style.transform = `scale(${Math.max(0.6, s.x).toFixed(4)})`;
      if (s.isSettled(SPRING_MIN_VISIBLE_SCALE)) {
        s.x = 1;
        s.v = 0;
        el.style.transform = '';
        el.classList.remove('qs-tile-bouncing');
        if (this.bounceLease) {
          this.bounceLease.stop();
          this.bounceLease = null;
        }
        this.bounceEl = null;
      }
    },
  };
  /** 手势态：跟随手指中 */
  private dragging = false;
  private dragStartY = 0;
  private dragProgressAtStart = 0;
  private recentDy = 0;

  constructor(bridge: VMBridge, root: HTMLElement) {
    this.bridge = bridge;
    this.root = root;

    validateTilesAgainstCatalog();
    resetTileStates(); // 壳层自持态从零开始（工程 reload 不残留旧态）

    // ---- DOM 组装（全部壳层自有，零侵入 iframe 文档） ----
    this.scrim = document.createElement('div');
    this.scrim.className = 'shade-scrim';
    this.scrim.setAttribute('aria-hidden', 'true');

    this.panel = document.createElement('div');
    this.panel.className = 'qs-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', '通知与控制中心');

    // header：主标题随段切换（通知 ↔ 控制中心），副标题 0.1066 位移门槛淡出
    const header = document.createElement('div');
    header.className = 'qs-header';
    this.headerTitle = document.createElement('span');
    this.headerTitle.textContent = '通知';
    this.headerSource = document.createElement('span');
    this.headerSource.className = 'qs-source';
    this.headerSource.textContent = 'DOM 壳层 · 桥接 TurboWarp 运行时';
    header.append(this.headerTitle, this.headerSource);

    // 通知段（一段：progress 0→0.5 可见）
    this.notifSection = document.createElement('div');
    this.notifSection.className = 'shade-notif';
    this.clockText = document.createElement('div');
    this.clockText.className = 'shade-clock';
    this.dateText = document.createElement('div');
    this.dateText.className = 'shade-date';
    this.notifSection.append(this.clockText, this.dateText, this.buildNotifCards());

    // QS 段（二段：progress 0.5→1.0 渐显，alpha = content-alpha.map 曲线）
    this.qsSection = document.createElement('div');
    this.qsSection.className = 'shade-qs';
    const grid = document.createElement('div');
    grid.className = 'qs-grid';
    for (const tile of TILES) grid.appendChild(this.buildTile(tile));
    this.qsSection.appendChild(grid);

    // 动作反馈行（r20261108：apply 返回文案改独立显示，4s 淡出）
    this.feedback = document.createElement('div');
    this.feedback.className = 'qs-feedback';
    this.feedback.hidden = true;

    this.panel.append(header, this.notifSection, this.qsSection, this.feedback);

    this.strip = document.createElement('div');
    this.strip.className = 'qs-grab-strip';
    this.strip.setAttribute('role', 'button');
    this.strip.setAttribute('aria-label', '下拉打开通知与控制中心');
    const handle = document.createElement('div');
    handle.className = 'qs-handle';
    this.strip.appendChild(handle);

    this.root.append(this.scrim, this.panel, this.strip);

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

  /* ---------------- 通知段卡片 ---------------- */

  private buildNotifCards(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'shade-notif-cards';

    const placeholder = document.createElement('div');
    placeholder.className = 'shade-notif-card';
    const t = document.createElement('span');
    t.textContent = '通知 · 0 条';
    const s = document.createElement('span');
    s.className = 'shade-notif-card-sub';
    s.textContent = '工程内无通知子系统（#18 现状口径）——壳层占位';
    placeholder.append(t, s);
    wrap.appendChild(placeholder);

    // 前台/锁屏只读状态卡（复用工程变量只读通道）
    const status = document.createElement('div');
    status.className = 'shade-notif-card shade-notif-status';
    wrap.appendChild(status);
    this.notifStatusEl = status;
    return wrap;
  }

  private notifStatusEl: HTMLElement | null = null;

  private refreshNotifStatus(): void {
    if (!this.notifStatusEl) return;
    const app = this.bridge.getVar('当前打开应用');
    const drawer = this.bridge.getVar('All Apps open？');
    const locked = this.bridge.getVar('锁屏');
    const where = app ? `应用 · ${String(app)}` : drawer === '1' ? 'All Apps' : '桌面';
    this.notifStatusEl.textContent = `前台 ${where} · ${locked === '1' ? '锁屏中' : '已解锁'}`;
  }

  private refreshClock(): void {
    const d = new Date();
    this.clockText.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    this.dateText.textContent = `${d.getMonth() + 1}月${d.getDate()}日 周${'日一二三四五六'[d.getDay()]}`;
  }

  /* ---------------- 磁贴 ---------------- */

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

    if (def.kind === 'toggle' && def.toggle) {
      el.addEventListener('click', () => this.onToggleClick(def, el));
      this.refreshToggleTile(def, el);
    } else if (def.kind === 'action' && def.apply) {
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
          }, FEEDBACK_MS);
        }
        this.bounce(el);
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

  private onToggleClick(def: TileDef, el: HTMLElement): void {
    if (!def.toggle) return;
    const before = el.dataset.state;
    const state = toggleTileState(def.id, def.toggle, this.bridge);
    if (state === 'unavailable') {
      // 不可用反馈（独立反馈行，磁贴态不变）
      this.feedback.textContent = `${def.label}：当前不可用（锁屏中）`;
      this.feedback.hidden = false;
      if (this.feedbackTimer !== null) window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = window.setTimeout(() => {
        this.feedback.hidden = true;
        this.feedbackTimer = null;
      }, FEEDBACK_MS);
      this.bounce(el);
      return;
    }
    this.refreshToggleTile(def, el);
    if (before !== state) this.bounce(el);
  }

  private refreshToggleTile(def: TileDef, el: HTMLElement): void {
    if (!def.toggle) return;
    const state = getTileState(def.id, def.toggle, this.bridge);
    el.dataset.state = state;
    const text = el.querySelector<HTMLElement>('.qs-tile-text');
    if (text) text.textContent = renderToggleState(def.label, state);
  }

  /** tile-bounce（按压反馈）：vendored Spring 解析闭式解，收敛阈值 = min-visible.scale */
  private bounce(el: HTMLElement): void {
    // 单实例复用：新按压直接接管同一弹簧（连续快按不叠租约）；控制器只注册一次
    if (!this.bounceSpring) {
      this.bounceSpring = new Spring({
        ...makeSpringParams(BOUNCE_RESPONSE_S, BOUNCE_DAMPING_RATIO, 1),
        initialValue: 1,
        initialVelocity: 0,
      });
      this.driver.add(this.bounceController);
    }
    if (this.bounceLease) this.bounceLease.stop();
    el.classList.add('qs-tile-bouncing'); // 禁 CSS transition（spring 全权接管 transform）
    this.bounceEl = el;
    const s = this.bounceSpring;
    // 从静止弹起：squash 起点释放（self: 下探幅度）；在飞中再按 = 注入释放速度
    if (s.x >= 0.999) {
      s.x = 0.92;
      s.v = 0;
    } else {
      s.v = BOUNCE_RELEASE_V;
    }
    s.setTarget(1, s.v);
    this.bounceLease = this.driver.start();
  }

  /* ---------------- 快照/轮询 ---------------- */

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
      if (!el) continue;
      if (def.kind === 'toggle' && def.toggle) {
        this.refreshToggleTile(def, el);
        continue;
      }
      if (!def.render) continue;
      const text = el.querySelector<HTMLElement>('.qs-tile-text');
      if (text) text.textContent = def.render(this.snapshotSync(def));
    }
    this.refreshNotifStatus();
    this.refreshClock();
  }

  /* ---------------- 轮询（开启时才跑） ---------------- */

  private syncPolling(open: boolean): void {
    if (open && this.pollTimer === null) {
      this.pollTimer = window.setInterval(() => this.refreshTiles(), POLL_MS);
      this.refreshTiles();
      // 通知段时钟（1s 拍；面板关闭时走同一停表纪律）
      if (this.clockTimer === null) {
        this.clockTimer = window.setInterval(() => this.refreshClock(), 1000);
      }
    } else if (!open && this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
      if (this.clockTimer !== null) {
        window.clearInterval(this.clockTimer);
        this.clockTimer = null;
      }
    }
  }

  /* ---------------- shade 同步（progress 单源） ---------------- */

  /** 通知段淡出曲线（self: 线性 [0.5→0.72] 淡出，登记 docs/SHELL.md——SPEC 无对应 token） */
  private static notifFade(progress: number): number {
    if (progress <= 0.5) return 1;
    if (progress >= 0.72) return 0;
    return 1 - (progress - 0.5) / 0.22;
  }

  /** progress(0..1) → shade 全量同步：scrim / 通知段 / QS 段 / header */
  private syncDom(progress: number): void {
    // scrim：motion.shade.scrim-alpha.map（语料原样：返回系数直接作 alpha）
    this.scrim.style.opacity = String(getNotificationScrimAlpha(progress));
    this.scrim.style.visibility = progress <= 0.001 ? 'hidden' : 'visible';

    // 面板位移（1 = 完全展开；0 = 收起于屏外）
    const pct = Math.round((1 - progress) * 105);
    this.panel.style.transform = `translateY(-${pct}%)`;
    this.panel.style.visibility = progress <= 0.001 ? 'hidden' : 'visible';

    // QS 段：motion.shade.content-alpha.map（<0.3 全透明——通知段期间 QS 自然隐藏）
    const contentAlpha = getShadeContentAlpha(progress);
    this.qsSection.style.opacity = String(contentAlpha);
    this.qsSection.style.pointerEvents = contentAlpha > 0.5 ? 'auto' : 'none';

    // 通知段：一段全量，二段 [0.5→0.72] 线性淡出+上移（self: 曲线）
    const notifAlpha = QsPanel.notifFade(progress);
    this.notifSection.style.opacity = String(notifAlpha);
    this.notifSection.style.transform = `translateY(${(-notifAlpha * 24).toFixed(1)}px)`;
    this.notifSection.style.visibility = notifAlpha <= 0.001 ? 'hidden' : 'visible';
    this.notifSection.style.pointerEvents = notifAlpha > 0.5 ? 'auto' : 'none';

    // header：主标题随段切换；副标题 0.1066 位移门槛淡出（motion.qs.percent-displacement-at-fade-out）
    const seg = progress >= 0.5 ? '控制中心' : '通知';
    if (this.headerTitle.textContent !== seg) this.headerTitle.textContent = seg;
    // fade-out 门槛：p ≤ 0.1066 全显，p ∈ (0.1066 → 0.24] 线性淡出至 0
    const gate = QS_PERCENT_DISPLACEMENT_AT_FADE_OUT;
    const srcAlpha = progress <= gate ? 1 : Math.max(0, 1 - (progress - gate) / (0.24 - gate));
    this.headerSource.style.opacity = String(srcAlpha);

    // 拉出条把手随展开渐隐（展开后面板头部接管视觉）
    this.strip.style.opacity = String(Math.max(0, 1 - progress * 3));
  }

  /* ---------------- 手势 ---------------- */

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
    // 无位移纯点击 = 切换（点击把手即开/关意图——AOSP 顶部下拉交互惯例）。
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

  /* ---------------- 探针/自动化入口 ---------------- */

  /** 以动画路径开面板（连续打断语义下幂等） */
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
