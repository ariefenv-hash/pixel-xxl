/**
 * apps.ts — app 窗口管理 / Recents / 桌面绑定 / 返回手势
 *
 * 打开一个 app 的时序（性能预算 #5）：
 *   点击 → 立即插入窗口骨架并起 240ms 入场动画（不阻塞在网络上）
 *        → 并行 import() 该 app 的 chunk → 挂载内容（通常 60~120ms 内完成）
 * 因此「点开有感」与「内容就绪」解耦，点按永远不会出现空等。
 */

import { $, el } from '../core/dom';
import { APPS, type AppContext, type AppModule } from '../core/registry';
import { store } from '../core/store';
import { mark } from '../core/perf';
import type { ShadeApi } from './shade';
import { applyPalette, applyTheme, applyWallpaper } from './system';

export interface AppManager {
  open(id: string): void;
  close(): void;
  showRecents(): void;
  hideRecents(): void;
  back(): void;
}

interface Mounted {
  id: string;
  node: HTMLElement;
  body: HTMLElement;
  unmount?: () => void;
}

let current: Mounted | null = null;
let recentsOpen = false;
let toastTimer = 0;

function toast(msg: string): void {
  const node = $('#toast');
  if (!node) return;
  node.textContent = msg;
  node.dataset.show = '1';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    node.dataset.show = '0';
  }, 1800);
}

export function initApps(shade: ShadeApi): AppManager {
  const screen = $('#screen')!;
  const layer = $('#appLayer')!;
  const recents = $('#recents')!;
  const track = $('#recentsTrack')!;

  const ctx: AppContext = {
    open: (id) => manager.open(id),
    close: () => manager.close(),
    toast,
    setWallpaper: (id) => {
      store.set('wallpaper', id);
      applyWallpaper(id);
      applyPalette(id, store.get('theme'));
    },
    setTheme: (theme) => {
      store.set('theme', theme);
      applyTheme(theme);
      applyPalette(store.get('wallpaper'), theme);
    },
    getTheme: () => store.get('theme'),
    getWallpaper: () => store.get('wallpaper'),
  };

  /* ------------------------------ 窗口骨架 ------------------------------ */

  function buildWindow(id: string): Mounted {
    const def = APPS[id];
    const node = el('section', { class: 'app-window', 'data-app': id });
    node.innerHTML =
      '<header class="app-window__header">' +
      '<button class="app-window__back" type="button" aria-label="返回">' +
      '<svg><use href="#ic-back"/></svg></button>' +
      `<span class="app-window__title">${def?.name ?? id}</span>` +
      '</header>' +
      '<div class="app-window__body"></div>';
    const body = node.querySelector<HTMLElement>('.app-window__body')!;
    node.querySelector('.app-window__back')!.addEventListener('click', () => manager.back());
    return { id, node, body };
  }

  function teardown(inst: Mounted): void {
    try {
      inst.unmount?.();
    } catch {
      /* app 卸载异常不应阻塞外壳 */
    }
    inst.node.remove();
  }

  /* ------------------------------- 打开 app ------------------------------- */

  async function open(id: string): Promise<void> {
    const def = APPS[id];
    if (!def) {
      toast(`未注册的应用：${id}`);
      return;
    }
    if (current?.id === id) return;
    if (current) teardown(current);

    hideRecents();
    shade.close();

    const inst = buildWindow(id);
    current = inst;
    layer.append(inst.node);
    screen.dataset.view = 'app';
    mark(`app-open:${id}`);

    // 记录最近使用（去重后置顶，最多 6 个）
    const recent = [id, ...store.get('recent').filter((x) => x !== id)].slice(0, 6);
    store.set('recent', recent);

    try {
      const mod: AppModule = await def.load();
      // 加载期间用户可能已经关掉/换 app，避免挂到已废弃的窗口
      if (current !== inst) return;
      inst.unmount = mod.mount(inst.body, ctx);
    } catch (err) {
      if (current !== inst) return;
      inst.body.append(
        el('div', { class: 'empty' }, [
          el('div', { class: 'empty__title', html: '应用加载失败' }),
          el('div', { class: 'empty__text', html: String((err as Error)?.message ?? err) }),
        ])
      );
    }
  }

  /* ------------------------------- 关闭 app ------------------------------- */

  function close(): void {
    if (!current) return;
    const inst = current;
    current = null;
    delete screen.dataset.view; // 桌面立即恢复（CSS transition 接管）
    inst.node.dataset.closing = '1';
    window.setTimeout(() => teardown(inst), 200);
  }

  /** 返回键语义：Recents 开着 → 先关 Recents；否则关 app */
  function back(): void {
    if (recentsOpen) {
      hideRecents();
      return;
    }
    if (current) close();
  }

  /* -------------------------------- Recents -------------------------------- */

  function paintRecents(): void {
    const list = store.get('recent');
    const empty = $('.recents__empty', recents) as HTMLElement | null;
    track.replaceChildren(
      ...list.map((id) => {
        const def = APPS[id];
        const card = el('button', { class: 'recent-card', type: 'button', 'data-app': id });
        card.innerHTML =
          '<span class="recent-card__head">' +
          `<span class="icon__tile"><svg><use href="#ic-${def?.icon ?? 'apps'}"/></svg></span>` +
          `<span>${def?.name ?? id}</span></span>` +
          `<span class="recent-card__body"><svg class="recent-card__mark"><use href="#ic-${def?.icon ?? 'apps'}"/></svg></span>`;
        card.addEventListener('click', () => open(id));
        return card;
      })
    );
    if (empty) empty.hidden = list.length > 0;
  }

  function showRecents(): void {
    paintRecents();
    recentsOpen = true;
    recents.hidden = false;
    recents.dataset.open = '1';
    shade.close();
  }

  function hideRecents(): void {
    if (!recentsOpen) return;
    recentsOpen = false;
    recents.dataset.open = '0';
    window.setTimeout(() => {
      if (!recentsOpen) recents.hidden = true;
    }, 260);
  }

  /* ------------------------------ 桌面绑定 ------------------------------ */

  function bindDesktop(): void {
    const grid = $('#desktopGrid')!;
    const dock = $('#dock')!;

    const handler = (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-app]');
      if (!btn) return;
      const id = btn.dataset.app!;
      open(id);
    };
    grid.addEventListener('click', handler);
    dock.addEventListener('click', handler);
  }

  /* ---------------------------- 返回手势（边缘） ---------------------------- */

  function bindBackGesture(): void {
    const EDGE = 22;
    let tracking = false;
    let startX = 0;
    let startY = 0;
    let fromLeft = false;

    screen.addEventListener(
      'pointerdown',
      (e) => {
        if (screen.dataset.shade === '1') return;
        const rect = screen.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x > EDGE && x < rect.width - EDGE) return;
        tracking = true;
        fromLeft = x <= EDGE;
        startX = e.clientX;
        startY = e.clientY;
      },
      { passive: true }
    );

    screen.addEventListener(
      'pointerup',
      (e) => {
        if (!tracking) return;
        tracking = false;
        const dx = e.clientX - startX;
        const dy = Math.abs(e.clientY - startY);
        if (dy > 60) return;
        const passed = fromLeft ? dx > 70 : dx < -70;
        if (passed) back();
      },
      { passive: true }
    );

    screen.addEventListener('pointercancel', () => {
      tracking = false;
    });
  }

  /* ------------------------------- 空手势区 ------------------------------- */

  // 桌面空白处上滑 → Recents；下压 → 无（交给状态栏手势）
  function bindDesktopGestures(): void {
    let startY = 0;
    let startT = 0;
    let tracking = false;

    $('#desktop')!.addEventListener(
      'pointerdown',
      (e) => {
        if ((e.target as HTMLElement).closest('[data-app]')) return;
        tracking = true;
        startY = e.clientY;
        startT = performance.now();
      },
      { passive: true }
    );

    $('#desktop')!.addEventListener(
      'pointerup',
      (e) => {
        if (!tracking) return;
        tracking = false;
        const dy = e.clientY - startY; // 向上为负
        const dt = performance.now() - startT;
        if (dy < -70 && dt < 600) showRecents();
      },
      { passive: true }
    );

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') back();
    });
  }

  const manager: AppManager = { open, close, showRecents, hideRecents, back };

  bindDesktop();
  bindBackGesture();
  bindDesktopGestures();

  return manager;
}
