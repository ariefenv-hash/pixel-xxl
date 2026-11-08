/* main.js —— 总装入口（对应原工程「绿旗被点击」后的系统装配顺序）：
 *   壁纸首绘 → 初始取色 → 构建桌面/抽屉/后台/锁屏 → 输入与流程模块 → 常驻循环 → 事件补线。
 * 原工程里部分广播（open-recents / guide-end）由主脚本统一接线，此处等价表达。 */

import { state, setRuntime } from "./store.js";
import { on } from "./bus.js";
import { unlockAudio } from "./audio.js";
import { paintWallpaper } from "./wallpapers.js";
import { recolorFrom } from "./monet.js";
import { setWallpaperCanvas } from "./wallpaper-ref.js";
import { startWallpaperFx } from "./wallpaper-fx.js";
import { initInput } from "./input.js";
import { buildShade, startShadeLoop } from "./shade.js";
import { initBoot } from "./boot.js";
import { buildDesktop, flyInIcons } from "./desktop.js";
import { buildDrawer, startDrawerLoop } from "./drawer.js";
import { buildRecents, openRecents } from "./recents.js";
import { buildLockscreen, initLockKeys } from "./lockscreen.js";
import { initOnboarding } from "./onboarding.js";
import { initWindowManager } from "./window-manager.js";

function main() {
  /* 1. 壁纸层：引用注册 → 首绘 → 初始取色（对应开机预热阶段的预渲染/取色门控） */
  const wall = document.getElementById("wallpaper");
  setWallpaperCanvas(wall);
  paintWallpaper(state.wallpaperId, wall);
  recolorFrom(wall, state.brightnessMode);

  /* 2. 构建各 UI 层（内部只建 DOM，不启动流程）
   *    shade 先于 desktop 构建 —— 手势仲裁注册顺序即优先级（顶缘下拉先于分页） */
  buildShade();
  buildDesktop();
  buildDrawer();
  buildRecents();
  buildLockscreen();

  /* 3. 交互与系统流程 */
  initInput();
  initBoot();          // 启动遮罩 → 174 帧开机动画 → 引导
  initOnboarding();    // 三页引导
  initWindowManager(); // 应用窗口开合 / 返回路由 / md3e 返回柄
  initLockKeys();      // A/D 键与电源键

  /* 4. 常驻循环：壁纸状态机（视差/亮度/模糊）+ 抽屉位移 + shade 跟手 */
  startWallpaperFx();
  startDrawerLoop();
  startShadeLoop();

  /* 5. 事件补线（跨模块广播，等价原工程「广播 open-recents / 引导结束」） */
  on("open-recents", () => {
    openRecents();
    setRuntime({ mode: "recents" });
  });
  on("guide-end", () => {
    flyInIcons();      // 图标错峰飞入（对应「飞入动画状态=1」）
  });

  /* 6. 音频上下文需用户手势解锁（对应打包器启动屏的点击即启动） */
  const unlock = () => {
    unlockAudio();
    document.removeEventListener("pointerdown", unlock);
  };
  document.addEventListener("pointerdown", unlock);

  /* 7. 调试钩子（无头回归 / 控制台排查用） */
  window.__px = state;
}

main();
