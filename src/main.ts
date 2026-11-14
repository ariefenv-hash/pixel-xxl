/**
 * main.ts — 启动编排
 *
 * 启动序刻意压到最短：HTML 里的桌面 DOM 已经可见（首帧不依赖 JS），这里只做
 * 「把交互接上」：应用调色板 → 绑定面板 → 绑定 app 管理 → 绑定下拉手势。
 * 全部是事件绑定与属性写入，没有布局计算、没有网络等待，因此在 mark 之间
 * 只有个位数毫秒。
 */

import './styles/main.css';
import { $ } from './core/dom';
import { mark, reportToConsole, watchLongTasks } from './core/perf';
import { store } from './core/store';
import { bootSystem, initLockscreen, initPullGesture } from './shell/system';
import { initShade } from './shell/shade';
import { initApps, type AppManager } from './shell/apps';
import { initEffects } from './shell/effects';

mark('dcl');
watchLongTasks();

const params = new URLSearchParams(location.search);

// 调试/对照通道：?theme=light / ?wp=w1 / ?lock=1
if (params.get('theme') === 'light' || params.get('theme') === 'dark') {
  store.set('theme', params.get('theme') as 'light' | 'dark');
}
if (params.get('wp')) store.set('wallpaper', params.get('wp')!.slice(0, 4));

bootSystem();
initEffects();

let appsRef: AppManager | null = null;
const shade = initShade((id) => appsRef?.open(id));
appsRef = initApps(shade);

initPullGesture((which) => shade.open(which));

const lock = initLockscreen(() => {
  /* 解锁后不做额外动作：桌面本身已在下面 */
});

// 默认直接进桌面（二访秒开）；?lock=1 走完整锁屏流程用于演示
if (params.get('lock') !== '1') {
  const lockEl = $('#lockscreen');
  if (lockEl) lockEl.hidden = true;
}
void lock;

mark('interactive');

// 首屏报告推迟到 load 之后：此时 paint entry 才可用，FCP 才有真值
window.addEventListener('load', () => {
  reportToConsole();
  // load 后再补一次，覆盖 LCP/长任务等晚到指标
  setTimeout(reportToConsole, 1200);
});

// Service Worker：放到 load 之后注册，绝不抢首屏带宽
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* 注册失败（如 file:// 或隐私模式）不影响可用性 */
    });
  });
}

// 便于自动化探针
(window as Window & { __shell?: unknown }).__shell = { shade, apps: () => appsRef };
