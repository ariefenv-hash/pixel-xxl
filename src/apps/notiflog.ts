import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "通知",
  icon: "notifications",
  desc: "集中查看通知历史，按应用筛选、批量清除与免打扰时段设置。",
  blocks: 213,
  features: [
    "按应用分组的通知历史",
    "单条与批量清除",
    "免打扰时段与例外白名单",
    "通知渠道粒度开关",
  ],
}).mount;
