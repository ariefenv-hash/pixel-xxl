/* desktop.js —— 桌面：11 图标分页（忠实布局）、时钟大件、页点、飞入错峰、
 * 分页手势（÷5 越界阻尼、阈值 -50/-274、回弹 /8）、返回热区 y<-320、
 * 底部上滑进后台（起手 y<-342、过 -300 判入）、抽屉起手带 -280<y<-200 */

import { state } from "./store.js";
import { emit, on } from "./bus.js";
import { addHandler } from "./input.js";
import { APPS } from "./apps/registry.js";
import { makeIcon, makeClockIcon } from "./icons.js";

const el = () => document.getElementById("desktop");

/* 图标布局（scratch 坐标，页宽 324；bilibili 的 204 = -120 + 324 页内位） */
const GRID = [
  { id: "设置", x: -120, y: 60, page: 0 },
  { id: "相册", x: -40, y: 60, page: 0 },
  { id: "商店", x: 40, y: 60, page: 0 },
  { id: "通知", x: 120, y: 60, page: 0 },
  { id: "视频", x: -120, y: -10, page: 0 },
  { id: "电话", x: -40, y: -10, page: 0 },
  { id: "个性化", x: 40, y: -10, page: 0 },
  { id: "music", x: 120, y: -10, page: 0 },
  { id: "计算器", x: -120, y: -80, page: 0 },
  { id: "bilibili", x: 204, y: 60, page: 1 },
];
const CLOCK_POS = { x: -80, y: 200, size: 200 };

const icons = [];
let clockNode = null;

export function buildDesktop() {
  const root = el();
  root.innerHTML = "";

  for (const def of GRID) {
    const app = APPS[def.id];
    const node = document.createElement("div");
    node.className = "d-icon";
    const ic = makeIcon(def.id, { size: 54 });
    ic.style.background = app.color;
    ic.style.color = "rgba(255,255,255,.94)";
    node.appendChild(ic);
    const lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.textContent = def.id;
    node.appendChild(lbl);
    root.appendChild(node);
    icons.push({ def, node, delay: flyDelay(def.x, def.y) });
  }

  /* 图标点开（用距离守卫避免与分页手势冲突） */
  root.addEventListener("pointerup", (e) => {
    if (state.mode !== "desktop" || state.drawer.open || state.locked) return;
    const iconEl = e.target.closest(".d-icon, .d-clock");
    if (!iconEl) return;
    if (pageDrag.moved) return;
    if (state.pageX !== currentPageRest()) return;
    const id = iconEl.classList.contains("d-clock") ? "时钟"
      : icons.find((i) => i.node === iconEl)?.def.id;
    if (id) emit("open-app", id);
  });

  // 时钟大件（动态图标：时/分/秒针三层实时旋转 —— 对应原工程三层克隆）
  clockNode = document.createElement("div");
  clockNode.className = "d-clock";
  const face = document.createElement("div");
  face.className = "clock-face";
  const clockIcon = makeClockIcon(140);
  clockIcon.style.background = "transparent";
  clockIcon.style.boxShadow = "none";
  face.appendChild(clockIcon);
  clockNode.appendChild(face);
  const digital = document.createElement("div");
  digital.className = "digital";
  clockNode.appendChild(digital);
  root.appendChild(clockNode);
  setInterval(() => {
    const d = new Date();
    digital.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, 1000);

  const dots = document.createElement("div");
  dots.className = "d-dots";
  dots.innerHTML = "<i></i><i></i>";
  root.appendChild(dots);

  const dockHint = document.createElement("div");
  dockHint.className = "d-dock-hint";
  root.appendChild(dockHint);

  registerGestures();
}

/* 飞入错峰帧数（原公式 round(20-|y*0.7|/13) + round(8-|x*0.7|/15)，30fps ≈ ×33ms） */
function flyDelay(x, y) {
  return Math.round(20 - (Math.abs(y * .7) / 13)) + Math.round(8 - Math.abs(x * .7) / 15);
}

function currentPageRest() { return state.currentPage * -324; }

/* 每帧布局：当前页图标 ×0.7 向心（忠实原工程），位置由 left/top 承载 */
export function layoutDesktop() {
  for (const { def, node } of icons) {
    const isCur = def.page === state.currentPage;
    const f = isCur ? .7 : 1;
    node.style.left = `${162 + (def.x + state.pageX) * f}px`;
    node.style.top = `${360 - def.y * f}px`;
  }
  const f = .7;
  clockNode.style.left = `${162 + (CLOCK_POS.x + state.pageX) * f}px`;
  clockNode.style.top = `${360 - CLOCK_POS.y * f}px`;

  el().querySelectorAll(".d-dots i").forEach((d, i) =>
    d.classList.toggle("on", i === state.currentPage));
}

/* 释放后回弹：pageX += (目标-pageX)/8（忠实原工程），rAF 驱动 */
let springing = false;
export function springPageTo(target) {
  if (springing) return;
  springing = true;
  const step = () => {
    state.pageX += (target - state.pageX) / 8;
    layoutDesktop();
    if (Math.abs(target - state.pageX) < .4) {
      state.pageX = target;
      layoutDesktop();
      springing = false;
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const pageDrag = { moved: false, startX: 0 };

function registerGestures() {
  /* 桌面分页（页宽 324，越界阻尼 ÷5，阈值 -50 / -274）。
 * test 排除底部两块手势区，让位给 返回热区 / 后台上滑 / 抽屉起手带。 */
  addHandler("page-drag", {
    test: (x, y) => state.mode === "desktop" && !state.drawer.open && !state.recentsOpen &&
      !state.openApp && y > -342 && !(y > -280 && y < -200),
    onDown(g) { pageDrag.moved = false; pageDrag.startX = state.pageX; },
    onMove(g) {
      if (Math.abs(g.dx) > 20) pageDrag.moved = true;
      if (!pageDrag.moved) return;
      let nx = pageDrag.startX + g.dx;
      if (state.currentPage === 0 && nx > 0) nx = pageDrag.startX + g.dx / 5;
      if (state.currentPage === 1 && nx < -324) nx = pageDrag.startX + g.dx / 5;
      state.pageX = nx;
      layoutDesktop();
    },
    onUp(g) {
      if (pageDrag.moved) {
        // 两阈值分属不同起手页的分支（原工程在拖拽中切换当前页），必须 else-if
        if (state.currentPage === 0 && state.pageX < -50) state.currentPage = 1;
        else if (state.currentPage === 1 && state.pageX > -274) state.currentPage = 0;
      }
      springPageTo(currentPageRest());
    },
  });

  /* 底部上滑 → 后台（起手 y<-342，松手前越过 -300 判入）。
   * 优先级高于返回热区：两块热区在原工程中是并行脚本，此处以声明顺序表达仲裁。 */
  addHandler("recents-swipe", {
    test: (x, y) => y < -342 && state.mode === "desktop" && !state.drawer.open && !state.openApp,
    onUp(g) { if (g.y > -300 && g.dy > 30) emit("open-recents"); },
  });

  /* 返回热区 y<-320（对应「交互方式」角色） */
  addHandler("back-zone", {
    test: (x, y) => y < -320 && state.mode !== "lock" && state.mode !== "boot" && state.mode !== "onboard",
    onDown() { emit("back-gesture"); },
  });

  /* 抽屉起手带：关闭态 -280<y<-200，打开态任意位置；开合阈值 ±50 */
  let dd = null;
  addHandler("drawer-gesture", {
    test: (x, y) => state.mode === "desktop" && !state.recentsOpen && !state.openApp &&
      (state.drawer.open ? y < 330 : y > -280 && y < -200),
    onDown(g) { dd = { y0: g.y, base: state.drawer.y }; },
    onMove(g) {
      if (!dd) return;
      // 关闭态：把拖距映射到 -695→0 的轨道（317px 拖满）；打开态：1:1 跟手
      state.drawer.y = state.drawer.open
        ? Math.max(-695, Math.min(60, dd.base + g.dy))
        : Math.max(-695, Math.min(60, -695 + (g.y - dd.y0 + 317) * (695 / 317)));
      emit("drawer-y", state.drawer.y);
    },
    onUp(g) {
      if (!dd) return;
      const dy = g.y - dd.y0;
      if (!state.drawer.open && dy > 50) emit("drawer-toggle", true);
      else if (state.drawer.open && dy < -50) emit("drawer-toggle", false);
      else emit("drawer-settle");
      dd = null;
    },
  });

  on("key-page", (dir) => {
    if (state.mode !== "desktop") return;
    state.currentPage = Math.max(0, Math.min(1, state.currentPage + dir));
    springPageTo(currentPageRest());
  });
}

/* 图标飞入（对应「引导结束」后 飞入动画状态=1） */
export function flyInIcons() {
  layoutDesktop();
  const root = el();
  root.hidden = false;
  for (const { node, delay } of icons) {
    node.style.opacity = "0";
    setTimeout(() => { node.style.opacity = "1"; }, delay * 33);
  }
  clockNode.style.opacity = "0";
  setTimeout(() => { clockNode.style.opacity = "1"; }, 420);
}
