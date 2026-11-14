/** dom.ts — 极小的 DOM 工具集（替代框架） */

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T =>
  root.querySelector(sel) as T;

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll(sel)) as T[];

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

export const clamp = (v: number, min = 0, max = 1): number => (v < min ? min : v > max ? max : v);

/** 只保留最后一次调用的 rAF 节流（手势/滚动用） */
export function rafThrottle<T extends unknown[]>(fn: (...args: T) => void): (...args: T) => void {
  let queued = false;
  let last: T;
  return (...args: T) => {
    last = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...last);
    });
  };
}

export const pad2 = (n: number): string => (n < 10 ? '0' + n : String(n));

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function clockText(d = new Date()): { time: string; date: string } {
  return {
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    date: `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`,
  };
}

/** 触发一次性的 transition 结束回调（带回退定时器，防 transitionend 不触发） */
export function afterTransition(node: HTMLElement, ms: number, cb: () => void): void {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    node.removeEventListener('transitionend', onEnd);
    cb();
  };
  const onEnd = (e: Event) => {
    if (e.target === node) finish();
  };
  node.addEventListener('transitionend', onEnd);
  window.setTimeout(finish, ms + 60);
}
