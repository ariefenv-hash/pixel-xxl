/**
 * src/shell/boot-progress.ts — fast-path Phase 2 伴随遮蔽：启动进度纯函数层（#33）
 *
 * 职责（纯函数，零 DOM，vitest 直测）：
 *  1. packPhaseText：装载段文案（镜像根入口 v1.06 loading-note 四态口径：
 *     首次下载 X% / 逐文件兜底 / 解码素材 X% / 构建桌面）；
 *  2. renderPhaseText：渲染段文案（镜像 v1.06 #boot-feedback 阶梯：变量优先
 *     「正在渲染桌面 X%」，无变量时按 runtime 阶段推断）；
 *  3. handoverVerdict：fast-face 交接判定（镜像 v1.06 收层五通道的语义子集：
 *     iframe #boot-feedback hidden（其五通道任一命中）→ 交接；硬封顶兜底）。
 *
 * 数据源全部只读（__packState() / 工程变量「渲染的进度/渲染数」——v1.06 readVar
 * 同口径零红线）。DOM 采集在 auto-boot.ts，本模块不做任何 IO。
 */

import type { PackState } from '../bridge/runtime';

/** 装载段文案（active 态：绿旗代点前 + 伴随态早期）。st=null = loader 信号未就绪。 */
export function packPhaseText(st: PackState | null): string {
  if (!st) return '正在准备素材…';
  if (st.failed) return '正在加载素材（逐文件模式，稍慢）…';
  if (!st.ready) {
    if (st.total > 0) {
      const pct = Math.min(100, Math.round((st.loaded / st.total) * 100));
      return `首次进入需要下载素材包（约 22 MB），完成后保存在本地… ${pct}%`;
    }
    return '正在准备素材…';
  }
  const a = st.assets;
  if (a && a.total > 0 && a.loaded < a.total) {
    const pct = Math.min(100, Math.round((a.loaded / a.total) * 100));
    return `${st.source === 'idb' ? '已从本地素材库载入素材包，' : '素材包就绪，'}解码素材 ${pct}%…`;
  }
  return `${st.source === 'idb' ? '已从本地素材库载入素材包，' : '素材包就绪，'}正在构建桌面…`;
}

/** 渲染段推断阶梯输入（口径镜像 v1.06 #boot-feedback：变量优先，阶段推断兜底） */
export type RenderStageHint = 'no-vm' | 'no-targets' | 'loading-targets' | 'not-running' | 'running';

export interface RenderProgress {
  /** 「渲染的进度/渲染数」换算的 0~100 百分比；null = 变量未就绪（走阶梯兜底） */
  pct: number | null;
  /** runtime 阶段推断（threads>0 曾出现 = running） */
  stage: RenderStageHint;
}

/** 渲染段文案（companion 态：绿旗代点后）。 */
export function renderPhaseText(p: RenderProgress): string {
  if (p.pct !== null) {
    return `正在渲染桌面 ${Math.max(0, Math.min(100, Math.round(p.pct)))}%…（非下载）`;
  }
  switch (p.stage) {
    case 'no-vm':
      return '运行时启动中…';
    case 'no-targets':
      return '装载舞台与角色…';
    case 'loading-targets':
      return '编译工程数据…';
    case 'not-running':
      return '等待启动…';
    case 'running':
      return '渲染首帧…';
  }
}

/** 交接信号（#boot-feedback 层状态 + 伴随态时长）。feedbackHidden=null = 无反馈层（nofb 模式）。 */
export interface HandoverSignals {
  /** iframe 内 #boot-feedback 是否已 hidden（其五通道任一命中的稳定信号） */
  feedbackHidden: boolean | null;
  /** 伴随态已持续的秒数（companion 态起点起算） */
  elapsedSec: number;
}

/**
 * 交接判定：'dismiss' = fast-face 该淡出（iframe 画面接管）；'hold' = 继续遮蔽。
 * - feedbackHidden === true：v1.06 五通道（像素点亮/进度满/保守放行/180s 封顶/error）
 *   任一命中 → 反馈层已收 → 交接（不重新发明点亮检测，镜像既有逻辑）；
 * - feedbackHidden === null（nofb 模式无反馈层）或 false：硬封顶兜底（默认 200s，
 *   与 v1.06 的 180s 同量级、留 20s 余量防抖）——fast-face 不允许永久遮挡。
 */
export function handoverVerdict(s: HandoverSignals, capSec = 200): 'hold' | 'dismiss' {
  if (s.feedbackHidden === true) return 'dismiss';
  if (s.elapsedSec >= capSec) return 'dismiss';
  return 'hold';
}

/** 「渲染的进度/渲染数」→ 百分比；任一缺失/非法 → null（调用方走阶梯兜底）。 */
export function renderPct(progress: unknown, total: unknown): number | null {
  // null/undefined/空串显式拒绝：Number(null)=0 会把「变量缺失」误判为 0%
  if (progress == null || total == null || progress === '' || total === '') return null;
  const p = typeof progress === 'number' ? progress : Number(progress);
  const t = typeof total === 'number' ? total : Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return null;
  return (p / t) * 100;
}
