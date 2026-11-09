/**
 * notifications.spec.ts — 通知面状态机断言（L3 通知面第一批 · R140 · #18 任务 4）
 */
import { describe, it, expect } from 'vitest';
import {
  upsertNotification,
  removeNotification,
  isDismissable,
  clearDismissible,
  mediaNotification,
} from '../src/shell/notifications';
import type { NotificationRecord } from '../src/shell/notifications';

const rec = (id: string, ongoing = false): NotificationRecord => ({
  id,
  app: '测试',
  title: `标题 ${id}`,
  text: '正文',
  ongoing,
});

describe('notifications 状态机', () => {
  it('upsert：空列表追加', () => {
    const list = upsertNotification([], rec('a'));
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('a');
  });

  it('upsert：同 id 替换保位（AOSP 同 id update 不重排语义）', () => {
    const list = upsertNotification([rec('a'), rec('b'), rec('c')], {
      ...rec('b'),
      title: '换曲',
    });
    expect(list.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(list[1].title).toBe('换曲');
  });

  it('upsert：不同 id 尾部追加', () => {
    const list = upsertNotification([rec('a')], rec('b'));
    expect(list.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('upsert 纯函数：不修改入参列表', () => {
    const input = [rec('a')];
    const list = upsertNotification(input, rec('b'));
    expect(input).toHaveLength(1);
    expect(list).toHaveLength(2);
  });

  it('remove：存在则移除', () => {
    const list = removeNotification([rec('a'), rec('b')], 'a');
    expect(list.map((r) => r.id)).toEqual(['b']);
  });

  it('remove：不存在原样返回（引用相等 = diff 短路语义）', () => {
    const input = [rec('a')];
    expect(removeNotification(input, 'x')).toBe(input);
  });

  it('isDismissable：ongoing 不可消除（AOSP ongoing 通知不可 swipe）', () => {
    expect(isDismissable(rec('a', false))).toBe(true);
    expect(isDismissable(rec('a', true))).toBe(false);
  });

  it('clearDismissible：ongoing 保留 + 清除数正确（AOSP CLEAR ALL 语义）', () => {
    const input = [rec('a', true), rec('b'), rec('c'), rec('d', true)];
    const res = clearDismissible(input);
    expect(res.cleared).toBe(2);
    expect(res.list.map((r) => r.id)).toEqual(['a', 'd']);
  });

  it('clearDismissible：全 ongoing → 零清除且原样返回', () => {
    const input = [rec('a', true)];
    const res = clearDismissible(input);
    expect(res.cleared).toBe(0);
    expect(res.list).toBe(input);
  });

  it('mediaNotification：MediaStyle 同构位字段（id 固定 / ongoing / 曲名原样）', () => {
    const m = mediaNotification('fripSide - only my railgun');
    expect(m.id).toBe('media');
    expect(m.app).toBe('音乐');
    expect(m.title).toBe('fripSide - only my railgun');
    expect(m.ongoing).toBe(true);
  });
});
