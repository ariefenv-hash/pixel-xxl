import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "Chrome",
  icon: "browser",
  desc: "浏览器占位：地址栏、标签页与阅读模式。",
  blocks: 0,
  features: [
    "地址栏与搜索建议",
    "多标签页与标签组",
    "阅读模式与网页翻译",
    "无痕浏览",
  ],
}).mount;
