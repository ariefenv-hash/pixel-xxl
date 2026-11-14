/**
 * src/bridge/runtime.ts — DOM 壳 ⇄ TurboWarp 运行时 桥接协议（#23 任务 3）
 *
 * 架构（iframe 同源）：
 *   shell/index.html 以 <iframe id="runtime" src="../index.html"> 原样嵌入根入口
 *   （零构建忠实态、启动序列零复制），壳层 DOM 叠加在其上。桥接全部经
 *   frame.contentWindow 读取/调用（同源免跨域限制）。
 *
 * 红线（docs/HANDOFF.md + docs/SHELL.md）：
 * - 读通道零限制：window.vm / window.scaffolding / window.__packState /
 *   window.__packSource（lib/pixel-xxl-app.js、lib/project-loader.js 显式挂载，
 *   v1.05/v1.06 已验证零红线）；
 * - **写通道收敛在 VMBridge 三方法**（getVar/setVar/broadcast），语义纪律：
 *   只允许复用工程既有事件链（scripts/gen-bridge-catalog.py 生成的
 *   catalog.ts 广播图），空壳变量（refs=0）一律不写（catalog.ts 头注与
 *   docs/SHELL.md §5）；
 * - runtime.threads.length 为稳定运行信号（HANDOFF 已知坑：_tickCounter 在
 *   打包 runtime 上不存在）。
 */

import { STAGE_VARIABLE_MAP } from './catalog';
// 真源指纹 PROJECT_SHA256_16（catalog.ts 生成期锁定 project.json sha256 前 16 位）
// 在生成期已对账；运行期对账以变量集合一致性为准（运行时无可靠通道取工程 sha）。

export interface PackState {
  source: '' | 'idb' | 'cdn' | 'origin' | 'files';
  failed: boolean;
  ready: boolean;
  loaded: number;
  total: number;
  assets: { loaded: number; total: number };
}

export interface RuntimeSnapshot {
  vmReady: boolean;
  targets: number;
  threads: number;
}

interface StageVarBox {
  name: string;
  value: unknown;
}

interface VmLike {
  runtime?: {
    targets?: unknown[];
    threads?: unknown[];
    getTargetForStage?: () => { variables?: Record<string, StageVarBox> } | null;
    /** scratch-vm：启动广播帽子线程（matchFields 匹配 BROADCAST_OPTION） */
    startHats?: (opcode: string, matchFields?: Record<string, unknown>) => unknown[];
  };
}

/** 运行时全局面（lib/pixel-xxl-app.js / lib/project-loader.js 挂载） */
interface RuntimeWindow {
  vm?: unknown;
  scaffolding?: unknown;
  __packState?: () => PackState;
  __packSource?: () => string;
}

/* ---------------- iframe 取窗（唯一取窗点，全部访问走它） ---------------- */

let frameEl: HTMLIFrameElement | null = null;

/** 绑定运行时 iframe（main.ts 启动时调用一次）。 */
export function bindFrame(frame: HTMLIFrameElement): void {
  frameEl = frame;
}

function runtimeWin(): RuntimeWindow | null {
  try {
    const w = frameEl?.contentWindow as RuntimeWindow | null | undefined;
    return w ?? null;
  } catch {
    return null;
  }
}

/** 任何访问都 try/catch：运行时未就绪时静默降级，绝不抛错打断壳层。 */
export function getVm(): VmLike | null {
  const w = runtimeWin();
  try {
    return ((w?.vm ?? null) as VmLike) ?? null;
  } catch {
    return null;
  }
}

export function getPackState(): PackState | null {
  try {
    const fn = runtimeWin()?.__packState;
    return typeof fn === 'function' ? fn() : null;
  } catch {
    return null;
  }
}

export function getPackSource(): string | null {
  try {
    const fn = runtimeWin()?.__packSource;
    return typeof fn === 'function' ? fn() : null;
  } catch {
    return null;
  }
}

/** 只读采集：按名读舞台全局变量值（v1.06 #boot-feedback readVar 同口径，零红线）。 */
export function readStageVarValue(name: string): string | number | boolean | null {
  const vm = getVm();
  if (!vm || !vm.runtime) return null;
  try {
    const stage = vm.runtime.getTargetForStage?.() ?? null;
    const vars = stage?.variables;
    if (!vars) return null;
    for (const k of Object.keys(vars)) {
      const v = vars[k];
      if (v && v.name === name) {
        const val = v.value;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          return val;
        }
        return null;
      }
    }
  } catch {
    /* 未就绪：静默 */
  }
  return null;
}

export function readRuntimeSnapshot(): RuntimeSnapshot {
  const vm = getVm();
  if (!vm || !vm.runtime) return { vmReady: false, targets: 0, threads: 0 };
  try {
    const rt = vm.runtime;
    return {
      vmReady: true,
      targets: Array.isArray(rt.targets) ? rt.targets.length : 0,
      threads: rt.threads ? rt.threads.length : 0,
    };
  } catch {
    return { vmReady: false, targets: 0, threads: 0 };
  }
}

/** 就绪订阅：轮询 iframe 内 window.vm，就绪即回调一次并停止（返回停表函数）。 */
export function onRuntimeReady(cb: () => void, intervalMs = 500): () => void {
  const timer = window.setInterval(() => {
    const vm = getVm();
    if (vm && vm.runtime) {
      window.clearInterval(timer);
      cb();
    }
  }, intervalMs);
  return () => window.clearInterval(timer);
}

/* ---------------- VMBridge：写通道收敛类（tiles.ts 唯一消费面） ---------------- */

export interface AttachReport {
  ok: boolean;
  /** 变量目录与运行时实际集合的差异明细（ok=false 时逐条列出） */
  problems: string[];
}

/**
 * VMBridge —— 桥接写通道的唯一守门面。
 * - getVar：只读，按名寻址（与 v1.06 readVar 先例同口径）；
 * - setVar：写舞台全局变量（调 catalog 目录校验 + 空壳保护）；
 * - broadcast：触发工程广播（startHats 'event_whenbroadcastreceived'），
 *   返回启动线程数（0 = 无接收者，调用方须显式呈现异常）。
 * 语义纪律见 tiles.ts 头注与 docs/SHELL.md §5：只复用工程既有事件链，
 * 不对空壳变量发明语义。
 */
export class VMBridge {
  /** attach 时对账成功标记（fail loud，漂移即阻断壳层挂载） */
  private attached = false;

  /**
   * 装载对账：vm 就绪后核对「catalog 舞台变量目录」与运行时实际变量集合
   * （catalog 侧 PROJECT_SHA256_16 已在生成期锁定真源；此处防运行时换代漂移）。
   */
  attach(): AttachReport {
    const problems: string[] = [];
    const vm = getVm();
    if (!vm || !vm.runtime) {
      return { ok: false, problems: ['vm 未就绪，attach 前须先 onRuntimeReady'] };
    }
    try {
      const stage = vm.runtime.getTargetForStage?.() ?? null;
      const vars = stage?.variables ?? null;
      if (!vars) {
        return { ok: false, problems: ['getTargetForStage().variables 不可读（运行时结构变化？）'] };
      }
      const actual = new Set<string>();
      for (const k of Object.keys(vars)) {
        const v = vars[k];
        if (v && typeof v.name === 'string') actual.add(v.name);
      }
      for (const [name, meta] of STAGE_VARIABLE_MAP) {
        if (!actual.has(name)) {
          problems.push(`catalog 变量「${name}」（refs=${meta.refs}）在运行时中不存在`);
        }
      }
      const ok = problems.length === 0;
      this.attached = ok;
      return { ok, problems };
    } catch (e) {
      return { ok: false, problems: ['对账异常: ' + String(e)] };
    }
  }

  /** 空壳变量保护：refs=0 的变量禁止一切写入（docs/SHELL.md §5）。 */
  private static assertWritable(name: string): void {
    const meta = STAGE_VARIABLE_MAP.get(name);
    if (meta && meta.refs === 0) {
      throw new Error(`空壳变量「${name}」禁止写入（refs=0，DOM 壳不替工程发明语义）`);
    }
  }

  getVar(name: string): unknown | null {
    const vm = getVm();
    if (!vm || !vm.runtime) return null;
    try {
      const stage = vm.runtime.getTargetForStage?.() ?? null;
      const vars = stage?.variables;
      if (!vars) return null;
      for (const k of Object.keys(vars)) {
        const v = vars[k];
        if (v && v.name === name) return v.value;
      }
    } catch {
      /* 未就绪：静默 */
    }
    return null;
  }

  /** 写舞台全局变量；成功 true / 变量不存在或未装载 false；空壳变量直接抛错。 */
  setVar(name: string, value: string | number | boolean): boolean {
    VMBridge.assertWritable(name);
    const vm = getVm();
    if (!vm || !vm.runtime) return false;
    try {
      const stage = vm.runtime.getTargetForStage?.() ?? null;
      const vars = stage?.variables;
      if (!vars) return false;
      for (const k of Object.keys(vars)) {
        const v = vars[k];
        if (v && v.name === name) {
          v.value = value;
          return true;
        }
      }
    } catch {
      /* 未就绪：静默 */
    }
    return false;
  }

  /** 触发工程广播，返回启动线程数（0 = 无接收者）。 */
  broadcast(name: string): number {
    const vm = getVm();
    if (!vm || !vm.runtime?.startHats) return 0;
    try {
      const threads = vm.runtime.startHats('event_whenbroadcastreceived', {
        BROADCAST_OPTION: name,
      });
      return Array.isArray(threads) ? threads.length : 0;
    } catch {
      return 0;
    }
  }

  get isAttached(): boolean {
    return this.attached;
  }

  /** 探针握手面（scripts/shell-probe.py）：对账成功。 */
  get ready(): boolean {
    return this.attached;
  }

  /** 探针握手面：工程装载完成（stage.variables 非空 = loadProject 完成稳定信号）。 */
  get projectLoaded(): boolean {
    try {
      const stage = getVm()?.runtime?.getTargetForStage?.() ?? null;
      return !!stage?.variables && Object.keys(stage.variables).length > 0;
    } catch {
      return false;
    }
  }
}
