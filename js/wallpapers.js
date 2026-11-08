/* wallpapers.js —— 7 张程序化壁纸（对应原工程 壁纸编号 1~7）。
 * 原工程 5 张壁纸为用户照片套 SVG 壳（30+MB，分析报告 §2/§7.3），此处改为
 * 画布绘制的同氛围替代：1/2 忠实还原两张纯色（#101516 / #212d33）。 */

function solid(color) {
  return (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  };
}

function lerpC(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
function css(c, alpha = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
}

/* 3 晨曦 —— 蜜桃到薰衣草的竖向渐变 + 太阳盘 */
function dawn(ctx, w, h) {
  const top = [255, 173, 133], mid = [255, 129, 141], bot = [159, 122, 199];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(top)); g.addColorStop(.52, css(mid)); g.addColorStop(1, css(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * .5, h * .3, 0, w * .5, h * .3, w * .34);
  sun.addColorStop(0, "rgba(255,244,214,.95)");
  sun.addColorStop(.35, "rgba(255,244,214,.28)");
  sun.addColorStop(1, "rgba(255,244,214,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h * .72);
  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.beginPath(); ctx.ellipse(w * .5, h * .985, w * .9, h * .07, 0, 0, Math.PI * 2); ctx.fill();
}

/* 4 极光 —— 深海夜色 + 三条极光丝带 */
function aurora(ctx, w, h) {
  ctx.fillStyle = "#07131c"; ctx.fillRect(0, 0, w, h);
  const ribbons = [
    ["rgba(64,224,180,.5)", -120, 520, 140],
    ["rgba(90,140,255,.42)", 60, 620, 190],
    ["rgba(180,110,255,.35)", -40, 700, 120],
  ];
  ctx.globalCompositeOperation = "lighter";
  for (const [color, baseY, amp, thick] of ribbons) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = baseY + Math.sin((x / w) * Math.PI * 2.2 + baseY) * amp * .12 + Math.sin(x * .012) * 26;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let x = w; x >= 0; x -= 6) {
      const y = baseY + Math.sin((x / w) * Math.PI * 2.2 + baseY) * amp * .12 + Math.sin(x * .012) * 26 + thick;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, baseY - amp, 0, baseY + thick + amp);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.5, color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w, y = Math.random() * h * .55, r = Math.random() * 1.4 + .3;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * .5 + .1})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

/* 5 绽放 —— 几何花冠（对应原工程几何风壁纸） */
function bloom(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#20222c"); g.addColorStop(1, "#101319");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const cx = w * .5, cy = h * .42;
  const petals = 12;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const r = w * .30;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a);
    const hue = 200 + i * 8;
    ctx.fillStyle = `hsla(${hue}, 46%, ${i % 2 ? 62 : 54}%, .5)`;
    ctx.beginPath();
    ctx.ellipse(r * .52, 0, r * .5, r * .17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath(); ctx.arc(cx, cy, w * .045, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 1.5;
  for (let rr = w * .18; rr < w * .8; rr += w * .12) {
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
  }
}

/* 6 海浪 —— 层叠正弦波 */
function waves(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#8ec5e8"); g.addColorStop(.5, "#5a8fd0"); g.addColorStop(1, "#274690");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const layers = [
    ["rgba(255,255,255,.30)", .58, 42, 0.9],
    ["rgba(255,255,255,.20)", .66, 58, 1.4],
    ["rgba(20,40,90,.35)", .78, 46, 1.1],
    ["rgba(10,25,60,.5)", .9, 60, 1.7],
  ];
  for (const [color, baseR, amp, freq] of layers) {
    const baseY = h * baseR;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const y = baseY + Math.sin(x * .01 * freq + baseR * 9) * amp + Math.sin(x * .023 * freq) * amp * .4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }
}

/* 7 暮色 —— 默认壁纸（壁纸编号=7）：暮光渐变网格 + 颗粒，致敬原工程的照片氛围 */
function dusk(ctx, w, h) {
  const stops = [
    [0.00, [24, 28, 48]], [0.30, [64, 60, 110]], [0.55, [150, 92, 134]],
    [0.75, [235, 130, 100]], [1.00, [28, 24, 38]],
  ];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [p, c] of stops) g.addColorStop(p, css(c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * .72, h * .60, 0, w * .72, h * .60, w * .5);
  glow.addColorStop(0, "rgba(255,196,120,.5)"); glow.addColorStop(1, "rgba(255,196,120,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  let gx = 0;
  for (let i = 0; i < 4200; i++) {
    gx += 0.6180339887;
    const x = (gx % 1) * w, y = (Math.random()) * h;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * .05})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.fillStyle = "rgba(12,10,20,.55)";
  ctx.beginPath();
  ctx.moveTo(0, h * .86);
  ctx.quadraticCurveTo(w * .3, h * .78, w * .55, h * .865);
  ctx.quadraticCurveTo(w * .8, h * .94, w, h * .88);
  ctx.lineTo(w, h); ctx.lineTo(0, h);
  ctx.closePath(); ctx.fill();
}

export const WALLPAPERS = [
  null,                       // 占位 0
  { name: "曜石", paint: solid("#101516") },   // 壁纸1（原工程纯色）
  { name: "墨蓝", paint: solid("#212d33") },   // 壁纸2（原工程纯色）
  { name: "晨曦", paint: dawn },
  { name: "极光", paint: aurora },
  { name: "绽放", paint: bloom },
  { name: "海浪", paint: waves },
  { name: "暮色", paint: dusk },               // 默认
];

export const WALLPAPER_SELECTABLE = [1, 2, 3, 4, 5, 6, 7];

/** 把壁纸 id 绘制到指定画布（供壁纸层/缩略图/取色复用） */
export function paintWallpaper(id, canvas) {
  const def = WALLPAPERS[id] || WALLPAPERS[7];
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  def.paint(ctx, w, h);
  return def;
}
