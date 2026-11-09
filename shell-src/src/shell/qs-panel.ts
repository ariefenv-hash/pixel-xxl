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
import {
  TILES,
  TILE_IDS,
  validateTilesAgainstCatalog,
  renderToggleState,
  describeTile,
} from './tiles';
import type { TileDef } from './tiles';
import { resetTileStates, getTileState, toggleTileState } from './tile-states';
import {
  normalizeOrder,
  moveTile,
  gridIndexForPoint,
  getQuickRowTiles,
  orderToDefs,
} from './tile-order';
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
/** 长按磁贴详情阈值（self:：framework ViewConfiguration 惯例值，语料未入库不标 aosp:） */
const LONG_PRESS_MS = 400; // self:
/** 长按取消位移（px，超此值视为滚动意图取消详情） */
const LONG_PRESS_CANCEL_PX = 8; // self:
/** bounce spring 参数（self: 手感值；response 秒 / ζ 阻尼比 / 点击释放初速度） */
const BOUNCE_RESPONSE_S = 0.28;
const BOUNCE_DAMPING_RATIO = 0.55;
const BOUNCE_RELEASE_V = 1.6;
/** 编辑页起拖位移（px，self:——语料无固定阈值，不标 aosp:） */
const EDIT_DRAG_START_PX = 6; // self:
/** 编辑页重排 FLIP 补位动画时长（ms，self:） */
const EDIT_FLIP_MS = 180; // self:

/** 编辑网格几何快照（起拖瞬间定格，拖动中不重测——cellW/H 含 gap 步进） */
interface EditGeom {
  left: number;
  top: number;
  cellW: number;
  cellH: number;
  cols: number;
  count: number;
}

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
  private readonly detailScrim: HTMLElement;
  private readonly detailCard: HTMLElement;
  private readonly detailTitle: HTMLElement;
  private readonly detailStatus: HTMLElement;
  private readonly detailBody: HTMLElement;
  private readonly detailAction: HTMLButtonElement;
  private readonly quickRow: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly editScrim: HTMLElement;
  private readonly editCard: HTMLElement;
  private readonly editGrid: HTMLElement;
  /** 详情卡当前来源磁贴（null = 关闭；长按后同磁贴 click 吞用） */
  private detailOpenFor: HTMLElement | null = null;
  /** 当前磁贴序（编辑页拖动提交；会话级自持与 tile-states 同律，self: §6.4） */
  private order: string[] = [...TILE_IDS];
  /** 编辑页拖动态（null = 未拖动） */
  private editDragEl: HTMLElement | null = null;
  private editDragId: string | null = null;
  private editDragStarted = false;
  private editDragStartX = 0;
  private editDragStartY = 0;
  /** 拖动中的工作序（drop 才提交 this.order——AOSP drop 才落盘语义） */
  private editDragOrder: string[] | null = null;
  /** 指针相对拖动项视觉左上角的抓取偏移（起拖瞬间定格） */
  private editDragOffX = 0;
  private editDragOffY = 0;
  /** 最近指针位（reflow 后重钉拖动项消费） */
  private editLastX = 0;
  private editLastY = 0;
  private editGeom: EditGeom | null = null;
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

    // 通知段（一段：progress 0→0.5 可见；顶部含折叠态磁贴行 = #18 任务 1；
    //         R138 起行成员 = 当前磁贴序前 4 toggle 族，tile-order 动态派生）
    this.notifSection = document.createElement('div');
    this.notifSection.className = 'shade-notif';
    this.quickRow = document.createElement('div');
    this.quickRow.className = 'shade-quick-row';
    this.rebuildQuickRow();
    this.clockText = document.createElement('div');
    this.clockText.className = 'shade-clock';
    this.dateText = document.createElement('div');
    this.dateText.className = 'shade-date';
    this.notifSection.append(this.quickRow, this.clockText, this.dateText, this.buildNotifCards());

    // QS 段（二段：progress 0.5→1.0 渐显，alpha = content-alpha.map 曲线）+
    // 编辑页入口钮（AOSP footer pencil 同构位，self: · #18 对照稿余项 R138）
    this.qsSection = document.createElement('div');
    this.qsSection.className = 'shade-qs';
    this.grid = document.createElement('div');
    this.grid.className = 'qs-grid';
    this.rebuildGrid();
    const editEntry = document.createElement('button');
    editEntry.type = 'button';
    editEntry.className = 'qs-edit-entry';
    editEntry.textContent = '编辑磁贴';
    editEntry.setAttribute('aria-label', '编辑磁贴');
    editEntry.addEventListener('click', () => this.openEditPage());
    this.qsSection.append(this.grid, editEntry);

    // 动作反馈行（r20261108：apply 返回文案改独立显示，4s 淡出）
    this.feedback = document.createElement('div');
    this.feedback.className = 'qs-feedback';
    this.feedback.hidden = true;

    // 长按磁贴详情（#18 对照稿深化项：AOSP tile dialog 同构位，self: 文案）
    this.detailScrim = document.createElement('div');
    this.detailScrim.className = 'qs-detail-scrim';
    this.detailScrim.hidden = true;
    this.detailScrim.addEventListener('click', () => this.closeTileDetail());
    this.detailCard = document.createElement('div');
    this.detailCard.className = 'qs-tile-detail';
    this.detailCard.setAttribute('role', 'dialog');
    this.detailCard.hidden = true;
    this.detailTitle = document.createElement('div');
    this.detailTitle.className = 'qs-detail-title';
    this.detailStatus = document.createElement('div');
    this.detailStatus.className = 'qs-detail-status';
    this.detailBody = document.createElement('div');
    this.detailBody.className = 'qs-detail-body';
    this.detailAction = document.createElement('button');
    this.detailAction.type = 'button';
    this.detailAction.className = 'qs-detail-action';
    this.detailAction.addEventListener('click', () => {
      const def = this.detailActionDef;
      if (!def?.toggle) return;
      toggleTileState(def.id, def.toggle, this.bridge);
      this.refreshToggleTile(def);
      this.syncDetailDom(def); // AOSP dialog 语义：点击开关后对话框保持打开、文案实刷新
    });
    this.detailCard.append(this.detailTitle, this.detailStatus, this.detailBody, this.detailAction);

    // QS 展开编辑页覆层（#18 对照稿余项 · R138，AOSP 编辑页同构位）：
    // scrim + 卡（标题/拖动提示/完成钮 + 磁贴列表整卡拖动重排）。
    // 无「可添加磁贴」池（全部 12 磁贴常驻，只重排不增删，self: 裁剪披露）。
    this.editScrim = document.createElement('div');
    this.editScrim.className = 'qs-edit-scrim';
    this.editScrim.hidden = true;
    this.editScrim.addEventListener('click', () => this.closeEditPage());
    this.editCard = document.createElement('div');
    this.editCard.className = 'qs-edit-card';
    this.editCard.setAttribute('role', 'dialog');
    this.editCard.setAttribute('aria-label', '编辑磁贴');
    this.editCard.hidden = true;
    const editHead = document.createElement('div');
    editHead.className = 'qs-edit-head';
    const editTitle = document.createElement('span');
    editTitle.className = 'qs-edit-title';
    editTitle.textContent = '编辑磁贴';
    const editHint = document.createElement('span');
    editHint.className = 'qs-edit-hint';
    editHint.textContent = '拖动调整顺序';
    const editDone = document.createElement('button');
    editDone.type = 'button';
    editDone.className = 'qs-edit-done';
    editDone.textContent = '完成';
    editDone.setAttribute('aria-label', '完成编辑');
    editDone.addEventListener('click', () => this.closeEditPage());
    editHead.append(editTitle, editHint, editDone);
    this.editGrid = document.createElement('div');
    this.editGrid.className = 'qs-edit-grid';
    this.editCard.append(editHead, this.editGrid);

    this.panel.append(header, this.notifSection, this.qsSection, this.feedback);

    this.strip = document.createElement('div');
    this.strip.className = 'qs-grab-strip';
    this.strip.setAttribute('role', 'button');
    this.strip.setAttribute('aria-label', '下拉打开通知与控制中心');
    const handle = document.createElement('div');
    handle.className = 'qs-handle';
    this.strip.appendChild(handle);

    this.root.append(
      this.scrim,
      this.panel,
      this.strip,
      this.detailScrim,
      this.detailCard,
      this.editScrim,
      this.editCard,
    );

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
    this.refreshTiles(); // 初始态前置（R138：rebuild 通道收口后状态读数直挂 DOM）
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

  /** 详情卡当前磁贴定义（action 钮消费） */
  private detailActionDef: TileDef | null = null;

  private buildTile(def: TileDef, variant: 'grid' | 'mini' = 'grid'): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = variant === 'mini' ? 'qs-tile qs-tile-mini' : 'qs-tile';
    el.dataset.tileId = def.id;
    el.setAttribute('aria-label', def.label);

    const dot = document.createElement('span');
    dot.className = 'qs-tile-dot';
    const text = document.createElement('span');
    text.className = 'qs-tile-text';
    el.append(dot, text);

    if (def.kind === 'toggle' && def.toggle) {
      this.bindLongPress(def, el);
      el.addEventListener('click', () => {
        if (this.detailOpenFor === el) return; // 长按已开详情：吞掉同磁贴尾随 click
        this.onToggleClick(def, el);
      });
      this.refreshToggleTile(def);
    } else if (def.kind === 'action' && def.apply) {
      this.bindLongPress(def, el);
      el.addEventListener('click', () => {
        if (this.detailOpenFor === el) return; // 同上
        const feedback = def.apply!(this.bridge);
        // 反馈独立成行（不再覆盖磁贴文本）；空反馈不占位
        if (feedback) this.showFeedback(feedback);
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
    const before = getTileState(def.id, def.toggle, this.bridge);
    const state = toggleTileState(def.id, def.toggle, this.bridge);
    if (state === 'unavailable') {
      // 不可用反馈（独立反馈行，磁贴态不变，内部态零写入）
      this.showFeedback(`${def.label}：当前不可用（锁屏中）`);
      this.bounce(el);
      return;
    }
    this.refreshToggleTile(def); // 折叠行 + 网格同刷（共享同一状态机）
    if (before !== state) this.bounce(el);
  }

  /** 反馈行（独立行，4s 淡出；多处消费：action 文案 / unavailable 提示） */
  private showFeedback(text: string): void {
    this.feedback.textContent = text;
    this.feedback.hidden = false;
    if (this.feedbackTimer !== null) window.clearTimeout(this.feedbackTimer);
    this.feedbackTimer = window.setTimeout(() => {
      this.feedback.hidden = true;
      this.feedbackTimer = null;
    }, FEEDBACK_MS);
  }

  /** 刷新一个 toggle 磁贴的全部实例（折叠行 + 网格；共享同一状态机） */
  private refreshToggleTile(def: TileDef): void {
    if (!def.toggle) return;
    const state = getTileState(def.id, def.toggle, this.bridge);
    for (const el of this.root.querySelectorAll<HTMLElement>(`.qs-tile[data-tile-id="${def.id}"]`)) {
      el.dataset.state = state;
      const text = el.querySelector<HTMLElement>('.qs-tile-text');
      if (text) text.textContent = renderToggleState(def.label, state);
    }
  }

  /* ---------------- 长按磁贴详情（#18 对照稿深化项 · R137） ---------------- */

  /**
   * 长按 → 详情卡（AOSP tile dialog 同构位）。
   * 时序：pointerdown 起 400ms（self:）计时；up/cancel/位移超阈提前取消；
   * 到时开卡并记录来源磁贴（同磁贴尾随 click 吞用——防快按长按边缘竞态）。
   */
  private bindLongPress(def: TileDef, el: HTMLElement): void {
    let timer: number | null = null;
    let downY = 0;
    const disarm = (): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    el.addEventListener('pointerdown', (e) => {
      disarm();
      downY = e.clientY;
      timer = window.setTimeout(() => {
        timer = null;
        this.detailOpenFor = el;
        this.openTileDetail(def);
      }, LONG_PRESS_MS);
    });
    el.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientY - downY) > LONG_PRESS_CANCEL_PX) disarm();
    });
    el.addEventListener('pointerup', disarm);
    el.addEventListener('pointercancel', disarm);
    el.addEventListener('pointerleave', disarm);
  }

  /** 详情卡 DOM 同步（open 与 action 钮点击后共用；AOSP dialog 点击后保持打开） */
  private syncDetailDom(def: TileDef): void {
    const detail = describeTile(def, (v) => def.render ? def.render(v) : '');
    this.detailTitle.textContent = detail.title;
    this.detailBody.textContent = detail.body;
    this.detailActionDef = def;
    if (def.kind === 'toggle' && def.toggle) {
      const state = getTileState(def.id, def.toggle, this.bridge);
      this.detailStatus.textContent = renderToggleState(def.label, state);
      this.detailAction.hidden = false;
      this.detailAction.textContent = state === 'active' ? '关闭磁贴' : '打开磁贴';
      this.detailAction.disabled = state === 'unavailable';
    } else {
      this.detailStatus.textContent = detail.status || def.label;
      this.detailAction.hidden = true; // action/status 详情只读
    }
  }

  private openTileDetail(def: TileDef): void {
    this.syncDetailDom(def);
    this.detailScrim.hidden = false;
    this.detailCard.hidden = false;
  }

  private closeTileDetail(): void {
    this.detailOpenFor = null;
    this.detailActionDef = null;
    this.detailScrim.hidden = true;
    this.detailCard.hidden = true;
  }

  /* ---------------- QS 展开编辑页（#18 对照稿余项 · R138） ----------------
   * AOSP 编辑页同构位：入口（footer pencil）→ 编辑覆层 → 整卡拖动重排 →
   * drop 提交磁贴序 → 网格/折叠行 rebuild 跟随（QuickQSPanel 语义）。
   * 三态状态机跨 rebuild 保留（tile-states 的 states Map 会话自持，rebuild
   * 只重建 DOM 不动状态）；编辑序会话级不落盘（self: 披露 §6.4）。
   */

  /** 网格 rebuild（当前序；dataset.order = 探针断言锚） */
  private rebuildGrid(): void {
    this.grid.textContent = '';
    this.grid.dataset.order = this.order.join(',');
    for (const def of orderToDefs(this.order, TILES)) this.grid.appendChild(this.buildTile(def));
  }

  /** 折叠行 rebuild（当前序前 4 个 toggle 族；QuickQSPanel 同构语义） */
  private rebuildQuickRow(): void {
    this.quickRow.textContent = '';
    for (const def of getQuickRowTiles(this.order, TILES)) {
      this.quickRow.appendChild(this.buildTile(def, 'mini'));
    }
  }

  /** 编辑列表 rebuild（当前序；整卡拖动重排项，div 无点击语义 = 编辑态不翻转） */
  private rebuildEditList(): void {
    this.editGrid.textContent = '';
    this.editGrid.dataset.order = this.order.join(',');
    for (const def of orderToDefs(this.order, TILES)) {
      const item = document.createElement('div');
      item.className = 'qs-edit-item';
      item.dataset.tileId = def.id;
      item.setAttribute('aria-label', def.label);
      const dot = document.createElement('span');
      dot.className = 'qs-tile-dot';
      const text = document.createElement('span');
      text.className = 'qs-edit-item-text';
      text.textContent = def.label;
      item.append(dot, text);
      this.bindEditDrag(item);
      this.editGrid.appendChild(item);
    }
  }

  /** 重排提交：网格 + 折叠行 + 编辑列表全 rebuild，状态机跨 rebuild 保留 */
  private applyOrder(): void {
    this.rebuildGrid();
    this.rebuildQuickRow();
    this.rebuildEditList();
    this.refreshTiles();
  }

  private openEditPage(): void {
    this.rebuildEditList(); // 与当前序同步（拖动中断的工作序不落地）
    this.editScrim.hidden = false;
    this.editCard.hidden = false;
  }

  private closeEditPage(): void {
    this.editScrim.hidden = true;
    this.editCard.hidden = true;
  }

  /**
   * 编辑列表拖动绑定：pointerdown 记锚 → 位移超 6px（self:）起拖 → 随指跟随 +
   * 目标格 live reflow（FLIP self: 180ms）→ drop 提交工作序（normalizeOrder 兜底）。
   * pointer capture 保证移出项体仍跟手（合成事件捕获失败不阻断——探针惯例）。
   */
  private bindEditDrag(item: HTMLElement): void {
    item.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.editDragEl = item;
      this.editDragId = item.dataset.tileId ?? null;
      this.editDragStarted = false;
      this.editDragOrder = null;
      this.editDragStartX = e.clientX;
      this.editDragStartY = e.clientY;
      this.editLastX = e.clientX;
      this.editLastY = e.clientY;
      const rect = item.getBoundingClientRect(); // 此时无 transform：视觉位 = 布局位
      this.editDragOffX = e.clientX - rect.left;
      this.editDragOffY = e.clientY - rect.top;
      try {
        item.setPointerCapture(e.pointerId);
      } catch {
        /* 合成事件无活动指针：捕获失败不阻断 */
      }
      e.preventDefault();
    });
    item.addEventListener('pointermove', (e) => this.onEditDragMove(e));
    item.addEventListener('pointerup', (e) => this.onEditDragEnd(e));
    item.addEventListener('pointercancel', (e) => this.onEditDragEnd(e));
  }

  private onEditDragMove(e: PointerEvent): void {
    const el = this.editDragEl;
    const id = this.editDragId;
    if (!el || id === null) return;
    this.editLastX = e.clientX;
    this.editLastY = e.clientY;
    if (!this.editDragStarted) {
      if (Math.hypot(e.clientX - this.editDragStartX, e.clientY - this.editDragStartY) < EDIT_DRAG_START_PX) {
        return;
      }
      this.editDragStarted = true;
      this.editDragOrder = [...this.order]; // 工作序：drop 才提交
      el.classList.add('qs-edit-dragging');
      this.snapshotEditGeom();
    }
    this.syncDragTransform();
    const g = this.editGeom;
    if (!g || !this.editDragOrder) return;
    const target = gridIndexForPoint(e.clientX - g.left, e.clientY - g.top, g.cellW, g.cellH, g.cols, g.count);
    const cur = this.editDragOrder.indexOf(id);
    if (target !== cur) {
      this.editDragOrder = moveTile(this.editDragOrder, id, target);
      this.reflowEditGrid();
    }
  }

  private onEditDragEnd(e: PointerEvent): void {
    const el = this.editDragEl;
    if (!el) return;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* 指针已释放：忽略 */
    }
    if (this.editDragStarted && this.editDragOrder && this.editDragId) {
      this.order = normalizeOrder(this.editDragOrder, TILE_IDS); // 兜底规范化
      this.applyOrder(); // rebuild 后拖动项已被重建，拖动态随之清空
    }
    el.classList.remove('qs-edit-dragging');
    el.style.transform = '';
    this.editDragEl = null;
    this.editDragId = null;
    this.editDragStarted = false;
    this.editDragOrder = null;
    this.editGeom = null;
  }

  /** 起拖瞬间几何快照（cellW/H = 格宽高 + gap 步进；列数读 computed grid 轨道） */
  private snapshotEditGeom(): void {
    const g = this.editGrid.getBoundingClientRect();
    const style = getComputedStyle(this.editGrid);
    const gapX = parseFloat(style.columnGap) || 0;
    const gapY = parseFloat(style.rowGap) || 0;
    const first = this.editGrid.querySelector<HTMLElement>('.qs-edit-item');
    const rect = first?.getBoundingClientRect();
    this.editGeom = {
      left: g.left,
      top: g.top,
      cellW: (rect ? rect.width : 0) + gapX,
      cellH: (rect ? rect.height : 0) + gapY,
      cols: style.gridTemplateColumns.split(' ').filter(Boolean).length,
      count: this.editDragOrder?.length ?? 0,
    };
  }

  /**
   * 拖动项视觉位钉到指针：布局位（offsetLeft/Top 不含 transform）+ translate 补差。
   * reflow 重排后布局位变化，必须重钉——否则拖动项视觉跳回原格。
   */
  private syncDragTransform(): void {
    const el = this.editDragEl;
    if (!el) return;
    const g = this.editGrid.getBoundingClientRect();
    const lx = g.left + el.offsetLeft;
    const ly = g.top + el.offsetTop;
    const tx = this.editLastX - this.editDragOffX - lx;
    const ty = this.editLastY - this.editDragOffY - ly;
    el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
  }

  /** 编辑列表 live reflow：按工作序重排 DOM（拖动项 listeners/捕获随元素保留）+ 非拖动项 FLIP 补位 */
  private reflowEditGrid(): void {
    const order = this.editDragOrder ?? this.order;
    const items = new Map<string, HTMLElement>();
    for (const el of Array.from(this.editGrid.children) as HTMLElement[]) {
      const tid = el.dataset.tileId;
      if (tid) items.set(tid, el);
    }
    const firstRects = new Map<string, DOMRect>();
    for (const [tid, el] of items) firstRects.set(tid, el.getBoundingClientRect());
    for (const tid of order) {
      const el = items.get(tid);
      if (el) this.editGrid.appendChild(el);
    }
    this.editGrid.dataset.order = order.join(',');
    for (const [tid, el] of items) {
      if (el === this.editDragEl) continue;
      const a = firstRects.get(tid);
      if (!a) continue;
      const b = el.getBoundingClientRect();
      const ddx = a.left - b.left;
      const ddy = a.top - b.top;
      if (Math.abs(ddx) < 1 && Math.abs(ddy) < 1) continue;
      el.style.transition = 'none';
      el.style.transform = `translate(${ddx.toFixed(1)}px, ${ddy.toFixed(1)}px)`;
      void el.offsetWidth; // 强制 reflow：invert 态生效后再 play
      el.style.transition = `transform ${EDIT_FLIP_MS}ms var(--px-ease-emphasized)`;
      el.style.transform = '';
      const cleanup = (): void => {
        el.style.transition = '';
        el.removeEventListener('transitionend', cleanup);
      };
      el.addEventListener('transitionend', cleanup);
      window.setTimeout(cleanup, EDIT_FLIP_MS + 60);
    }
    if (this.editDragEl) this.syncDragTransform(); // 布局位变化：重钉到指针
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
      if (def.kind === 'toggle' && def.toggle) {
        this.refreshToggleTile(def); // 全实例刷（折叠行 + 网格）
        continue;
      }
      const el = this.root.querySelector<HTMLElement>(`.qs-tile[data-tile-id="${def.id}"]`);
      if (!el) continue;
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

    // 面板位移（两段 shade 位移模型 · R137 修正）：p≤0.5 为滑入段（0.5 时恰好
    // 全落贴顶），p>0.5 保持贴顶不动、仅内容过渡（通知淡出/QS 淡入）——
    // AOSP 一段 shade = 通知面板贴顶全量可见。
    // #31 即修即录（探针 D7 外视口实测发现）：R136 恒定位移 translateY(-(1-p)*105)
    // 在一段时露出的是面板**底部**（QS 尾部），通知段/clock/折叠行从未入视口
    // （notifFade 淡出窗 [0.5→0.72] 与内容入视口窗错开，clock 实际不可见）。
    const slide = Math.min(1, progress * 2);
    const pct = Math.round((1 - slide) * 105);
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

  /**
   * 探针/自动化专用：瞬置展开分数（setProgress + syncDom，不动轮询租约）。
   * 消费面：D 场景折叠行交互（折叠行随通知段 notifFade 曲线，一段才可见——
   * AOSP 语义；探针需先拉回一段再点折叠行磁贴）。非交互入口，不供业务调用。
   */
  setProgressForProbe(progress: number): void {
    const p = Math.max(0, Math.min(1, progress));
    this.animator.setProgress(p);
    this.syncDom(p);
  }
}
