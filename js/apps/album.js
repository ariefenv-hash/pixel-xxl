/* apps/album.js —— 相册：7 张程序化壁纸即「照片」，点开大图，可一键设为壁纸（重取色）。 */

import { header, body, svg, P } from "./helpers.js";
import { state, setPref } from "../store.js";
import { WALLPAPERS, paintWallpaper, WALLPAPER_SELECTABLE } from "../wallpapers.js";
import { recolorFrom } from "../monet.js";
import { wallpaperCanvas } from "../wallpaper-ref.js";

export function mount(win, api) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("相册"));
  const b = body();
  root.appendChild(b);

  const grid = document.createElement("div");
  grid.className = "al-grid";
  b.appendChild(grid);

  for (const id of WALLPAPER_SELECTABLE) {
    const item = document.createElement("div");
    item.className = "al-item";
    const cv = document.createElement("canvas");
    cv.width = 140; cv.height = 110;
    paintWallpaper(id, cv);
    item.appendChild(cv);
    const cap = document.createElement("div");
    cap.className = "cap";
    cap.textContent = `${WALLPAPERS[id].name} · 壁纸${id}`;
    item.appendChild(cap);
    item.addEventListener("pointerup", () => openViewer(id));
    grid.appendChild(item);
  }

  function openViewer(id) {
    const v = document.createElement("div");
    v.className = "al-viewer";
    v.innerHTML = `<div class="shot"></div>
      <div class="ops">
        <button class="m3-btn tonal">关闭</button>
        <button class="m3-btn">设为壁纸</button>
      </div>`;
    const shot = v.querySelector(".shot");
    const big = document.createElement("canvas");
    big.width = 264; big.height = 560;
    paintWallpaper(id, big);
    shot.appendChild(big);
    v.querySelector(".tonal").addEventListener("pointerup", () => v.remove());
    v.querySelector(".m3-btn:not(.tonal)").addEventListener("pointerup", async () => {
      setPref({ wallpaperId: id });
      paintWallpaper(id, wallpaperCanvas.get());
      await recolorFrom(wallpaperCanvas.get(), state.brightnessMode);
      v.querySelector(".m3-btn:not(.tonal)").textContent = "已设为壁纸 ✓";
      setTimeout(() => v.remove(), 700);
    });
    root.appendChild(v);
  }

  win.appendChild(root);
  return { destroy() { } };
}
