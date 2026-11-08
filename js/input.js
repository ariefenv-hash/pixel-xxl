/* input.js —— 指针 → 逻辑坐标（Scratch 系：x∈[-162,162] y∈[-360,360]，y 向上）
 * 手势仲裁：同一时刻只有一个 claimant（桌面分页 / 抽屉 / 后台 / 返回柄 / 窗口）。
 * 忠实阈值（自原工程逐条提取）：
 *   分页判定位移 >20｜返回热区 y<-320｜后台起手 y<-342、过 -300 判入｜
 *   抽屉起手带 -280<y<-200、开合阈值 ±50｜预测性返回柄 drag 提交 x<80 / 松手 x<140 */

import { state } from "./store.js";
import { emit } from "./bus.js";

export const G = {
  scale: 1,
  down: false,
  x: 0, y: 0,          // 逻辑坐标（Scratch 系）
  sx: 0, sy: 0,        // 起手逻辑坐标
  dx: 0, dy: 0,        // 相对起手位移
  claim: null,         // 当前手势占用者
};

export function toLogical(clientX, clientY) {
  const r = document.getElementById("screen").getBoundingClientRect();
  const px = (clientX - r.left) / (r.width / 324);
  const py = (clientY - r.top) / (r.height / 720);
  return { x: px - 162, y: 360 - py };
}

/* 命中测试工具（等价 abs(mouse - pos) < half 的判定式） */
export function hit(lx, ly, cx, cy, hw, hh) {
  return Math.abs(lx - cx) < hw && Math.abs(ly - cy) < hh;
}

const handlers = new Map(); // zone -> {test(x,y,e), onDown, onMove, onUp, capture}

export function addHandler(name, def) { handlers.set(name, def); }

function screenEl() { return document.getElementById("screen"); }

function pos(e) {
  const p = toLogical(e.clientX, e.clientY);
  G.x = p.x; G.y = p.y;
  G.dx = G.x - G.sx; G.dy = G.y - G.sy;
}

function down(e) {
  if (state.mode === "boot" || state.mode === "onboard") return; // 这些层自管点击
  const p = toLogical(e.clientX, e.clientY);
  G.sx = G.x = p.x; G.sy = G.y = p.y;
  G.dx = G.dy = 0;
  G.down = true;
  G.claim = null;
  try { screenEl().setPointerCapture?.(e.pointerId); } catch { /* 合成事件可能无活动指针 */ }
  /* 快捷设置开启态：整屏手势直路由给 shade（其余 handler 全部短路） */
  if (state.shadeOpen) {
    const h = handlers.get("shade");
    if (h) { G.claim = "shade"; h.onDown?.(G); }
    return;
  }
  // 依优先级询问各 handler（注册顺序即优先级）
  for (const [name, h] of handlers) {
    if (!h.test || h.test(G.x, G.y)) {
      G.claim = name;
      h.onDown?.(G);
      break;
    }
  }
}

function move(e) {
  if (!G.down) return;
  pos(e);
  if (G.claim) handlers.get(G.claim)?.onMove?.(G);
}

function up(e) {
  if (!G.down) return;
  pos(e);
  G.down = false;
  if (G.claim) handlers.get(G.claim)?.onUp?.(G);
  G.claim = null;
}

export function initInput() {
  const el = screenEl();
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);

  /* 键盘：忠实原工程 —— a 锁屏 / d 解锁；方向键翻页（触屏用户走滑动） */
  window.addEventListener("keydown", (e) => {
    if (e.key === "a" || e.key === "A") emit("key-lock");
    if (e.key === "d" || e.key === "D") emit("key-unlock");
    if (e.key === "ArrowLeft") emit("key-page", -1);
    if (e.key === "ArrowRight") emit("key-page", 1);
    if (e.key === "Escape") emit("key-back");
  });

  /* 缩放适配 */
  const fit = () => {
    const s = Math.min(window.innerWidth / 348, window.innerHeight / 748, 1.6);
    G.scale = s;
    document.documentElement.style.setProperty("--scale", s.toFixed(4));
  };
  fit();
  window.addEventListener("resize", fit);
}
