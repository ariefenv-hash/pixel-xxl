/**
 * system.ts — 壁纸 / 主题 / 状态栏 / 时钟 / 锁屏 / 桌面下拉手势
 *
 * 性能要点：
 *  - 壁纸三级加载：CSS 内联 LQIP（首帧）→ 360w（瞬时）→ 1080w（空闲时升级）；
 *    全部走 <link rel=preload>/Image 预载，切换时只写一个 CSS 变量，不引发重排。
 *  - 时钟 1s tick，但只在页面可见时跑（visibilitychange 暂停），且只更新文本节点。
 *  - 手势全程 transform + rAF，不读布局（clientHeight 只取一次并缓存）。
 */

import { $, clamp, clockText, rafThrottle } from '../core/dom';
import { store } from '../core/store';
import { mark } from '../core/perf';
import PALETTES from '../palettes.json';

// 产物里 public/ 的内容平铺到站根，因此运行时用相对站根路径
const WALL_BASE = 'wallpapers/';

interface PaletteData {
  default: string;
  palettes: Record<string, { light: Record<string, string>; dark: Record<string, string> }>;
}

const data = PALETTES as unknown as PaletteData;

/* --------------------------------- 壁纸 --------------------------------- */

let currentWallpaper = '';
const preloaded = new Set<string>();

function wallpaperUrl(id: string, size: 360 | 720 | 1080): string {
  return `${WALL_BASE}${id}-${size}.webp`;
}

/** 预热：只做 360 档（首屏需要的），1080 档在空闲时再拉 */
export function warmWallpaper(id: string): void {
  if (preloaded.has(id)) return;
  preloaded.add(id);
  const img = new Image();
  img.decoding = 'async';
  img.src = wallpaperUrl(id, 360);
}

export function applyWallpaper(id: string): void {
  const root = document.documentElement;
  const wp = $('#wallpaper');
  if (!wp) return;

  root.dataset.wallpaper = id;
  wp.dataset.wallpaper = id;

  // 第一层：360 档（约 90KB，通常已在缓存）
  const fast = new Image();
  fast.decoding = 'async';
  fast.src = wallpaperUrl(id, 360);
  const paint = () => {
    wp.style.setProperty('--wallpaper-image', `url("${fast.src}")`);
    wp.dataset.ready = '1';
  };
  if (fast.complete) paint();
  else fast.decode().then(paint).catch(paint);

  // 第二层：空闲时升级到 1080 档（仅在高清屏 + 非省流网络上）
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  const cheapNet = !conn || (!conn.saveData && !/2g|3g/.test(conn.effectiveType ?? '4g'));
  const sharpScreen = (window.devicePixelRatio || 1) >= 2;
  const upgrade = () => {
    const hi = new Image();
    hi.decoding = 'async';
    hi.src = wallpaperUrl(id, 1080);
    hi.decode()
      .then(() => {
        if (currentWallpaper !== id) return;
        wp.style.setProperty('--wallpaper-image', `url("${hi.src}")`);
      })
      .catch(() => {
        /* 高清失败就停在 360，不影响可用 */
      });
  };
  if (cheapNet && sharpScreen) {
    if ('requestIdleCallback' in window) {
      // 4s 后再升级：避开首屏带宽竞争窗口，二访时通常已进 SW 缓存
      (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void })
        .requestIdleCallback(upgrade, { timeout: 4000 });
    } else {
      setTimeout(upgrade, 4000);
    }
  }

  currentWallpaper = id;
}

/* --------------------------------- 主题 --------------------------------- */

export function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f8f9ff');
}

/** 切壁纸时把该壁纸的整套调色板写到 :root（构建期已算好，这里只是赋值） */
export function applyPalette(id: string, theme: 'light' | 'dark'): void {
  const set = data.palettes[id]?.[theme];
  if (!set) return;
  const style = document.documentElement.style;
  for (const [k, v] of Object.entries(set)) style.setProperty(k, v);
}

/* -------------------------------- 状态栏 -------------------------------- */

export function initStatusbar(): void {
  const timeEls = [$('#statusTime'), $('#shadeTime'), $('#lockTime')];
  const dateEls = [$('#shadeDate'), $('#lockDate')];

  const tick = () => {
    const { time, date } = clockText();
    for (const el of timeEls) if (el && el.textContent !== time) el.textContent = time;
    for (const el of dateEls) if (el && el.textContent !== date) el.textContent = date;
  };
  tick();
  window.setInterval(() => {
    if (document.visibilityState === 'visible') tick();
  }, 1000);

  const bt = $('#sbBt');
  const wifi = $('#sbWifi');
  const battery = $('#sbBattery i') as HTMLElement | null;
  const sync = () => {
    if (bt) bt.hidden = !store.get('btOn');
    if (wifi) wifi.style.opacity = store.get('wifiOn') ? '1' : '0.35';
    if (battery) battery.style.width = `${clamp(store.get('brightness') / 100) * 100}%`;
  };
  sync();
  store.subscribe((_s, key) => {
    if (key === 'btOn' || key === 'wifiOn' || key === 'brightness') sync();
  });
}

/* -------------------------------- 低端降级 -------------------------------- */

/** 性能预算 #8：能力探测只做一次，结果写 data-perf，样式层据此关掉毛玻璃 */
export function detectPerfTier(): void {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = nav.hardwareConcurrency ?? 4;
  const low = mem <= 3 || cores <= 4;
  const screen = $('#screen');
  if (screen) screen.dataset.perf = low ? 'low' : 'high';
}

/* -------------------------------- 锁屏 -------------------------------- */

export function initLockscreen(onUnlock: () => void): { lock: () => void } {
  const lockEl = $('#lockscreen');
  if (!lockEl) return { lock: () => {} };

  let startY = 0;
  let tracking = false;
  let unlocked = false;

  const setOffset = (dy: number) => {
    const d = clamp(dy, -40, 400);
    lockEl.style.transform = `translateY(${-Math.max(0, d)}px)`;
    lockEl.style.opacity = String(1 - Math.max(0, d) / 260);
  };

  const finish = (dy: number) => {
    tracking = false;
    lockEl.style.transform = '';
    lockEl.style.opacity = '';
    if (dy > 90 && !unlocked) {
      unlocked = true;
      lockEl.hidden = true;
      onUnlock();
    }
  };

  lockEl.addEventListener(
    'pointerdown',
    (e) => {
      if (unlocked) return;
      tracking = true;
      startY = e.clientY;
      lockEl.setPointerCapture(e.pointerId);
      lockEl.style.transition = 'none';
    },
    { passive: true }
  );

  const move = rafThrottle((y: number) => {
    if (!tracking) return;
    setOffset(startY - y);
  });

  lockEl.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    move(e.clientY);
  });

  const up = (e: PointerEvent) => {
    if (!tracking) return;
    lockEl.style.transition = '';
    finish(startY - e.clientY);
  };
  lockEl.addEventListener('pointerup', up);
  lockEl.addEventListener('pointercancel', up);

  return {
    lock: () => {
      unlocked = false;
      lockEl.hidden = false;
    },
  };
}

/* ------------------------- 状态栏下拉手势（开面板） ------------------------- */

/**
 * 从状态栏区域下拉：左半 → 通知中心，右半 → 控制中心（对齐 AOSP 的分区下拉）。
 * 跟手阶段直接改面板 transform，松手按「距离 或 速度」判定展开/回弹。
 */
export function initPullGesture(open: (which: 'shade' | 'qs', from: number) => void): void {
  const screen = $('#screen');
  if (!screen) return;

  const HOT_ZONE = 64; // 顶部热区（含状态栏）
  let tracking = false;
  let startX = 0;
  let startY = 0;
  let startT = 0;

  screen.addEventListener(
    'pointerdown',
    (e) => {
      // 面板打开时由面板自己的手势接管
      if (screen.dataset.shade === '1') return;
      // app 内不触发（避免和 app 内滚动冲突）
      if (screen.dataset.view === 'app') return;
      if (e.clientY > HOT_ZONE) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
      startT = performance.now();
    },
    { passive: true }
  );

  screen.addEventListener(
    'pointerup',
    (e) => {
      if (!tracking) return;
      tracking = false;
      const dy = e.clientY - startY;
      const dt = performance.now() - startT;
      const velocity = dy / Math.max(dt, 1);
      if (dy > 40 || velocity > 0.35) {
        const rect = screen.getBoundingClientRect();
        const which: 'shade' | 'qs' = startX - rect.left < rect.width / 2 ? 'shade' : 'qs';
        open(which, Math.max(dy, 0));
      }
    },
    { passive: true }
  );

  screen.addEventListener('pointercancel', () => {
    tracking = false;
  });
}

/* -------------------------------- 启动序 -------------------------------- */

/* 开机动画 + 引导页（原版序列 1:1，#36）：
   角色2 驱动 G+星尘 ≈174 tick（60fps ≈ 2.9s）→ 中文引导 5 页（next 胶囊，原版 (95,-320)）
   → 图标飞入（飞入动画状态）。?noboot=1 直达桌面（性能门禁 / 回归对照通道）。 */
export function initBoot(): void {
  const boot = $('#boot');
  const guide = $('#guide');
  if (!boot || !guide) return;
  if (new URLSearchParams(location.search).has('noboot')) {
    boot.remove();
    guide.remove();
    return;
  }

  const pages = Array.from(guide.querySelectorAll('.guide__page'));
  const pagesWrap = $('#desktopPages');
  let page = 0;
  let closed = false;

  const flyIn = () => {
    if (!pagesWrap) return;
    pagesWrap.dataset.fly = '1';
    window.setTimeout(() => {
      pagesWrap.dataset.fly = '0';
    }, 950);
  };
  const openGuide = () => {
    boot.remove();
    guide.hidden = false;
  };
  const finish = () => {
    if (closed) return;
    closed = true;
    guide.hidden = true;
    if (document.body.contains(boot)) boot.remove();
    flyIn();
  };
  const show = (i: number) => {
    page = i;
    pages.forEach((p, j) => p.classList.toggle('is-on', j === i));
  };
  const next = () => {
    if (page < pages.length - 1) show(page + 1);
    else finish();
  };

  // 开机段：点击任意处跳过（原版语义：点击可中断启动动画）
  boot.addEventListener(
    'click',
    () => {
      boot.classList.add('is-done');
      window.setTimeout(() => {
        openGuide();
        show(0);
      }, 220);
    },
    { once: true }
  );
  window.setTimeout(() => {
    if (!document.body.contains(boot) || closed) return;
    boot.classList.add('is-done');
    window.setTimeout(() => {
      openGuide();
      show(0);
    }, 220);
  }, 2900);

  $('#guideNext')?.addEventListener('click', next);
  $('#guideSkip')?.addEventListener('click', finish);
}

export function bootSystem(): void {
  const wallpaper = store.get('wallpaper');
  store.get('theme');
  warmWallpaper(wallpaper);
  applyWallpaper(wallpaper);
  applyTheme(store.get('theme'));
  applyPalette(wallpaper, store.get('theme'));
  initStatusbar();
  detectPerfTier();
  mark('shell-ready');
}
