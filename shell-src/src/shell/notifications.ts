/**
 * shell/notifications.ts — 通知面状态机（L3 通知面第一批 · #18 任务 4 · R140）
 *
 * 内存自持（L0：零工程变量写入——AOSP NotificationManager 同构位本即系统服务
 * 自持状态；模拟器侧通知源 = 工程既有事件链**只读轮询**（music播放状态 refs=8 /
 * 当前播放music refs=2，值域 project.json 实证："0"/"1" 与 "歌手 - 曲名" 字符串，
 * 写入方 = usic APP 本体）+ 壳层事件；不发明新写通道）。
 *
 * 纯函数无 DOM（vitest 直测）；渲染层 qs-panel.ts 消费。
 *
 * 同构位披露（self:）：md3 语料树无 NotificationStackScrollLayout /
 * NotificationSummaryAdapter 源码（R140 实查，与 R137/R139 QS dimens 实查同律）
 * ——卡结构按 AOSP 通知卡公开形态同构（app 行 / title / text / ongoing 语义），
 * 不标 aosp: 结构 token，防编造。
 */

/** 通知卡数据（AOSP 通知卡公开形态同构位：app 行 / title / text / ongoing） */
export interface NotificationRecord {
  /** 稳定 id（媒体卡固定 'media'——upsert 语义；AOSP media 通知单实例） */
  readonly id: string;
  /** 发出方 app 名（AOSP 通知卡 app 行） */
  readonly app: string;
  /** 通知标题（媒体卡 = 曲名原样消费，不加工） */
  readonly title: string;
  /** 通知正文行 */
  readonly text: string;
  /** 进行中语义（AOSP ongoing：不可 swipe 消除、CLEAR ALL 保留） */
  readonly ongoing: boolean;
}

/**
 * upsert：同 id 替换**保位**，无则尾部追加。
 * （AOSP 同 id 通知 update 不重排语义——媒体卡切歌只改文案，位置不动。）
 */
export function upsertNotification(
  list: NotificationRecord[],
  rec: NotificationRecord,
): NotificationRecord[] {
  const idx = list.findIndex((r) => r.id === rec.id);
  if (idx === -1) return [...list, rec];
  const next = [...list];
  next[idx] = rec;
  return next;
}

/** 按 id 移除（不存在则原样返回——引用相等可被调用方用于 diff 短路） */
export function removeNotification(
  list: NotificationRecord[],
  id: string,
): NotificationRecord[] {
  if (!list.some((r) => r.id === id)) return list;
  return list.filter((r) => r.id !== id);
}

/** swipe 消除资格（AOSP ongoing 通知不可 swipe 消除） */
export function isDismissable(rec: NotificationRecord): boolean {
  return !rec.ongoing;
}

/**
 * 清除全部可消除卡（AOSP CLEAR ALL 语义：ongoing 保留）。
 * 返回 { list: 新列表, cleared: 清除数 }——渲染层以 cleared>0 判定是否重渲。
 */
export function clearDismissible(
  list: NotificationRecord[],
): { list: NotificationRecord[]; cleared: number } {
  const kept = list.filter((r) => r.ongoing);
  const cleared = list.length - kept.length;
  return cleared === 0 ? { list, cleared: 0 } : { list: kept, cleared };
}

/**
 * 媒体卡工厂（MediaStyle 同构位，self: 文案登记 docs/SHELL.md §6.3）。
 * 数据源 = 工程既有事件链只读轮询；title = 曲名原样，不加工。
 */
export function mediaNotification(song: string): NotificationRecord {
  return { id: 'media', app: '音乐', title: song, text: '正在播放', ongoing: true };
}
