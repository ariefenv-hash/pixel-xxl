/**
 * build-palettes.mjs — 构建期 Monet 调色板烘焙
 *
 * 性能优化点 #10（本项目最关键的一条）：取色是纯函数——同一张壁纸必然得到同一
 * 套调色板。旧实现每次开机在浏览器里跑 materialPalettePro（average/median/kmeans
 * 三算法 + 全链重染），是启动空窗的主力之一。这里把整套计算搬到构建期，运行时
 * 只剩「给 <html> 设 data-theme / data-wallpaper」两次属性写入。
 *
 * 产出：
 *   src/styles/palettes.css   默认壁纸 × 明暗两态（静态可用，首屏零 JS 依赖）
 *   src/palettes.json         全部壁纸 × 两态（切壁纸时由 JS 设 CSS 变量）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hctFromRgb, hexFromRgb, tonalPalette } from './hct.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_WALLPAPER = 'w3'; // 旧工程「壁纸编号 = 3」的默认位

const catalog = JSON.parse(readFileSync(join(ROOT, 'scripts/wallpaper-colors.json'), 'utf8'));

/* ---------------- Material Score：从 k-means 簇里挑「主色」作为 seed ---------------- */
function scoreSeed(clusters) {
  let best = null;
  for (const { rgb, weight } of clusters) {
    const hct = hctFromRgb(rgb);
    // 官方 Score 的过滤：过黑/过白/无彩色一律不参与（壁纸取色不选灰阶）
    if (hct.tone < 18 || hct.tone > 92) continue;
    if (hct.chroma < 9) continue;
    // 权重为主，chroma 与「中调偏好」微调（tone 50 附近最耐看）
    const toneBias = 1 - Math.abs(hct.tone - 50) / 100;
    const score = weight * (1 + hct.chroma / 60) * (0.7 + 0.6 * toneBias);
    if (!best || score > best.score) best = { score, hct, rgb };
  }
  // 全灰壁纸兜底：取权重最高的簇
  if (!best) {
    const top = clusters[0];
    best = { score: 0, hct: hctFromRgb(top.rgb), rgb: top.rgb };
  }
  return best;
}

/* ------------------------------- 角色映射 ------------------------------- */
function scheme(seedHct) {
  const hue = seedHct.hue;
  const a1 = tonalPalette(hue, Math.max(48, seedHct.chroma)); // accent1 / primary
  const a2 = tonalPalette(hue, 16); // accent2 / secondary
  const a3 = tonalPalette((hue + 60) % 360, 32); // accent3 / tertiary
  const n1 = tonalPalette(hue, 4); // neutral1
  const n2 = tonalPalette(hue, 8); // neutral2

  const light = {
    '--color-primary': a1(40),
    '--color-on-primary': a1(100),
    '--color-primary-container': a1(90),
    '--color-on-primary-container': a1(10),
    '--color-secondary': a2(40),
    '--color-on-secondary': a2(100),
    '--color-secondary-container': a2(90),
    '--color-on-secondary-container': a2(10),
    '--color-tertiary': a3(40),
    '--color-on-tertiary': a3(100),
    '--color-tertiary-container': a3(90),
    '--color-on-tertiary-container': a3(10),
    '--color-error': '#b3261e',
    '--color-on-error': '#ffffff',
    '--color-error-container': '#f9dedc',
    '--color-on-error-container': '#410e0b',
    '--color-surface': n1(98),
    '--color-on-surface': n1(10),
    '--color-surface-dim': n1(87),
    '--color-surface-bright': n1(98),
    '--color-surface-container-lowest': n1(100),
    '--color-surface-container-low': n1(96),
    '--color-surface-container': n1(94),
    '--color-surface-container-high': n1(92),
    '--color-surface-container-highest': n1(90),
    '--color-on-surface-variant': n2(30),
    '--color-outline': n2(50),
    '--color-outline-variant': n2(80),
    '--color-inverse-surface': n1(20),
    '--color-inverse-on-surface': n1(95),
    '--color-inverse-primary': a1(80),
    '--color-scrim': 'rgba(0,0,0,0.32)',
    '--color-wallpaper-veil': `rgba(${hexToRgb(n1(98)).join(',')},0.86)`,
    '--color-scheme': 'light',
  };

  const dark = {
    '--color-primary': a1(80),
    '--color-on-primary': a1(20),
    '--color-primary-container': a1(30),
    '--color-on-primary-container': a1(90),
    '--color-secondary': a2(80),
    '--color-on-secondary': a2(20),
    '--color-secondary-container': a2(30),
    '--color-on-secondary-container': a2(90),
    '--color-tertiary': a3(80),
    '--color-on-tertiary': a3(20),
    '--color-tertiary-container': a3(30),
    '--color-on-tertiary-container': a3(90),
    '--color-error': '#f2b8b5',
    '--color-on-error': '#601410',
    '--color-error-container': '#8c1d18',
    '--color-on-error-container': '#f9dedc',
    '--color-surface': n1(6),
    '--color-on-surface': n1(90),
    '--color-surface-dim': n1(6),
    '--color-surface-bright': n1(24),
    '--color-surface-container-lowest': n1(4),
    '--color-surface-container-low': n1(10),
    '--color-surface-container': n1(12),
    '--color-surface-container-high': n1(17),
    '--color-surface-container-highest': n1(22),
    '--color-on-surface-variant': n2(80),
    '--color-outline': n2(60),
    '--color-outline-variant': n2(30),
    '--color-inverse-surface': n1(90),
    '--color-inverse-on-surface': n1(20),
    '--color-inverse-primary': a1(40),
    '--color-scrim': 'rgba(0,0,0,0.5)',
    '--color-wallpaper-veil': `rgba(${hexToRgb(n1(6)).join(',')},0.72)`,
    '--color-scheme': 'dark',
  };

  return { hue: +hue.toFixed(1), chroma: +Math.max(48, seedHct.chroma).toFixed(1), light, dark };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/* --------------------------------- 主流程 --------------------------------- */
const all = {};
for (const wp of catalog) {
  const seed = scoreSeed(wp.clusters);
  all[wp.id] = scheme(seed.hct);
  console.log(
    `${wp.id}: seed #${seed.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}` +
      ` → H${all[wp.id].hue} C${all[wp.id].chroma} | primary(light)=${all[wp.id].light['--color-primary']}`
  );
}

const decl = (obj, indent = '  ') =>
  Object.entries(obj).map(([k, v]) => `${indent}${k}: ${v};`).join('\n');

// palettes.css：默认壁纸两态，静态可用
const d = all[DEFAULT_WALLPAPER];
const css = `/* 自动生成，勿手改 —— scripts/build-palettes.mjs（HCT/CAM16，构建期烘焙） */
:root,
html[data-theme="light"] {
${decl(d.light)}
}
html[data-theme="dark"] {
${decl(d.dark)}
}
html {
  color-scheme: var(--color-scheme);
}
`;
writeFileSync(join(ROOT, 'src/styles/palettes.css'), css);

// palettes.json：全量，切壁纸时 JS 应用
writeFileSync(
  join(ROOT, 'src/palettes.json'),
  JSON.stringify({ default: DEFAULT_WALLPAPER, palettes: all })
);
console.log(`\npalettes.css ${css.length}B · palettes.json ${Object.keys(all).length} 组`);
