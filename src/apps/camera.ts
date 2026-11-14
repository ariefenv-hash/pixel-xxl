import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "相机",
  icon: "camera",
  desc: "相机占位：取景、拍照与相册联动。",
  blocks: 0,
  features: [
    "取景器与网格线",
    "拍照 / 录像模式切换",
    "夜景与人像模式",
    "连拍与相册联动",
  ],
}).mount;
