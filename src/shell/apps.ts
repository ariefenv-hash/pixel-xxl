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
import { kindOf, playClose, playOpen, rectOf, type LaunchKind, type Rect } from '../motion/launch';
import { initPredictive } from '../motion/predictive';
import { initHandoff } from '../motion/handoff';
import { animateWindowRect } from '../motion/window-morph';
import { initWidgets } from './widgets';
import { initDrawer, type DrawerApi } from './drawer';
import { tick } from './effects';
import type { ShadeApi } from './shade';
import { applyPalette, applyTheme, applyWallpaper } from './system';

export interface AppManager {
  open(id: string, source?: Element | null): void;
  close(instant?: boolean): void;
  showRecents(): void;
  hideRecents(): void;
  back(): void;
}

interface Mounted {
  id: string;
  node: HTMLElement;
  body: HTMLElement;
  unmount?: () => void;
  /** 打开来源的几何（关窗/预测式返回把窗口收回去的那一点） */
  rect: Rect | null;
  source: Element | null;
  kind: LaunchKind;
}

let current: Mounted | null = null;
let recentsOpen = false;
let drawer: DrawerApi | null = null;
/** 窗口已被停到最近任务卡的位置（同一实例，不重新挂载） */
let parked = false;
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
  const widgets = initWidgets();
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
    return { id, node, body, rect: null, source: null, kind: 'icon' };
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

  async function open(id: string, source?: Element | null): Promise<void> {
    const def = APPS[id];
    if (!def) {
      toast(`未注册的应用：${id}`);
      return;
    }
    if (current?.id === id) {
      if (recentsOpen) void restoreFromCard();
      return;
    }
    if (current) teardown(current);
    parked = false;
    layer.style.zIndex = '';
    delete screen.dataset.recents;

    hideRecents();
    drawer?.close();
    shade.close();

    const inst = buildWindow(id);
    current = inst;
    layer.append(inst.node);
    screen.dataset.view = 'app';
    mark(`app-open:${id}`);

    // 容器变换：图标（或 Recents 卡片）→ 全屏。窗口先以图标尺寸投影出来，
    // 再由 500ms emphasized 主时间轴拉到全屏；内容只走最后 45%。
    const src = source ?? null;
    const kind = kindOf(src);
    // 图标要圆形起点；小组件/任务卡保留自己的矩形圆角
    const rect = src ? rectOf(src, layer.getBoundingClientRect(), kind === 'icon') : null;
    inst.rect = rect;
    inst.source = src;
    inst.kind = kind;
    if (rect) void playOpen(inst.node, rect, src, kind);
    else inst.node.style.setProperty('--launch-content', '1');
    tick('open');
    widgets.setAppForeground(id);

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

  function close(instant = false): void {
    if (!current) return;
    const inst = current;
    current = null;
    parked = false;
    delete screen.dataset.view; // 桌面立即恢复（CSS transition 接管）
    widgets.setAppForeground(null);
    tick('close');
    layer.style.zIndex = '';
    if (instant || !inst.rect) {
      teardown(inst);
      return;
    }
    // 关窗 = 开窗曲线的反向（250ms），窗口收进图标后再卸载
    void playClose(inst.node, inst.rect, inst.source, inst.kind).then(() => teardown(inst));
  }

  /** 返回键语义：Recents 开着 → 先关 Recents；否则关 app */
  function back(): void {
    if (recentsOpen) {
      if (parked) void restoreFromCard();
      else hideRecents();
      return;
    }
    if (drawer?.isOpen()) {
      drawer.close();
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
        card.addEventListener('click', () => {
          if (parked && current?.id === id) void restoreFromCard();
          else open(id, card);
        });
        return card;
      })
    );
    if (empty) empty.hidden = list.length > 0;
  }

  /** 把当前窗口收进第一张卡（同一 DOM，保留 app 状态） */
  async function showRecents(): Promise<void> {
    if (recentsOpen) return;
    paintRecents();
    recentsOpen = true;
    screen.dataset.recents = '1';
    recents.hidden = false;
    recents.dataset.open = '1';
    shade.close();

    const inst = current;
    const card = track.querySelector<HTMLElement>('.recent-card');
    if (!inst || !card) return;
    // 当前卡居中，下一张从右侧露出一点（Android 任务视图的构图）
    track.scrollLeft = Math.max(0, card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2);
    // 卡片先隐形，窗口落位后再显形：否则「同一张 app」会叠两层
    card.dataset.parked = '1';
    layer.style.zIndex = '31';
    parked = true;
    const r = card.getBoundingClientRect();
    await animateWindowRect(inst.node, { x: r.left, y: r.top, w: r.width, h: r.height }, { durationMs: 320, radius: 26 });
    if (!parked) return; // 动画途中用户又点了别的
    // 窗口 → 卡片的 140ms 交叉淡出：避免「落位瞬间换成占位卡」的跳变
    card.dataset.parked = '0';
    const fade = inst.node.animate([{ opacity: '1' }, { opacity: '0' }], {
      duration: 140,
      easing: 'linear',
      fill: 'forwards',
    });
    await fade.finished.catch(() => undefined);
    if (!parked) return;
    inst.node.getAnimations().forEach((a) => a.cancel());
    inst.node.style.visibility = 'hidden';
    inst.node.style.opacity = '';
    layer.style.zIndex = '';
  }

  /** 点当前 app 的卡片：把同一个窗口拉回全屏（不重新 mount） */
  async function restoreFromCard(): Promise<void> {
    const inst = current;
    if (!inst) {
      hideRecents();
      return;
    }
    recentsOpen = false;
    delete screen.dataset.recents;
    recents.dataset.open = '0';
    parked = false;
    screen.dataset.view = 'app';
    widgets.setAppForeground(inst.id);
    inst.node.style.visibility = 'visible';
    layer.style.zIndex = '31';
    const box = layer.getBoundingClientRect();
    await animateWindowRect(
      inst.node,
      { x: box.left, y: box.top, w: box.width, h: box.height },
      { durationMs: 336, radius: 24, resetAtEnd: true }
    );
    layer.style.zIndex = '';
    hideRecents();
    recents.hidden = true;
  }

  function hideRecents(): void {
    if (!recentsOpen) return;
    recentsOpen = false;
    delete screen.dataset.recents;
    recents.dataset.open = '0';
    window.setTimeout(() => {
      if (!recentsOpen) recents.hidden = true;
    }, 260);
  }

  /** 点空白 / 返回键：退出任务视图回桌面（窗口已停成卡片，直接卸载） */
  function exitToHome(): void {
    const inst = current;
    current = null;
    parked = false;
    layer.style.zIndex = '';
    delete screen.dataset.view;
    widgets.setAppForeground(null);
    hideRecents();
    recents.hidden = false; // 让淡出可见
    window.setTimeout(() => {
      if (!recentsOpen) recents.hidden = true;
    }, 260);
    if (inst) teardown(inst);
  }

  /* ------------------------------ 桌面绑定 ------------------------------ */

  function bindDesktop(): void {
    const pages = $('#desktopPages')!;

    const handler = (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-app]');
      if (!btn) return;
      const id = btn.dataset.app!;
      open(id, btn);
    };
    // 原版桌面无 Dock：页一图标 + 页二 bilibili + 时钟组件都在分页容器里，一个委托全接
    pages.addEventListener('click', handler);
  }

  /* --------------------------- 任务视图空白 --------------------------- */

  recents.addEventListener('click', (e) => {
    if (!recentsOpen) return;
    const el = e.target as HTMLElement;
    if (el.closest('.recent-card') || el.closest('button')) return;
    exitToHome();
  });

  /* ------------------------- 上滑 / 上滑长按 ------------------------- */

  initHandoff({
    screen,
    getWindow: () => (recentsOpen || parked ? null : (current?.node ?? null)),
    onRecents: () => {
      void showRecents();
    },
    onHome: () => {
      const inst = current;
      if (!inst) return;
      current = null;
      parked = false;
      delete screen.dataset.view;
      widgets.setAppForeground(null);
      const box = layer.getBoundingClientRect();
      // 从手势中途的缩小态继续往下送走（不是跳回全屏再关）
      void animateWindowRect(
        inst.node,
        { x: box.left + box.width / 2 - 44, y: box.top + box.height + 40, w: 88, h: 88 },
        { durationMs: 220, radius: 30, accelerate: true, fade: 0 }
      ).then(() => teardown(inst));
    },
  });

  /* ---------------------------- 预测式返回 ---------------------------- */

  // 拖动即预览：窗口按进度缩小让位，松手收进图标或弹回（见 motion/predictive.ts）
  initPredictive({
    screen,
    getWindow: () => (recentsOpen ? null : (current?.node ?? null)),
    getSource: () => (recentsOpen ? null : (current?.rect ?? null)),
    onCommit: () => close(true),
  });

  /* ------------------------------- 空手势区 ------------------------------- */

  // 桌面上滑 → All Apps（原工程语义）；Esc 逐层返回
  function bindDesktopGestures(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') back();
    });
  }

  const manager: AppManager = { open, close, showRecents, hideRecents, back };

  drawer = initDrawer({
    onOpen: (id, el) => open(id, el),
    canStart: () => !current && !recentsOpen && !shade.isOpen(),
  });

  bindDesktop();
  bindDesktopGestures();

  return manager;
}
