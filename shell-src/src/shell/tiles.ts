/**
 * shell/tiles.ts — QS 磁贴定义（L2 首批 · #18 对照稿交付）
 *
 * 两族磁贴并存：
 * ① 工程联动族（action/status）：只允许复用工程既有事件链（catalog 的广播图），
 *    亮度模式 / 壁纸编号 → 写变量 + 广播「壁纸」（个性化APP 同款序列）；
 *    曲线风格 → 仅写变量（「应用」target 直读，工程内原样）；
 *    前台/锁屏/时钟 → 只读展示。空壳变量（refs=0）一律不写（catalog 头注纪律）。
 * ② 壳层自持族（toggle，#18 首批六磁贴）：Wi-Fi/蓝牙/手电筒/自动旋转/亮暗切换/
 *    飞行模式——三态状态机在 tile-states.ts，不写任何工程变量（L0：不新增
 *    project.json 变量），unavailable 联动只用只读锁屏变量（self: 模拟语义登记
 *    docs/SHELL.md）。亮暗切换的壳层副作用 = 壳层主题换肤（style.css 变量组），
 *    零工程侵入。
 */
import { BROADCAST_MAP, STAGE_VARIABLE_MAP } from '../bridge/catalog';
import type { VMBridge } from '../bridge/runtime';
import { getTileState, toggleTileState, resetTileStates } from './tile-states';
import type { TileState, ToggleOpts } from './tile-states';

/** 磁贴种类：action = 点按执行动作序列；status = 只读展示；toggle = 三态开关（壳层自持） */
export type TileKind = 'action' | 'status' | 'toggle';

export interface TileDef {
  /** 稳定 id（DOM data-attr 与探针断言锚点） */
  readonly id: string;
  readonly kind: TileKind;
  /** 主标签 */
  readonly label: string;
  /** 读的舞台变量（快照轮询源；空数组 = 纯本地状态如时钟/三态磁贴） */
  readonly valueNames: readonly string[];
  /** action 磁贴：执行序列，返回反馈文案（桥接失败必须显式返回错误） */
  readonly apply?: (bridge: VMBridge) => string;
  /** 状态磁贴：由快照值渲染展示文本 */
  readonly render?: (values: Readonly<Record<string, string>>) => string;
  /** toggle 磁贴：三态配置（tile-states.ts 状态机） */
  readonly toggle?: ToggleOpts;
}

/* ---------------- 动作序列（工程事件链的忠实复刻） ---------------- */

/** 亮度模式四档循环序（README 口径 100/500/600/800；工程写入均为字符串字面量） */
const BRIGHTNESS_CYCLE_STR: readonly string[] = ['100', '500', '600', '800'];

function cycleBrightness(bridge: VMBridge): string {
  const cur = bridge.getVar('亮度模式');
  const curStr = cur === null ? '500' : String(cur);
  const idx = BRIGHTNESS_CYCLE_STR.indexOf(curStr);
  const next = BRIGHTNESS_CYCLE_STR[(idx + 1) % BRIGHTNESS_CYCLE_STR.length] ?? BRIGHTNESS_CYCLE_STR[0]!;
  // 工程链路：写变量 → 广播「壁纸」（zz 收到后自转「取色」完成重取色）
  if (!bridge.setVar('亮度模式', next)) return '写入失败：变量不存在或未装载';
  const threads = bridge.broadcast('壁纸');
  return threads > 0 ? `亮度模式 → ${next}（壁纸链 ${threads} 线程）` : '写入成功但广播「壁纸」无接收者（异常，请上报）';
}

function cycleWallpaper(bridge: VMBridge): string {
  const cur = bridge.getVar('壁纸编号');
  const curNum = Math.max(1, Math.min(7, parseInt(String(cur ?? '3'), 10) || 3));
  const next = (curNum % 7) + 1;
  if (!bridge.setVar('壁纸编号', String(next))) return '写入失败：变量不存在或未装载';
  const threads = bridge.broadcast('壁纸');
  return threads > 0 ? `壁纸 → ${next}/7（壁纸链 ${threads} 线程）` : '写入成功但广播「壁纸」无接收者（异常，请上报）';
}

function toggleCurveStyle(bridge: VMBridge): string {
  const cur = String(bridge.getVar('曲线风格') ?? '0');
  const next = cur === '0' ? '1' : '0';
  // 「应用」target 逐帧直读该变量，无广播参与（catalog：曲线风格 senders=[]）
  if (!bridge.setVar('曲线风格', next)) return '写入失败：变量不存在或未装载';
  return `曲线风格 → ${next === '1' ? '分段缓动' : '指数趋近'}`;
}

/* ---------------- 锁屏 unavailable 判定（只读通道，self: 模拟语义） ---------------- */

/** 只读锁屏判定：「锁屏」=1 = 锁定（运行时未就绪时 getVar 返回 null → 不锁） */
function isLockscreenLocked(bridge: VMBridge): boolean {
  return bridge.getVar('锁屏') === '1';
}

/* ---------------- 磁贴表 ---------------- */

/** #18 首批六磁贴（对照稿清单：Wi-Fi/蓝牙/手电筒/自动旋转/亮暗切换/飞行模式） */
export const TOGGLE_TILES: readonly TileDef[] = [
  {
    id: 'wifi',
    kind: 'toggle',
    label: 'WLAN',
    valueNames: [],
    toggle: { initial: 'inactive', unavailableWhen: isLockscreenLocked },
  },
  {
    id: 'bluetooth',
    kind: 'toggle',
    label: '蓝牙',
    valueNames: [],
    toggle: { initial: 'inactive', unavailableWhen: isLockscreenLocked },
  },
  {
    id: 'flashlight',
    kind: 'toggle',
    label: '手电筒',
    valueNames: [],
    toggle: { initial: 'inactive' }, // 锁屏手电筒可用（惯例，self: 登记）
  },
  {
    id: 'auto-rotate',
    kind: 'toggle',
    label: '自动旋转',
    valueNames: [],
    toggle: { initial: 'inactive', unavailableWhen: isLockscreenLocked },
  },
  {
    id: 'dark-mode',
    kind: 'toggle',
    label: '深色主题',
    valueNames: [],
    toggle: {
      initial: 'active', // 壳层默认深色基线（style.css :root 深色变量组）
      onToggle: (active) => applyShadeTheme(active),
    },
  },
  {
    id: 'airplane',
    kind: 'toggle',
    label: '飞行模式',
    valueNames: [],
    toggle: { initial: 'inactive', unavailableWhen: isLockscreenLocked },
  },
];

/** 壳层亮暗换肤：html[data-shade-theme] 切换 style.css 变量组（dark-mode 磁贴消费） */
export function applyShadeTheme(dark: boolean): void {
  document.documentElement.dataset.shadeTheme = dark ? 'dark' : 'light';
}

export const TILES: readonly TileDef[] = [
  ...TOGGLE_TILES,
  {
    id: 'brightness',
    kind: 'action',
    label: '亮度模式',
    valueNames: ['亮度模式'],
    apply: cycleBrightness,
    render: (v) => `亮度模式 · ${v['亮度模式'] ?? '—'}`,
  },
  {
    id: 'wallpaper',
    kind: 'action',
    label: '壁纸',
    valueNames: ['壁纸编号'],
    apply: cycleWallpaper,
    render: (v) => `壁纸 · ${v['壁纸编号'] ?? '—'}/7`,
  },
  {
    id: 'curve-style',
    kind: 'action',
    label: '曲线风格',
    valueNames: ['曲线风格'],
    apply: toggleCurveStyle,
    render: (v) => `曲线风格 · ${v['曲线风格'] === '1' ? '分段' : '指数'}`,
  },
  {
    id: 'foreground',
    kind: 'status',
    label: '前台',
    valueNames: ['当前打开应用', 'All Apps open？'],
    render: (v) => {
      const app = v['当前打开应用'] ?? '';
      const drawer = v['All Apps open？'] === '1';
      const where = app ? `应用 · ${app}` : drawer ? 'All Apps' : '桌面';
      return `前台 · ${where}`;
    },
  },
  {
    id: 'lock-state',
    kind: 'status',
    label: '锁屏',
    valueNames: ['锁屏'],
    render: (v) => `锁屏 · ${v['锁屏'] === '1' ? '已锁定' : '未锁定'}`,
  },
  {
    id: 'clock',
    kind: 'status',
    label: '时钟',
    valueNames: [],
    // 纯 DOM 时钟（L2 演示：壳层自有子系统，不依赖运行时数据）
    render: () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    },
  },
];

/** 三态磁贴标签文案（toggle 磁贴 render 通道） */
export function renderToggleState(label: string, state: TileState): string {
  if (state === 'unavailable') return `${label} · 不可用`;
  return `${label} · ${state === 'active' ? '开' : '关'}`;
}

/* ------- 折叠态磁贴行（#18 任务 1「折叠态显示 N 个」· R137） -------
 * AOSP 语义：通知 shade 折叠段顶部常驻一行 QS 磁贴（QuickQSPanel 同构位），
 * 二段展开显示全量网格。行内数量 N：SPEC 附注二留空项（SystemUI 原生资源
 * 语料未入库——md3 语料树 1588 blob 实查无 QS 原生 dimens，R137 实查披露），
 * 取 4 为壳层 self: 值（登记 docs/SHELL.md §6.3，防编造不标 aosp:）。
 */
/** 折叠态顶部磁贴行数量（self: 值） */
export const QUICK_ROW_COUNT = 4;
/** 折叠行磁贴 = 首批 toggle 磁贴前 N 个（与网格共享同一状态机实例） */
export const QUICK_ROW_TILES: readonly TileDef[] = TOGGLE_TILES.slice(0, QUICK_ROW_COUNT);

/* ------- 长按磁贴详情（#18 对照稿深化项 · R137） -------
 * AOSP 语义：长按 QS 磁贴 → 磁贴详情对话框（标题 + 开关钮，Android 12+ 同构）。
 * 长按阈值 400ms：framework ViewConfiguration 惯例值，语料未入库按 self: 登记
 * （不标 aosp:，docs/SHELL.md §6.3）；工程内无设置页 → 详情卡不放设置入口
 * （self: 裁剪，非 AOSP 原样）。文案为壳层演示语义（self:）。
 */
export interface TileDetailContent {
  readonly title: string;
  readonly status: string;
  readonly body: string;
  /** 是否提供「关闭磁贴」钮（toggle 磁贴；action/status 详情只读） */
  readonly closable: boolean;
}

/** 详情卡说明文案（self: 壳层演示语义，非 AOSP 原文） */
const TOGGLE_DETAIL_BODY =
  '壳层自持三态磁贴：工程内无实体服务，状态由壳层状态机维护（docs/SHELL.md §6.2 披露）。';
const ACTION_DETAIL_BODY = '工程联动磁贴：点击执行工程事件链（写变量 + 广播，catalog 对账纪律）。';
const STATUS_DETAIL_BODY = '只读展示磁贴：随工程变量快照轮询刷新，无开关。';

/** 磁贴详情卡内容（纯函数，vitest 直测） */
export function describeTile(
  def: TileDef,
  render?: (values: Readonly<Record<string, string>>) => string,
): TileDetailContent {
  if (def.kind === 'toggle') {
    return { title: def.label, status: '', body: TOGGLE_DETAIL_BODY, closable: true };
  }
  if (def.kind === 'action') {
    return { title: def.label, status: render ? render({}) : '', body: ACTION_DETAIL_BODY, closable: false };
  }
  return { title: def.label, status: render ? render({}) : '', body: STATUS_DETAIL_BODY, closable: false };
}

/**
 * 启动期校验：磁贴引用的变量/广播必须存在于 catalog 且非空壳；
 * 广播必须确有接收者（防桥接语义写错名）。漂移 = 启动即抛（fail loud）。
 * toggle 磁贴不绑变量（壳层自持），不参与变量目录校验。
 */
export function validateTilesAgainstCatalog(): void {
  const problems: string[] = [];
  for (const tile of TILES) {
    for (const name of tile.valueNames) {
      const v = STAGE_VARIABLE_MAP.get(name);
      if (!v) problems.push(`[${tile.id}] 变量「${name}」不在舞台变量目录`);
      else if (v.refs === 0) problems.push(`[${tile.id}] 变量「${name}」是空壳变量（refs=0），禁止绑定`);
    }
  }
  for (const b of BROADCAST_MAP.values()) {
    if (b.name === '壁纸' && b.receivers.length === 0) problems.push('广播「壁纸」无接收者，主题链断裂');
  }
  if (problems.length > 0) throw new Error(`磁贴绑定与桥接目录不一致：\n${problems.join('\n')}`);
}

export { getTileState, toggleTileState, resetTileStates };
export type { TileState };
