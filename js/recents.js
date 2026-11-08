/* recents.js —— 多任务后台：卡片 x = 200 + 90·e^(0.001·((n-1)·(-160)+后台x))（原公式），
 * 拖动 ×1.5 跟手，点卡片回前台，上划卡片移除。 */

import { state } from "./store.js";
import { on, emit } from "./bus.js";
import { APPS } from "./apps/registry.js";
import { makeIcon } from "./icons.js";

const el = () => document.getElementById("recents");
let layer, built = false;
let bgX = 0;                     // 后台x（拖动量）

export function buildRecents() {
  layer = el();
  layer.innerHTML = `<div class="rc-hint">最近应用 · 上滑卡片移除 · 点击回到应用</div>`;
  built = true;
}

export function openRecents() {
  if (!built) return;
  state.recentsOpen = true;
  layer.hidden = false;
  layout();
}

export function closeRecents() {
  state.recentsOpen = false;
  layer.hidden = true;
  bgX = 0;
}

export function pushRecent(appId) {
  const list = state.recents.filter((id) => id !== appId);
  list.push(appId);
  state.recents = list.slice(-6);
}

function removeRecent(id, node) {
  node.classList.add("dismiss");
  node.style.transform = `${node.style.transform} translateY(-560px)`;
  setTimeout(() => {
    state.recents = state.recents.filter((x) => x !== id);
    layout();
  }, 240);
}

/* 卡片布局 —— 指数展开公式（新卡片序号大 → 靠右） */
function layout() {
  if (!built) return;
  layer.querySelectorAll(".rc-card").forEach((n) => n.remove());
  const list = state.recents;
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "rc-empty";
    empty.textContent = "没有最近的应用";
    layer.appendChild(empty);
    return;
  }
  list.forEach((id, i) => {
    const app = APPS[id];
    const card = document.createElement("div");
    card.className = "rc-card";
    card.style.background = `color-mix(in srgb, ${app.color} 14%, var(--md-surface-container-low))`;
    card.innerHTML = `
      <div class="rc-bar">
        <div class="ic-mini" style="background:${app.color}"></div>
        <span>${id}</span>
        <span style="margin-left:auto">Pixel XXL</span>
      </div>
      <div class="rc-shot"></div>`;
    const shot = card.querySelector(".rc-shot");
    const ic = makeIcon(id, { size: 72 });
    ic.style.background = app.color;
    ic.style.color = "rgba(255,255,255,.95)";
    shot.appendChild(ic);
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = id;
    shot.appendChild(name);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = app.tagline || "";
    shot.appendChild(sub);

    const x = 200 + 90 * Math.exp(.001 * (i * -160 + bgX));   // 原公式
    // 原工程卡片造型带旋转中心偏移（公式值域 200~290 在舞台右缘外），
    // 此处以 -230 校准把最新卡带入屏内（中心偏右），旧卡向左叠放
    card.style.left = `${162 + (x - 230)}px`;
    card.style.top = `${360 + 40}px`;
    card.addEventListener("pointerup", (e) => {
      if (Math.abs(e._rcDx ?? 0) > 10) return;
      closeRecents();
      emit("open-app", id);
    });
    card.addEventListener("pointerdown", (e) => { e._rcDx = 0; e._rcY = e.clientY; });
    card.addEventListener("pointermove", (e) => {
      if (e.buttons) {
        e._rcDx = (e._rcDx ?? 0) + e.movementX;
        const dy = e.clientY - e._rcY;
        if (dy < -80) { removeRecent(id, card); e.preventDefault(); }
      }
    });
    layer.appendChild(card);
  });
}

/* 后台横向拖动 ×1.5 跟手 */
export function dragRecents(dx) {
  bgX += dx * 1.5;
  layout();
}
