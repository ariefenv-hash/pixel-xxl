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
import { bindFrame, VMBridge, getVm, getPackSource, readRuntimeSnapshot } from './bridge/runtime';
import { QsPanel } from './shell/qs-panel';
import { createFastFace, isFastFaceEnabled, type FastFaceHandle } from './shell/fast-face';

interface WindowShell {
  __PIXEL_SHELL?: { panel: QsPanel; bridge: VMBridge; attachProblems: string[] };
}

const frame = document.getElementById('runtime') as HTMLIFrameElement | null;
const qsRoot = document.getElementById('qs-root');
const statusElRaw = document.getElementById('bridge-status');
if (!frame || !qsRoot || !statusElRaw) throw new Error('壳层骨架缺失（#runtime/#qs-root/#bridge-status）');
const statusEl: HTMLElement = statusElRaw;

bindFrame(frame);

/* ---------- fast-face 快速启动面（#23 fast-path Phase 1 · v1.21） ----------
 * 用户定锚：取消每次重建的 VM 串行初始化等待。壳层第一帧即渲染 DOM 快速面
 * （壁纸渐变 + DOM 时钟 + 后台初始化提示），iframe 的 VM boot 链全程被遮蔽；
 * attach 成功后 dismiss() 交叉淡出，iframe 桌面接管。?fast=0 关断（默认开）。 */
let fastFace: FastFaceHandle | null = null;
if (isFastFaceEnabled(window.location.search)) {
  fastFace = createFastFace(document.body);
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
  // fast-face 交叉淡出（v1.21）：attach 成功 = iframe 桌面已就绪可接管，快速面离场
  if (fastFace && !fastFace.isDismissed()) fastFace.dismiss();
  setStatus('桥接就绪（变量目录 94 项对账一致）· 磁贴写通道已启用', 'ok');
  // 探针/自动化出口（scripts/shell-probe.py 旧约定握手名 __PIXEL_SHELL；
  //  shell-verify.py 兼容消费；只读引用，无破坏面）
  (window as WindowShell).__PIXEL_SHELL = { panel, bridge, attachProblems: [] };
}

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
