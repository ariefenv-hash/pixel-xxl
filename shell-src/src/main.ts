/**
 * src/main.ts — 新壳装配层（#23 POC · iframe 架构）
 *
 * 职责：
 * 1. 绑定运行时 iframe（桥接唯一取窗点）；
 * 2. vm 就绪后 VMBridge.attach() 对账（catalog ↔ 运行时变量集合，漂移 fail loud）；
 * 3. 挂载控制中心面板（src/shell/qs-panel.ts，L2 PoC：vendored md3 连续打断内核）；
 * 4. #bridge-status 胶囊：桥接状态一句话可见（ok 绿 / err 红 / 探针断言锚点）。
 *
 * 纪律：本文件不触碰运行时（iframe 内根入口原样），不注册 SW（避免
 * /shell/ 页面把根入口离线回退键 index.html 污染成壳层版本——见 docs/SHELL.md §8）。
 */

import './style.css';
import {
  bindFrame, VMBridge, getVm, getPackSource, getPackState, readRuntimeSnapshot, readStageVarValue,
} from './bridge/runtime';
import { QsPanel } from './shell/qs-panel';
import { createFastFace, isFastFaceEnabled, type FastFaceHandle } from './shell/fast-face';
import {
  isAutoBootEnabled, readLaunchState, clickLaunchScreen, autoBootAction,
  readFeedbackLayerState, feedbackHiddenSignal,
} from './shell/auto-boot';
import { packPhaseText, renderPhaseText, renderPct, handoverVerdict } from './shell/boot-progress';

interface WindowShell {
  __PIXEL_SHELL?: { panel: QsPanel; bridge: VMBridge; attachProblems: string[] };
}

const frame = document.getElementById('runtime') as HTMLIFrameElement | null;
const qsRoot = document.getElementById('qs-root');
const statusElRaw = document.getElementById('bridge-status');
if (!frame || !qsRoot || !statusElRaw) throw new Error('壳层骨架缺失（#runtime/#qs-root/#bridge-status）');
const statusEl: HTMLElement = statusElRaw;

bindFrame(frame);

/* ---------- fast-face 快速启动面（#23 fast-path Phase 1 · v1.21；Phase 2 · v1.23） ----------
 * 用户定锚：取消每次重建的 VM 串行初始化等待。壳层第一帧即渲染 DOM 快速面
 * （壁纸渐变 + DOM 时钟 + 实时进度），iframe 的 VM boot 链全程被遮蔽。
 * v1.21 缺陷修正（#33）：attach ≠ 桌面可用（attach 后淡出 → 用户看到绿旗屏）——
 * 现 attach 成功仅转入 companion 伴随态继续遮蔽空窗，handover 判定镜像 v1.06
 * 五通道（iframe #boot-feedback hidden → 交接；硬封顶 200s 兜底）。
 * ?fast=0 关断快速面（默认开）。 */
let fastFace: FastFaceHandle | null = null;
if (isFastFaceEnabled(window.location.search)) {
  fastFace = createFastFace(document.body);
}

/* ---------- 绿旗自动开机（#33 Phase 2 · v1.23） ----------
 * 病根：装载完成后停在「点击绿旗」启动屏死等手动点击。壳层在启动屏出现后
 * 代点（DOM 级 .click()，零运行时 API 触碰；音频 autoplay 风险披露见 #33 §四1）。
 * ?boot=0 关断（与 ?fast=0 对称；双零 = 完整恢复 v1.20 行为）。
 * 状态语义（v1.23 返工修正）：#launch 装载前即 hidden——只有「曾可见后隐藏」
 * 才算外部已启动（停表防二次 start）；装载中 hidden 继续轮询（决策纯函数
 * autoBootAction，auto-boot.ts）。 */
if (isAutoBootEnabled(window.location.search)) {
  let seenVisible = false;
  const bootTimer = window.setInterval(() => {
    const action = autoBootAction({ launch: readLaunchState(frame), seenVisible });
    if (action === 'click') {
      seenVisible = true;
      if (clickLaunchScreen(frame) === 'clicked') window.clearInterval(bootTimer);
    } else if (action === 'stop-external') {
      window.clearInterval(bootTimer); // 用户手动/回归通道已启动：不再代点
    }
  }, 400);
}

function setStatus(text: string, level: 'ok' | 'err'): void {
  statusEl.textContent = text;
  statusEl.dataset.level = level;
  statusEl.hidden = false;
}

/* ---------- 就绪驱动：工程装载完成 → 对账 → 挂面板 ---------- */

const bridge = new VMBridge();
let panel: QsPanel | null = null;

/**
 * 工程装载完成的判定：vm.runtime 存在（app.js 同步挂载，偏早）**且**
 * stage.variables 非空（loadProject 完成的稳定信号——v1.06 反馈层的
 * targets/threads 推断同口径；锚点 index.html L429-437）。
 * 只读轮询，500ms 节拍；从不写运行时。
 */
function readyForAttach(): boolean {
  try {
    const vm = getVm();
    const stage = vm?.runtime?.getTargetForStage?.() ?? null;
    return !!stage?.variables && Object.keys(stage.variables).length > 0;
  } catch {
    return false;
  }
}

function tryAttach(): void {
  if (panel || !readyForAttach()) return;
  const report = bridge.attach();
  if (!report.ok) {
    setStatus('桥接对账失败：' + report.problems[0], 'err');
    // fail loud：漂移即阻断面板挂载（tiles 与 catalog 的绑定契约不可信）
    console.error('[shell] VMBridge.attach 对账失败', report.problems);
    return;
  }
  panel = new QsPanel(bridge, qsRoot as HTMLElement);
  // fast-face 伴随态（v1.23 #33）：attach 成功 ≠ 桌面可用——转 companion 继续遮蔽，
  // handover 由下方 1s 轮询按镜像 v1.06 五通道判定（不再 attach 即淡出）。
  if (fastFace && !fastFace.isDismissed() && fastFace.getPhase() === 'active') {
    fastFace.enterCompanion();
    companionSince = Date.now();
  }
  setStatus('桥接就绪（变量目录 94 项对账一致）· 磁贴写通道已启用', 'ok');
  // 探针/自动化出口（scripts/shell-probe.py 旧约定握手名 __PIXEL_SHELL；
  //  shell-verify.py 兼容消费；只读引用，无破坏面）
  (window as WindowShell).__PIXEL_SHELL = { panel, bridge, attachProblems: [] };
}

/* ---------- fast-face 伴随态驱动（#33 · v1.23）：实时进度 + handover 判定 ----------
 * 数据源全部只读：装载段 __packState()（loader 挂载）；渲染段工程变量
 * 「渲染的进度/渲染数」（v1.06 readVar 同口径）。handover 信号 = #boot-feedback
 * 「曾激活后再次 hidden」（v1.06 五通道收层稳定终态）——v1.23 返工修正：
 * 反馈层从页面加载起就带 hidden 挂在 DOM（未激活态），首版误读为「已收层」
 * 导致 attach 后 1s 误 dismiss（CI dump 实证）；换算纯函数 feedbackHiddenSignal。 */
let companionSince = 0;
let feedbackActiveSeen = false;

window.setInterval(() => {
  if (!fastFace || fastFace.isDismissed() || fastFace.getPhase() === 'dismissing') return;
  if (fastFace.getPhase() === 'active') {
    // 装载段（绿旗前）：镜像根入口 v1.06 loading-note 四态口径
    fastFace.setBootProgress(packPhaseText(getPackState()));
    return;
  }
  // companion（绿旗后）：渲染段阶梯文案（变量优先）+ handover 判定
  const pct = renderPct(readStageVarValue('渲染的进度'), readStageVarValue('渲染数'));
  const snap = readRuntimeSnapshot();
  const stage = !snap.vmReady ? 'no-vm'
    : snap.targets === 0 ? 'no-targets'
      : snap.targets < 3 ? 'loading-targets'
        : snap.threads > 0 ? 'running' : 'not-running';
  fastFace.setBootProgress(renderPhaseText({ pct, stage }), pct);
  const fState = readFeedbackLayerState(frame);
  if (fState === 'active') feedbackActiveSeen = true;
  const feedbackHidden = feedbackHiddenSignal(fState, feedbackActiveSeen);
  const elapsedSec = companionSince ? (Date.now() - companionSince) / 1000 : 0;
  if (handoverVerdict({ feedbackHidden, elapsedSec }) === 'dismiss') {
    fastFace.dismiss();
  }
}, 1000);

window.setInterval(tryAttach, 500);
tryAttach();

/* ---------- 胶囊心跳：轻量运行时快照（1s，纯文本，零布局抖动） ---------- */

window.setInterval(() => {
  if (panel) {
    const s = readRuntimeSnapshot();
    const src = getPackSource();
    const tail = s.vmReady
      ? `targets=${s.targets} threads=${s.threads}${src ? ` · pack=${src}` : ''}`
      : '';
    setStatus('桥接就绪 · 磁贴写通道已启用' + (tail ? ` · ${tail}` : ''), 'ok');
  }
}, 1000);
