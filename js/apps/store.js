/* apps/store.js —— 商店：内置应用目录，可「打开」跳转对应应用（真实联动）。 */

import { header, body, listTitle } from "./helpers.js";
import { APPS } from "./registry.js";
import { makeIcon } from "../icons.js";

const RATINGS = {
  设置: "系统应用", 相册: "4.8 ★ · 12MB", 商店: "系统应用", 通知: "系统应用",
  视频: "4.2 ★ · 程序化内容", 电话: "系统应用", 个性化: "4.9 ★ · Monet",
  music: "4.7 ★ · WebAudio", 计算器: "4.6 ★ · 21KB", bilibili: "外部站点",
  时钟: "4.9 ★ · 动态图标",
};

export function mount(win, api) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("商店"));
  const b = body();
  root.appendChild(b);

  b.appendChild(listTitle("全部应用 · 已随系统内置，点「打开」直达"));
  for (const [id, app] of Object.entries(APPS)) {
    const r = document.createElement("div");
    r.className = "st-app-row";
    const ic = makeIcon(id, { size: 52 });
    ic.style.background = app.color;
    ic.style.color = "rgba(255,255,255,.94)";
    r.appendChild(ic);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<div class="t">${id}</div><div class="s">${RATINGS[id] || ""}</div>`;
    r.appendChild(meta);
    const btn = document.createElement("button");
    btn.className = "install done";
    btn.textContent = "打开";
    btn.addEventListener("pointerup", () => {
      import("../window-manager.js").then((m) => {
        api.close();
        setTimeout(() => m.openApp(id), 120);
      });
    });
    r.appendChild(btn);
    b.appendChild(r);
  }

  win.appendChild(root);
  return { destroy() { } };
}
