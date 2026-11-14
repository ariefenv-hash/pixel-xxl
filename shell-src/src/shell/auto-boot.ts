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
 * 本模块同时承载伴随态一路只读信号采集：
 *  - readFeedbackLayerHidden：iframe 内 #boot-feedback 是否 hidden（v1.06 五通道
 *    收层的稳定外显信号，fast-face 交接判定消费——不重新发明点亮检测）；
 *  渲染进度变量采集（「渲染的进度/渲染数」，v1.06 readVar 同口径只读零红线）
 *  在 bridge/runtime.ts 的 readStageVarValue（读通道零限制面）。
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

/** 代点结果：clicked=已点击；not-visible=启动屏未出现（继续轮询）；gone=已隐藏（曾被点击/外部隐藏） */
export type AutoBootResult = 'clicked' | 'not-visible' | 'gone';

/** DOM 采集：代点绿旗。幂等安全（启动屏 hidden 后不再点击），任何异常静默降级。 */
export function clickLaunchScreen(frame: HTMLIFrameElement): AutoBootResult {
  let launch: HTMLElement | null = null;
  try {
    launch = frame.contentDocument?.getElementById('launch') ?? null;
  } catch {
    return 'not-visible'; // 跨源/未就绪：继续轮询
  }
  if (!launch) return 'not-visible';
  if (launch.hasAttribute('hidden')) return 'gone';
  launch.click();
  return 'clicked';
}

/**
 * 只读采集：iframe 内 #boot-feedback 是否已 hidden。
 * 返回 null = 反馈层不存在（?nofb=1 模式 / 尚未创建 / 读取异常）。
 */
export function readFeedbackLayerHidden(frame: HTMLIFrameElement): boolean | null {
  try {
    const fb = frame.contentDocument?.getElementById('boot-feedback') ?? null;
    if (!fb) return null;
    return fb.hasAttribute('hidden');
  } catch {
    return null;
  }
}
