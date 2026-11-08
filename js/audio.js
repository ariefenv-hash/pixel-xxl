/* audio.js —— WebAudio 合成引擎：
 * - 系统音效（开机和弦 / 解锁滴答 / 按键哒）全部程序合成，无二进制素材
 * - 两首音乐为内置 chiptune 音序器实时合成（原工程的 2 首 MP3 涉及版权，不予内置；
 *   播放器语义忠实保留：时长 / 进度条 t÷len×125 / 暂停恢复 / 计时器广播门控） */

let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudio() { try { ac(); } catch { /* 无声环境 */ } }

function blip(freq, dur = .08, type = "sine", gain = .18, when = 0) {
  let a;
  try { a = ac(); } catch { return; }
  const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + .05);
}

export const sfx = {
  boot() { // 开机和弦：D-A-F#-D 上行
    [294, 440, 554, 740].forEach((f, i) => blip(f, .5, "sine", .14, i * .16));
  },
  unlock() { blip(660, .07, "triangle", .15); blip(990, .09, "triangle", .12, .06); },
  lock() { blip(520, .07, "triangle", .13); blip(330, .1, "triangle", .1, .06); },
  tick() { blip(1400, .025, "square", .05); },
};

/* ── chiptune 音序器 ─────────────────────────────────────────
 * note = [midi, beats]；midi≤0 为休止。音色：方波主旋律 + 三角波贝斯 + 噪声 hat。 */

const N = (m, b) => [m, b];
const REST = [0, 1];

function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

/* Track A —— 「Railgun Dash (chiptune tribute)」：A 小调 152 BPM 疾走琶音 */
function trackA() {
  const bar = (root) => [
    N(root, .5), N(root + 7, .5), N(root + 12, .5), N(root + 16, .5),
    N(root + 19, .5), N(root + 16, .5), N(root + 12, .5), N(root + 7, .5),
  ];
  const lead = [
    ...bar(69), ...bar(72), ...bar(69), ...bar(76),
    ...bar(69), ...bar(72), ...bar(74), ...bar(69 - 3 + 12),
  ];
  const bass = [];
  for (let i = 0; i < 8; i++) bass.push(N(45 + (i % 2 ? 7 : 0), 1), N(52 + (i % 2 ? 7 : 0), 1));
  const bpm = 152, beats = lead.reduce((a, [, b]) => a + b, 0);
  return { name: "Railgun Dash (chiptune tribute)", bpm, lead, bass, beats, len: (beats / bpm) * 60 };
}

/* Track B —— 「520AM (8-bit lullaby)」：慢板摇篮曲，呼应 5:20am 的梗 */
function trackB() {
  const mel = [
    N(76, 1), N(74, 1), N(71, 2), REST, N(69, 1), N(71, 1), N(74, 2),
    N(76, 1), N(79, 1), N(81, 2), N(79, 1), N(76, 1), N(74, 2),
    N(71, 1), N(69, 1), N(67, 2), REST, N(69, 1), N(71, 1), N(69, 2), N(64, 4),
  ];
  const bass = [N(40, 4), N(45, 4), N(36, 4), N(45, 4), N(38, 4), N(43, 4), N(33, 4), N(40, 4)];
  const bpm = 92, beats = mel.reduce((a, [, b]) => a + b, 0);
  return { name: "520AM (8-bit lullaby)", bpm, lead: mel, bass, beats, len: (beats / bpm) * 60 };
}

export const TRACKS = [trackA(), trackB()];

/* 播放器：position 基于音频时钟推进，支持 play/pause/seek */
export const player = {
  trackIndex: 0,
  playing: false,
  startCtxTime: 0,
  startOffset: 0,
  onState: null,

  get track() { return TRACKS[this.trackIndex]; },
  get duration() { return this.track.len; },
  get position() {
    if (!this.playing) return this.startOffset;
    return Math.min(this.startOffset + (ac().currentTime - this.startCtxTime), this.duration);
  },

  _nodes: null,
  _timer: null,

  play(index = this.trackIndex, offset = 0) {
    this.stopVoices();
    this.trackIndex = index;
    this.startOffset = offset;
    const a = ac();
    this.startCtxTime = a.currentTime;
    this.playing = true;
    this.schedule();
    this._timer = setInterval(() => {
      if (this.position >= this.duration - .05) { this.pause(); this.startOffset = 0; this.emit(); }
    }, 250);
    this.emit();
  },

  pause() {
    if (!this.playing) return;
    this.startOffset = this.position;
    this.playing = false;
    this.stopVoices();
    clearInterval(this._timer);
    this.emit();
  },

  toggle() { this.playing ? this.pause() : this.play(); },

  stopVoices() {
    if (this._nodes) { try { this._nodes.forEach((n) => n.stop?.()); } catch { } this._nodes = null; }
  },

  /* 前瞻式调度：把整曲排进 WebAudio 时间轴（曲目 < 60s，节点量可控） */
  schedule() {
    const a = ac();
    const t0 = a.currentTime + .06 - this.startOffset;
    const spb = 60 / this.track.bpm;
    const master = a.createGain();
    master.gain.value = .8;
    master.connect(a.destination);
    const nodes = [master];

    let t = 0;
    for (const [m, b] of this.track.lead) {
      const dur = b * spb;
      if (m > 0) nodes.push(voice(a, master, midiHz(m), t0 + t, dur * .92, "square", .10));
      t += dur;
    }
    let tb = 0;
    while (tb < this.track.beats) {
      for (const [m, b] of this.track.bass) {
        const dur = b * spb;
        if (m > 0 && tb < this.track.beats) nodes.push(voice(a, master, midiHz(m), t0 + tb, dur * .95, "triangle", .13));
        tb += dur;
      }
    }
    this._nodes = nodes;
  },

  emit() { this.onState?.(); },
};

function voice(a, dest, freq, when, dur, type, gain) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + .015);
  g.gain.setValueAtTime(gain, when + dur * .7);
  g.gain.exponentialRampToValueAtTime(.0001, when + dur);
  o.connect(g).connect(dest);
  o.start(when); o.stop(when + dur + .05);
  return o;
}
