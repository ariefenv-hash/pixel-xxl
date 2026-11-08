/* apps/music.js —— music：master（正在播放 + 进度条）+ 播放列表子页（2 首）。
 * 进度条忠实原公式：x = AppX - 125 + (t/len)×125（250 逻辑 px 行程）。
 * 音源为内置 chiptune 合成（原 MP3 涉版权不入库，语义保留：播放/暂停/进度/结束自停）。 */

import { header, body, row, listTitle, svg, P } from "./helpers.js";
import { player, TRACKS } from "../audio.js";

export function mount(win, api) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("music"));
  const b = body();
  root.appendChild(b);

  const hero = document.createElement("div");
  hero.className = "mu-hero";
  hero.innerHTML = `
    <div class="mu-art"><svg viewBox="0 0 24 24" fill="currentColor"><path d="${P.music}"/></svg></div>
    <div class="mu-now">未在播放</div>
    <div class="mu-state">从播放列表选一首，或点左下角播放</div>`;
  b.appendChild(hero);

  const prog = document.createElement("div");
  prog.innerHTML = `
    <div class="mu-progress"><div class="mu-track"><div class="mu-fill"></div></div></div>
    <div class="mu-times"><span class="cur">0:00</span><span class="dur">0:00</span></div>`;
  b.appendChild(prog);

  /* 迷你播放/暂停（scratch (-122,-317) → 左下角悬浮按钮） */
  const mini = document.createElement("button");
  mini.className = "mu-mini";
  mini.innerHTML = svg(P.play, 22);
  mini.addEventListener("pointerup", () => {
    if (!player.playing && player.position === 0) player.play();
    else player.toggle();
  });
  root.appendChild(mini);

  const fill = prog.querySelector(".mu-fill");
  const cur = prog.querySelector(".cur");
  const dur = prog.querySelector(".dur");
  const now = hero.querySelector(".mu-now");
  const st = hero.querySelector(".mu-state");

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const render = () => {
    const t = player.track;
    const p = player.position;
    now.textContent = t.name;
    st.textContent = player.playing ? "正在播放 · chiptune 实时合成" : "已暂停";
    fill.style.width = `${(p / t.len) * 100}%`;                     // t/len → 行程
    cur.textContent = fmt(p);
    dur.textContent = fmt(t.len);
    mini.innerHTML = svg(player.playing ? P.pause : P.play, 22);
    if (interval === null && player.playing) startLoop();
  };
  let interval = null;
  const startLoop = () => {
    interval = setInterval(() => {
      render();
      if (!player.playing) { clearInterval(interval); interval = null; render(); }
    }, 200);
  };
  player.onState = render;
  render();

  win.appendChild(root);

  let sub = null;
  function showPlaylist() {
    sub = document.createElement("div");
    sub.appendChild(header("播放列表", { onBack: () => api.onBack() }));
    const b2 = body();
    sub.appendChild(b2);

    TRACKS.forEach((t, i) => {
        const r = row({
          icon: svg(P.music), title: t.name,
          sub: `${Math.round(t.len)}s · ${t.bpm} BPM · 内置合成`,
          chevron: false,
          onClick: () => {
            player.play(i, 0);
            setTimeout(() => api.onBack(), 260);
          },
        });
        r.classList.add("mu-track-row");
        b2.appendChild(r);
      });
    b2.appendChild(listTitle("注：原工程的两首 MP3 因版权不随库分发，此处以 WebAudio 音序器实时合成同氛围替代曲。"));
    api.openSub(sub);
  }

  /* master 上的“播放列表”入口（原工程 master 行 (0,224)） */
  b.insertBefore(row({
    icon: svg("M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h12v2H3v-2z"),
    title: "播放列表", sub: "2 首内置曲目",
    onClick: () => showPlaylist(),
  }), hero.nextSibling);

  return {
    onBack() { api.closeSub(); },
    destroy() { player.onState = null; },
  };
}
