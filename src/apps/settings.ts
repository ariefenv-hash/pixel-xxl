/**
 * settings.ts — 设置（外壳内的系统级入口）
 *
 * 差异点：这一屏把 v2 的性能预算做成可自证的面板——用户能直接看到首屏各节点
 * 的实际耗时与预算判定，不需要开 DevTools。这是「可测量」原则的落地。
 */
import { $, el } from '../core/dom';
import type { AppModule } from '../core/registry';
import { snapshot } from '../core/perf';
import { store } from '../core/store';
import './settings.css';

interface PerfShape {
  fcp: number;
  dcl: number;
  shellReady: number;
  interactive: number;
  longTasks: number;
  maxTask: number;
  fails?: string[];
}

export const mount: AppModule['mount'] = (root, ctx) => {
  const wrap = el('div', { class: 'set' });
  wrap.innerHTML =
    '<section class="page__section set__hero">' +
    '<div class="set__device"><span>Pixel XXL</span><small>Android 17 · 纯 Web</small></div>' +
    '</section>' +

    '<section class="page__section">' +
    '<h2 class="section-title">外观</h2>' +
    '<div class="card"><div class="list">' +
    '<button class="row" type="button" data-act="theme">' +
    '<span class="row__icon"><svg><use href="#ic-dark"/></svg></span>' +
    '<span class="row__text"><span class="row__title">主题</span>' +
    '<span class="row__sub" id="setThemeSub">深色</span></span>' +
    '<svg class="row__chevron"><use href="#ic-chevron-right"/></svg></button>' +
    '<button class="row" type="button" data-act="wallpaper">' +
    '<span class="row__icon"><svg><use href="#ic-palette"/></svg></span>' +
    '<span class="row__text"><span class="row__title">壁纸与取色</span>' +
    '<span class="row__sub" id="setWallSub">夜色紫</span></span>' +
    '<svg class="row__chevron"><use href="#ic-chevron-right"/></svg></button>' +
    '</div></div></section>' +

    '<section class="page__section">' +
    '<h2 class="section-title">首屏性能（本机实测）</h2>' +
    '<div class="card set__perf" id="setPerf"></div>' +
    '<p class="set__note">预算：可交互 &lt; 1000ms、桌面可见 &lt; 1500ms（中端机 4G 冷启）。' +
    '这些数字来自本机真实执行，不是构建期估算。</p>' +
    '</section>' +

    '<section class="page__section">' +
    '<h2 class="section-title">存储</h2>' +
    '<div class="card"><div class="list">' +
    '<button class="row" type="button" data-act="reset">' +
    '<span class="row__icon"><svg><use href="#ic-delete"/></svg></span>' +
    '<span class="row__text"><span class="row__title">清除本地数据</span>' +
    '<span class="row__sub">壁纸、主题、磁贴与最近任务恢复到默认</span></span>' +
    '</button></div></div></section>' +

    '<section class="page__section">' +
    '<h2 class="section-title">关于</h2>' +
    '<div class="card set__about">' +
    '<p><b>Pixel XXL v2.0</b> · 零框架 / 构建期烘焙 / 首屏 CSS 直出</p>' +
    '<p>外壳与全部应用均为原生 DOM 实现，无 Scratch 运行时、无虚拟 DOM、无 Web Font。' +
    '调色板由壁纸经 HCT 在构建期算好，运行时只做一次变量赋值。</p>' +
    '</div></section>';

  root.append(wrap);

  const themeSub = $('#setThemeSub', wrap)!;
  const wallSub = $('#setWallSub', wrap)!;
  const perfEl = $('#setPerf', wrap)!;

  const WALL_NAMES: Record<string, string> = {
    w1: '珊瑚暮色',
    w2: '雾青',
    w3: '夜色紫',
    w4: '苔原',
    w5: '蓝调',
  };

  const paintLabels = () => {
    themeSub.textContent = ctx.getTheme() === 'dark' ? '深色' : '浅色';
    wallSub.textContent = WALL_NAMES[ctx.getWallpaper()] ?? ctx.getWallpaper();
  };

  const paintPerf = () => {
    // 用实时快照：FCP 的 paint entry 在启动 mark 时还没产生，缓存值会是 0
    const cached = (window as Window & { __perf?: PerfShape }).__perf;
    const p: PerfShape = { ...(snapshot() as PerfShape), fails: cached?.fails };
    const rows: [string, number, number][] = [
      ['可交互', p.interactive ?? 0, 1000],
      ['首帧内容（FCP）', p.fcp ?? 0, 1500],
      ['外壳就绪', p.shellReady ?? 0, 400],
      ['DOMContentLoaded', p.dcl ?? 0, 600],
    ];
    perfEl.replaceChildren(
      ...rows.map(([label, value, budget]) => {
        const ok = value <= budget;
        const row = el('div', { class: 'perf-row' });
        row.innerHTML =
          `<span class="perf-row__label">${label}</span>` +
          `<span class="perf-row__bar"><i style="transform:scaleX(${Math.min(1, value / budget)})"></i></span>` +
          `<span class="perf-row__val" data-ok="${ok ? '1' : '0'}">${value}ms</span>`;
        return row;
      })
    );
    const extra = el('div', { class: 'perf-extra' });
    extra.textContent =
      `长任务 ${p.longTasks ?? 0} 个${p.maxTask ? `（最长 ${p.maxTask}ms）` : ''}` +
      (p.fails?.length ? ` · 超预算：${p.fails.join(' / ')}` : ' · 全部达标');
    perfEl.append(extra);
  };

  wrap.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'theme') {
      const next = ctx.getTheme() === 'dark' ? 'light' : 'dark';
      ctx.setTheme(next);
      paintLabels();
    } else if (act === 'wallpaper') {
      ctx.open('theme');
    } else if (act === 'reset') {
      try {
        localStorage.removeItem('px2:state');
        localStorage.removeItem('px2:alarms');
      } catch {
        /* ignore */
      }
      ctx.toast('本地数据已清除，下次启动恢复默认');
      store.set('recent', []);
    }
  });

  paintLabels();
  paintPerf();

  return () => wrap.remove();
};
