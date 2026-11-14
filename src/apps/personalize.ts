/**
 * personalize.ts — 个性化（原工程 551 块）
 *
 * 旧工程这一屏的核心是「壁纸 → materialPalettePro 取色 → 全链重染」，
 * 在设备上是开机的性能大头。v2 的对应能力全部前移到构建期：
 * 这里选壁纸只是切一个 id，调色板由 shell 从 palettes.json 直接套用，
 * 运行时不跑任何取色算法。
 */
import { $, el } from '../core/dom';
import type { AppModule } from '../core/registry';
import './personalize.css';

const WALLPAPERS = [
  { id: 'w1', name: '珊瑚暮色' },
  { id: 'w2', name: '雾青' },
  { id: 'w3', name: '夜色紫' },
  { id: 'w4', name: '苔原' },
  { id: 'w5', name: '蓝调' },
];

const SWATCHES = [
  ['--color-primary', '主色'],
  ['--color-primary-container', '主容器'],
  ['--color-secondary-container', '次容器'],
  ['--color-tertiary', '第三色'],
  ['--color-surface-container-high', '表面高'],
];

export const mount: AppModule['mount'] = (root, ctx) => {
  const wrap = el('div', { class: 'pers' });
  wrap.innerHTML =
    '<section class="pers__section">' +
    '<h2 class="section-title">壁纸</h2>' +
    '<div class="pers__walls" id="persWalls"></div>' +
    '</section>' +
    '<section class="pers__section">' +
    '<h2 class="section-title">外观</h2>' +
    '<div class="card"><div class="pers__row">' +
    '<span class="pers__row-label">主题</span>' +
    '<div class="segmented" id="persTheme">' +
    '<button class="segmented__item" type="button" data-theme="light">浅色</button>' +
    '<button class="segmented__item" type="button" data-theme="dark">深色</button>' +
    '</div></div></div>' +
    '</section>' +
    '<section class="pers__section">' +
    '<h2 class="section-title">取色结果（构建期已烘焙）</h2>' +
    '<div class="card"><div class="pers__swatches" id="persSwatches"></div></div>' +
    '<p class="pers__note">调色板由壁纸在构建期经 HCT（CAM16 + L*）算出，运行时只做一次 CSS 变量赋值——旧工程在设备上重跑取色算法的那段时间，在这里不存在。</p>' +
    '</section>';
  root.append(wrap);

  const wallsEl = $('#persWalls', wrap)!;
  const themeEl = $('#persTheme', wrap)!;
  const swatchesEl = $('#persSwatches', wrap)!;

  const paintWalls = () => {
    const active = ctx.getWallpaper();
    wallsEl.replaceChildren(
      ...WALLPAPERS.map((w) => {
        const b = el('button', {
          class: 'wall',
          type: 'button',
          'data-active': w.id === active ? '1' : '0',
        });
        b.innerHTML =
          `<span class="wall__thumb" style="background-image:url('wallpapers/${w.id}-360.webp')"></span>` +
          `<span class="wall__name">${w.name}</span>` +
          (w.id === active ? '<span class="wall__check"><svg><use href="#ic-check"/></svg></span>' : '');
        b.addEventListener('click', () => {
          ctx.setWallpaper(w.id);
          paintWalls();
          paintSwatches();
          ctx.toast(`壁纸已切换 · ${w.name}`);
        });
        return b;
      })
    );
  };

  const paintTheme = () => {
    const t = ctx.getTheme();
    for (const b of Array.from(themeEl.children) as HTMLElement[]) {
      b.dataset.active = b.dataset.theme === t ? '1' : '0';
    }
  };

  const paintSwatches = () => {
    const cs = getComputedStyle(document.documentElement);
    swatchesEl.replaceChildren(
      ...SWATCHES.map(([varName, label]) => {
        const color = cs.getPropertyValue(varName).trim();
        const row = el('div', { class: 'swatch' });
        row.innerHTML =
          `<span class="swatch__dot" style="background:${color}"></span>` +
          `<span class="swatch__label">${label}</span>` +
          `<code class="swatch__hex">${color.toUpperCase()}</code>`;
        return row;
      })
    );
  };

  themeEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-theme]');
    if (!btn) return;
    ctx.setTheme(btn.dataset.theme as 'light' | 'dark');
    paintTheme();
    // 主题变量在下一个样式帧生效
    requestAnimationFrame(paintSwatches);
  });

  paintWalls();
  paintTheme();
  paintSwatches();

  return () => wrap.remove();
};
