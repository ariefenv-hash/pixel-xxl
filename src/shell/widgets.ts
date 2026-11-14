/**
 * widgets.ts — 桌面小组件（时钟 / 世界钟）
 *
 * 原工程用 `多层图标()` 逐帧画「时钟-时 / 时钟-分 / 时钟-秒」三个角色，秒针只在
 * 时钟 app 未打开时走（$当前打开应用 ≠ '时钟'）。这里用 DOM 等价实现，并复用同一规则：
 * 时钟 app 在前台时停秒针，减少后台无意义的重绘。
 *
 * 打开/关闭不在这里做：由 shell/apps.ts 走 motion/launch.ts 的 widget 时间轴
 * （QSTM `getOpeningWindowAnimatorsForWidget`，WIDGET_CROSSFADE 125ms / 500ms 主轴）。
 */

const $ = <T extends HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

const CITIES: Array<{ tz: string; offset: string }> = [
  { tz: 'Asia/Shanghai', offset: '0' },
  { tz: 'Europe/London', offset: '-8' },
  { tz: 'America/New_York', offset: '-13' },
];

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

export interface WidgetsApi {
  /** app 打开/关闭时暂停秒针（原工程同规则） */
  setAppForeground(id: string | null): void;
}

export function initWidgets(): WidgetsApi {
  const hour = $('#wHour');
  const minute = $('#wMinute');
  const second = $('#wSecond');
  const date = $('#wDate');
  const big = $('#wWorldTime');
  const cities = Array.from(document.querySelectorAll<HTMLElement>('.widget__cities b'));

  let appId: string | null = null;
  let timer = 0;

  function paint(): void {
    const now = new Date();
    if (hour) hour.style.setProperty('--rot', `${(now.getHours() % 12) * 30 + now.getMinutes() * 0.5}deg`);
    if (minute) minute.style.setProperty('--rot', `${now.getMinutes() * 6 + now.getSeconds() * 0.1}deg`);
    if (second) {
      const running = appId !== 'clock';
      second.style.opacity = running ? '1' : '0';
      second.style.setProperty('--rot', `${now.getSeconds() * 6}deg`);
    }
    if (date) {
      date.textContent = new Intl.DateTimeFormat('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }).format(now);
    }
    if (big) big.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    cities.forEach((node, i) => {
      const city = CITIES[i];
      if (!city) return;
      try {
        node.textContent = new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: city.tz,
        }).format(now);
      } catch {
        node.textContent = '--:--';
      }
    });
  }

  function schedule(): void {
    window.clearTimeout(timer);
    const delay = 1000 - (Date.now() % 1000);
    timer = window.setTimeout(() => {
      paint();
      schedule();
    }, delay + 8);
  }

  paint();
  schedule();

  return {
    setAppForeground(id: string | null): void {
      appId = id;
      paint();
    },
  };
}
