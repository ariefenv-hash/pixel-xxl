/* apps/phone.js —— 电话：拨号盘（3×4 键 + 呼叫），呼叫页为模拟界面。 */

import { header, body, svg, P } from "./helpers.js";
import { sfx } from "../audio.js";

const PAD = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

export function mount(win) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("电话"));
  const b = body();
  root.appendChild(b);

  const screen = document.createElement("div");
  screen.className = "dl-screen";
  screen.innerHTML = `<div class="dl-number"></div><div class="dl-sub"></div>`;
  b.appendChild(screen);
  const numberEl = screen.querySelector(".dl-number");
  const subEl = screen.querySelector(".dl-sub");

  const pad = document.createElement("div");
  pad.className = "dl-pad";
  b.appendChild(pad);

  let number = "";
  const render = () => {
    numberEl.textContent = number;
    subEl.textContent = number.length >= 11 ? "手机号 · 点击呼叫" : number ? "输入号码" : "";
  };

  PAD.forEach(([n, letters], i) => {
    const k = document.createElement("button");
    k.className = "dl-key";
    k.innerHTML = `<span class="n">${n}</span><span class="l">${letters || "·"}</span>`;
    const col = i % 3, row = Math.floor(i / 3);
    k.style.left = `${162 + (col - 1) * 88}px`;
    k.style.top = `${52 + row * 82}px`;
    k.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      number += n;
      sfx.tick();
      render();
    });
    pad.appendChild(k);
  });

  const back = document.createElement("button");
  back.className = "dl-key";
  back.innerHTML = `<span class="n">⌫</span>`;
  back.style.left = `${162 + 2 * 88}px`;
  back.style.top = `${52 + 3 * 82}px`;
  back.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    number = number.slice(0, -1);
    render();
  });
  pad.appendChild(back);

  const call = document.createElement("button");
  call.className = "dl-call";
  call.innerHTML = svg(P.phone, 26);
  call.style.bottom = "18px";
  call.addEventListener("pointerup", () => {
    if (!number) return;
    showCalling();
  });
  pad.appendChild(call);

  function showCalling() {
    const c = document.createElement("div");
    c.className = "dl-calling";
    c.innerHTML = `
      <div class="who">${number}</div>
      <div class="st">正在呼叫…（模拟）</div>
      <button class="m3-btn" style="background:#ea4335;color:#fff">挂断</button>`;
    c.querySelector(".m3-btn").addEventListener("pointerup", () => c.remove());
    root.appendChild(c);
  }

  render();
  win.appendChild(root);
  return { destroy() { } };
}
