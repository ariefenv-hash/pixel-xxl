/* shade.js —— 快捷设置下拉面板（对应 AOSP QS shade 的 Pixel 语义）：
 *   顶缘（逻辑 y>330）下拉开；面板跟手，松手 >60px 或过半即开；
 *   瓷砖全部接真状态：亮度模式 100/500/600/800（applyMonet 全 UI 重染）、
 *   壁纸循环（paint + recolor + 持久化）、music 播放/暂停、锁屏。
 *   开启态整屏仅 shade 响应手势（input.js 直路由）；返回键先关面板再落回。 */

import { state, setPref, setRuntime } from "./store.js";
import { on, emit } from "./bus.js";
import { addHandler } from "./input.js";
import { monet, applyMonet, recolorFrom } from "./monet.js";
import { paintWallpaper, WALLPAPERS, WALLPAPER_SELECTABLE } from "./wallpapers.js";
import { wallpaperCanvas } from "./wallpaper-ref.js";
import { player } from "./audio.js";
import { lock } from "./lockscreen.js";

const el = () => document.getElementById("shade");
const PANEL_H = 470;

let panel, scrim, timeEl, dateEl, built = false;
let drag = null;        // { y0, base } base = 起手时的 shadeY
let shadeY = 0;         // 0=全合 470=全开

const MODE_NAME = { 100: "深色", 500: "标准", 600: "柔和", 800: "明亮" };

export function buildShade() {
  const root = el();
  root.innerHTML = `
    <div class="sh-scrim"></div>
    <div class="sh-panel">
      <div class="sh-head">
        <div class="sh-clock">00:00</div>
        <div class="sh-date"></div>
      </div>
      <div class="sh-grid"></div>
      <div class="sh-foot">Pixel XXL · 快捷设置</div>
    </div>`;
  panel = root.querySelector(".sh-panel");
  scrim = root.querySelector(".sh-scrim");
  timeEl = root.querySelector(".sh-clock");
  dateEl = root.querySelector(".sh-date");
  scrim.addEventListener("pointerup", () => closeShade());

  const grid = root.querySelector(".sh-grid");
  grid.appendChild(tile("亮度模式", () => MODE_NAME[state.brightnessMode] || "标准", cycleMode));
  grid.appendChild(tile("壁纸", () => (WALLPAPERS[state.wallpaperId] || {}).name || "壁纸", cycleWallpaper));
  grid.appendChild(tile("音乐", musicState, () => { player.toggle(); refreshTiles(); }));
  grid.appendChild(tile("锁屏", () => "A / D 键", () => { closeShade(); lock(); }));

  const tick = () => {
    const d = new Date();
    timeEl.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    dateEl.textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()]}`;
  };
  tick();
  setInterval(tick, 1000);

  built = true;
  registerGesture();
  subscribeKeys();
}

function tile(name, stateText, onClick) {
  const t = document.createElement("button");
  t.className = "sh-tile";
  t.innerHTML = `<div class="sh-tile-name">${name}</div><div class="sh-tile-state"></div>`;
  t._stateText = stateText;
  t.addEventListener("pointerup", (e) => { e.stopPropagation(); onClick(); });
  return t;
}

function refreshTiles() {
  el().querySelectorAll(".sh-tile").forEach((t) => {
    if (t._stateText) t.querySelector(".sh-tile-state").textContent = t._stateText();
  });
}

/* ── 瓷砖动作（全部真状态）────────────────────────── */

function cycleMode() {
  const seq = [100, 500, 600, 800];
  const next = seq[(seq.indexOf(state.brightnessMode) + 1) % seq.length];
  setPref({ brightnessMode: next });
  applyMonet(monet.baseHsl, next);          // 全 UI 重染（对应原工程「取色」广播）
  refreshTiles();
}

function cycleWallpaper() {
  const seq = WALLPAPER_SELECTABLE;
  const next = seq[(seq.indexOf(state.wallpaperId) + 1) % seq.length];
  setPref({ wallpaperId: next });
  paintWallpaper(next, wallpaperCanvas.get());
  recolorFrom(wallpaperCanvas.get(), state.brightnessMode);
  refreshTiles();
}

function musicState() {
  if (!player.playing) return "已暂停";
  return player.track.name.length > 14 ? player.track.name.slice(0, 13) + "…" : player.track.name;
}

/* ── 手势：顶缘下拉 / 开启态整屏接管 ─────────────────── */

function registerGesture() {
  addHandler("shade", {
    test: (x, y) => !state.shadeOpen && y > 330 &&
      state.mode !== "lock" && state.mode !== "boot" && state.mode !== "onboard",
    onDown(g) { drag = { y0: g.y, base: shadeY }; },
    onMove(g) {
      if (!drag) return;
      // 逻辑坐标 y 向上：向下拉 = dy 为负 → 取负得「下拉距离」
      shadeY = Math.max(0, Math.min(PANEL_H, drag.base + (-g.dy) * 1.15));
      apply();
    },
    onUp(g) {
      if (!drag) return;
      const pull = drag.y0 - g.y;             // 正 = 向下拉开的距离
      if (!state.shadeOpen) openShade(pull > 60 || shadeY > PANEL_H * .5);
      else if (pull < -60 || shadeY < PANEL_H * .5) openShade(false);
      else apply();
      drag = null;
    },
  });
}

function apply() {
  if (!built) return;
  const p = shadeY / PANEL_H;
  panel.style.transform = `translateY(${(-100 * (1 - p)).toFixed(2)}%)`;
  scrim.style.opacity = (p * .55).toFixed(3);
  el().hidden = shadeY <= 1 && !state.shadeOpen;
}

export function openShade(open) {
  if (open) {
    emit("drawer-y", -695);                 // 与抽屉互斥（一次性语义）
    setRuntime({ shadeOpen: true });
    shadeY = PANEL_H;
    refreshTiles();
  } else {
    setRuntime({ shadeOpen: false });
    shadeY = 0;
  }
  el().hidden = !open && shadeY <= 1;
  apply();
}

export function closeShade() { openShade(false); }

/* ── 返回键语义：先关面板，本轮返回不再下传 ─────────────── */

function subscribeKeys() {
  const consume = () => {
    if (!state.shadeOpen) return;
    setTimeout(closeShade, 0);              // 延迟关闭：让本轮 back 的其他订阅者读到 shadeOpen=true 而短路
  };
  on("key-back", consume);
  on("back-gesture", consume);
  on("key-lock", closeShade);
}

/* 每帧跟手循环（拖动中实时 apply；静态时零开销由事件驱动） */
export function startShadeLoop() {
  const loop = () => { if (drag) apply(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
