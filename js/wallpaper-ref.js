/* wallpaper-ref.js —— 壁纸画布的全局引用（避免模块循环依赖） */

let canvas = null;

export function setWallpaperCanvas(el) { canvas = el; }
export function getWallpaperCanvas() { return canvas; }

export const wallpaperCanvas = {
  set: setWallpaperCanvas,
  get: getWallpaperCanvas,
};
