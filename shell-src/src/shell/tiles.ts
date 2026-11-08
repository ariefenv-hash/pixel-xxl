/**
 * shell/tiles.ts — QS 磁贴定义（L2 PoC：DOM 壳承载的控制器中心子系统）
 *
 * 语义纪律：每个动作磁贴只允许复用工程既有事件链（catalog 的广播图）：
 *   亮度模式 / 壁纸编号 → 写变量 + 广播「壁纸」（个性化APP 同款序列；
 *     链路：个性化APP→壁纸→zz→取色→13 target 全员重取色，见 catalog）；
 *   曲线风格 → 仅写变量（「应用」target 直读，无广播参与——工程内原样）。
 * 空壳变量（refs=0，含控制中心五变量）一律不写——DOM 壳不替工程发明语义，
 * 控制中心正是本壳承载的「工程内未实现」子系统（#18），DOM 侧状态由壳层自持。
 */
import { BROADCAST_MAP, STAGE_VARIABLE_MAP } from '../bridge/catalog';
import type { VMBridge } from '../bridge/runtime';

/** 磁贴种类：action = 点按执行动作序列；status = 只读展示（轮询刷新） */
export type TileKind = 'action' | 'status';

export interface TileDef {
  /** 稳定 id（DOM data-attr 与探针断言锚点） */
  readonly id: string;
  readonly kind: TileKind;
  /** 主标签（动作磁贴为名称；状态磁贴为名称前缀） */
  readonly label: string;
  /** 读的舞台变量（快照轮询源；空数组 = 纯本地状态如时钟） */
  readonly valueNames: readonly string[];
  /** 动作磁贴：执行序列，返回给用户的反馈文案（桥接失败必须显式返回错误） */
  readonly apply?: (bridge: VMBridge) => string;
  /** 状态磁贴：由快照值渲染展示文本 */
  readonly render?: (values: Readonly<Record<string, string>>) => string;
}

/* ---------------- 动作序列（工程事件链的忠实复刻） ---------------- */

/** 亮度模式四档循环序（README 口径 100/500/600/800；工程写入均为字符串字面量） */
const BRIGHTNESS_CYCLE: readonly string[] = ['100', '500', '600', '800'];

function cycleBrightness(bridge: VMBridge): string {
  const cur = bridge.getVar('亮度模式');
  const curStr = cur === null ? '500' : String(cur);
  const idx = BRIGHTNESS_CYCLE.indexOf(curStr);
  const next = BRIGHTNESS_CYCLE[(idx + 1) % BRIGHTNESS_CYCLE.length] ?? BRIGHTNESS_CYCLE[0]!;
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

/* ---------------- 磁贴表 ---------------- */

export const TILES: readonly TileDef[] = [
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

/**
 * 启动期校验：磁贴引用的变量/广播必须存在于 catalog 且非空壳；
 * 广播必须确有接收者（防桥接语义写错名）。漂移 = 启动即抛（fail loud）。
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
