import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "商店",
  icon: "store",
  desc: "应用分发与更新：安装、更新、卸载，以及应用详情与权限说明。",
  blocks: 213,
  features: [
    "应用详情页与应用内截图",
    "批量更新队列与后台下载",
    "已安装应用的权限审查",
    "按设备能力筛选兼容版本",
  ],
}).mount;
