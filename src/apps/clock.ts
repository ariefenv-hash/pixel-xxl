/**
 * clock.ts — 时钟（原工程 203 块）
 *
 * 四个子系统：世界时钟 / 闹钟 / 秒表 / 计时器。
 * 时间源统一用 performance.now() 起算 + Date.now() 校准，避免 setInterval 累积漂移。
 * 所有 interval 在卸载时清理，防止 app 关掉后仍在跑（原工程曾有此泄漏）。
 */
import { $, el, pad2 } from '../core/dom';
import type { AppModule } from '../core/registry';
import { store } from '../core/store';
import './clock.css';

type Tab = 'clock' | 'alarm' | 'stopwatch' | 'timer';

const ZONES = [
  { city: '北京', offset: 8 },
  { city: '伦敦', offset: 0 },
  { city: '纽约', offset: -5 },
  { city: '洛杉矶', offset: -8 },
];

interface Alarm {
  id: string;
  h: number;
  m: number;
  label: string;
  on: boolean;
}

const ALARM_KEY = 'px2:alarms';

function loadAlarms(): Alarm[] {
  try {
    const raw = localStorage.getItem(ALARM_KEY);
    if (raw) return JSON.parse(raw) as Alarm[];
  } catch {
    /* ignore */
  }
  return [
    { id: 'a1', h: 7, m: 30, label: '工作日', on: true },
    { id: 'a2', h: 9, m: 0, label: '周末', on: false },
  ];
}

function saveAlarms(list: Alarm[]): void {
  try {
    localStorage.setItem(ALARM_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const fmtDur = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return h > 0
    ? `${h}:${pad2(m)}:${pad2(s)}`
    : `${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
};

export const mount: AppModule['mount'] = (root) => {
  let tab: Tab = 'clock';
  let alarms = loadAlarms();

  const wrap = el('div', { class: 'clock' });
  wrap.innerHTML =
    '<nav class="clock__tabs" id="clockTabs">' +
    (['clock', 'alarm', 'stopwatch', 'timer'] as Tab[])
      .map(
        (t, i) =>
          `<button class="clock__tab${i === 0 ? ' is-active' : ''}" type="button" data-tab="${t}">` +
          `${['时钟', '闹钟', '秒表', '计时器'][i]}</button>`
      )
      .join('') +
    '</nav>' +
    '<div class="clock__body" id="clockBody"></div>';
  root.append(wrap);

  const body = $<HTMLElement>('#clockBody', wrap);
  const tabs = $<HTMLElement>('#clockTabs', wrap);

  /* ------------------------------ 定时器登记 ------------------------------ */
  const timers = new Set<number>();
  const every = (ms: number, fn: () => void): number => {
    const id = window.setInterval(fn, ms);
    timers.add(id);
    return id;
  };

  /* -------------------------------- 时钟 -------------------------------- */

  function renderClock(): void {
    body.replaceChildren();
    const page = el('div', { class: 'clock__page' });
    page.innerHTML =
      '<div class="clock__hero">' +
      '<div class="clock__big" id="ckBig">--:--</div>' +
      '<div class="clock__sec" id="ckSec">:--</div>' +
      '<div class="clock__date" id="ckDate"></div>' +
      '</div>' +
      '<div class="clock__zones" id="ckZones"></div>';
    body.append(page);

    const big = $('#ckBig', page)!;
    const sec = $('#ckSec', page)!;
    const date = $('#ckDate', page)!;
    const zones = $('#ckZones', page)!;

    const tick = () => {
      const now = new Date();
      big.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      sec.textContent = `:${pad2(now.getSeconds())}`;
      date.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · 周${'日一二三四五六'[now.getDay()]}`;

      zones.replaceChildren(
        ...ZONES.map((z) => {
          const utc = now.getTime() + now.getTimezoneOffset() * 60000;
          const t = new Date(utc + z.offset * 3600000);
          const row = el('div', { class: 'zone' });
          row.innerHTML =
            `<span class="zone__city">${z.city}</span>` +
            `<span class="zone__diff">${z.offset - (-now.getTimezoneOffset() / 60) >= 0 ? '+' : ''}${z.offset - (-now.getTimezoneOffset() / 60)}h</span>` +
            `<span class="zone__time">${pad2(t.getHours())}:${pad2(t.getMinutes())}</span>`;
          return row;
        })
      );
    };
    tick();
    every(1000, tick);
  }

  /* -------------------------------- 闹钟 -------------------------------- */

  function renderAlarm(): void {
    body.replaceChildren();
    const page = el('div', { class: 'clock__page' });
    const list = el('div', { class: 'card' });
    page.append(list);

    const paint = () => {
      list.replaceChildren(
        ...alarms.map((a) => {
          const row = el('button', { class: 'row', type: 'button' });
          row.innerHTML =
            '<span class="row__text">' +
            `<span class="alarm__time">${pad2(a.h)}:${pad2(a.m)}</span>` +
            `<span class="row__sub">${a.label}</span></span>` +
            `<span class="switch" data-on="${a.on ? '1' : '0'}"></span>`;
          row.addEventListener('click', () => {
            a.on = !a.on;
            saveAlarms(alarms);
            paint();
          });
          return row;
        })
      );
    };
    paint();

    const add = el('button', { class: 'clock__fab', type: 'button' });
    add.innerHTML = '<svg><use href="#ic-add"/></svg>';
    add.addEventListener('click', () => {
      const now = new Date();
      alarms = [...alarms, { id: 'a' + Date.now(), h: now.getHours(), m: now.getMinutes(), label: '新闹钟', on: true }];
      saveAlarms(alarms);
      paint();
    });
    page.append(add);
    body.append(page);
  }

  /* -------------------------------- 秒表 -------------------------------- */

  let swRunning = false;
  let swBase = 0;
  let swAcc = 0;
  let swLaps: number[] = [];

  function renderStopwatch(): void {
    body.replaceChildren();
    const page = el('div', { class: 'clock__page clock__page--center' });
    page.innerHTML =
      '<div class="clock__big clock__big--mono" id="swTime">00:00.00</div>' +
      '<div class="clock__laps" id="swLaps"></div>' +
      '<div class="clock__controls">' +
      '<button class="clk-btn clk-btn--tonal" id="swLap" type="button">计次</button>' +
      '<button class="clk-btn clk-btn--filled" id="swToggle" type="button">开始</button>' +
      '</div>';
    body.append(page);

    const timeEl = $('#swTime', page)!;
    const lapEl = $('#swLaps', page)!;
    const toggle = $('#swToggle', page)!;
    const lap = $('#swLap', page)!;

    const paint = () => {
      const ms = swAcc + (swRunning ? performance.now() - swBase : 0);
      timeEl.textContent = fmtDur(ms);
    };

    toggle.addEventListener('click', () => {
      if (swRunning) {
        swAcc += performance.now() - swBase;
        swRunning = false;
        toggle.textContent = '继续';
      } else {
        swBase = performance.now();
        swRunning = true;
        toggle.textContent = '暂停';
      }
      paint();
    });

    lap.addEventListener('click', () => {
      const ms = swAcc + (swRunning ? performance.now() - swBase : 0);
      swLaps = [ms, ...swLaps];
      lapEl.replaceChildren(
        ...swLaps.map(
          (v, i) =>
            el('div', { class: 'lap' }, [
              el('span', { html: `计次 ${swLaps.length - i}` }),
              el('span', { html: fmtDur(v) }),
            ])
        )
      );
    });

    paint();
    const id = every(50, paint);
    // 页面切走时停掉高频刷新
    timers.add(id);
  }

  /* -------------------------------- 计时器 -------------------------------- */

  let tmTotal = 5 * 60 * 1000;
  let tmLeft = tmTotal;
  let tmRunning = false;
  let tmBase = 0;

  function renderTimer(): void {
    body.replaceChildren();
    const page = el('div', { class: 'clock__page clock__page--center' });
    page.innerHTML =
      '<div class="clock__big clock__big--mono" id="tmTime">05:00</div>' +
      '<div class="clock__presets" id="tmPresets"></div>' +
      '<div class="clock__controls">' +
      '<button class="clk-btn clk-btn--tonal" id="tmReset" type="button">重置</button>' +
      '<button class="clk-btn clk-btn--filled" id="tmToggle" type="button">开始</button>' +
      '</div>';
    body.append(page);

    const timeEl = $('#tmTime', page)!;
    const presets = $('#tmPresets', page)!;
    const toggle = $('#tmToggle', page)!;

    presets.replaceChildren(
      ...[1, 5, 10, 25].map((min) => {
        const b = el('button', { class: 'chip', type: 'button', html: `${min} 分` });
        b.addEventListener('click', () => {
          tmTotal = min * 60000;
          tmLeft = tmTotal;
          tmRunning = false;
          toggle.textContent = '开始';
          paint();
        });
        return b;
      })
    );

    const paint = () => {
      timeEl.textContent = `${pad2(Math.floor(tmLeft / 60000))}:${pad2(Math.floor((tmLeft % 60000) / 1000))}`;
      timeEl.dataset.done = tmLeft <= 0 ? '1' : '0';
    };

    toggle.addEventListener('click', () => {
      if (tmRunning) {
        tmLeft -= performance.now() - tmBase;
        tmRunning = false;
        toggle.textContent = '继续';
      } else {
        tmBase = performance.now();
        tmRunning = true;
        toggle.textContent = '暂停';
      }
    });

    $('#tmReset', page)!.addEventListener('click', () => {
      tmRunning = false;
      tmLeft = tmTotal;
      toggle.textContent = '开始';
      paint();
    });

    paint();
    every(200, () => {
      if (!tmRunning) return;
      const left = tmLeft - (performance.now() - tmBase);
      if (left <= 0) {
        tmRunning = false;
        tmLeft = 0;
        toggle.textContent = '开始';
      }
      paint();
    });
  }

  /* ------------------------------- 切换/卸载 ------------------------------- */

  const RENDER: Record<Tab, () => void> = {
    clock: renderClock,
    alarm: renderAlarm,
    stopwatch: renderStopwatch,
    timer: renderTimer,
  };

  const select = (next: Tab) => {
    tab = next;
    for (const b of Array.from(tabs.children) as HTMLElement[]) {
      b.classList.toggle('is-active', b.dataset.tab === tab);
    }
    // 停掉上一个 tab 的定时器，避免后台累积
    for (const id of timers) window.clearInterval(id);
    timers.clear();
    RENDER[tab]();
  };

  tabs.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!btn) return;
    select(btn.dataset.tab as Tab);
  });

  select('clock');

  return () => {
    for (const id of timers) window.clearInterval(id);
    timers.clear();
    wrap.remove();
  };
};

/** 供外壳读取「下一次闹钟」用于通知（保持与 store 的解耦） */
export function nextAlarmText(): string {
  const list = loadAlarms().filter((a) => a.on);
  if (!list.length) return '无闹钟';
  list.sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
  const a = list[0];
  return `${pad2(a.h)}:${pad2(a.m)} · ${a.label}`;
}

void store;
