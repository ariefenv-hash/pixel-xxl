/* apps/notifications.js —— 通知 + 快捷控制（控制中心语义）：
 * 瓷砖：深色模式（亮度模式 100/500 切换）、壁纸轮换、music 播放控制；
 * 列表：示例通知 + 正在播放的媒体通知（联动 player）。 */

import { header, body, svg, P, listTitle } from "./helpers.js";
import { state, setPref } from "../store.js";
import { recolorFrom } from "../monet.js";
import { wallpaperCanvas } from "../wallpaper-ref.js";
import { paintWallpaper, WALLPAPER_SELECTABLE } from "../wallpapers.js";
import { player } from "../audio.js";

export function mount(win, api) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("通知"));
  const b = body();
  root.appendChild(b);

  /* 快捷瓷砖 */
  const tiles = document.createElement("div");
  tiles.className = "nt-tiles";
  const mkTile = (icon, label, on, onClick) => {
    const t = document.createElement("div");
    t.className = `nt-tile ${on ? "on" : ""}`;
    t.innerHTML = `${svg(icon, 22)}<span>${label}</span>`;
    t.addEventListener("pointerup", async () => { await onClick(); });
    return t;
  };
  const renderTiles = () => {
    tiles.innerHTML = "";
    tiles.appendChild(mkTile(P.dark, state.brightnessMode < 400 ? "深色模式" : "浅色模式",
      state.brightnessMode < 400,
      async () => {
        const next = state.brightnessMode < 400 ? 500 : 100;
        setPref({ brightnessMode: next });
        await recolorFrom(wallpaperCanvas.get(), next);
        renderTiles();
      }));
    tiles.appendChild(mkTile(P.image, "换壁纸", false, async () => {
      const i = WALLPAPER_SELECTABLE.indexOf(state.wallpaperId);
      const next = WALLPAPER_SELECTABLE[(i + 1) % WALLPAPER_SELECTABLE.length];
      setPref({ wallpaperId: next });
      paintWallpaper(next, wallpaperCanvas.get());
      await recolorFrom(wallpaperCanvas.get(), state.brightnessMode);
      renderTiles();
    }));
    tiles.appendChild(mkTile(P.play, player.playing ? "暂停音乐" : "播放音乐",
      player.playing, () => { player.toggle(); renderTiles(); }));
    tiles.appendChild(mkTile(P.bell, "清除全部", false, () => {
      list.innerHTML = "";
      list.appendChild(listTitle("通知已全部清除"));
    }));
  };
  b.appendChild(tiles);
  renderTiles();

  /* 通知列表 */
  b.appendChild(listTitle("通知"));
  const list = document.createElement("div");
  b.appendChild(list);
  const items = [
    ["music", "Pixel XXL", "音乐播放器已就绪 · 2 首内置合成曲", "刚刚"],
    ["个性化", "Monet 取色", "壁纸变换将自动重染整套 UI（tonal 50~900）", "2 分钟前"],
    ["商店", "全部应用已内置", "无需安装，打开即用", "10 分钟前"],
  ];
  for (const [iconId, title, sub, when] of items) {
    const n = document.createElement("div");
    n.className = "nt-item";
    n.innerHTML = `
      <div class="ic" style="background:var(--md-secondary-container);color:var(--md-on-secondary-container)">${svg(P.bell, 18)}</div>
      <div style="flex:1;min-width:0"><div class="t">${title}</div><div class="s">${sub}</div></div>
      <div class="when">${when}</div>`;
    list.appendChild(n);
  }

  /* 媒体通知（播放时插入） */
  player.onState = () => {
    if (player.playing && !list.querySelector(".nt-media")) {
      const m = document.createElement("div");
      m.className = "nt-item nt-media";
      m.innerHTML = `
        <div class="ic" style="background:var(--md-primary);color:var(--md-on-primary)">${svg(P.music, 18)}</div>
        <div style="flex:1;min-width:0"><div class="t">${player.track.name}</div><div class="s">正在播放 · chiptune</div></div>`;
      list.prepend(m);
    } else if (!player.playing) {
      list.querySelector(".nt-media")?.remove();
    }
  };

  win.appendChild(root);
  return { destroy() { player.onState = null; } };
}
