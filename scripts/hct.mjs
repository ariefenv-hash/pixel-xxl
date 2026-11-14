/**
 * hct.mjs — HCT 色彩空间（CAM16 hue/chroma + CIE L* tone）
 *
 * 为什么必须是 HCT 而不是 HSL/OKLCH：Material You 的「tone」定义就是 CIE L*，
 * 同一 tone 在任意 hue/chroma 下的相对亮度一致——这是 SystemUI 用 tone 40/80
 * 之类固定档位保证对比度合规的底层依据。用 HSL 的 L 会破坏这套保证。
 *
 * 出处：material-color-utils Hct / Cam16 / ViewingConditions（md3 §2.2 已索引），
 * 数学结构与 AOSP packages/SystemUI/monet/ColorScheme.java 一致：
 *   seed → HCT → TonalPalette(hue, chroma) → tone(t) → 角色映射
 *
 * 该文件只在构建期（Node）运行，产物是 CSS 变量；运行时零计算。
 */

const D65 = [95.047, 100.0, 108.883];

/* ------------------------------ 线性化与 XYZ ------------------------------ */

const linearize = (c) => {
  const v = c / 255;
  return v <= 0.040449936 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const delinearize = (v) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
};

/** sRGB(0..255) → XYZ(0..100, D65) */
export function xyzFromRgb(rgb) {
  const [r, g, b] = rgb.map(linearize);
  return [
    (0.41233895 * r + 0.35762064 * g + 0.18051042 * b) * 100,
    (0.2126 * r + 0.7152 * g + 0.0722 * b) * 100,
    (0.01932141 * r + 0.11916382 * g + 0.95034478 * b) * 100,
  ];
}

/** XYZ(0..100) → 线性 sRGB（未裁剪，用于色域判定） */
function linearRgbFromXyz([x, y, z]) {
  const X = x / 100, Y = y / 100, Z = z / 100;
  return [
    3.2413774792388685 * X - 1.5376652402851851 * Y - 0.49885366846268053 * Z,
    -0.9691452513005321 * X + 1.8758853451067872 * Y + 0.04156585616912061 * Z,
    0.05562093689691305 * X - 0.20395524564742123 * Y + 1.0571799111220335 * Z,
  ];
}

/* --------------------------- Y ↔ L*（tone 的定义） --------------------------- */

export const yFromLstar = (lstar) =>
  lstar > 8 ? 100 * Math.pow((lstar + 16) / 116, 3) : (100 * lstar) / 903.2962962;

export const lstarFromY = (y) =>
  y > 0.0088564516 ? 116 * Math.cbrt(y / 100) - 16 : 903.2962962 * (y / 100);

/* ------------------------------- 观察条件 ------------------------------- */

function viewingConditions() {
  const surround = 2.0;
  const adaptingLuminance = (200 / Math.PI) * yFromLstar(50) / 100;
  const backgroundLstar = 50;

  const rgbW = [
    0.401288 * D65[0] + 0.650173 * D65[1] - 0.051461 * D65[2],
    -0.250268 * D65[0] + 1.204414 * D65[1] + 0.045854 * D65[2],
    -0.002079 * D65[0] + 0.048952 * D65[1] + 0.953127 * D65[2],
  ];

  const f = 0.8 + surround / 10;
  const c = f >= 0.9 ? 0.59 + (0.69 - 0.59) * (f - 0.9) * 10 : 0.525 + (0.59 - 0.525) * (f - 0.8) * 10;
  let d = f * (1 - (1 / 3.6) * Math.exp((-adaptingLuminance - 42) / 92));
  d = Math.min(1, Math.max(0, d));
  const nc = f;
  const rgbD = rgbW.map((w) => d * (100 / w) + 1 - d);

  const k = 1 / (5 * adaptingLuminance + 1);
  const k4 = k ** 4;
  const k4F = 1 - k4;
  const fl = k4 * adaptingLuminance + 0.1 * k4F * k4F * Math.cbrt(5 * adaptingLuminance);

  const n = yFromLstar(backgroundLstar) / D65[1];
  const z = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / Math.pow(n, 0.2);
  const ncb = nbb;

  const rgbAFactors = rgbD.map((v, i) => Math.pow((fl * v * rgbW[i]) / 100, 0.42));
  const rgbA = rgbAFactors.map((v) => (400 * v) / (v + 27.13));
  const aw = ((40 * rgbA[0] + 20 * rgbA[1] + rgbA[2]) / 20) * nbb;

  return { c, nc, ncb, n, z, nbb, fl, rgbD, aw };
}

const VC = viewingConditions();

/* ------------------------------ CAM16 正向 ------------------------------ */

/** XYZ(0..100) → { j, chroma, hue } */
export function cam16FromXyz([x, y, z]) {
  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * z;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * z;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * z;

  const adapt = (cVal, i) => {
    const d = VC.rgbD[i] * cVal;
    const af = Math.pow((VC.fl * Math.abs(d)) / 100, 0.42);
    return Math.sign(d) * (400 * af) / (af + 27.13);
  };
  const rA = adapt(rC, 0);
  const gA = adapt(gC, 1);
  const bA = adapt(bC, 2);

  const a = (11 * rA - 12 * gA + bA) / 11;
  const b = (rA + gA - 2 * bA) / 9;
  const u = (20 * rA + 20 * gA + 21 * bA) / 20;
  const p2 = (40 * rA + 20 * gA + bA) / 20;

  let hue = (Math.atan2(b, a) * 180) / Math.PI;
  if (hue < 0) hue += 360;

  const ac = p2 * VC.nbb;
  const j = 100 * Math.pow(ac / VC.aw, VC.c * VC.z);

  const huePrime = hue < 20.14 ? hue + 360 : hue;
  const eHue = 0.25 * (Math.cos(((huePrime * Math.PI) / 180) + 2) + 3.8);
  const p1 = (50000 / 13) * eHue * VC.nc * VC.ncb;
  const t = (p1 * Math.hypot(a, b)) / (u + 0.305);
  const alpha = Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73) * Math.pow(t, 0.9);
  const chroma = alpha * Math.sqrt(j / 100);

  return { j, chroma, hue };
}

/* ------------------------------ CAM16 反向 ------------------------------ */

/** { j, chroma, hue } → XYZ(0..100)；可能落在色域外观测，调用方负责裁剪 */
export function xyzFromCam16(j, chroma, hue) {
  if (j <= 0) return [0, 0, 0];
  const alpha = chroma === 0 ? 0 : chroma / Math.sqrt(j / 100);
  const t = Math.pow(alpha / Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73), 1 / 0.9);

  const hueRad = (hue * Math.PI) / 180;
  const eHue = 0.25 * (Math.cos(hueRad + 2) + 3.8);
  const ac = VC.aw * Math.pow(j / 100, 1 / (VC.c * VC.z));
  const p1 = (50000 / 13) * eHue * VC.nc * VC.ncb;
  const p2 = ac / VC.nbb;

  const gamma = (23 * p2 * t) / (23 * p1 + 11 * t * Math.cos(hueRad) + 108 * t * Math.sin(hueRad));
  const a = gamma * Math.cos(hueRad);
  const b = gamma * Math.sin(hueRad);

  const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
  const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
  const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;

  const unadapt = (val, i) => {
    const absVal = Math.abs(val);
    const base = Math.max(0, (27.13 * absVal) / (400 - absVal));
    const cVal = Math.sign(val) * (100 / VC.fl) * Math.pow(base, 1 / 0.42);
    return cVal / VC.rgbD[i];
  };
  const rC = unadapt(rA, 0);
  const gC = unadapt(gA, 1);
  const bC = unadapt(bA, 2);

  return [
    1.86206786 * rC - 1.01125463 * gC + 0.14918677 * bC,
    0.38752654 * rC + 0.62144744 * gC - 0.00897398 * bC,
    -0.0158415 * rC - 0.03412294 * gC + 1.04996444 * bC,
  ];
}

/* -------------------------------- HCT API -------------------------------- */

/** RGB(0..255) → { hue, chroma, tone } */
export function hctFromRgb(rgb) {
  const xyz = xyzFromRgb(rgb);
  const { j, chroma, hue } = cam16FromXyz(xyz);
  return { hue, chroma, tone: lstarFromY(xyz[1]) };
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** 求 tone 对应的 XYZ：二分 J，使 Y 命中目标；色域外时二分 chroma 回退 */
export function rgbFromHct(hue, chroma, tone) {
  if (tone <= 0) return [0, 0, 0];
  if (tone >= 100) return [255, 255, 255];

  const targetY = yFromLstar(tone);

  // chroma 参与亮度感知，故每次试探 chroma 都必须重解 J，否则 tone 会漂
  const solveAt = (c) => {
    let lo = 0;
    let hi = 400;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (xyzFromCam16(mid, c, hue)[1] < targetY) lo = mid;
      else hi = mid;
    }
    return linearRgbFromXyz(xyzFromCam16((lo + hi) / 2, c, hue));
  };

  let linear = solveAt(chroma);
  if (!inGamut(linear)) {
    let lo = 0;
    let hi = chroma;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(solveAt(mid))) lo = mid;
      else hi = mid;
    }
    linear = solveAt(lo);
  }
  return linear.map(delinearize);
}

export const hexFromRgb = (rgb) =>
  '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

export const rgbFromHex = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

/** Material 的 TonalPalette：固定 hue/chroma，按 tone 取色 */
export function tonalPalette(hue, chroma) {
  return (tone) => hexFromRgb(rgbFromHct(hue, chroma, tone));
}
