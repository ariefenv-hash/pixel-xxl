/* apps/helpers.js —— 应用内 UI 公共件（头部 / 正文 / 列表行 / SVG 图形） */

export function header(title, { onBack } = {}) {
  const h = document.createElement("div");
  h.className = "aw-header";
  h.innerHTML = `
    ${onBack ? `<button class="back" aria-label="返回">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z"/></svg>
    </button>` : `<span style="width:8px"></span>`}
    <span class="t">${title}</span>`;
  if (onBack) h.querySelector(".back").addEventListener("pointerup", onBack);
  return h;
}

export function body() {
  const b = document.createElement("div");
  b.className = "aw-body";
  return b;
}

export function row({ icon, iconBg, title, sub, chevron = true, onClick }) {
  const r = document.createElement("div");
  r.className = "m3-row";
  r.innerHTML = `
    ${icon ? `<div class="ri" style="${iconBg ? `background:${iconBg};color:#fff` : ""}">${icon}</div>` : ""}
    <div class="rt"><div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>
    ${chevron ? `<svg class="chev" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="m9 6 6 6-6 6-1.4-1.4L12.2 12 7.6 7.4 9 6z"/></svg>` : ""}`;
  if (onClick) r.addEventListener("pointerup", onClick);
  return r;
}

export function listTitle(text) {
  const t = document.createElement("div");
  t.className = "m3-list-title";
  t.textContent = text;
  return t;
}

export function svg(path, size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"><path d="${path}"/></svg>`;
}

export const P = {
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v2h-2V7zm0 4h2v6h-2v-6z",
  palette: "M12 3a9 9 0 0 0 0 18c.8 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1-.2-.3-.4-.6-.4-1 0-.9.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z",
  image: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z",
  phone: "M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z",
  music: "M12 3v10.6a4 4 0 1 0 2 3.4V7h4V3h-6z",
  play: "M8 5v14l11-7L8 5z",
  pause: "M6 5h4v14H6V5zm8 0h4v14h-4V5z",
  bell: "M12 22a2.3 2.3 0 0 0 2.3-2.3H9.7A2.3 2.3 0 0 0 12 22zm7-5.4v-1l-1.6-1.6v-4.3c0-2.9-1.6-5.4-4.3-6V3a1.1 1.1 0 1 0-2.2 0v.7c-2.7.6-4.3 3.1-4.3 6v4.3L5 15.6v1h14z",
  video: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14.5v-9l7 4.5-7 4.5z",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.5 5h-1.7v6l4.7 2.8.8-1.4-3.8-2.2V7z",
  calc: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
  dark: "M12 3a9 9 0 1 0 9 9c0-.5 0-1-.1-1.4A7 7 0 0 1 11 3.1c-.3 0-.7-.1-1-.1z",
  store: "M6.6 8.2 12 2.6l5.4 5.6h2.2c.8 0 1.4.6 1.4 1.4v9.8c0 .8-.6 1.4-1.4 1.4H4.4c-.8 0-1.4-.6-1.4-1.4V9.6c0-.8.6-1.4 1.4-1.4h2.2z",
  tv: "M21 7h-6.2l3.6-3.6L17 2l-5 5-5-5-1.4 1.4L9.2 7H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z",
};
