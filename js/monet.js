/* monet.js —— Material You 动态取色管线（原生实现，对应原工程 §4.1）：
 *   壁纸像素 → average / k-means 提取基色 → HSL
 *   → light/dark 两套 tonal palette（键 50~900，极端亮度饱和度 ×0.8）
 *   → 按「亮度模式」(100/500/600/800) 选择 tone → 写入 CSS 变量 → 全 UI 重染
 * 原工程用 取色进度/目标取色数量 做启动门控；此处以 Promise 表达同一语义。 */

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslCss(h, s, l) {
  return `hsl(${(((h % 360) + 360) % 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
}

/** tonal palette：tone(0~100) → 颜色。极端亮度（≤10 / ≥90）饱和度 ×0.8（忠实原工程）。 */
function tone(h, s, t) {
  const extreme = t <= 10 || t >= 90;
  const sat = s * (extreme ? .8 : 1);
  return hslCss(h, Math.min(sat, 1), t / 100);
}

/* MD3 明暗两套方案的 tone 映射（沿用 MD3 标准 角色→tone 键位） */
const LIGHT = {
  primary: 40, onPrimary: 100, primaryContainer: 90, onPrimaryContainer: 10,
  secondary: 40, onSecondary: 100, secondaryContainer: 90, onSecondaryContainer: 10,
  tertiary: 40, onTertiary: 100, tertiaryContainer: 90, onTertiaryContainer: 10,
  surface: 98, onSurface: 10, surfaceVariant: 90, onSurfaceVariant: 30,
  surfaceContainerLowest: 100, surfaceContainerLow: 96, surfaceContainer: 94,
  surfaceContainerHigh: 92, surfaceContainerHighest: 90,
  outline: 50, outlineVariant: 80,
  inverseSurface: 20, inverseOnSurface: 95,
};
const DARK = {
  primary: 80, onPrimary: 20, primaryContainer: 30, onPrimaryContainer: 90,
  secondary: 80, onSecondary: 20, secondaryContainer: 30, onSecondaryContainer: 90,
  tertiary: 80, onTertiary: 20, tertiaryContainer: 30, onTertiaryContainer: 90,
  surface: 6, onSurface: 90, surfaceVariant: 30, onSurfaceVariant: 80,
  surfaceContainerLowest: 4, surfaceContainerLow: 10, surfaceContainer: 12,
  surfaceContainerHigh: 17, surfaceContainerHighest: 22,
  outline: 60, outlineVariant: 30,
  inverseSurface: 90, inverseOnSurface: 20,
};

const CSS_VAR = {
  primary: "--md-primary", onPrimary: "--md-on-primary",
  primaryContainer: "--md-primary-container", onPrimaryContainer: "--md-on-primary-container",
  secondary: "--md-secondary", onSecondary: "--md-on-secondary",
  secondaryContainer: "--md-secondary-container", onSecondaryContainer: "--md-on-secondary-container",
  tertiary: "--md-tertiary", onTertiary: "--md-on-tertiary",
  tertiaryContainer: "--md-tertiary-container", onTertiaryContainer: "--md-on-tertiary-container",
  surface: "--md-surface", onSurface: "--md-on-surface",
  surfaceVariant: "--md-surface-variant", onSurfaceVariant: "--md-on-surface-variant",
  surfaceContainerLowest: "--md-surface-container-lowest",
  surfaceContainerLow: "--md-surface-container-low",
  surfaceContainer: "--md-surface-container",
  surfaceContainerHigh: "--md-surface-container-high",
  surfaceContainerHighest: "--md-surface-container-highest",
  outline: "--md-outline", outlineVariant: "--md-outline-variant",
  inverseSurface: "--md-inverse-surface", inverseOnSurface: "--md-inverse-on-surface",
};

export const monet = {
  scheme: "light",     // 当前方案（对应亮度模式档位）
  baseHsl: [230, .21, .42],
};

/** 从壁纸画布提取基色：k-means(k=4, 6 轮) 按「数量 × 彩度」挑最优簇，average 兜底 */
function extractBase(canvas) {
  const w = 24, h = 48;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const octx = off.getContext("2d", { willReadFrequently: true });
  octx.drawImage(canvas, 0, 0, w, h);
  const data = octx.getImageData(0, 0, w, h).data;
  const pts = [];
  let ar = 0, ag = 0, ab = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const p = [data[i], data[i + 1], data[i + 2]];
    pts.push(p);
    ar += p[0]; ag += p[1]; ab += p[2]; n++;
  }
  const avgHsl = rgbToHsl(ar / n, ag / n, ab / n);

  // k-means：均匀采样 4 个质心
  let cents = [0, 1, 2, 3].map((i) => pts[Math.floor(((i + .5) / 4) * pts.length)]);
  for (let it = 0; it < 6; it++) {
    const sums = cents.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < cents.length; c++) {
        const dr = p[0] - cents[c][0], dg = p[1] - cents[c][1], db = p[2] - cents[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; bi = c; }
      }
      const s = sums[bi];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    cents = cents.map((c, i) => (sums[i][3]
      ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]]
      : c));
  }

  // 评分：簇占比 × 彩度（避免选中大面积灰白背景），同时惩罚过暗/过亮
  let bestHsl = avgHsl, bestScore = -1;
  for (const s of sumsOf(pts, cents)) {
    const hsl = rgbToHsl(s.r, s.g, s.b);
    const [, sat, lig] = hsl;
    const chroma = sat * (1 - Math.abs(lig - .5) * .9);
    const score = s.count * chroma;
    if (score > bestScore) { bestScore = score; bestHsl = hsl; }
  }
  // 基色彩度过低时略作提升，保证主题可辨识（对应原工程对固定设计色的中和）
  if (bestHsl[1] < .18) bestHsl = [bestHsl[0], .18 + bestHsl[1] * .6, bestHsl[2]];
  return bestHsl;
}

function sumsOf(pts, cents) {
  const buckets = cents.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
  for (const p of pts) {
    let bi = 0, bd = Infinity;
    for (let c = 0; c < cents.length; c++) {
      const dr = p[0] - cents[c][0], dg = p[1] - cents[c][1], db = p[2] - cents[c][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; bi = c; }
    }
    const b = buckets[bi];
    b.r += p[0]; b.g += p[1]; b.b += p[2]; b.count++;
  }
  return buckets.map((b) => b.count
    ? { r: b.r / b.count, g: b.g / b.count, b: b.b / b.count, count: b.count }
    : { r: 128, g: 128, b: 128, count: 0 });
}

const SECONDARY_S = .55, TERTIARY_H_SHIFT = 52;

/** 应用整套方案到 CSS 变量。mode 档位（亮度模式）：100 暗 / 500 标准 / 600 / 800 亮 */
export function applyMonet(hsl, mode = 500) {
  const dark = mode < 400;
  monet.scheme = dark ? "dark" : "light";
  monet.baseHsl = hsl;
  const [h, s] = hsl;
  const map = dark ? DARK : LIGHT;
  const root = document.documentElement.style;
  for (const [role, t] of Object.entries(map)) {
    const isSecondary = role.startsWith("secondary");
    const isTertiary = role.startsWith("tertiary");
    const hue = isTertiary ? h + TERTIARY_H_SHIFT : h;
    const sat = isSecondary ? s * SECONDARY_S : (isTertiary ? Math.min(1, s * .9 + .08) : s);
    root.setProperty(CSS_VAR[role], tone(hue, sat, t));
  }
  // 纯中性 surface 系（neutral palette：同 hue 低饱和）
  const ns = Math.min(s * .18, .12);
  root.setProperty("--md-surface", tone(h, ns, map.surface));
  root.setProperty("--md-on-surface", tone(h, ns, map.onSurface));
  root.setProperty("--md-surface-variant", tone(h, ns, map.surfaceVariant));
  root.setProperty("--md-on-surface-variant", tone(h, ns, map.onSurfaceVariant));
  for (const k of ["surfaceContainerLowest", "surfaceContainerLow", "surfaceContainer", "surfaceContainerHigh", "surfaceContainerHighest"]) {
    root.setProperty(CSS_VAR[k], tone(h, ns, map[k]));
  }
  root.setProperty("--md-scrim", dark ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.45)");
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0a0d10" : "#101516");
}

/** 重取色入口（对应广播「取色」）：壁纸画布 → 基色 → 依亮度模式重染全部 UI */
export function recolorFrom(wallpaperCanvas, mode) {
  return new Promise((resolve) => {
    // 双 rAF：让壁纸先绘制完成再取样（对应原工程 70 帧等待的门控语义）
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const hsl = extractBase(wallpaperCanvas);
      applyMonet(hsl, mode);
      resolve(hsl);
    }));
  });
}
