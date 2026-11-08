/* apps/personalization.js —— 个性化：壁纸选择（页1：壁纸3/4/5/6；页2：壁纸7）
 * + 亮度模式（100/500/600/800，忠实原工程单变量切全 UI tone）。
 * 选壁纸 → 广播「壁纸」语义：重绘 + 重取色 + 全 UI 重染。 */

import { header, body, row, listTitle, svg, P } from "./helpers.js";
import { state, setPref } from "../store.js";
import { WALLPAPERS, paintWallpaper } from "../wallpapers.js";
import { recolorFrom } from "../monet.js";
import { wallpaperCanvas } from "../wallpaper-ref.js";

export function mount(win, api) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("个性化"));
  const b = body();
  root.appendChild(b);

  /* 顶部预览横幅（当前壁纸） */
  const banner = document.createElement("div");
  banner.className = "pz-banner";
  const bcv = document.createElement("canvas");
  bcv.width = 320; bcv.height = 150;
  banner.appendChild(bcv);
  const cap = document.createElement("div");
  cap.className = "cap";
  banner.appendChild(cap);
  b.appendChild(banner);
  const paintBanner = () => {
    paintWallpaper(state.wallpaperId, bcv);
    cap.textContent = `当前 · 壁纸${state.wallpaperId} ${WALLPAPERS[state.wallpaperId]?.name || ""}`;
  };
  paintBanner();

  b.appendChild(row({
    icon: svg(P.image), title: "壁纸", sub: "7 张程序化壁纸 · 点选即重染",
    onClick: () => showSub("壁纸"),
  }));
  b.appendChild(listTitle("主题色调（亮度模式：单变量驱动整套 tonal palette）"));

  const tones = document.createElement("div");
  tones.className = "pz-tone-row";
  const TONES = [[100, "深"], [500, "标准"], [600, "柔"], [800, "浅"]];
  const renderTones = () => {
    tones.innerHTML = "";
    for (const [v, label] of TONES) {
      const t = document.createElement("div");
      t.className = `pz-tone ${state.brightnessMode === v ? "sel" : ""}`;
      t.textContent = label;
      t.addEventListener("pointerup", async () => {
        setPref({ brightnessMode: v });
        await recolorFrom(wallpaperCanvas.get(), v);
        renderTones();
      });
      tones.appendChild(t);
    }
  };
  renderTones();
  b.appendChild(tones);

  win.appendChild(root);

  let thumbPage = 1;

  function showSub() {
    api.openSub(buildWallpaperSub());
  }

  function buildWallpaperSub() {
    const d = document.createElement("div");
    d.appendChild(header(`壁纸 · 第 ${thumbPage} 页`, { onBack: () => api.onBack() }));
    const b2 = body();
    d.appendChild(b2);

    const grid = document.createElement("div");
    grid.className = "pz-grid";
    const ids = thumbPage === 1 ? [3, 4, 5, 6] : [1, 2, 7];
    for (const id of ids) {
      const th = document.createElement("div");
      th.className = `pz-thumb ${state.wallpaperId === id ? "sel" : ""}`;
      const cv = document.createElement("canvas");
      cv.width = 150; cv.height = 84;
      paintWallpaper(id, cv);
      th.appendChild(cv);
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.textContent = `壁纸${id} ${WALLPAPERS[id].name}`;
      th.appendChild(tag);
      th.addEventListener("pointerup", async () => {
        setPref({ wallpaperId: id });
        paintWallpaper(id, wallpaperCanvas.get());
        await recolorFrom(wallpaperCanvas.get(), state.brightnessMode);   // ≈ 广播「壁纸」+「取色」
        paintBanner();
        d.querySelectorAll(".pz-thumb").forEach((x) => x.classList.remove("sel"));
        th.classList.add("sel");
      });
      grid.appendChild(th);
    }
    b2.appendChild(grid);

    /* 翻页（对应原工程 壁纸/壁纸2 两页 ±86,-301 的前后按钮） */
    const nav = document.createElement("div");
    nav.className = "pz-tone-row";
    const prev = document.createElement("div");
    prev.className = "pz-tone";
    prev.textContent = thumbPage > 1 ? "‹ 上一页" : "";
    const next = document.createElement("div");
    next.className = "pz-tone";
    next.textContent = thumbPage < 2 ? "下一页 ›" : "";
    prev.addEventListener("pointerup", () => { if (thumbPage > 1) { thumbPage--; api.openSub(buildWallpaperSub()); } });
    next.addEventListener("pointerup", () => { if (thumbPage < 2) { thumbPage++; api.openSub(buildWallpaperSub()); } });
    nav.appendChild(prev); nav.appendChild(next);
    b2.appendChild(nav);
    b2.appendChild(listTitle("选中的壁纸会立即触发全 UI 动态取色（Monet）。"));
    return d;
  }

  return {
    onBack() { api.closeSub(); },
    destroy() { },
  };
}
