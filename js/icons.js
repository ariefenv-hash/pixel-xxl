/* icons.js —— 11 个应用图标（SVG 程序化生成，squircle 容器 + 几何字形）。
 * 动态时钟图标忠实原工程：时针/分针/秒针三层按真实时间旋转。 */

const glyph = {
  设置: `<path d="M19.4 13a7.6 7.6 0 0 0 .1-1 7.6 7.6 0 0 0-.1-1l2.1-1.6a.5.5 0 0 0 .1-.7l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7.7 7.7 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.7L4.5 11a7.6 7.6 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.7l2 3.4c.1.2.4.3.6.2l2.5-1a7.7 7.7 0 0 0 1.7 1l.4 2.6c0 .3.2.5.5.5h4c.3 0 .5-.2.5-.5l.4-2.6a7.7 7.7 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.7L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>`,
  相册: `<path d="M12 2l2.4 2.4L12 6.8 9.6 4.4 12 2zm0 20l-2.4-2.4 2.4-2.4 2.4 2.4L12 22zM2 12l2.4-2.4L6.8 12l-2.4 2.4L2 12zm20 0l-2.4 2.4L17.2 12l2.4-2.4L22 12zM6.3 6.3l3.4.1-.1 3.4-3.4-.1.1-3.4zm11.4 11.4l-3.4-.1.1-3.4 3.4.1-.1 3.4zm0-11.3l-.1 3.4-3.4-.1.1-3.4 3.4.1zM6.4 17.7l.1-3.4 3.4.1-.1 3.4-3.4-.1z"/><circle cx="12" cy="12" r="3.2"/>`,
  商店: `<path d="M6.6 8.2 12 2.6l5.4 5.6h2.2c.8 0 1.4.6 1.4 1.4v9.8c0 .8-.6 1.4-1.4 1.4H4.4c-.8 0-1.4-.6-1.4-1.4V9.6c0-.8.6-1.4 1.4-1.4h2.2zm2.8 0h5.2L12 5.4 9.4 8.2zM8 12.5h8v1.8H8v-1.8zm0 3.6h5.4v1.8H8v-1.8z"/>`,
  通知: `<path d="M12 22a2.3 2.3 0 0 0 2.3-2.3H9.7A2.3 2.3 0 0 0 12 22zm7-5.4v-1l-1.6-1.6v-4.3c0-2.9-1.6-5.4-4.3-6V3a1.1 1.1 0 1 0-2.2 0v.7c-2.7.6-4.3 3.1-4.3 6v4.3L5 15.6v1h14zM6.8 18.8h10.4v1.8H6.8v-1.8z"/>`,
  视频: `<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14.5v-9l7 4.5-7 4.5z"/>`,
  电话: `<path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/>`,
  个性化: `<path d="M12 3a9 9 0 0 0 0 18c.8 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1-.2-.3-.4-.6-.4-1 0-.9.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8zM6.5 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>`,
  music: `<path d="M12 3v10.6a4 4 0 1 0 2 3.4V7h4V3h-6z"/>`,
  计算器: `<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm1 3v3h8V5H8zm0 6h2.4v2.4H8V11zm3.3 0h2.4v2.4h-2.4V11zm3.3 0H17v2.4h-2.4V11zM8 14.6h2.4V17H8v-2.4zm3.3 0h2.4V17h-2.4v-2.4zm3.3 0H17V17h-2.4v-2.4z"/>`,
  bilibili: `<path d="M5.2 3.4 8 6h8l2.8-2.6a1 1 0 0 1 1.4 1.5L18.6 6H19a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h.4L3.8 4.9a1 1 0 0 1 1.4-1.5zM5 8.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H5zm3.2 2.6 3 1.7a.7.7 0 0 1 0 1.2l-3 1.7a.7.7 0 0 1-1-.6v-3.4a.7.7 0 0 1 1-.6zm8.6 0v4.6a.7.7 0 0 1-1 .6l-3-1.7a.7.7 0 0 1 0-1.2l3-1.7a.7.7 0 0 1 1 .6z"/>`,
  时钟: `<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13h-1.7v6l4.7 2.8.8-1.4-3.8-2.2V7z"/>`,
};

/* 图标配色（按下后会随 Monet 重染——此处容器色由调用方传 palette 决定） */
export const APP_COLORS = {
  设置: "#5c6bc0", 相册: "#ea4335", 商店: "#34a853", 通知: "#fbbc05",
  视频: "#e91e63", 电话: "#26a69a", 个性化: "#7e57c2", music: "#ff7043",
  计算器: "#607d8b", bilibili: "#fb7299", 时钟: "#4285f4",
};

/** 生成图标 DOM：<ic><svg/></ic>，glyph 用 currentColor */
export function makeIcon(name, { size = 54, glyphScale = .58 } = {}) {
  const box = document.createElement("div");
  box.className = "ic";
  box.style.width = box.style.height = `${size}px`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.style.width = svg.style.height = `${Math.round(size * glyphScale)}px`;
  svg.innerHTML = `<g fill="currentColor">${glyph[name] || glyph.设置}</g>`;
  box.appendChild(svg);
  return box;
}

/** 动态时钟图标（原工程：时钟图标拆时/分/秒针三层克隆，实时旋转） */
export function makeClockIcon(size = 96) {
  const el = document.createElement("div");
  el.className = "ic";
  el.style.width = el.style.height = `${size}px`;
  el.style.position = "relative";
  el.style.background = "var(--md-surface-container-lowest)";
  el.innerHTML = `
    <div class="hand h" style="width:${size * .045}px;height:${26}%;margin-left:-${size * .0225}px;background:var(--md-on-surface)"></div>
    <div class="hand m" style="width:${size * .036}px;height:${37}%;margin-left:-${size * .018}px;background:var(--md-on-surface)"></div>
    <div class="hand s" style="width:${size * .018}px;height:${41}%;margin-left:-${size * .009}px;background:var(--md-primary)"></div>
    <div class="pin" style="width:${size * .09}px;height:${size * .09}px;margin:-${size * .045}px"></div>`;
  const h = el.children[0], m = el.children[1], s = el.children[2];
  const tick = () => {
    const d = new Date();
    const sec = d.getSeconds() + d.getMilliseconds() / 1000;
    const min = d.getMinutes() + sec / 60;
    const hr = (d.getHours() % 12) + min / 60;
    s.style.transform = `rotate(${sec * 6}deg)`;
    m.style.transform = `rotate(${min * 6}deg)`;
    h.style.transform = `rotate(${hr * 30}deg)`;
  };
  tick();
  const iv = setInterval(tick, 50);
  el.addEventListener("pxl-stop", () => clearInterval(iv), { once: true });
  return el;
}
