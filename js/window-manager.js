/* window-manager.js —— 应用窗口管理：
 * - 图标→窗口 变焦开合（FLIP），曲线风格 0=指数趋近 / 1=分段缓动（忠实两套曲线开关）
 * - md3e 预测性返回柄（右缘拖拽：拖入 x<80 预告、松手 x<140 提交）
 * - 子页推拉（master x→-100 亮度-30% ↔ detail 自 +100 滑入）
 * - 返回路由：子页 → 主页 → 关窗；同时驱动后台列表 */

import { state, setRuntime } from "./store.js";
import { on, emit } from "./bus.js";
import { APPS } from "./apps/registry.js";
import { sfx } from "./audio.js";
import { pushRecent, closeRecents } from "./recents.js";
import { openDrawer } from "./drawer.js";

const layer = () => document.getElementById("windows");
let current = null;   // {id, win, api, iconEl}

/* 窗口目标矩形（scratch: 300×648 @ (0,0)） */
const WIN_RECT = { x: 162, y: 360, w: 300, h: 648 };

export function openApp(id, sourceRect = null) {
  if (state.openApp || state.mode === "boot" || state.mode === "onboard") return;
  const app = APPS[id];
  if (!app) return;

  closeRecents();
  openDrawer(false);

  const win = document.createElement("div");
  win.className = "app-window";
  layer().appendChild(win);
  layer().hidden = false;
  layer().classList.add("live");

  /* 挂载应用内容 */
  const api = app.mount(win, {
    openSub: (detailEl) => mountSub(win, detailEl),
    closeSub: () => unmountSub(win),
    close: () => closeApp(),
    title: (t) => {
      const h = win.querySelector(".aw-header .t");
      if (h) h.textContent = t;
    },
  });

  /* md3e 返回柄 */
  const handle = buildHandle();
  win.appendChild(handle);

  /* FLIP 起点矩形 */
  const from = sourceRect || findIconRect(id) || { x: 162, y: 700, w: 54, h: 54 };
  setRuntime({ openApp: id, mode: "app" });
  pushRecent(id);
  emit("app-opened", id);

  animateZoom(win, from, WIN_RECT, false, () => {
    win.style.transform = "";
    win.style.borderRadius = "";
  });
  sfx.tick();
  current = { id, win, api };
}

export function closeApp() {
  if (!current) return;
  const { id, win, api } = current;
  api?.destroy?.();
  const to = findIconRect(id) || { x: 162, y: 700, w: 54, h: 54 };
  animateZoom(win, to, { x: 162, y: 360, w: 300, h: 648 }, true, () => {
    win.remove();
    if (!layer().children.length) {
      layer().hidden = true;
      layer().classList.remove("live");
    }
  });
  setRuntime({ openApp: null, mode: state.locked ? "lock" : "desktop" });
  current = null;
  emit("app-closed", id);
}

/* 子页推拉：master x→-100 / 亮度-30%，detail 自 +100 滑入（忠实原工程参数） */
function mountSub(win, detailEl) {
  let master = win.querySelector(".aw-master");
  if (!master) {
    master = document.createElement("div");
    master.className = "aw-master";
    while (win.firstChild && win.firstChild !== win.querySelector(".md3e-handle")) {
      master.appendChild(win.firstChild);
    }
    win.insertBefore(master, win.querySelector(".md3e-handle"));
  }
  master.classList.add("pushed");
  let detail = win.querySelector(".aw-detail");
  if (!detail) {
    detail = document.createElement("div");
    detail.className = "aw-detail";
    win.insertBefore(detail, win.querySelector(".md3e-handle"));
  }
  detail.innerHTML = "";
  detail.appendChild(detailEl);
  requestAnimationFrame(() => detail.classList.add("show"));
  win.dataset.sub = "1";
}

function unmountSub(win) {
  const master = win.querySelector(".aw-master");
  const detail = win.querySelector(".aw-detail");
  if (master) master.classList.remove("pushed");
  if (detail) {
    detail.classList.remove("show");
    setTimeout(() => (detail.innerHTML = ""), 400);
  }
  win.dataset.sub = "";
}

/* 返回路由 */
function back() {
  if (state.mode === "recents") { closeRecents(); setRuntime({ mode: state.openApp ? "app" : "desktop" }); return; }
  if (!current) return;
  const win = current.win;
  if (win.dataset.sub) {
    current.api?.onBack?.();          // 应用自决子页回退（状态机）
    unmountSub(win);
    sfx.tick();
  } else {
    closeApp();
  }
}

/* ── md3e 预测性返回柄 ─────────────────────────────── */
function buildHandle() {
  const h = document.createElement("div");
  h.className = "md3e-handle";
  h.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M14.8 5.2 8 12l6.8 6.8 1.4-1.4L10.8 12l5.4-5.4-1.4-1.4z"/></svg>`;
  let drag = null;

  h.addEventListener("pointerdown", (e) => {
    if (!current) return;
    e.stopPropagation();
    try { h.setPointerCapture(e.pointerId); } catch { /* 合成事件可能无活动指针 */ }
    const r = document.getElementById("screen").getBoundingClientRect();
    const scale = r.width / 324;
    drag = {
      x0: (e.clientX - r.left) / scale,
      y0: (e.clientY - r.top) / scale,
      moved: false,
    };
    h.style.transition = "none";
  });

  h.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = document.getElementById("screen").getBoundingClientRect();
    const scale = r.width / 324;
    const lx = (e.clientX - r.left) / scale;
    const ly = (e.clientY - r.top) / scale;
    // 起手必须在右缘（x>120，忠实原工程热区）；跟手 + y 弱跟随（/10）
    if (!drag.moved && drag.x0 < 120) { drag = null; return; }
    drag.moved = true;
    const dx = lx - drag.x0;
    const x = Math.max(-10, Math.min(200, 200 + dx));
    h.style.transform = `translateX(${x - 200}px) translateY(${(ly - drag.y0) / 10}px)`;
    h.classList.toggle("stretch", x < 80);
  });

  h.addEventListener("pointerup", () => {
    if (!drag) return;
    const m = h.style.transform.match(/translateX\((-?[\d.]+)px\)/);
    const shifted = m ? Math.abs(parseFloat(m[1])) : 0;
    const x = 200 - shifted;
    h.classList.remove("stretch");
    h.style.transition = "transform .3s var(--ease-emphasized)";
    h.style.transform = "";
    drag = null;
    if (x < 140) back();     // 松手提交（忠实阈值）
  });
  return h;
}

/* ── 变焦动画（曲线风格 0 / 1）───────────────────────── */
function animateZoom(el, from, to, closing, done) {
  const fx = from.x - from.w / 2, fy = from.y - from.h / 2;
  const sx = from.w / to.w, sy = from.h / to.h;

  if (state.curveStyle === 0) {
    // 指数趋近（原曲线风格 0：逐帧 x += (目标-x)/k）
    const k = closing
      ? { x: 0, y: 0, sx: 1, sy: 1, r: 28 }
      : { x: fx, y: fy, sx, sy, r: 62 };
    el.style.transformOrigin = "0 0";
    const step = () => {
      // 目标：开窗 → 0 位移 / 1 缩放；关窗 → 图标矩形
      const tx = closing ? fx : 0, ty = closing ? fy : 0;
      const tsx = closing ? sx : 1, tsy = closing ? sy : 1;
      k.x += (tx - k.x) / 6; k.y += (ty - k.y) / 6;
      k.sx += (tsx - k.sx) / 6; k.sy += (tsy - k.sy) / 6;
      k.r += ((closing ? 62 : 28) - k.r) / 6;
      apply(el, k.x, k.y, k.sx, k.sy, k.r, to);
      if (Math.abs(k.x - tx) < .5 && Math.abs(k.sx - tsx) < .005) {
        done();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } else {
    // 分段缓动（原曲线风格 1：CSS emphasized 曲线一次性过渡）
    el.style.transformOrigin = "0 0";
    apply(el, fx, fy, sx, sy, closing ? 28 : 62, to);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition =
        `transform 480ms var(--ease-emphasized), border-radius 480ms var(--ease-emphasized)`;
      apply(el, closing ? fx : 0, closing ? fy : 0, closing ? sx : 1, closing ? sy : 1, closing ? 62 : 28, to);
      setTimeout(done, 500);
    }));
  }
}

function apply(el, x, y, sx, sy, radius, to) {
  el.style.transform =
    `translate(${x - (162 - to.w / 2)}px, ${y - (360 - to.h / 2)}px) scale(${sx}, ${sy})`;
  el.style.borderRadius = `${radius}px`;
}

function findIconRect(id) {
  const icons = document.querySelectorAll("#desktop .d-icon");
  for (const node of icons) {
    const lbl = node.querySelector(".lbl");
    if (lbl && lbl.textContent === id) {
      const r = node.getBoundingClientRect();
      const s = document.getElementById("screen").getBoundingClientRect();
      const scale = s.width / 324;
      return {
        x: (r.left + r.width / 2 - s.left) / scale,
        y: (r.top + r.height / 2 - s.top) / scale,
        w: r.width / scale,
        h: r.height / scale,
      };
    }
  }
  return null;
}

export function initWindowManager() {
  on("open-app", (id) => openApp(id));
  on("back-gesture", back);
  on("key-back", back);
  on("close-app", closeApp);
}
