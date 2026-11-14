import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "视频",
  icon: "video",
  desc: "本地视频库与播放器：硬解优先、后台画中画、字幕与倍速。",
  blocks: 213,
  features: [
    "视频墙与目录浏览",
    "硬件解码优先的播放内核",
    "画中画与后台音频",
    "字幕轨道与倍速播放",
  ],
}).mount;
