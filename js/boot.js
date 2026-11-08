/* boot.js —— 启动遮罩 → 174 帧程序化开机动画 → 门控（预渲染/取色）→ 广播「开机引导下一页」。
 * 忠实对应原工程 角色2：淡入 60 帧 → 逐帧 174 次 → 开机动画中=1 →
 * 等 渲染的进度≥渲染数 → 淡出 30 帧 → 广播 app加载 → 等 取色进度 → 广播 开机引导下一页 */

import { emit, on } from "./bus.js";
import { sfx } from "./audio.js";
import { state, setRuntime } from "./store.js";

const FRAME_COUNT = 174;
const C = ["#4c8df6", "#ea4335", "#fbbc05", "#34a853"];

/** 174 帧程序化动画：四色圆点聚合 → 自旋光环 → 「Pixel XXL」字标浮现 */
function drawBootFrame(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#101516";
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2 - 40;
  const p = t / FRAME_COUNT;

  if (p < .55) {
    // 阶段一：四点从四角螺旋聚拢（0 → 0.55）
    const k = easeInOut(p / .55);
    const orbit = (1 - k) * w * .46 + 8;
    const spin = k * Math.PI * 3.2;
    for (let i = 0; i < 4; i++) {
      const a = spin + (i / 4) * Math.PI * 2;
      const r = 13 + k * 6;
      ctx.fillStyle = C[i];
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * orbit, cy + Math.sin(a) * orbit * .8, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p < .8) {
    // 阶段二：光环自旋展开
    const k = (p - .55) / .25;
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * Math.PI * 2 + k * Math.PI * 2.4;
      ctx.strokeStyle = C[i];
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, 34, a0, a0 + Math.PI * 2 * (.55 - .28 * k), false);
      ctx.stroke();
    }
  } else {
    // 阶段三：字标
    const k = (p - .8) / .2;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = "#eef1f6";
    ctx.font = `600 ${Math.round(w * .12)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "6px";
    ctx.fillText("Pixel XXL", cx, cy);
    ctx.restore();
  }

  // 底部进度微光条
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(w * .2, h * .82, w * .6, 3);
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(w * .2, h * .82, w * .6 * p, 3);
}

function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

export function initBoot() {
  const layer = document.getElementById("boot");
  const splash = document.getElementById("splash");
  const canvas = document.getElementById("boot-canvas");
  const ctx = canvas.getContext("2d");

  const skip = document.createElement("button");
  skip.className = "boot-skip";
  skip.textContent = "跳过 ››";
  layer.appendChild(skip);

  let started = false;

  splash.addEventListener("pointerdown", () => {
    if (started) return;
    started = true;
    sfx.boot();
    splash.style.transition = "opacity .45s";
    splash.style.opacity = "0";
    setTimeout(() => (splash.hidden = true), 460);
    runBoot();
  });

  skip.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    finishBoot();
  });

  function runBoot() {
    layer.classList.add("live");
    let frame = 0;
    const step = () => {
      drawBootFrame(ctx, canvas.width, canvas.height, frame);
      frame++;
      if (frame <= FRAME_COUNT && !layer.hidden) {
        setTimeout(() => requestAnimationFrame(step), 1000 / 30); // 30fps，忠实原工程
      } else {
        // 开机动画完 → 门控：等图标预渲染 + 取色（此处由桌面/取色模块 resolve）
        emit("boot-anim-done");
      }
    };
    step();
  }

  on("boot-anim-done", () => {
    setTimeout(() => finishBoot(), 400);
  });

  function finishBoot() {
    if (state.mode !== "boot") return;
    layer.hidden = true;
    setRuntime({ mode: "onboard" });
    emit("boot-finished");   // ≈ 广播「开机引导下一页」序列起点
  }
}
