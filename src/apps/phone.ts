import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "电话",
  icon: "phone",
  desc: "拨号、通话记录与联系人，支持双卡与来电拦截。",
  blocks: 213,
  features: [
    "九宫格拨号盘与 T9 联想",
    "通话记录与未接标记",
    "联系人合并与去重",
    "双卡选择与来电拦截规则",
  ],
}).mount;
