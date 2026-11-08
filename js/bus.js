/* bus.js —— 极简事件总线（对应原工程的 8 个广播：
 * APP打开 / app加载 / 取色 / 壁纸 / 开机引导下一页 / 引导结束 / 计时器 / 计时器-2） */

const listeners = new Map();

export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => off(evt, fn);
}

export function off(evt, fn) {
  listeners.get(evt)?.delete(fn);
}

export function emit(evt, payload) {
  listeners.get(evt)?.forEach((fn) => {
    try { fn(payload); } catch (err) { console.error(`[bus:${evt}]`, err); }
  });
}
