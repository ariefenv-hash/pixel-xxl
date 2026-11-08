/* lockscreen.js —— 锁屏 / AOD。
 * 原工程锁屏 = a/d 键冻结（无独立视觉层），此处按 AOD 语义补全视觉：
 * 大钟 + 日期 + 解锁涟漪（对应 aosp/unlock-ripple 的同源思路）。 */

import { state, setRuntime } from "./store.js";
import { on, emit } from "./bus.js";
import { sfx } from "./audio.js";

const el = () => document.getElementById("lockscreen");
let timeEl, dateEl;

export function buildLockscreen() {
  const root = el();
  root.innerHTML = `
    <div class="ls-time">00:00</div>
    <div class="ls-date"></div>
    <div class="ls-unlock">按 D 键 / 电源键 / 点按解锁</div>`;
  timeEl = root.querySelector(".ls-time");
  dateEl = root.querySelector(".ls-date");

  const tick = () => {
    const d = new Date();
    timeEl.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    dateEl.textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()]}`;
  };
  tick();
  setInterval(tick, 1000);

  root.addEventListener("pointerdown", (e) => {
    ripple(e);
    unlock();
  });
}

function ripple(e) {
  const root = el();
  const r = document.getElementById("screen").getBoundingClientRect();
  const dot = document.createElement("div");
  dot.className = "ls-ripple go";
  dot.style.left = `${((e.clientX - r.left) / r.width) * 100}%`;
  dot.style.top = `${((e.clientY - r.top) / r.height) * 100}%`;
  root.appendChild(dot);
  setTimeout(() => dot.remove(), 720);
}

export function lock() {
  if (state.locked) return;
  setRuntime({ locked: true, mode: "lock" });
  el().hidden = false;
  sfx.lock();
  emit("drawer-y", -695);
}

export function unlock() {
  if (!state.locked) return;
  setRuntime({ locked: false, mode: state.openApp ? "app" : "desktop" });
  el().hidden = true;
  sfx.unlock();
}

export function initLockKeys() {
  on("key-lock", lock);
  on("key-unlock", unlock);
  document.getElementById("btn-power").addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    state.locked ? unlock() : lock();
  });
}
