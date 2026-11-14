/**
 * drawer.ts — All Apps 抽屉
 *
 * 语义出处：
 *   · 原工程 `All Apps` 角色：显示 y 从 −695 → 0，跟手阻尼 /6，松手阈值 ±50；
 *     桌面图标同时 `宽→0.9×、长→0` 收起，图标 GHOST→100 淡出；
 *   · AOSP Launcher3 `AllAppsTransitionController`：拖动进度 0（全开）~1（全关），
 *     松手弹簧 stiffness 600 / dampingRatio 0.9，内容 alpha 217ms、scale 350ms。
 *
 * 这里用一个 0→1 的进度 p 同时驱动：面板位移、背景模糊/压暗、桌面图标与 Dock 退场、
 * 抽屉图标错峰淡入。拖拽时 p 跟手；松手交给解析弹簧（可再次按下打断）。
 */

import { driver } from '../motion/driver';
import { Spring } from '../motion';
import { APPS } from '../core/registry';
import { tick } from './effects';

export interface DrawerOptions {
  onOpen: (id: string, source: HTMLElement) => void;
  /** 最近任务/面板打开时不允许起手 */
  canStart: () => boolean;
}

export interface DrawerApi {
  open(): void;
  close(instant?: boolean): void;
  isOpen(): boolean;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export function initDrawer(opts: DrawerOptions): DrawerApi {
  const screen = document.querySelector<HTMLElement>('#screen')!;
  const drawer = document.querySelector<HTMLElement>('#drawer')!;
  const panel = drawer.querySelector<HTMLElement>('.drawer__panel')!;
  const grid = drawer.querySelector<HTMLElement>('#drawerGrid')!;
  const search = drawer.querySelector<HTMLInputElement>('#drawerSearch')!;

  let p = 0;
  let open = false;
  let dragging = false;
  let lease: (() => void) | null = null;
  let spring: Spring | null = null;
  let task: { update(dt: number): void } | null = null;
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let v = 0;
  let pointerId = -1;
  let baseP = 0;
  let startX = 0;

  /* ------------------------------- 内容 ------------------------------- */

  let built = false;

  /** 首次打开/空闲时再建 14 个图标节点：不抢首屏主线程 */
  function buildGrid(): void {
    if (built) return;
    built = true;
    const entries = Object.values(APPS);
    grid.replaceChildren(
      ...entries.map((def, i) => {
        const btn = document.createElement('button');
        btn.className = 'drawer__app';
        btn.type = 'button';
        btn.dataset.app = def.id;
        btn.style.setProperty('--i', String(i));
        btn.innerHTML =
          `<span class="icon__tile"><svg class="icon__svg"><use href="#ic-${def.icon}"/></svg></span>` +
          `<span class="drawer__label">${def.name}</span>`;
        btn.addEventListener('click', () => {
          if (p < 0.6) return;
          opts.onOpen(def.id, btn);
        });
        return btn;
      })
    );
  }

  search.addEventListener('input', () => {
    buildGrid();
    const q = search.value.trim().toLowerCase();
    grid.querySelectorAll<HTMLElement>('.drawer__app').forEach((el) => {
      const name = (el.textContent ?? '').toLowerCase();
      el.hidden = q.length > 0 && !name.includes(q);
    });
  });

  /* ------------------------------- 绘制 ------------------------------- */

  function apply(progress: number): void {
    p = clamp01(progress);
    const screenH = screen.clientHeight || 800;
    panel.style.transform = `translate3d(0, ${((1 - p) * screenH).toFixed(1)}px, 0)`;
    drawer.style.setProperty('--p', p.toFixed(3));
    // 桌面图标 / 小组件 / Dock 随抽屉上推后退（原工程：图标同时缩到 0.9 并淡出）
    screen.style.setProperty('--drawer-p', p.toFixed(3));
    drawer.style.visibility = p > 0.001 ? 'visible' : 'hidden';
    drawer.setAttribute('aria-hidden', p > 0.001 ? 'false' : 'true');
    drawer.style.pointerEvents = p > 0.001 ? 'auto' : 'none';
  }

  function settle(target: number, velocity = 0): void {
    if (target > 0.5) {
      if (!open) tick('drawer');
      open = true;
      drawer.dataset.open = '1';
    } else {
      open = false;
      delete drawer.dataset.open;
    }
    spring = new Spring({
      mass: 1,
      stiffness: 600,
      damping: 2 * 0.9 * Math.sqrt(600),
      initialValue: p,
      initialVelocity: velocity / (screen.clientHeight || 800),
    });
    spring.setTarget(target);
    if (!task) {
      task = {
        update(dt: number): void {
          if (!spring) return;
          spring.update(dt);
          apply(spring.x);
          if (spring.isSettled(0.002, 0.02)) {
            apply(spring.target);
            stopLoop();
            if (spring.target < 0.5) {
              open = false;
              drawer.dataset.open = '';
              drawer.style.visibility = 'hidden';
            }
            spring = null;
          }
        },
      };
      driver.add(task);
      const l = driver.start();
      lease = () => {
        driver.remove(task!);
        l.stop();
      };
    }
  }

  function stopLoop(): void {
    lease?.();
    lease = null;
    task = null;
  }

  /* ------------------------------- 手势 ------------------------------- */

  function begin(e: PointerEvent): void {
    if (dragging || !opts.canStart()) return;
    const target = e.target as HTMLElement;
    const isOpen = p > 0.99;
    if (!isOpen) {
      // 桌面上起手：图标/小组件/Dock 的点击优先
      if (target.closest('[data-app]')) return;
    } else {
      // 抽屉内起手：只在顶部（搜索框/空白）向下拖，列表滚动让位
      const body = drawer.querySelector<HTMLElement>('.drawer__grid')!;
      if (body.contains(target) && body.scrollTop > 0) return;
    }
    buildGrid(); // 兜底：空闲预建还没跑就被上滑
    dragging = true;
    pointerId = e.pointerId;
    startY = e.clientY;
    startX = e.clientX;
    lastY = e.clientY;
    baseP = p;
    lastT = e.timeStamp;
    v = 0;
  }

  function move(e: PointerEvent): void {
    if (!dragging || e.pointerId !== pointerId) return;
    const dy = e.clientY - startY;
    const dx = e.clientX - startX;
    // 抽屉打开时的边缘横滑 → 收起（与预测式返回同向）
    if (baseP > 0.5 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (Math.abs(dx) > 44) {
        dragging = false;
        settle(0, dx < 0 ? -900 : 900);
      }
      return;
    }
    if (p <= 0.001 && dy > -10) return; // 还没向上
    const dt = Math.max(8, e.timeStamp - lastT);
    v = ((e.clientY - lastY) / dt) * 1000;
    lastY = e.clientY;
    lastT = e.timeStamp;
    try {
      screen.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件 */
    }
    const span = Math.min(screen.clientHeight || 800, 560) * 0.45;
    // 从起手那一刻的进度连续算：向上拖 → 增加；向下拖 → 减少。
    // 不能在中途切换基准，否则越过 0.5 时进度会突然跳回。
    apply(baseP - dy / span);
  }

  function end(e: PointerEvent): void {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = -1;
    if (baseP > 0.5) {
      // 从打开态往下拖：拖过 32% 或向下甩 → 收起
      settle(p < 0.68 || v > 650 ? 0 : 1, v);
    } else {
      // 从关闭态往上拖：拖过 32% 或向上甩 → 打开
      settle(p > 0.32 || v < -650 ? 1 : 0, v);
    }
  }

  screen.addEventListener('pointerdown', begin, { passive: true });
  // move/up 挂 window：抽屉里的 button 会拿到隐式指针捕获，事件不一定回到 screen
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', end, { passive: true });
  window.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    settle(p > 0.5 ? 1 : 0, 0);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && p > 0.5) settle(0);
  });

  apply(0);
  drawer.style.visibility = 'hidden';

  // 空闲时预建，保证第一次上滑就能看到完整网格；不占用首屏
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(() => buildGrid(), { timeout: 1500 });
  else window.setTimeout(buildGrid, 700);

  return {
    open(): void {
      if (open) return;
      drawer.style.visibility = 'visible';
      settle(1, -700);
    },
    close(instant = false): void {
      if (instant) {
        stopLoop();
        apply(0);
        open = false;
        drawer.dataset.open = '';
        drawer.style.visibility = 'hidden';
        return;
      }
      if (p > 0.001) settle(0, 0);
    },
    isOpen(): boolean {
      return p > 0.5;
    },
  };
}
