/**
 * fast-face.ts — Shell 快速启动面（#23 fast-path Phase 1 · v1.21）
 *
 * 用户定锚（2026-11-13）：迁移根本目的 = 取消 Scratch 转换来的过长初始化时间
 * （即便有下载缓存，每次重建仍要重新初始化 VM）。本模块让壳层第一帧就渲染
 * DOM 快速面（壁纸渐变 + DOM 时钟 + 开机光点），iframe 里的 VM boot 链
 * 全程被遮蔽在后台；readyForAttach() 就绪后由 main.ts 调 dismiss() 交叉淡出。
 *
 * 设计纪律：
 *  - 零 VM 依赖（不 import bridge；不读 runtime）——VM 未就绪也必须完整可渲染；
 *  - 纯逻辑（clockFace/isFastFaceEnabled/nextPhase）与 DOM 装配（createFastFace）分层，
 *    前者 vitest 契约覆盖，后者由 scripts/shell-probe.py 冒烟；
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

/** 快速面状态机（active → dismissing → dismissed；dismiss 幂等） */
export type FastFacePhase = 'active' | 'dismissing' | 'dismissed';

export function nextPhase(phase: FastFacePhase, event: 'dismiss' | 'fade-done'): FastFacePhase | null {
  if (event === 'dismiss') {
    if (phase === 'active') return 'dismissing';
    return phase; // dismissing/dismissed：幂等锚（重复 dismiss 原地）
  }
  // fade-done：仅 dismissing → dismissed 合法；active（未开始淡出）收到 = 非法迁移，
  // 返回 null fail loud（调用方不静默吞——对齐 attach 漂移 fail loud 纪律）
  if (phase === 'dismissing') return 'dismissed';
  if (phase === 'dismissed') return 'dismissed';
  return null;
}

/** 淡出时长（ms）——与 CSS #fast-face transition 480ms 一致；探针等待窗 = 此值 + 余量 */
export const FAST_FACE_FADE_MS = 480;

/**
 * DOM 装配：创建快速面并挂到指定容器。
 * 结构（class 全部带 ff- 前缀，根 id=fast-face，避免与壳层/根入口任何 id 碰撞）：
 *   #fast-face（fixed 全屏覆盖层，z-index 高于 iframe）
 *     ├─ .ff-wall（CSS 渐变壁纸层）
 *     ├─ .ff-clock（HH:MM 大字）
 *     ├─ .ff-date（日期行）
 *     └─ .ff-boot（底部小字：后台初始化提示 + 光点脉冲）
 *
 * @param root 挂载容器（shell 层 body 直下）
 * @param opts.now 时钟注入（测试用）；opts.tickMs 时钟节拍（默认 1000）
 */
export interface FastFaceHandle {
  el: HTMLElement;
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
  el.innerHTML = [
    '<div class="ff-wall" aria-hidden="true"></div>',
    '<div class="ff-clock" role="timer"></div>',
    '<div class="ff-date"></div>',
    '<div class="ff-boot"><span class="ff-dot"></span>Pixel XXL · 正在后台初始化运行时</div>',
  ].join('');

  const clockEl = el.querySelector<HTMLElement>('.ff-clock')!;
  const dateEl = el.querySelector<HTMLElement>('.ff-date')!;
  const render = (): void => {
    const f = clockFace(now());
    clockEl.textContent = f.hhmm;
    dateEl.textContent = f.date;
  };
  render();
  const timer = window.setInterval(render, opts.tickMs ?? 1000);
  root.appendChild(el);

  let phase: FastFacePhase = 'active';
  const finish = (): void => {
    const next = nextPhase(phase, 'fade-done');
    if (next === null) {
      console.error('[fast-face] 非法状态迁移：active 收到 fade-done（dismiss 未先行）');
      return;
    }
    phase = next;
    el.remove();
  };

  return {
    el,
    dismiss(): void {
      const next = nextPhase(phase, 'dismiss');
      if (next === null) return;
      phase = next;
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
      phase = 'dismissed';
    },
  };
}
