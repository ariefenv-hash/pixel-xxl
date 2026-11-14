import { createPlaceholder } from './placeholder';

export const mount = createPlaceholder({
  title: "信息",
  icon: "message",
  desc: "短信与 RCS 会话：会话列表、群聊与快捷回复。",
  blocks: 0,
  features: [
    "会话列表与未读标记",
    "群聊与 @ 提醒",
    "富媒体（图片 / 位置 / 语音）",
    "验证码自动识别与一键填充",
  ],
}).mount;
