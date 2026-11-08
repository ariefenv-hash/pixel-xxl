/* apps/video.js —— 视频：程序化演示影片（canvas 动画）+ 播放控制 + 清单。
 * 无真实片源（原工程的视频 MP4 不入库），以可播放的生成动画承担同等交互。 */

import { header, body, svg, P, listTitle } from "./helpers.js";

const FILMS = [
  { name: "流光 · Plasma", seed: 1 },
  { name: "环 · Orbit", seed: 2 },
];

export function mount(win) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.appendChild(header("视频"));
  const b = body();
  root.appendChild(b);

  const stage = document.createElement("div");
  stage.className = "vd-stage";
  const cv = document.createElement("canvas");
  cv.width = 264; cv.height = 165;
  stage.appendChild(cv);
  const playBtn = document.createElement("button");
  playBtn.className = "vd-play";
  playBtn.innerHTML = svg(P.play, 30);
  stage.appendChild(playBtn);
  b.appendChild(stage);

  const ctx = cv.getContext("2d");
  let film = FILMS[0];
  let playing = false;
  let t = 0;
  let raf = null;

  function frame() {
    if (!playing) return;
    t += .016;
    const w = cv.width, h = cv.height;
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, w, h);
    if (film.seed === 1) {
      for (let i = 0; i < 5; i++) {
        const g = ctx.createLinearGradient(0, h * (i / 5 + Math.sin(t + i) * .04), w, h * ((i + 1) / 5));
        g.addColorStop(0, `hsla(${(t * 40 + i * 50) % 360},70%,55%,.5)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      for (let i = 0; i < 9; i++) {
        ctx.rotate(t * (.3 + i * .05));
        ctx.strokeStyle = `hsla(${(t * 60 + i * 30) % 360},75%,60%,.75)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * .1 + i * 12, (w * .1 + i * 12) * .62, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }

  const setPlaying = (p) => {
    playing = p;
    playBtn.innerHTML = svg(p ? P.pause : P.play, 30);
    playBtn.style.opacity = p ? "0" : "1";
    if (p) frame();
    else cancelAnimationFrame(raf);
  };
  playBtn.addEventListener("pointerup", () => setPlaying(!playing));
  stage.addEventListener("pointerup", (e) => {
    if (e.target === playBtn) return;
    setPlaying(!playing);
  });

  b.appendChild(listTitle("片单（生成式演示）"));
  for (const f of FILMS) {
    const r = document.createElement("div");
    r.className = "m3-row";
    r.innerHTML = `<div class="ri" style="background:var(--md-tertiary-container);color:var(--md-on-tertiary-container)">${svg(P.video)}</div>
      <div class="rt"><div class="t">${f.name}</div><div class="s">循环播放 · ${f.seed === 1 ? "渐变流光" : "轨道环"}</div></div>`;
    r.addEventListener("pointerup", () => {
      film = f;
      t = 0;
      setPlaying(true);
    });
    b.appendChild(r);
  }

  win.appendChild(root);
  setPlaying(true);
  return { destroy() { cancelAnimationFrame(raf); } };
}
