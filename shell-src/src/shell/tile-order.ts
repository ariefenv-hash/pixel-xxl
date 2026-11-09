/**
 * shell/tile-order.ts — QS 磁贴序与编辑页纯函数（L2 · #18 对照稿余项 · R138）
 *
 * AOSP 语义同构位（SystemUI QS 编辑页 / QuickQSPanel）：
 * - 磁贴序 = 用户自定顺序；编辑页拖动重排，折叠行跟随当前序前 N 个
 *   （QuickQSPanel 同构语义）。本壳编辑序会话级自持（与 tile-states 的 states
 *   Map 同律：工程 reload 不残留；AOSP 经 Settings 持久化，本壳工程内无设置页
 *   不落盘，self: 披露 docs/SHELL.md §6.4）；
 * - 折叠行派生限定 toggle 族（mini 变体为三态展示位，action/status 不入折叠行，
 *   self: 裁剪披露——AOSP 原样为序前 N 个磁贴不筛选种类）；
 * - 编辑页无「可添加磁贴」池（全部 12 磁贴常驻 active，只重排不增删，
 *   self: 裁剪披露）。
 */
import { QUICK_ROW_COUNT } from './tiles';
import type { TileDef } from './tiles';

/** 默认磁贴序（TILES 定义序 = v1.16/v1.17 网格序；重排前的基线） */
export function defaultTileOrder(defs: readonly TileDef[]): string[] {
  return defs.map((d) => d.id);
}

/**
 * 序规范化：剔未知 id、去重（保首个）、补缺失（按 allIds 定义序追加到尾部）。
 * 返回新数组（不 mutate 入参）；结果长度恒 = allIds 长度，且为 allIds 的排列。
 */
export function normalizeOrder(order: readonly string[], allIds: readonly string[]): string[] {
  const known = new Set(allIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of order) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of allIds) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/**
 * 重排：把 id 移到目标格位 toIndex（0 基；语义 = 指针悬停格位即最终格位，
 * 其余磁贴绕拖动项让位）。id 不在序中 → 原样返回（no-op）；toIndex 越界 clamp。
 * 纯函数，不 mutate 入参。
 */
export function moveTile(order: readonly string[], id: string, toIndex: number): string[] {
  const from = order.indexOf(id);
  if (from < 0) return [...order];
  const clamped = Math.max(0, Math.min(order.length - 1, toIndex));
  const next = [...order];
  next.splice(from, 1);
  next.splice(clamped, 0, id);
  return next;
}

/**
 * 指针位置 → 编辑网格目标格位（纯几何，clamped）。
 * @param relX/relY 指针相对网格内容盒左上角的偏移（px）
 * @param cellW/cellH 单格步进（格宽/高 + gap，调用方合成快照）
 * @param cols 列数；count 磁贴总数
 */
export function gridIndexForPoint(
  relX: number,
  relY: number,
  cellW: number,
  cellH: number,
  cols: number,
  count: number,
): number {
  if (cellW <= 0 || cellH <= 0 || cols <= 0 || count <= 0) return 0;
  const col = Math.max(0, Math.min(cols - 1, Math.floor(relX / cellW)));
  const row = Math.max(0, Math.floor(relY / cellH));
  return Math.max(0, Math.min(count - 1, row * cols + col));
}

/**
 * 折叠行磁贴派生：当前磁贴序中前 QUICK_ROW_COUNT 个 toggle 族磁贴。
 * AOSP QuickQSPanel 同构语义 = 显示用户自定序前 N 个；本壳限定 toggle 族
 * （mini 变体三态展示位，self: 裁剪披露 docs/SHELL.md §6.4）。
 */
export function getQuickRowTiles(order: readonly string[], defs: readonly TileDef[]): TileDef[] {
  const byId = new Map(defs.map((d) => [d.id, d] as const));
  const out: TileDef[] = [];
  for (const id of order) {
    const def = byId.get(id);
    if (!def || def.kind !== 'toggle') continue;
    out.push(def);
    if (out.length >= QUICK_ROW_COUNT) break;
  }
  return out;
}

/** 序 → 磁贴定义列表（编辑列表/网格 rebuild 消费；未知 id 剔除） */
export function orderToDefs(order: readonly string[], defs: readonly TileDef[]): TileDef[] {
  const byId = new Map(defs.map((d) => [d.id, d] as const));
  const out: TileDef[] = [];
  for (const id of order) {
    const def = byId.get(id);
    if (def) out.push(def);
  }
  return out;
}
