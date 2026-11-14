/**
 * music.ts — 音乐（原工程 619 块，是该项目最大的 app）
 *
 * 音频不占首屏：<audio preload="none">，只有用户点播放才发起请求。
 * 进度条用 transform: scaleX 表示，不写 width（避免每帧重排）。
 */
import { $, el } from '../core/dom';
import type { AppModule } from '../core/registry';
import { store } from '../core/store';
import './music.css';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  src: string;
  /** 已知时长（秒）：用于未加载时先把进度条的时长显示出来 */
  duration: number;
  art: string;
}

const TRACKS: Track[] = [
  {
    id: 't1',
    title: '夜航',
    artist: '林间回声',
    album: 'Single · 2026',
    src: 'audio/track-1.mp3',
    duration: 110,
    art: 'linear-gradient(150deg,#3b2b6b,#7b5ea7 45%,#c3a6d9)',
  },
  {
    id: 't2',
    title: '白日梦',
    artist: '林间回声',
    album: 'Single · 2026',
    src: 'audio/track-2.mp3',
    duration: 257,
    art: 'linear-gradient(150deg,#1f4a5c,#3f8fa8 50%,#a8d8e0)',
  },
];

const fmt = (s: number): string => {
  if (!Number.isFinite(s)) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' + sec : sec}`;
};

export const mount: AppModule['mount'] = (root, ctx) => {
  let index = 0;
  let playing = false;

  const wrap = el('div', { class: 'mus' });
  wrap.innerHTML =
    '<div class="mus__art" id="musArt"><svg class="mus__watermark"><use href="#ic-music"/></svg></div>' +
    '<div class="mus__meta">' +
    '<div class="mus__title" id="musTitle"></div>' +
    '<div class="mus__artist" id="musArtist"></div>' +
    '</div>' +
    '<div class="mus__progress">' +
    '<div class="mus__bar" id="musBar"><div class="mus__fill" id="musFill"></div></div>' +
    '<div class="mus__times"><span id="musCur">0:00</span><span id="musDur">--:--</span></div>' +
    '</div>' +
    '<div class="mus__controls">' +
    '<button class="mus__btn" id="musPrev" type="button" aria-label="上一首"><svg><use href="#ic-prev"/></svg></button>' +
    '<button class="mus__btn mus__btn--play" id="musPlay" type="button" aria-label="播放"><svg><use href="#ic-play"/></svg></button>' +
    '<button class="mus__btn" id="musNext" type="button" aria-label="下一首"><svg><use href="#ic-next"/></svg></button>' +
    '</div>' +
    '<div class="mus__list" id="musList"></div>';
  root.append(wrap);

  const art = $('#musArt', wrap)!;
  const titleEl = $('#musTitle', wrap)!;
  const artistEl = $('#musArtist', wrap)!;
  const bar = $('#musBar', wrap)!;
  const fill = $('#musFill', wrap)!;
  const curEl = $('#musCur', wrap)!;
  const durEl = $('#musDur', wrap)!;
  const playBtn = $('#musPlay', wrap)!;
  const listEl = $('#musList', wrap)!;

  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = store.get('volume') / 100;

  const paintTrack = () => {
    const t = TRACKS[index];
    art.style.background = t.art;
    art.dataset.playing = playing ? '1' : '0';
    titleEl.textContent = t.title;
    artistEl.textContent = `${t.artist} · ${t.album}`;
    playBtn.innerHTML = `<svg><use href="#ic-${playing ? 'pause' : 'play'}"/></svg>`;
    durEl.textContent = fmt(t.duration);
    listEl.replaceChildren(
      ...TRACKS.map((tr, i) => {
        const row = el('button', {
          class: 'mus__row',
          type: 'button',
          'data-active': i === index ? '1' : '0',
        });
        row.innerHTML =
          `<span class="mus__row-title">${tr.title}</span>` +
          `<span class="mus__row-sub">${tr.artist}</span>`;
        row.addEventListener('click', () => {
          if (i === index) {
            toggle();
            return;
          }
          index = i;
          load(true);
        });
        return row;
      })
    );
  };

  /** 首次播放才挂 src（懒加载的关键） */
  const load = (autoplay: boolean): void => {
    const t = TRACKS[index];
    if (!audio.src.endsWith(t.src)) {
      audio.src = t.src;
      audio.load();
    }
    paintTrack();
    if (autoplay) void audio.play().catch(() => ctx.toast('浏览器阻止了自动播放，请再点一次'));
  };

  const toggle = (): void => {
    if (!audio.src) {
      load(true);
      return;
    }
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  };

  audio.addEventListener('play', () => {
    playing = true;
    paintTrack();
  });
  audio.addEventListener('pause', () => {
    playing = false;
    paintTrack();
  });
  audio.addEventListener('loadedmetadata', () => {
    durEl.textContent = fmt(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    const dur = audio.duration || 0;
    const ratio = dur ? audio.currentTime / dur : 0;
    // scaleX：合成层内变形，不触发重排
    fill.style.transform = `scaleX(${ratio})`;
    curEl.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('ended', () => {
    index = (index + 1) % TRACKS.length;
    load(true);
  });

  $('#musPlay', wrap)!.addEventListener('click', toggle);
  $('#musPrev', wrap)!.addEventListener('click', () => {
    index = (index - 1 + TRACKS.length) % TRACKS.length;
    load(playing);
  });
  $('#musNext', wrap)!.addEventListener('click', () => {
    index = (index + 1) % TRACKS.length;
    load(playing);
  });

  // 进度条拖动
  let seeking = false;
  const seek = (clientX: number) => {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    fill.style.transform = `scaleX(${ratio})`;
    if (audio.duration) {
      curEl.textContent = fmt(ratio * audio.duration);
      audio.currentTime = ratio * audio.duration;
    }
  };
  bar.addEventListener('pointerdown', (e) => {
    seeking = true;
    bar.setPointerCapture(e.pointerId);
    seek(e.clientX);
  });
  bar.addEventListener('pointermove', (e) => {
    if (seeking) seek(e.clientX);
  });
  const stopSeek = () => {
    seeking = false;
  };
  bar.addEventListener('pointerup', stopSeek);
  bar.addEventListener('pointercancel', stopSeek);

  // 音量跟随系统滑块
  const unsub = store.subscribe((_s, key) => {
    if (key === 'volume') audio.volume = store.get('volume') / 100;
  });

  paintTrack();

  return () => {
    unsub();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    wrap.remove();
  };
};
