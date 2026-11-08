/* apps/clock.js —— 时钟应用：大表盘（实时时/分/秒针）+ 数字钟 + 可用秒表。
 * 桌面大件同源（icons.js 的动态时钟图标），此为应用内完整版。 */

import { header, body, listTitle } from "./helpers.js";

export function mount(win) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("时钟"));
  const b = body();
  root.appendChild(b);

  const wrap = document.createElement("div");
  wrap.className = "ck-app";
  b.appendChild(wrap);

  const big = document.createElement("div");
  big.className = "ck-big";
  big.innerHTML = `<div class="face"></div>`;
  for (let i = 0; i < 12; i++) {
    const t = document.createElement("i");
    t.className = "tick";
    t.style.transform = `rotate(${i * 30}deg)`;
    big.appendChild(t);
  }
  big.insertAdjacentHTML("beforeend", `
    <div class="hand h"></div><div class="hand m"></div><div class="hand s"></div><div class="pin"></div>`);
  wrap.appendChild(big);

  const digital = document.createElement("div");
  digital.className = "ck-digital";
  const date = document.createElement("div");
  date.className = "ck-date";
  wrap.appendChild(digital);
  wrap.appendChild(date);

  const iv = setInterval(tick, 50);
  function tick() {
    const d = new Date();
    const sec = d.getSeconds() + d.getMilliseconds() / 1000;
    const min = d.getMinutes() + sec / 60;
    const hr = (d.getHours() % 12) + min / 60;
    big.querySelector(".s").style.transform = `rotate(${sec * 6}deg)`;
    big.querySelector(".m").style.transform = `rotate(${min * 6}deg)`;
    big.querySelector(".h").style.transform = `rotate(${hr * 30}deg)`;
    digital.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    date.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${["周日","周一","周二","周三","周四","周五","周六"][d.getDay()]}`;
  }
  tick();

  /* 秒表（真实可用） */
  b.appendChild(listTitle("秒表"));
  const swRow = document.createElement("div");
  swRow.className = "st-kv";
  swRow.innerHTML = `<span class="v" style="font-size:22px">0:00.00</span>`;
  const ops = document.createElement("div");
  ops.style.display = "flex";
  ops.style.gap = "10px";
  ops.style.marginTop = "10px";
  let swStart = 0, swAcc = 0, swTimer = null;
  const swLabel = swRow.querySelector(".v");
  const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms / 10) % 100).padStart(2, "0")}`;
  const mkBtn = (text, fn) => {
    const btn = document.createElement("button");
    btn.className = "m3-btn tonal";
    btn.textContent = text;
    btn.addEventListener("pointerup", fn);
    ops.appendChild(btn);
  };
  mkBtn("开始/暂停", () => {
    if (swTimer) { clearInterval(swTimer); swAcc += Date.now() - swStart; swTimer = null; }
    else { swStart = Date.now(); swTimer = setInterval(() => (swLabel.textContent = fmt(swAcc + Date.now() - swStart)), 31); }
  });
  mkBtn("清零", () => {
    clearInterval(swTimer); swTimer = null; swAcc = 0; swLabel.textContent = "0:00.00";
  });
  const swCard = document.createElement("div");
  swCard.appendChild(swRow);
  swCard.appendChild(ops);
  b.appendChild(swCard);

  win.appendChild(root);
  return { destroy() { clearInterval(iv); if (swTimer) clearInterval(swTimer); } };
}
