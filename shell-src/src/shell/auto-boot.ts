/**
 * src/shell/auto-boot.ts — fast-path Phase 2：绿旗自动开机 + 伴随态信号采集（#33）
 *
 * 病根（#33 §一③）：v1.21 fast-face 在 attach 即淡出，淡出后用户看到的是
 * iframe 的「点击绿旗」启动屏——初始化死等一次手动点击。本模块在启动屏出现后
 * 由壳层代点绿旗：**DOM 级模拟点击**（同源 iframe 文档内 #launch 元素 .click()，
 * 语义 = 用户代理点击），零运行时 API 触碰（不调 vm.greenFlag / scaffolding）。
 * 先例：v1.10 fps 尾部块覆写运行时行为（尾部追加面）；本切片连根入口字节都不动。
 *
 * 关断通道：?boot=0（与 ?fast=0 对称；?fast=0&boot=0 = 完整恢复 v1.20 行为）。
 *
 * 已知披露（#33 §四1）：代点为非受信手势（isTrusted=false），AudioContext 可能
 * 挂起至用户首次真实交互（浏览器 autoplay 政策）——TurboWarp 运行时通常自恢复。
 *
 * 状态语义（v1.23 返工修正 · CI run 43550590925 现场 dump 实证）：
 *  - #launch 初始即带 hidden 属性（装载前）——「hidden」≠「已启动」：代点决策
 *    必须区分「曾可见后隐藏」（外部已启动，停止）与「从未可见」（装载中，继续）；
 *  - #boot-feedback 从页面加载起就带 hidden 挂在 DOM（未激活态，绿旗点击后才
 *    显示）——「hidden」≠「已收层」：收层信号 = 曾采样到激活态（active）之后
 *    再次 hidden。两处语义修正纯函数化（autoBootAction/feedbackHiddenSignal），
 *    vitest 直测。
 */

/** 关断参数名（?boot=0 时绿旗代点不装，回退手动点击） */
export const AUTO_BOOT_DISABLE_PARAM = 'boot';

/**
 * 纯函数：URL 查询串 → 绿旗代点是否启用。
 * 仅 `boot=0`（大小写不敏感）关断；boot=1/无参数/其他值均启用（默认开）。
 * （与 fast-face 的 isFastFaceEnabled 同构，vitest 直测。）
 */
export function isAutoBootEnabled(search: string): boolean {
  const m = /[?&]boot=([^&]*)/.exec(search);
  return !(m && decodeURIComponent(m[1]).trim().toLowerCase() === '0');
}

/* ---------------- 绿旗代点：状态采集 + 决策纯函数 ---------------- */

/** #launch 三态（只读采集）：missing=元素不存在/跨源；hidden=带 hidden 属性；visible=可点 */
export type LaunchState = 'missing' | 'hidden' | 'visible';

/** DOM 采集：iframe 内 #launch 三态。任何异常 → missing（继续轮询）。 */
export function readLaunchState(frame: HTMLIFrameElement): LaunchState {
  try {
    const launch = frame.contentDocument?.getElementById('launch');
    if (!launch) return 'missing';
    return launch.hasAttribute('hidden') ? 'hidden' : 'visible';
  } catch {
    return 'missing';
  }
}

/** DOM 采集：visible 时代点点击（launch.click()）；非 visible 不点（幂等安全）。 */
export function clickLaunchScreen(frame: HTMLIFrameElement): 'clicked' | 'not-visible' {
  try {
    const launch = frame.contentDocument?.getElementById('launch');
    if (!launch || launch.hasAttribute('hidden')) return 'not-visible';
    launch.click();
    return 'clicked';
  } catch {
    return 'not-visible';
  }
}

/** 代点决策输入（轮询快照 + 是否曾采样到 visible） */
export interface AutoBootStep {
  launch: LaunchState;
  /** 本轮会话内是否曾采样到 #launch visible（区分「装载前 hidden」与「启动后 hidden」） */
  seenVisible: boolean;
}

/**
 * 纯函数：代点决策。
 * - visible → 'click'（该点了；点击成功后调用方停表）；
 * - hidden 且曾可见 → 'stop-external'（用户手动/外部通道已启动：不再代点，
 *   防止对已隐藏的 launch 二次 click 触发 scaffolding.start() 重启线程）；
 * - hidden 且从未可见 → 'wait'（装载中，继续轮询——**v1.23 返工修正**：
 *   首版把装载前 hidden 误判为外部已启动，代点被永久短路，CI dump 实证
 *   launch_hidden=false 无人点击）；
 * - missing → 'wait'。
 */
export function autoBootAction(s: AutoBootStep): 'click' | 'wait' | 'stop-external' {
  if (s.launch === 'visible') return 'click';
  if (s.launch === 'hidden' && s.seenVisible) return 'stop-external';
  return 'wait';
}

/* ---------------- 伴随态反馈层信号：状态采集 + 换算纯函数 ---------------- */

/** #boot-feedback 三态（只读采集）：missing=无反馈层（nofb 模式/未创建）；hidden=带 hidden；active=显示中 */
export type FeedbackLayerState = 'missing' | 'hidden' | 'active';

/** DOM 采集：iframe 内 #boot-feedback 三态。任何异常 → missing。 */
export function readFeedbackLayerState(frame: HTMLIFrameElement): FeedbackLayerState {
  try {
    const fb = frame.contentDocument?.getElementById('boot-feedback');
    if (!fb) return 'missing';
    return fb.hasAttribute('hidden') ? 'hidden' : 'active';
  } catch {
    return 'missing';
  }
}

/**
 * 纯函数：反馈层状态 → handoverVerdict 的 feedbackHidden 信号。
 * - active → false（收层未发生，hold）；
 * - hidden 且曾采样到 active → true（**已收层**——v1.06 五通道任一命中后的
 *   稳定终态，fast-face 该交接）；
 * - hidden 且从未激活 → null（**未激活态**：#boot-feedback 从页面加载起就带
 *   hidden 挂在 DOM，绿旗点击后才显示——**v1.23 返工修正**：首版把「未激活」
 *   误读为「已收层」，attach 后 1s 即误 dismiss，CI dump 实证 phase=removed；
 *   null 交由 handoverVerdict 走硬封顶兜底）；
 * - missing → null（nofb 模式：封顶兜底）。
 */
export function feedbackHiddenSignal(
  state: FeedbackLayerState,
  activeSeen: boolean,
): boolean | null {
  if (state === 'active') return false;
  if (state === 'hidden' && activeSeen) return true;
  return null;
}
