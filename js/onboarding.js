/* onboarding.js —— 三页引导，元素数据 1:1 取自原工程『克隆』调用参数
 * (我是, x, y → x2, y2, 大小1 → 大小2, 页)，cssY = 360 - scratchY。
 * 入场：ghost 100→0 / 云母模糊 7→0 / 尺寸插值；next 点击后 30 帧退场。 */

import { on, emit } from "./bus.js";
import { setRuntime, state } from "./store.js";

/* 内容文案：原工程为图形素材，此处以同版式文字表达（欢迎 / 手势 / 主题） */
const PAGES = [
  null,
  {
    els: [
      { cls: "ob-blob", w: 96, from: [220, 606], to: [110, 303], s1: 50, s2: 100, bg: "linear-gradient(135deg,#4c8df6,#34a853)" },
      { cls: "ob-blob", w: 120, from: [-240, -546], to: [-120, -273], s1: 100, s2: 100, bg: "linear-gradient(135deg,#fbbc05,#ea4335)" },
      { text: "欢迎来到 Pixel XXL", cls: "ob-title", from: [-180, 85], to: [-36, 85], s1: 100, s2: 100 },
      { text: "一台跑在浏览器里的「Pixel 手机」", cls: "ob-sub", from: [-180, 0], to: [-88, 0], s1: 100, s2: 100 },
      { text: "Material You · 动态取色 · 原生 Web", cls: "ob-sub", from: [-180, -40], to: [-88, -40], s1: 100, s2: 100 },
    ],
  },
  {
    els: [
      { cls: "ob-blob", w: 120, from: [-240, -580], to: [-120, -290], s1: 100, s2: 100, bg: "linear-gradient(135deg,#34a853,#4c8df6)" },
      { cls: "ob-card", w: 150, h: 96, from: [-115, 250], to: [-115, 250], s1: 0, s2: 100 },
      { cls: "ob-card", w: 170, h: 64, from: [-115, 280], to: [-115, 260], s1: 100, s2: 100 },
      { text: "手势导航", cls: "ob-title", from: [0, 165], to: [0, 175], s1: 100, s2: 100 },
      { text: "底部上滑进多任务，上滑悬停开 All Apps", cls: "ob-sub", from: [-27, 95], to: [-27, 105], s1: 100, s2: 100 },
      { text: "从屏幕底缘向上划 — 返回", cls: "ob-sub", from: [0, -120], to: [0, -100], s1: 90, s2: 100 },
      { text: "或拖动右缘的 md3e 返回柄", cls: "ob-sub", from: [0, -120], to: [0, -100], s1: 90, s2: 100 },
      { cls: "ob-gesture-pill", text: "‹ 返回", w: 64, h: 30, from: [-68.5, -110], to: [-68.5, -100], s1: 90, s2: 100 },
      { cls: "ob-gesture-pill", text: "多任务 ›", w: 64, h: 30, from: [68.5, -110], to: [68.5, -100], s1: 90, s2: 100 },
    ],
  },
  {
    els: [
      { cls: "ob-blob", w: 110, from: [240, -200], to: [120, -100], s1: 100, s2: 100, bg: "linear-gradient(135deg,#ea4335,#fbbc05)" },
      { text: "一切都随壁纸变色", cls: "ob-title", from: [-115, 245], to: [-115, 250], s1: 100, s2: 100 },
      { text: "换一张壁纸，整套 UI 立刻重染", cls: "ob-sub", from: [-25, 180], to: [-25, 190], s1: 100, s2: 100 },
      { text: "试试「个性化」应用 › 壁纸", cls: "ob-sub", from: [-180, 139], to: [-93, 139], s1: 100, s2: 100 },
      { text: "锁屏：A 锁 / D 解，或按侧边电源键", cls: "ob-sub", from: [-180, 90], to: [-93, 90], s1: 100, s2: 100 },
    ],
  },
];

let page = 0;

export function initOnboarding() {
  const layer = document.getElementById("onboarding");

  on("boot-finished", () => gotoPage(1));

  on("ob-next", () => {
    if (state.mode !== "onboard") return;
    if (page < 3) gotoPage(page + 1);
    else {
      layer.hidden = true;
      setRuntime({ mode: "desktop" });
      emit("guide-end");          // ≈ 广播「引导结束」：壁纸亮度回归、图标飞入
    }
  });

  function gotoPage(next) {
    // 旧页元素退场
    layer.querySelectorAll(".ob-el:not(.leaving)").forEach((el) => {
      el.classList.add("leaving");
      el.style.transition = "opacity .32s linear, filter .32s linear";
      el.style.opacity = "0";
      el.style.filter = "blur(6px)";
    });
    setTimeout(() => {
      layer.innerHTML = "";
      const dots = document.createElement("div");
      dots.className = "ob-dots";
      dots.innerHTML = `<i class="${next >= 1 && "on"}"></i><i class="${next >= 2 && "on"}"></i><i class="${next >= 3 && "on"}"></i>`;
      layer.appendChild(dots);
      page = next;

      if (next <= 3) {
        const defs = PAGES[next]?.els || [];
        defs.forEach((def, i) => spawn(def, i));
      } else {
        emit("ob-next");
        return;
      }

      const nextBtn = document.createElement("button");
      nextBtn.className = "ob-next";
      nextBtn.textContent = next === 3 ? "开始" : "NEXT";
      layer.appendChild(nextBtn);
      requestAnimationFrame(() => requestAnimationFrame(() => (nextBtn.style.opacity = "1")));
      nextBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        nextBtn.style.transition = "opacity .3s";
        nextBtn.style.opacity = "0";
        emit("ob-next");
      });
      layer.hidden = false;
    }, 330);
  }

  function spawn(def, idx) {
    const el = document.createElement("div");
    el.className = `ob-el ${def.cls || ""}`;
    if (def.text) el.textContent = def.text;
    if (def.bg) el.style.background = def.bg;
    if (def.w && !def.text) {
      el.style.width = `${def.w}px`;
      el.style.height = def.h ? `${def.h}px` : `${def.w}px`;
    }
    layer.appendChild(el);

    // 初态（from，模糊 7 级、全透明）；尺寸 1 → 尺寸 2 用 scale 表达
    const place = (x, y, s) => {
      el.style.left = `${162 + x - el.offsetWidth / 2}px`;
      el.style.top = `${360 - y - el.offsetHeight / 2}px`;
      el.style.transform = `scale(${Math.max(s, 0) / 100})`;
    };
    place(def.from[0], def.from[1], def.s1);
    el.style.opacity = "0";
    el.style.filter = "blur(7px)";

    // 分帧入场（对应原工程逐帧 1/10 与 1/10.5 插值 → 用长缓动近似）
    setTimeout(() => {
      el.classList.add("settled");
      place(def.to[0], def.to[1], def.s2);
      el.style.opacity = "1";
      el.style.filter = "blur(0px)";
    }, 90 + idx * 110);
  }
}
