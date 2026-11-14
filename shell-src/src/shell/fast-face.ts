/**
 * fast-face.ts — Shell 快速启动面（#23 fast-path Phase 1 · v1.21；Phase 2 扩展 · v1.23）
 *
 * 用户定锚（2026-11-13）：迁移根本目的 = 取消 Scratch 转换来的过长初始化时间
 * （即便有下载缓存，每次重建仍要重新初始化 VM）。本模块让壳层第一帧就渲染
 * DOM 快速面（壁纸渐变 + DOM 时钟 + 进度文案），iframe 里的 VM boot 链
 * 全程被遮蔽在后台。
 *
 * Phase 2 扩展（#33 · v1.23，伴随遮蔽）：
 *  - handover 时点修正：attach ≠ 桌面可用（v1.21 缺陷——attach 后立即淡出，
 *    用户看到的是绿旗屏/黑反馈层）。新状态机 active →（attach）→ companion
 *    →（handover 判定命中）→ dismissing → dismissed：伴随态继续遮蔽空窗，
 *    由 main.ts 按镜像 v1.06 五通道的判定调 dismiss；
 *  - 实时进度：.ff-boot 文案 + .ff-bar 细进度条接双数据源（装载段 __packState /
 *    渲染段「渲染的进度/渲染数」，全部只读，boot-progress.ts 纯函数供文案）；
 *  - data-phase 外显（探针断言锚）。
 *
 * 设计纪律：
 *  - 零 VM 依赖（不 import bridge；不读 runtime）——VM 未就绪也必须完整可渲染；
 *  - 纯逻辑（clockFace/isFastFaceEnabled/nextPhase）与 DOM 装配（createFastFace）分层，
 *    前者 vitest 契约覆盖，后者由 scripts/shell-verify.py 冒烟；
 *  - 淡出 CSS transition 驱动（480ms emphasized 曲线，prefers-reduced-motion 降级）；
 *  - ?fast=0 关断（回归/对照通道），默认启用。
 */

/** 关断参数名（?fast=0 时整个快速面不创建，回退 v1.20 直接看 iframe boot 链） */
export const FAST_FACE_DISABLE_PARAM = 'fast';

/** 时钟面纯数据（24h 制，两位补零；AOSP deskclock 默认口径） */
export interface ClockFace {
  /** HH:MM（24h 制，两位补零） */
  hhmm: string;
  /** 日期行（n月n日 周x） */
  date: string;
}

/** 星期中文表（AOSP zh-CN 系统地区格式对齐） */
const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 纯函数：Date → 时钟面（测试可注入任意时刻，含跨日/单位数分钟） */
export function clockFace(now: Date): ClockFace {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hhmm: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    date: `${now.getMonth() + 1}月${now.getDate()}日 ${WEEK_CN[now.getDay()]}`,
  };
}

/**
 * 纯函数：URL 查询串 → 快速面是否启用。
 * 仅 `fast=0`（大小写不敏感）关断；fast=1/无参数/其他值均启用（默认开）。
 */
export function isFastFaceEnabled(search: string): boolean {
  const m = /[?&]fast=([^&]*)/.exec(search);
  return !(m && decodeURIComponent(m[1]).trim().toLowerCase() === '0');
}

/**
 * 快速面状态机（v1.23 扩展）：
 *   active ──attach──> companion ──dismiss──> dismissing ──fade-done──> dismissed
 *   active ──dismiss───────────────┘（直通降级：attach 前收 handover 判定/destroy）
 * 幂等：重复 attach/dismiss 原地；非法迁移返回 null fail loud（fade-done 未先行 dismiss）。
 */
export type FastFacePhase = 'active' | 'companion' | 'dismissing' | 'dismissed';

export type FastFaceEvent = 'attach' | 'dismiss' | 'fade-done';

export function nextPhase(phase: FastFacePhase, event: FastFaceEvent): FastFacePhase | null {
  switch (event) {
    case 'attach':
      if (phase === 'active') return 'companion';
      return phase; // companion/dismissing/dismissed：幂等锚（重复 attach 原地）
    case 'dismiss':
      if (phase === 'active' || phase === 'companion') return 'dismissing';
      return phase; // dismissing/dismissed：幂等
    // fade-done：仅 dismissing → dismissed 合法；未开始淡出收到 = 非法迁移，
    // 返回 null fail loud（调用方不静默吞——对齐 attach 漂移 fail loud 纪律）
    case 'fade-done':
      if (phase === 'dismissing') return 'dismissed';
      if (phase === 'dismissed') return 'dismissed';
      return null;
  }
}

/** 淡出时长（ms）——与 CSS #fast-face transition 480ms 一致；探针等待窗 = 此值 + 余量 */
export const FAST_FACE_FADE_MS = 480;

/**
 * DOM 装配：创建快速面并挂到指定容器。
 * 结构（class 全部带 ff- 前缀，根 id=fast-face，避免与壳层/根入口任何 id 碰撞）：
 *   #fast-face（fixed 全屏覆盖层，z-index 高于 iframe，data-phase 外显探针锚）
 *     ├─ .ff-wall（CSS 渐变壁纸层）
 *     ├─ .ff-clock（HH:MM 大字）
 *     ├─ .ff-date（日期行）
 *     ├─ .ff-bar（细进度条，companion 渲染段驱动；未知进度时半透明占位）
 *     └─ .ff-boot（底部小字：实时进度文案 + 光点脉冲）
 *
 * @param root 挂载容器（shell 层 body 直下）
 * @param opts.now 时钟注入（测试用）；opts.tickMs 时钟节拍（默认 1000）
 */
export interface FastFaceHandle {
  el: HTMLElement;
  /** 进入伴随态（attach 成功后；幂等）——不再淡出，等 handover 判定 */
  enterCompanion(): void;
  /** 更新进度文案与进度条（pct=null 时进度条回到不定态） */
  setBootProgress(text: string, pct?: number | null): void;
  /** 当前阶段（探针/主流程判定消费） */
  getPhase(): FastFacePhase;
  /** 开始淡出（幂等；重复调用无副作用）；动画结束自动从 DOM 移除并 clearInterval */
  dismiss(): void;
  /** 是否已彻底离场（fade 完成且 DOM 已移除） */
  isDismissed(): boolean;
  /** 手动销毁（测试清理） */
  destroy(): void;
}

export function createFastFace(
  root: HTMLElement,
  opts: { now?: () => Date; tickMs?: number } = {},
): FastFaceHandle {
  const now = opts.now ?? (() => new Date());
  const el = document.createElement('div');
  el.id = 'fast-face';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.phase = 'active';
  el.innerHTML = [
    '<div class="ff-wall" aria-hidden="true"></div>',
    '<div class="ff-clock" role="timer"></div>',
    '<div class="ff-date"></div>',
    '<div class="ff-bar" aria-hidden="true"><div class="ff-bar-fill"></div></div>',
    '<div class="ff-boot"><span class="ff-dot"></span><span class="ff-boot-text">正在准备素材…</span></div>',
  ].join('');

  const clockEl = el.querySelector<HTMLElement>('.ff-clock')!;
  const dateEl = el.querySelector<HTMLElement>('.ff-date')!;
  const barFillEl = el.querySelector<HTMLElement>('.ff-bar-fill')!;
  const bootTextEl = el.querySelector<HTMLElement>('.ff-boot-text')!;
  const render = (): void => {
    const f = clockFace(now());
    clockEl.textContent = f.hhmm;
    dateEl.textContent = f.date;
  };
  render();
  const timer = window.setInterval(render, opts.tickMs ?? 1000);
  root.appendChild(el);

  let phase: FastFacePhase = 'active';
  const setPhase = (next: FastFacePhase): void => {
    phase = next;
    el.dataset.phase = next;
  };
  const finish = (): void => {
    const next = nextPhase(phase, 'fade-done');
    if (next === null) {
      console.error('[fast-face] 非法状态迁移：未 dismiss 先收到 fade-done');
      return;
    }
    setPhase(next);
    el.remove();
  };

  return {
    el,
    enterCompanion(): void {
      const next = nextPhase(phase, 'attach');
      if (next === null) return; // 不可达（attach 幂等不返回 null）；防御性短路
      setPhase(next);
    },
    setBootProgress(text: string, pct?: number | null): void {
      if (bootTextEl.textContent !== text) bootTextEl.textContent = text;
      const v = pct == null || !Number.isFinite(pct) ? null : Math.max(0, Math.min(100, pct));
      barFillEl.style.width = v == null ? '0%' : `${v}%`;
    },
    getPhase(): FastFacePhase {
      return phase;
    },
    dismiss(): void {
      const next = nextPhase(phase, 'dismiss');
      if (next === null) return;
      setPhase(next);
      window.clearInterval(timer);
      el.classList.add('ff-out');
      // CSS transition 驱动淡出；transitionend 主通道 + 定时兜底（探针环境禁动画时靠定时）
      el.addEventListener('transitionend', finish, { once: true });
      window.setTimeout(finish, FAST_FACE_FADE_MS + 80);
    },
    isDismissed(): boolean {
      return phase === 'dismissed';
    },
    destroy(): void {
      window.clearInterval(timer);
      el.remove();
      setPhase('dismissed');
    },
  };
}
