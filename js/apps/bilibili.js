/* apps/bilibili.js —— bilibili：原工程该应用为页 1 的外链图标。
 * Web 版提供跳转卡（新标签页打开 bilibili.com），并说明不内嵌外部内容的原因。 */

import { header, body, listTitle } from "./helpers.js";

export function mount(win) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("bilibili"));
  const b = body();
  root.appendChild(b);

  const card = document.createElement("div");
  card.className = "bb-card";
  card.innerHTML = `
    <div class="bb-head">(°▽°)b<small>demo card</small></div>
    <div class="bb-body">
      <b>这是外部站点跳转卡。</b><br>
      原工程中 bilibili 是桌面第 1 页的独立图标；Web 重写版出于「零外部依赖、
      可离线运行」的取舍，不内嵌任何第三方页面 —— 点击下方按钮会在新标签页打开
      bilibili.com，其余一切照旧。
    </div>`;
  b.appendChild(card);

  const open = document.createElement("button");
  open.className = "m3-btn";
  open.style.margin = "14px 4px";
  open.textContent = "在新标签页打开 bilibili.com";
  open.addEventListener("pointerup", () => {
    window.open("https://www.bilibili.com", "_blank", "noopener");
  });
  b.appendChild(open);

  b.appendChild(listTitle("提示：离线环境下按钮不会有效果，这是预期行为。"));

  win.appendChild(root);
  return { destroy() { } };
}
