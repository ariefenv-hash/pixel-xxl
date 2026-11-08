/* drawer.js —— All Apps 抽屉：自 y=-695 滑入；任何返回/锁屏/进应用即整落
 * （一次性关闭逻辑，忠实原工程）；越 0 软阻尼 ÷10。 */

import { state } from "./store.js";
import { on, emit } from "./bus.js";
import { APPS } from "./apps/registry.js";
import { makeIcon } from "./icons.js";

const el = () => document.getElementById("drawer");
let sheet, built = false;

export function buildDrawer() {
  const root = el();
  sheet = document.createElement("div");
  sheet.className = "drawer-sheet";
  sheet.innerHTML = `
    <div class="drawer-grab"></div>
    <div class="drawer-search">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
      搜索应用
    </div>
    <div class="drawer-grid"></div>`;
  root.appendChild(sheet);
  const grid = sheet.querySelector(".drawer-grid");

  for (const [id, app] of Object.entries(APPS)) {
    const item = document.createElement("div");
    item.className = "dr-app";
    const ic = makeIcon(id, { size: 52 });
    ic.style.background = app.color;
    ic.style.color = "rgba(255,255,255,.94)";
    item.appendChild(ic);
    const lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.textContent = id;
    item.appendChild(lbl);
    item.addEventListener("pointerup", () => {
      if (state.mode !== "desktop") return;
      openDrawer(false);
      emit("open-app", id);
    });
    grid.appendChild(item);
  }
  built = true;
  layout();
}

export function openDrawer(open) {
  state.drawer.open = open;
  if (built) el().hidden = !open;
  emit("drawer-y", state.drawer.y);
  if (!open) state.drawer.y = -695;
}

on("drawer-toggle", (open) => openDrawer(open));
on("drawer-settle", () => {
  state.drawer.y = state.drawer.open ? 0 : -695;
  emit("drawer-y", state.drawer.y);
});
on("key-back", closeIfOpen);
on("back-gesture", closeIfOpen);
on("open-app", closeIfOpen);
on("key-lock", closeIfOpen);

function closeIfOpen() {
  if (state.drawer.open) {
    state.drawer.open = false;
    state.drawer.y = -695;      // 一次性关闭：直接整落
    el().hidden = true;
    emit("drawer-y", -695);
  }
}

/* y: -695（合）→ 0（开）；越 0 段 ÷10 软化（忠实原工程）；拖动中自动显隐 */
export function layout() {
  if (!built) return;
  const y = state.drawer.y;
  const root = el();
  if (y > -694) root.hidden = false;
  else if (!state.drawer.open) root.hidden = true;
  const shown = y > 0 ? y / 10 : y;
  sheet.style.transform = `translateY(${(-shown).toFixed(1)}px)`;
  sheet.style.backdropFilter = `blur(${Math.max(0, Math.min(16, (y + 695) / 695 * 14)).toFixed(1)}px)`;
}

export function startDrawerLoop() {
  const loop = () => { layout(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
