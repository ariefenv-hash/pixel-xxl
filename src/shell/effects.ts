/**
 * effects.ts — 「插件能力」的本地重构
 *
 * 原工程 11 个 Scratch 扩展里，真正影响观感的是四类；其余是构建期工具。
 * 对照表见 docs/EXTENSIONS.md。这里承接其中运行时的两类：
 *
 *   · qiaoqiaoMica / blurExportPro / gpu-liquid-glass
 *       → 毛玻璃 + 指针跟随的镜面高光。滚动/拖动时只写 CSS 变量（--gx/--gy），
 *         由合成器完成模糊，不触发布局；不支持 backdrop-filter 的设备降级为实色。
 *   · lmsSoundExpanded
 *       → 极轻的 UI 音效（开/关 app、抽屉到位）。首次手势后才创建 AudioContext，
 *         避免自动播放策略告警；音量 0.015，听感接近 ColorOS 的触感反馈。
 *
 * 没搬的（cropURL / lmsSkins / lmsAssets / svgconvert / skyhigh173JSON）是原工程
 * 「预烘 60 张皮肤帧」的构建链；本壳用实时 DOM 容器变换替代，因此不再需要。
 */

let audio: AudioContext | null = null;
let enabled = true;

function context(): AudioContext | null {
  if (!enabled) return null;
  if (audio) return audio;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    enabled = false;
    return null;
  }
  try {
    audio = new Ctor();
  } catch {
    enabled = false;
  }
  return audio;
}

/** 一次很短的带通噪声 + 正弦，模仿系统 touch sound 的「嗒」 */
export function tick(kind: 'open' | 'close' | 'drawer' = 'open'): void {
  const ctx = context();
  if (!ctx || ctx.state === 'suspended') return;
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(kind === 'drawer' ? 0.012 : 0.018, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(kind === 'close' ? 320 : kind === 'drawer' ? 520 : 440, t);
  osc.frequency.exponentialRampToValueAtTime(kind === 'close' ? 220 : 660, t + 0.07);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = kind === 'drawer' ? 1800 : 1100;
  filter.Q.value = 1.2;

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** 指针跟随高光：只在命中的玻璃容器上写 --gx/--gy（百分比） */
function initGlass(): void {
  const selector = '.widget, .dock, .drawer__search, .qs__panel, .shade__panel';
  let queued = false;
  let last: PointerEvent | null = null;

  const flush = (): void => {
    queued = false;
    const e = last;
    if (!e) return;
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--gx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      last = e;
      if (queued) return;
      queued = true;
      requestAnimationFrame(flush);
    },
    { passive: true }
  );
}

export function initEffects(): void {
  const screen = document.querySelector<HTMLElement>('#screen');
  const supports =
    CSS.supports('backdrop-filter', 'blur(2px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(2px)');
  if (!supports && screen) screen.dataset.perf = 'low';

  initGlass();

  // 首次手势后解锁音频（移动端 AudioContext 必须由用户手势创建）
  const unlock = (): void => {
    const ctx = context();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    document.removeEventListener('pointerdown', unlock);
  };
  document.addEventListener('pointerdown', unlock, { passive: true });
}
