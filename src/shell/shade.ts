/**
 * shade.ts — 通知中心 + 控制中心
 *
 * 版式与磁贴清单承接 android17-shade（AOSP SystemUI 来源），交互重写为
 * transform-only 的跟手实现：
 *  - 面板开合：data-open 切 CSS transition，手势期间 transition:none + 直写 transform；
 *  - 磁贴切换：只改 data-on，圆角/底色由 CSS transition 完成（不碰布局）；
 *  - 通知滑动删除：横向位移 + 透明度，越过 40% 宽度即移除。
 */

import { $, $$, clamp, el, rafThrottle } from '../core/dom';
import { store, type Notif } from '../core/store';

interface TileDef {
  id: string;
  title: string;
  icon: string;
  sub: string;
  onSub?: string;
  offSub?: string;
  /** 是否出现在通知中心顶部的 8 宫格快捷区 */
  quick?: boolean;
}

const TILES: TileDef[] = [
  { id: 'internet', title: '互联网', icon: 'internet', sub: 'HomeNet 5G', quick: true },
  { id: 'bluetooth', title: '蓝牙', icon: 'bluetooth', sub: '已连接 2 个设备', offSub: '已关闭', quick: true },
  { id: 'flashlight', title: '手电筒', icon: 'flashlight', sub: '已开启', offSub: '已关闭', quick: true },
  { id: 'modes', title: '模式', icon: 'modes', sub: '勿扰已开启', offSub: '已关闭', quick: true },
  { id: 'mobile', title: '移动数据', icon: 'mobile', sub: '中国移动', offSub: '已关闭', quick: true },
  { id: 'hotspot', title: '热点', icon: 'hotspot', sub: '已开启', offSub: '未开启', quick: true },
  { id: 'location', title: '位置信息', icon: 'location', sub: '使用中', offSub: '已关闭', quick: true },
  { id: 'airplane', title: '飞行模式', icon: 'airplane', sub: '已开启', offSub: '已关闭', quick: true },
  { id: 'cast', title: '投射', icon: 'cast', sub: '无可用设备', offSub: '无可用设备' },
  { id: 'screenrecord', title: '屏幕录制', icon: 'record', sub: '录制中', offSub: '点按开始录制' },
  { id: 'rotation', title: '自动旋转', icon: 'rotation', sub: '已开启', offSub: '已锁定竖屏' },
  { id: 'wallet', title: '钱包', icon: 'wallet', sub: '已就绪', offSub: '点按打开' },
  { id: 'qr', title: '扫码', icon: 'qr', sub: '点按扫描', offSub: '点按扫描' },
  { id: 'nfc', title: 'NFC', icon: 'nfc', sub: '已开启', offSub: '已关闭' },
  { id: 'battery', title: '省电模式', icon: 'eco', sub: '已开启', offSub: '已关闭' },
  { id: 'media', title: '媒体', icon: 'music', sub: '正在播放', offSub: '无媒体' },
];

type Which = 'shade' | 'qs';

export interface ShadeApi {
  open(which: Which): void;
  close(): void;
  toggle(which: Which): void;
  isOpen(): boolean;
  refreshNotifs(): void;
}

export function initShade(onOpenApp: (id: string) => void): ShadeApi {
  const screen = $('#screen')!;
  const shadeEl = $('#shade')!;
  const qsEl = $('#qs')!;
  const shadeList = $('#shadeList')!;
  const shadeQuick = $('#shadeQuickGrid')!;
  const qsGrid = $('#qsGrid')!;

  let which: Which | null = null;

  /* ------------------------------- 磁贴渲染 ------------------------------- */

  const tileOn = (id: string, fallback: boolean): boolean =>
    store.get('tiles')[id] ?? fallback;

  const subFor = (def: TileDef, on: boolean): string => {
    if (def.id === 'internet') return on ? 'HomeNet 5G' : '未连接';
    if (def.id === 'bluetooth') return on ? '已连接 2 个设备' : '已关闭';
    return on ? (def.onSub ?? def.sub) : (def.offSub ?? '已关闭');
  };

  function buildTile(def: TileDef, variant: 'qs' | 'quick'): HTMLElement {
    const on = tileOn(def.id, def.id === 'internet' || def.id === 'bluetooth');
    const node = el('button', {
      class: variant === 'qs' ? 'tile' : 'quick__tile',
      type: 'button',
      'data-tile': def.id,
      'data-on': on ? '1' : '0',
      role: 'switch',
      'aria-checked': on ? 'true' : 'false',
    });
    node.innerHTML =
      `<span class="tile__icon"><svg><use href="#ic-${def.icon}"/></svg></span>` +
      (variant === 'qs'
        ? `<span class="tile__label"><span class="tile__name">${def.title}</span>` +
          `<span class="tile__sub">${subFor(def, on)}</span></span>` +
          '<svg class="row__chevron"><use href="#ic-chevron-right"/></svg>'
        : `<span>${def.title}</span>`);
    return node;
  }

  function paintTiles(): void {
    qsGrid.replaceChildren(...TILES.map((t) => buildTile(t, 'qs')));
    shadeQuick.replaceChildren(...TILES.filter((t) => t.quick).map((t) => buildTile(t, 'quick')));
  }

  function toggleTile(id: string, node: HTMLElement): void {
    const def = TILES.find((t) => t.id === id);
    if (!def) return;
    const tiles = { ...store.get('tiles') };
    const next = !(tiles[id] ?? false);
    tiles[id] = next;
    store.set('tiles', tiles);

    // 只动属性：圆角/底色交给 CSS transition（transform-only 之外唯一的视觉变化通道）
    const on = next ? '1' : '0';
    node.dataset.on = on;
    node.setAttribute('aria-checked', next ? 'true' : 'false');
    const sub = node.querySelector('.tile__sub');
    if (sub) sub.textContent = subFor(def, next);

    // 快捷区同步（同一状态源，避免两处不一致）
    const twin = shadeQuick.querySelector<HTMLElement>(`[data-tile="${id}"]`);
    if (twin) twin.dataset.on = on;

    // 系统级联动
    if (id === 'bluetooth') store.set('btOn', next);
    if (id === 'internet') store.set('wifiOn', next);
  }

  /* ------------------------------- 通知渲染 ------------------------------- */

  function buildNotif(n: Notif): HTMLElement {
    const node = el('article', { class: 'notif', 'data-id': n.id });
    node.innerHTML =
      `<span class="notif__icon"><svg><use href="#ic-${n.icon}"/></svg></span>` +
      '<span class="notif__body">' +
      `<span class="notif__head"><span class="notif__app">${n.app}</span>` +
      `<span class="notif__time">${n.time}</span></span>` +
      `<span class="notif__title">${n.title}</span>` +
      `<span class="notif__text">${n.text}</span>` +
      (n.app === '音乐' ? '<span class="notif__action">打开播放器</span>' : '') +
      '</span>';
    if (n.app === '音乐') {
      node.querySelector('.notif__action')?.addEventListener('click', () => onOpenApp('music'));
    }
    return node;
  }

  function refreshNotifs(): void {
    const list = store.get('notifications');
    shadeList.replaceChildren(...list.map(buildNotif));
    const notifIcon = $('#statusNotif');
    if (notifIcon) notifIcon.style.opacity = list.length ? '0.9' : '0.3';
    const clearBtn = $('#clearAll') as HTMLElement | null;
    if (clearBtn) clearBtn.style.opacity = list.length ? '1' : '0.4';
  }

  /* ------------------------------- 开关面板 ------------------------------- */

  function setOpen(next: Which | null): void {
    which = next;
    for (const [key, node] of [
      ['shade', shadeEl],
      ['qs', qsEl],
    ] as [Which, HTMLElement][]) {
      const open = next === key;
      node.dataset.open = open ? '1' : '0';
      node.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (!open) node.style.transform = '';
    }
    screen.dataset.shade = next ? '1' : '0';
    if (next === 'shade') refreshNotifs();
  }

  const api: ShadeApi = {
    open(w) {
      setOpen(w);
    },
    close() {
      setOpen(null);
    },
    toggle(w) {
      setOpen(which === w ? null : w);
    },
    isOpen: () => which !== null,
    refreshNotifs,
  };

  /* ------------------------------- 面板手势 ------------------------------- */

  function bindPanelDrag(panel: HTMLElement, variant: Which): void {
    let startY = 0;
    let startT = 0;
    let dragging = false;

    panel.addEventListener(
      'pointerdown',
      (e) => {
        const target = e.target as HTMLElement;
        // 交互元素与滚动列表不接管，避免抢走点击/滚动
        if (target.closest('button, .notif, .slider, .qs__grid, .shade__notifs')) return;
        dragging = true;
        startY = e.clientY;
        startT = performance.now();
        panel.dataset.dragging = '1';
      },
      { passive: true }
    );

    const move = rafThrottle((y: number) => {
      if (!dragging) return;
      const dy = y - startY;
      if (dy > 0) {
        panel.style.transform = `translateY(${dy}px)`;
        panel.style.opacity = String(Math.max(0.4, 1 - dy / 600));
      } else {
        panel.style.transform = `translateY(${dy * 0.4}px)`;
      }
    });

    panel.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      move(e.clientY);
    });

    const end = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      delete panel.dataset.dragging;
      panel.style.transform = '';
      panel.style.opacity = '';

      const dy = e.clientY - startY;
      const dt = performance.now() - startT;
      const v = dy / Math.max(dt, 1);

      if (dy > 80 || v > 0.4) {
        api.close();
      } else if (variant === 'shade' && (dy < -60 || v < -0.35)) {
        // 通知中心上滑 → 直接进控制中心（AOSP 的手势接力）
        api.open('qs');
      }
    };
    panel.addEventListener('pointerup', end);
    panel.addEventListener('pointercancel', end);
  }

  /* --------------------------- 通知横向滑动删除 --------------------------- */

  function bindNotifSwipe(root: HTMLElement): void {
    let node: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let horizontal = false;
    let decided = false;

    root.addEventListener(
      'pointerdown',
      (e) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>('.notif');
        if (!card) return;
        node = card;
        startX = e.clientX;
        startY = e.clientY;
        horizontal = false;
        decided = false;
      },
      { passive: true }
    );

    root.addEventListener(
      'pointermove',
      (e) => {
        if (!node) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!decided) {
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
            decided = true;
            horizontal = Math.abs(dx) > Math.abs(dy) * 1.4;
            if (horizontal) node.dataset.swiping = '1';
          }
          return;
        }
        if (!horizontal) return;
        node.style.transform = `translateX(${dx}px)`;
        node.style.opacity = String(Math.max(0.15, 1 - Math.abs(dx) / 260));
      },
      { passive: true }
    );

    const end = (e: PointerEvent) => {
      if (!node) return;
      const card = node;
      node = null;
      if (!horizontal) return;
      const dx = e.clientX - startX;
      delete card.dataset.swiping;
      if (Math.abs(dx) > 110) {
        card.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`;
        card.style.opacity = '0';
        window.setTimeout(() => {
          const id = card.dataset.id;
          const rest = store.get('notifications').filter((n) => n.id !== id);
          store.set('notifications', rest);
          refreshNotifs();
        }, 160);
      } else {
        card.style.transform = '';
        card.style.opacity = '';
      }
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  }

  /* ------------------------------- 滑块拖拽 ------------------------------- */

  function bindSlider(
    root: HTMLElement,
    fill: HTMLElement,
    initial: number,
    onChange: (v: number) => void
  ): void {
    let dragging = false;

    const apply = (clientX: number) => {
      const rect = root.querySelector('.slider__track')!.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width);
      fill.style.width = `${ratio * 100}%`;
      onChange(Math.round(ratio * 100));
    };

    root.addEventListener('pointerdown', (e) => {
      dragging = true;
      root.setPointerCapture(e.pointerId);
      apply(e.clientX);
    });
    root.addEventListener('pointermove', (e) => {
      if (dragging) apply(e.clientX);
    });
    const stop = () => {
      dragging = false;
    };
    root.addEventListener('pointerup', stop);
    root.addEventListener('pointercancel', stop);

    fill.style.width = `${initial}%`;
  }

  /* -------------------------------- 事件绑定 -------------------------------- */

  function bind(): void {
    paintTiles();
    refreshNotifs();

    // 磁贴点击（事件委托，避免为每个磁贴挂监听）
    const onTileClick = (e: Event) => {
      const node = (e.target as HTMLElement).closest<HTMLElement>('[data-tile]');
      if (!node) return;
      toggleTile(node.dataset.tile!, node);
    };
    qsGrid.addEventListener('click', onTileClick);
    shadeQuick.addEventListener('click', onTileClick);

    bindPanelDrag($('.shade__panel') as HTMLElement, 'shade');
    bindPanelDrag($('.qs__panel') as HTMLElement, 'qs');
    bindNotifSwipe(shadeList);

    // 亮度 / 音量
    bindSlider($('#brightnessSlider')!, $('#brightnessFill')!, store.get('brightness'), (v) =>
      store.set('brightness', v)
    );
    bindSlider($('#volumeSlider')!, $('#volumeFill')!, store.get('volume'), (v) =>
      store.set('volume', v)
    );

    // 收起
    $$('[data-dismiss]').forEach((n) =>
      n.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        api.close();
      })
    );
    $('#qsBack')?.addEventListener('click', () => api.close());
    $('#shadeSettings')?.addEventListener('click', () => {
      api.close();
      onOpenApp('settings');
    });
    $('#qsSettings')?.addEventListener('click', () => {
      api.close();
      onOpenApp('settings');
    });
    $('#qsSettingsBtn')?.addEventListener('click', () => {
      api.close();
      onOpenApp('settings');
    });
    $('#shadePower')?.addEventListener('click', () => {
      api.close();
      onOpenApp('settings');
    });
    $('#qsPower')?.addEventListener('click', () => {
      api.close();
      onOpenApp('settings');
    });
    $('#qsNotifBtn')?.addEventListener('click', () => api.open('shade'));
    $('#qsEdit')?.addEventListener('click', () => {
      qsGrid.dataset.editing = qsGrid.dataset.editing === '1' ? '0' : '1';
    });

    $('#clearAll')?.addEventListener('click', () => {
      store.set('notifications', []);
      refreshNotifs();
    });

    // Esc 收起（键盘可达性）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && which) api.close();
      if (e.key === '1') api.toggle('shade');
      if (e.key === '2') api.toggle('qs');
    });
  }

  bind();
  return api;
}
