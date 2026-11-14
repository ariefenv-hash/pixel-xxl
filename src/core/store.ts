/**
 * store.ts — 全局状态（零框架、零初始化计算）
 *
 * 设计约束（性能预算）：
 *  1. 初始化只做一次 JSON.parse（约 1KB），不做任何派生计算——所有派生值
 *     （调色板、图标、栅格）都在构建期烘焙好；
 *  2. 写 localStorage 合并到空闲帧，避免手势途中触发同步 IO；
 *  3. 订阅按 key 分发，避免整树重渲染。
 */

export type Theme = 'light' | 'dark';

export interface Notif {
  id: string;
  app: string;
  icon: string;
  title: string;
  text: string;
  time: string;
  ongoing?: boolean;
}

export interface ShellState {
  booted: boolean;
  wallpaper: string;
  theme: Theme;
  brightness: number;
  volume: number;
  tiles: Record<string, boolean>;
  recent: string[];
  notifications: Notif[];
  wifiOn: boolean;
  btOn: boolean;
}

const KEY = 'px2:state';

const DEFAULTS: ShellState = {
  booted: false,
  wallpaper: 'w3',
  theme: 'dark',
  brightness: 72,
  volume: 45,
  tiles: {
    internet: true,
    bluetooth: true,
    flashlight: false,
    modes: true,
    mobile: true,
    hotspot: false,
    location: true,
    airplane: false,
    cast: false,
    screenrecord: false,
    rotation: true,
    wallet: false,
    qr: false,
    nfc: true,
    battery: false,
    media: false,
  },
  recent: ['settings', 'calculator', 'music'],
  notifications: [
    {
      id: 'n1',
      app: '音乐',
      icon: 'music',
      title: '正在播放',
      text: '夜航 · 林间回声',
      time: '刚刚',
      ongoing: true,
    },
    {
      id: 'n2',
      app: '设置',
      icon: 'settings',
      title: '系统更新',
      text: 'Android 17 已就绪，点按查看新功能',
      time: '12 分钟前',
    },
    {
      id: 'n3',
      app: '时钟',
      icon: 'clock',
      title: '闹钟',
      text: '明天 07:30 · 工作日',
      time: '1 小时前',
      ongoing: true,
    },
  ],
  wifiOn: true,
  btOn: true,
};

type Listener = (state: ShellState, key: keyof ShellState) => void;

class Store {
  private state: ShellState;
  private listeners = new Set<Listener>();
  private flushQueued = false;

  constructor() {
    this.state = this.load();
  }

  private load(): ShellState {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      const saved = JSON.parse(raw) as Partial<ShellState>;
      // 浅合并：新增字段自动取默认值，老存档不炸
      return { ...DEFAULTS, ...saved, tiles: { ...DEFAULTS.tiles, ...(saved.tiles ?? {}) } };
    } catch {
      return { ...DEFAULTS };
    }
  }

  get<K extends keyof ShellState>(key: K): ShellState[K] {
    return this.state[key];
  }

  snapshot(): Readonly<ShellState> {
    return this.state;
  }

  set<K extends keyof ShellState>(key: K, value: ShellState[K]): void {
    if (this.state[key] === value) return;
    this.state[key] = value;
    this.emit(key);
    this.persist();
  }

  patch(partial: Partial<ShellState>): void {
    for (const k of Object.keys(partial) as (keyof ShellState)[]) {
      const v = partial[k];
      if (v !== undefined) this.state[k] = v as never;
    }
    this.emit('booted');
    this.persist();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(key: keyof ShellState): void {
    for (const fn of this.listeners) fn(this.state, key);
  }

  private persist(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    const flush = () => {
      this.flushQueued = false;
      try {
        const { notifications, ...rest } = this.state;
        // 通知是临时数据，不入库（避免每次开机都顶上来一批陈旧通知）
        localStorage.setItem(KEY, JSON.stringify({ ...rest, notifications }));
      } catch {
        /* 隐私模式/配额满：静默降级，不影响交互 */
      }
    };
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void })
        .requestIdleCallback(flush);
    } else {
      setTimeout(flush, 200);
    }
  }
}

export const store = new Store();
