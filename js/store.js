/* store.js —— 全局状态 + localStorage 持久化。
 * 原工程把运行态（开机引导页=4、锁屏=0 等）随包保存造成脏存档（分析报告 §7.5），
 * 本工程只持久化用户偏好：壁纸编号、亮度模式、曲线风格。 */

const KEY = "pixel-xxl-state-v1";

const persisted = {
  wallpaperId: 7,      // 原工程 顶层游离：壁纸编号 = 7
  brightnessMode: 500, // 亮度模式 ∈ {100, 500, 600, 800}
  curveStyle: 1,       // 曲线风格 0=指数趋近 1=分段缓动（开窗动画两套曲线）
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(persisted, JSON.parse(raw));
  } catch { /* 私密模式等场景忽略 */ }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(persisted)); } catch { /* ignore */ }
}

load();

/* 运行态（不持久化，每次启动都是干净的开机流程） */
const runtime = {
  mode: "boot",          // boot | onboard | desktop | app | recents | lock
  locked: false,
  currentPage: 0,        // 桌面页
  pageX: 0,              // 显示x-角色1
  openApp: null,         // 完整打开的app
  recentsOpen: false,
  shadeOpen: false,      // 快捷设置面板开启态
  drawer: { open: false, y: -695 },  // All Apps 显示y
  recents: [],           // 后台应用 id 列表（新在后）
  booted: false,
};

export const state = { ...persisted, ...runtime };

export function setPref(patch) {
  Object.assign(persisted, patch);
  Object.assign(state, patch);
  save();
  return state;
}

export function setRuntime(patch) {
  Object.assign(state, patch);
  return state;
}
