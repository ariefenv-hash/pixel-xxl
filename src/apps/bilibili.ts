import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "bilibili",
  icon: "bilibili",
  desc: "视频社区客户端占位：首页推荐、播放页与弹幕层。",
  blocks: 213,
  features: [
    "首页推荐与分区导航",
    "播放页与弹幕轨道",
    "稍后再看与收藏夹",
    "投屏与倍速播放",
  ],
}).mount;
