/**
 * driver.ts — 唯一 rAF 宿主
 *
 * 复用纪律（来自 md3 内核）：动画器不自建循环，update(dt) 由宿主驱动；
 * 引用计数启停 —— 任一消费者 start() 即运行，全部释放才停（并行动画的宿主面）。
 * 页面隐藏时 rAF 由浏览器暂停，无额外节流逻辑。
 */

export interface FrameDriver {
  stop(): void;
}

export interface Updatable {
  update(dt: number): unknown;
}

export interface Driver {
  add(a: Updatable): void;
  remove(a: Updatable): void;
  start(): FrameDriver;
}

export function createFrameDriver(): Driver {
  const set = new Set<Updatable>();
  let handle = 0;
  let last = 0;
  let running = false;
  let leases = 0;

  const tick = (now: number): void => {
    if (!running) return;
    const dt = last > 0 ? Math.min((now - last) / 1000, 0.1) : 0; // 钳 100ms：后台回来不跳帧
    last = now;
    for (const a of set) a.update(dt);
    handle = requestAnimationFrame(tick);
  };

  const run = (): void => {
    if (running || set.size === 0) return;
    running = true;
    last = 0;
    handle = requestAnimationFrame(tick);
  };

  const halt = (): void => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(handle);
  };

  return {
    add(a): void {
      set.add(a);
    },
    remove(a): void {
      set.delete(a);
    },
    start(): FrameDriver {
      leases++;
      run();
      let released = false;
      return {
        stop(): void {
          if (released) return;
          released = true;
          leases = Math.max(0, leases - 1);
          if (leases === 0) halt();
        },
      };
    },
  };
}

/** 全局唯一宿主：外壳所有动画共用一个循环 */
export const driver = createFrameDriver();
