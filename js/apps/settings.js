/* apps/settings.js —— 设置：状态机 0 → 1-{关于本机} → 2-{彩蛋}（忠实原工程路由）。
 * 彩蛋页内置「曲线风格」开关（对应原工程 曲线风格 0/1 两个顶层游离调试开关）。 */

import { header, body, row, listTitle, svg, P } from "./helpers.js";
import { state, setPref } from "../store.js";

export function mount(win, api) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("设置"));
  const b = body();
  root.appendChild(b);

  const card = document.createElement("div");
  card.className = "st-device-card";
  card.innerHTML = `
    <div class="avatar">P</div>
    <div><div class="t">Pixel XXL</div><div class="s">Web Edition · v1.00</div></div>`;
  b.appendChild(card);

  b.appendChild(row({
    icon: svg(P.info), title: "关于本机", sub: "机型 · 版本 · 彩蛋",
    onClick: () => showSub("关于本机"),
  }));
  b.appendChild(row({
    icon: svg(P.palette), title: "个性化", sub: "壁纸与色调（跳转）",
    onClick: () => import("../window-manager.js").then((m) => {
      api.close();
      setTimeout(() => m.openApp("个性化"), 120);
    }),
  }));
  b.appendChild(listTitle("这台虚拟手机由原生 ES Modules 驱动，无构建、无二进制素材。"));

  win.insertBefore(root, null);

  let page = null;   // null | '关于本机' | '彩蛋'

  function showSub(next) {
    page = next;
    api.openSub(buildSub());
  }

  function buildSub() {
    const d = document.createElement("div");
    d.appendChild(header(page, { onBack: () => api.onBack() }));
    const b2 = body();
    d.appendChild(b2);

    if (page === "关于本机") {
      const hero = document.createElement("div");
      hero.className = "st-about-hero";
      hero.innerHTML = `
        <div class="logo"></div>
        <div class="name">Pixel XXL</div>
        <div class="ver">Web Edition v1.00 · 由 Scratch 工程原生重写</div>`;
      b2.appendChild(hero);
      b2.appendChild(listTitle("基本信息"));
      b2.appendChild(kv("机型", "Pixel XXL（324×720）"));
      b2.appendChild(kv("内核", "ES Modules · vanilla JS"));
      b2.appendChild(kv("取色引擎", "Monet · k-means + tonal palette"));
      b2.appendChild(kv("素材", "全部程序化生成"));
      b2.appendChild(row({
        icon: svg("M12 2l2.4 2.4L12 6.8 9.6 4.4 12 2z"), title: "彩蛋", sub: "开发者选项",
        chevron: true, onClick: () => { page = "彩蛋"; api.openSub(buildSub()); },
      }));
    } else {
      b2.appendChild(listTitle("彩蛋 · 开发者选项"));
      const sw = document.createElement("div");
      sw.className = "st-egg-sw";
      sw.innerHTML = `
        <div><div style="font-size:14px;font-weight:500">曲线风格（开窗动画）</div>
        <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:4px">
          ${state.curveStyle === 0 ? "0 · 指数趋近（原工程风格 0）" : "1 · 分段缓动（原工程风格 1）"}</div></div>
        <div class="m3-switch ${state.curveStyle === 1 ? "on" : ""}"></div>`;
      sw.querySelector(".m3-switch").addEventListener("pointerup", (e) => {
        const next = state.curveStyle === 1 ? 0 : 1;
        setPref({ curveStyle: next });
        e.currentTarget.classList.toggle("on", next === 1);
        const desc = sw.querySelector("div div:last-child");
        if (desc) desc.textContent =
          next === 0 ? "0 · 指数趋近（原工程风格 0）" : "1 · 分段缓动（原工程风格 1）";
      });
      b2.appendChild(sw);
      b2.appendChild(listTitle("致谢"));
      b2.appendChild(kv("原工程", "Pixel.XL.0827.html（TurboWarp 打包）"));
      b2.appendChild(kv("重写", "原生 Web · 多文件 · 零积木块"));
    }
    return d;
  }

  function kv(k, v) {
    const r = document.createElement("div");
    r.className = "st-kv";
    r.innerHTML = `<span class="k">${k}</span><span class="v">${v}</span>`;
    return r;
  }

  return {
    onBack() {
      if (page === "彩蛋") { page = "关于本机"; api.openSub(buildSub()); }
      else { page = null; api.closeSub(); }
    },
    destroy() { },
  };
}
