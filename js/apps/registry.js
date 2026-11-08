/* apps/registry.js —— 应用注册表（11 个图标 = 原工程 11 次『克隆应用』调用） */

import { mount as settingsMount } from "./settings.js";
import { mount as personalizationMount } from "./personalization.js";
import { mount as musicMount } from "./music.js";
import { mount as calculatorMount } from "./calculator.js";
import { mount as clockMount } from "./clock.js";
import { mount as albumMount } from "./album.js";
import { mount as storeMount } from "./store.js";
import { mount as notificationsMount } from "./notifications.js";
import { mount as videoMount } from "./video.js";
import { mount as phoneMount } from "./phone.js";
import { mount as bilibiliMount } from "./bilibili.js";

export const APPS = {
  设置: { color: "#5c6bc0", tagline: "系统与偏好", mount: settingsMount },
  相册: { color: "#ea4335", tagline: "壁纸与照片", mount: albumMount },
  商店: { color: "#34a853", tagline: "获取更多应用", mount: storeMount },
  通知: { color: "#f0a13a", tagline: "通知与快捷控制", mount: notificationsMount },
  视频: { color: "#e0637c", tagline: "程序化演示影片", mount: videoMount },
  电话: { color: "#2f9e8f", tagline: "拨号盘", mount: phoneMount },
  个性化: { color: "#7e57c2", tagline: "壁纸 · 主题色调", mount: personalizationMount },
  music: { color: "#f2703f", tagline: "合成器音乐播放器", mount: musicMount },
  计算器: { color: "#546e7a", tagline: "四则运算", mount: calculatorMount },
  bilibili: { color: "#fb7299", tagline: "跳转外部站点", mount: bilibiliMount },
  时钟: { color: "#4285f4", tagline: "表盘与秒表", mount: clockMount },
};
