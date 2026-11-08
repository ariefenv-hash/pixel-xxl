/* wallpaper-fx.js —— 壁纸层状态机（对应原工程 zz 角色的 5 条循环）：
 *   视差 x += (pageX/8 - x)/10｜尺寸 110(桌面)↔90(应用)｜亮度 0↔-25%｜
 *   模糊：桌面 0 ↔ 应用/后台 16 ↔ 抽屉按显示y插值((1-(y-20)/-675)*48 封顶16) */

import { state } from "./store.js";
import { emit, on } from "./bus.js";

const wall = document.getElementById("wallpaper");

const fx = { x: 0, scale: 110, brightness: 0, blur: 0 };

function lerp(a, b, k) { return a + (b - a) * k; }

export function startWallpaperFx() {
  on("drawer-y", (y) => { drawerY = y; });
  let drawerY = -695;

  const loop = () => {
    const inApp = !!state.openApp;
    const inRecents = state.recentsOpen;
    const drawerOpen = state.drawer.open;

    // 视差（pageX/8 趋近）
    fx.x = lerp(fx.x, state.pageX / 8, .1);

    // 尺寸 + 亮度
    const targetScale = inApp || inRecents ? 90 : 110;
    const targetBright = inApp || inRecents ? -25 : 0;
    fx.scale = lerp(fx.scale, targetScale, .07);
    fx.brightness = lerp(fx.brightness, targetBright, .07);

    // 模糊（0~16 级 → CSS blur 0~13px 近似原 16 级云母）
    let targetBlur = 0;
    if (inApp || inRecents) targetBlur = 16;
    else if (drawerOpen) {
      const v = (1 - ((drawerY - 20) * -1) / 675) * 48;   // 原公式
      targetBlur = Math.min(Math.max(v, 0), 16);
    }
    fx.blur = lerp(fx.blur, targetBlur, drawerOpen ? .14 : .09);

    wall.style.transform =
      `translate(${fx.x.toFixed(2)}px, 0) scale(${(fx.scale / 100).toFixed(4)})`;
    wall.style.filter =
      `brightness(${(1 + fx.brightness / 100).toFixed(3)}) blur(${(fx.blur * .8).toFixed(2)}px)`;

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/** 重绘壁纸（对应广播「壁纸」→ 换造型 + 广播「取色」由 monet.js 完成） */
export async function applyWallpaper(id, paintFn, recolorFn) {
  paintFn(id);
  return recolorFn();
}
