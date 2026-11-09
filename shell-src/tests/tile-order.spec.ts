/**
 * tile-order.spec.ts — QS 磁贴序与编辑页纯函数（#18 对照稿余项 · R138）
 *
 * 覆盖：normalizeOrder（剔未知/去重/补缺失）、moveTile（前移/后移/越界/未知 id）、
 * gridIndexForPoint（指针→格位几何 + clamp）、getQuickRowTiles（当前序前 4
 * toggle 族派生——AOSP QuickQSPanel 语义 + 本壳 toggle 族裁剪）、orderToDefs。
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeOrder,
  moveTile,
  gridIndexForPoint,
  getQuickRowTiles,
  orderToDefs,
  defaultTileOrder,
} from '../src/shell/tile-order';
import { TILES, TILE_IDS, QUICK_ROW_COUNT } from '../src/shell/tiles';

const IDS = TILE_IDS;
const byId = (id: string) => TILES.find((d) => d.id === id)!;

describe('defaultTileOrder / normalizeOrder', () => {
  it('默认序 = TILES 定义序，长度 12', () => {
    expect(defaultTileOrder(TILES)).toEqual(IDS);
    expect(IDS.length).toBe(12);
  });

  it('normalizeOrder：恒等输入原样返回', () => {
    expect(normalizeOrder(IDS, IDS)).toEqual(IDS);
  });

  it('normalizeOrder：剔未知 id', () => {
    expect(normalizeOrder(['wifi', 'ghost', 'airplane'], IDS)).toEqual(['wifi', 'airplane', ...IDS.filter((i) => i !== 'wifi' && i !== 'airplane')]);
  });

  it('normalizeOrder：去重保首个', () => {
    const out = normalizeOrder(['airplane', 'wifi', 'airplane'], IDS);
    expect(out.filter((i) => i === 'airplane').length).toBe(1);
    expect(out[0]).toBe('airplane');
    expect(out.length).toBe(12);
  });

  it('normalizeOrder：缺失项按定义序补尾，结果恒为全量排列', () => {
    const out = normalizeOrder(['airplane'], IDS);
    expect(out[0]).toBe('airplane');
    expect(out.length).toBe(IDS.length);
    expect([...out].sort().join()).toEqual([...IDS].sort().join());
    // 未提及的磁贴按定义相对顺序追加
    const rest = out.slice(1);
    expect(rest).toEqual(IDS.filter((i) => i !== 'airplane'));
  });
});

describe('moveTile（悬停格位 = 最终格位语义）', () => {
  const base = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('尾前移：f 到 0 → f 首位，其余顺移', () => {
    expect(moveTile(base, 'f', 0)).toEqual(['f', 'a', 'b', 'c', 'd', 'e']);
  });

  it('首后移：a 到 5 → a 尾位，其余顺移', () => {
    expect(moveTile(base, 'a', 5)).toEqual(['b', 'c', 'd', 'e', 'f', 'a']);
  });

  it('中段互换语义：c 到 0 → c 首位', () => {
    expect(moveTile(base, 'c', 0)).toEqual(['c', 'a', 'b', 'd', 'e', 'f']);
  });

  it('同格位 no-op（内容相等）', () => {
    expect(moveTile(base, 'c', 2)).toEqual(base);
  });

  it('越界 clamp（-5 → 0；99 → 尾位）', () => {
    expect(moveTile(base, 'e', -5)).toEqual(['e', 'a', 'b', 'c', 'd', 'f']);
    expect(moveTile(base, 'e', 99)).toEqual(['a', 'b', 'c', 'd', 'f', 'e']);
  });

  it('未知 id no-op；不 mutate 入参', () => {
    expect(moveTile(base, 'zz', 0)).toEqual(base);
    const copy = [...base];
    moveTile(base, 'a', 3);
    expect(base).toEqual(copy);
  });
});

describe('gridIndexForPoint（指针→编辑网格格位）', () => {
  // 2 列、12 项、cellW=120（含列 gap）、cellH=62（含行 gap）
  const W = 120;
  const H = 62;
  const COLS = 2;
  const N = 12;

  it('格内中点 → 对应格位', () => {
    expect(gridIndexForPoint(10, 10, W, H, COLS, N)).toBe(0);
    expect(gridIndexForPoint(130, 10, W, H, COLS, N)).toBe(1);
    expect(gridIndexForPoint(10, 70, W, H, COLS, N)).toBe(2);
    expect(gridIndexForPoint(130, 130, W, H, COLS, N)).toBe(5); // row2·col1
    expect(gridIndexForPoint(10, 130, W, H, COLS, N)).toBe(4); // row2·col0
  });

  it('负偏移 clamp 到 0；超界 clamp 到 count-1', () => {
    expect(gridIndexForPoint(-50, -50, W, H, COLS, N)).toBe(0);
    expect(gridIndexForPoint(999, 999, W, H, COLS, N)).toBe(N - 1);
    // 末行右列：row 6 col 1 = 13 → clamp 11
    expect(gridIndexForPoint(130, 6 * H + 10, W, H, COLS, N)).toBe(11);
  });

  it('非法几何（0 尺寸/0 列）安全回落 0', () => {
    expect(gridIndexForPoint(10, 10, 0, H, COLS, N)).toBe(0);
    expect(gridIndexForPoint(10, 10, W, 0, COLS, N)).toBe(0);
    expect(gridIndexForPoint(10, 10, W, H, 0, N)).toBe(0);
    expect(gridIndexForPoint(10, 10, W, H, COLS, 0)).toBe(0);
  });
});

describe('getQuickRowTiles（折叠行跟随磁贴序 · QuickQSPanel 同构语义）', () => {
  it('默认序 → 前 4 toggle（wifi/蓝牙/手电筒/自动旋转）', () => {
    const row = getQuickRowTiles(IDS, TILES);
    expect(QUICK_ROW_COUNT).toBe(4);
    expect(row.map((d) => d.id)).toEqual(['wifi', 'bluetooth', 'flashlight', 'auto-rotate']);
  });

  it('重排后跟随：airplane 提到首位 → 折叠行首位 = airplane', () => {
    const reordered = moveTile(IDS, 'airplane', 0);
    const row = getQuickRowTiles(reordered, TILES);
    expect(row.map((d) => d.id)).toEqual(['airplane', 'wifi', 'bluetooth', 'flashlight']);
  });

  it('action/status 不入折叠行（toggle 族裁剪，self: 披露）：brightness 提首位仍取 toggle', () => {
    const reordered = moveTile(IDS, 'brightness', 0);
    const row = getQuickRowTiles(reordered, TILES);
    expect(row.map((d) => d.id)).toEqual(['wifi', 'bluetooth', 'flashlight', 'auto-rotate']);
    for (const def of row) expect(def.kind).toBe('toggle');
  });

  it('数量恒 ≤ QUICK_ROW_COUNT', () => {
    expect(getQuickRowTiles(IDS, TILES).length).toBe(4);
  });
});

describe('orderToDefs', () => {
  it('序 → 定义列表；未知 id 剔除', () => {
    expect(orderToDefs(['wifi', 'ghost', 'clock'], TILES).map((d) => d.id)).toEqual(['wifi', 'clock']);
  });

  it('重排定义列表与 moveTile 结果一致', () => {
    const reordered = moveTile(IDS, 'airplane', 0);
    expect(orderToDefs(reordered, TILES)[0].id).toBe('airplane');
    expect(byId('airplane').label).toBe('飞行模式');
  });
});
