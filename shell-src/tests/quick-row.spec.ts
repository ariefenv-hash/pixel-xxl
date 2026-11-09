/**
 * quick-row.spec.ts — 折叠态磁贴行 + 长按详情内容（#18 深化项 · R137）
 *
 * 覆盖：QUICK_ROW_TILES 数量与成员（折叠态显示 N 个）、describeTile 三类磁贴
 * 的详情内容纯函数（toggle 可关 / action 只读 / status 只读）。
 */
import { describe, it, expect } from 'vitest';
import {
  QUICK_ROW_COUNT,
  QUICK_ROW_TILES,
  TOGGLE_TILES,
  TILES,
  describeTile,
} from '../src/shell/tiles';

describe('折叠态磁贴行（#18 任务 1）', () => {
  it('行内数量 = QUICK_ROW_COUNT = 4（self: 值，登记 SHELL.md §6.3）', () => {
    expect(QUICK_ROW_COUNT).toBe(4);
    expect(QUICK_ROW_TILES.length).toBe(4);
  });

  it('行成员 = 首批 toggle 磁贴前 4 个（wifi/蓝牙/手电筒/自动旋转）', () => {
    expect(QUICK_ROW_TILES.map((d) => d.id)).toEqual([
      'wifi',
      'bluetooth',
      'flashlight',
      'auto-rotate',
    ]);
    // 与网格共享同一状态机：行成员必须是 TOGGLE_TILES 的前缀
    expect(TOGGLE_TILES.slice(0, 4).map((d) => d.id)).toEqual(QUICK_ROW_TILES.map((d) => d.id));
  });

  it('行内磁贴全部为 toggle 族（折叠行不放 action/status）', () => {
    for (const def of QUICK_ROW_TILES) expect(def.kind).toBe('toggle');
  });
});

describe('长按磁贴详情内容 describeTile（纯函数）', () => {
  it('toggle 磁贴：标题 = 标签、可关（closable=true）', () => {
    const wifi = TILES.find((d) => d.id === 'wifi')!;
    const d = describeTile(wifi);
    expect(d.title).toBe('WLAN');
    expect(d.closable).toBe(true);
    expect(d.body).toContain('壳层自持');
  });

  it('action 磁贴：只读详情（closable=false），render 通道走状态文案', () => {
    const wp = TILES.find((d) => d.id === 'wallpaper')!;
    const d = describeTile(wp, () => '壁纸 · 3/7');
    expect(d.title).toBe('壁纸');
    expect(d.status).toBe('壁纸 · 3/7');
    expect(d.closable).toBe(false);
    expect(d.body).toContain('工程联动');
  });

  it('status 磁贴：只读详情（closable=false）', () => {
    const clock = TILES.find((d) => d.id === 'clock')!;
    const d = describeTile(clock);
    expect(d.title).toBe('时钟');
    expect(d.closable).toBe(false);
    expect(d.body).toContain('只读展示');
  });
});
