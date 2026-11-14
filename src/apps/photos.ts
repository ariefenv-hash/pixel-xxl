import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "相册",
  icon: "photos",
  desc: "按时间线浏览照片、按人物与场景自动分组，并生成回忆精选。",
  blocks: 213,
  features: [
    "时间线月视图与年月快速跳转",
    "人物 / 地点 / 事物三类自动分组",
    "回忆精选（自动配乐与转场）",
    "原图云端备份与本地缩略图分级",
  ],
}).mount;
