/**
 * registry.ts — app 注册表与懒加载
 *
 * 性能优化点 #4：每个 app 是一个独立 chunk，只有真正打开时才 import。
 * 首屏的 JS 只包含外壳逻辑，不含任何 app 代码。
 */

export interface AppContext {
  /** 打开另一个 app（用于 app 间跳转） */
  open(id: string): void;
  /** 关闭当前 app，回桌面 */
  close(): void;
  toast(msg: string): void;
  /** 切换壁纸（由个性化 app 调用，外壳负责应用调色板） */
  setWallpaper(id: string): void;
  setTheme(theme: 'light' | 'dark'): void;
  getTheme(): 'light' | 'dark';
  getWallpaper(): string;
}

export interface AppModule {
  /** 挂载到容器，返回卸载函数 */
  mount(root: HTMLElement, ctx: AppContext): () => void;
}

export interface AppDef {
  id: string;
  name: string;
  /** 图标 symbol id（见 index.html 的 sprite） */
  icon: string;
  /** 图标底色：'auto' = 用调色板 primary-container；'none' = 透明 */
  tint: 'auto' | 'none' | string;
  /** 是否出现在桌面（否则只在 All Apps 里） */
  onDesktop?: boolean;
  load(): Promise<AppModule>;
}

const lazy = <T>(fn: () => Promise<T>) => fn;

export const APPS: Record<string, AppDef> = {
  settings: {
    id: 'settings',
    name: '设置',
    icon: 'settings',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/settings')),
  },
  photos: {
    id: 'photos',
    name: '相册',
    icon: 'photos',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/photos')),
  },
  store: {
    id: 'store',
    name: '商店',
    icon: 'store',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/store')),
  },
  notifications: {
    id: 'notifications',
    name: '通知',
    icon: 'notifications',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/notiflog')),
  },
  video: {
    id: 'video',
    name: '视频',
    icon: 'video',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/video')),
  },
  phone: {
    id: 'phone',
    name: '电话',
    icon: 'phone',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/phone')),
  },
  bilibili: {
    id: 'bilibili',
    name: 'bilibili',
    icon: 'bilibili',
    tint: '#fb7299',
    onDesktop: true,
    load: lazy(() => import('../apps/bilibili')),
  },
  music: {
    id: 'music',
    name: '音乐',
    icon: 'music',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/music')),
  },
  calculator: {
    id: 'calculator',
    name: '计算器',
    icon: 'calculator',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/calculator')),
  },
  clock: {
    id: 'clock',
    name: '时钟',
    icon: 'clock',
    tint: 'auto',
    onDesktop: true,
    load: lazy(() => import('../apps/clock')),
  },
  theme: {
    id: 'theme',
    name: '个性化',
    icon: 'palette',
    tint: 'auto',
    onDesktop: false,
    load: lazy(() => import('../apps/personalize')),
  },
  message: {
    id: 'message',
    name: '信息',
    icon: 'message',
    tint: 'auto',
    load: lazy(() => import('../apps/message')),
  },
  browser: {
    id: 'browser',
    name: 'Chrome',
    icon: 'browser',
    tint: 'auto',
    load: lazy(() => import('../apps/browser')),
  },
  camera: {
    id: 'camera',
    name: '相机',
    icon: 'camera',
    tint: 'auto',
    load: lazy(() => import('../apps/camera')),
  },
};

/** 桌面图标顺序：对齐旧工程的图标排布（设置/相册/商店/通知/视频/电话/bilibili/个性化/music/计算器/时钟） */
export const DESKTOP_ORDER = [
  'settings',
  'photos',
  'store',
  'notifications',
  'video',
  'bilibili',
  'theme',
  'music',
  'calculator',
  'clock',
];

export const DOCK_ORDER = ['phone', 'message', 'browser', 'camera'];
