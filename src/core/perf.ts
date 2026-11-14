/**
 * perf.ts — 首屏预算探针（内置，随包发布）
 *
 * 为什么要在运行时留探针：性能预算必须是「可测量」的，否则退化无人发现。
 * 这里只做两件事：
 *   1. 记录关键节点（HTML 解析完成 / 外壳绑定完成 / 首帧 / 桌面可交互）；
 *   2. 超预算时在控制台显式 warn（不阻断用户，不抛错）。
 *
 * 预算（#35 验收口径 · 中端机 4G 冷启）：
 *   desktop-visible  < 1500ms
 *   interactive      < 1000ms
 */

export interface PerfSnapshot {
  dcl: number;
  shellReady: number;
  interactive: number;
  fcp: number;
  longTasks: number;
  maxTask: number;
}

const BUDGET = { interactive: 1000, desktopVisible: 1500 };

const marks = new Map<string, number>();
let longTasks = 0;
let maxTask = 0;

export function mark(name: string): number {
  const t = performance.now();
  marks.set(name, t);
  try {
    performance.mark(name);
  } catch {
    /* 老浏览器无 mark：忽略 */
  }
  return t;
}

export function get(name: string): number {
  return marks.get(name) ?? 0;
}

/** 长任务观测：>50ms 的任务会掉帧，桌面手势尤其敏感 */
export function watchLongTasks(): void {
  if (!('PerformanceObserver' in window)) return;
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks += 1;
        maxTask = Math.max(maxTask, entry.duration);
      }
    });
    obs.observe({ entryTypes: ['longtask'] });
  } catch {
    /* 不支持 longtask 的浏览器：静默 */
  }
}

function firstContentfulPaint(): number {
  let fcp = 0;
  try {
    for (const e of performance.getEntriesByType('paint')) {
      if (e.name === 'first-contentful-paint') fcp = e.startTime;
    }
  } catch {
    /* ignore */
  }
  return Math.round(fcp);
}

export function snapshot(): PerfSnapshot {
  return {
    dcl: Math.round(get('dcl')),
    shellReady: Math.round(get('shell-ready')),
    interactive: Math.round(get('interactive')),
    fcp: firstContentfulPaint(),
    longTasks,
    maxTask: Math.round(maxTask),
  };
}

/** 预算判定：返回违例清单（空数组 = 全过） */
export function audit(): string[] {
  const s = snapshot();
  const fails: string[] = [];
  if (s.interactive > BUDGET.interactive) {
    fails.push(`interactive ${s.interactive}ms > ${BUDGET.interactive}ms`);
  }
  if (s.fcp > BUDGET.desktopVisible) {
    fails.push(`fcp ${s.fcp}ms > ${BUDGET.desktopVisible}ms`);
  }
  return fails;
}

export function reportToConsole(): void {
  const s = snapshot();
  const fails = audit();
  const tag = fails.length ? 'warn' : 'info';
  // eslint-disable-next-line no-console
  console[tag](
    `[perf] fcp=${s.fcp}ms dcl=${s.dcl}ms shell=${s.shellReady}ms interactive=${s.interactive}ms ` +
      `longTasks=${s.longTasks} max=${s.maxTask}ms` +
      (fails.length ? `\n  超预算: ${fails.join(' / ')}` : '')
  );
  (window as Window & { __perf?: unknown }).__perf = { ...s, fails, budget: BUDGET };
}
