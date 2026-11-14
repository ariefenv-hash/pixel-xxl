/**
 * boot-progress.spec.ts — 伴随遮蔽进度纯函数契约（#33 Phase 2 · v1.23）
 *
 * 覆盖三层：
 *  1. packPhaseText：装载段四态文案（镜像根入口 v1.06 loading-note 口径）；
 *  2. renderPhaseText + renderPct：渲染段阶梯（变量优先，阶段推断兜底）；
 *  3. handoverVerdict：交接判定（反馈层 hidden 镜像五通道 + 硬封顶兜底）。
 */
import { describe, expect, it } from 'vitest';
import { packPhaseText, renderPhaseText, renderPct, handoverVerdict } from '../src/shell/boot-progress';
import type { PackState } from '../src/bridge/runtime';

function pack(over: Partial<PackState>): PackState {
  return {
    source: '', failed: false, ready: false, loaded: 0, total: 0,
    assets: { loaded: 0, total: 0 }, ...over,
  };
}

describe('packPhaseText（装载段四态）', () => {
  it('信号未就绪（null）→ 通用准备文案', () => {
    expect(packPhaseText(null)).toBe('正在准备素材…');
  });
  it('下载中 → 首次下载 X% 口径（total>0）', () => {
    expect(packPhaseText(pack({ loaded: 5, total: 10 }))).toContain('50%');
    expect(packPhaseText(pack({ loaded: 5, total: 10 }))).toContain('首次进入需要下载素材包');
  });
  it('failed → 逐文件兜底文案', () => {
    expect(packPhaseText(pack({ failed: true }))).toContain('逐文件模式');
  });
  it('ready + 解码中 → 解码素材 X%（区分 idb 来源文案）', () => {
    expect(packPhaseText(pack({ ready: true, source: 'idb', assets: { loaded: 3, total: 10 } })))
      .toContain('已从本地素材库载入素材包');
    expect(packPhaseText(pack({ ready: true, source: 'cdn', assets: { loaded: 3, total: 10 } })))
      .toContain('素材包就绪');
    expect(packPhaseText(pack({ ready: true, assets: { loaded: 3, total: 10 } }))).toContain('30%');
  });
  it('ready + 解码完成 → 构建桌面收尾文案', () => {
    expect(packPhaseText(pack({ ready: true, source: 'idb', assets: { loaded: 10, total: 10 } })))
      .toBe('已从本地素材库载入素材包，正在构建桌面…');
    expect(packPhaseText(pack({ ready: true, assets: { loaded: 10, total: 10 } })))
      .toBe('素材包就绪，正在构建桌面…');
  });
});

describe('renderPct（变量 → 百分比）', () => {
  it('正常换算 671/671 → 100', () => {
    expect(renderPct(671, 671)).toBe(100);
  });
  it('字符串数字（Scratch 变量口径）同样换算', () => {
    expect(renderPct('335', '671')).toBeCloseTo(49.925, 2);
  });
  it('total<=0 / 非数字 / null → null（调用方走阶梯兜底）', () => {
    expect(renderPct(10, 0)).toBeNull();
    expect(renderPct(null, 10)).toBeNull();
    expect(renderPct('abc', '10')).toBeNull();
    expect(renderPct(undefined, undefined)).toBeNull();
  });
});

describe('renderPhaseText（渲染段阶梯）', () => {
  it('变量优先：pct 有效 → 正在渲染桌面 X%（非下载）', () => {
    expect(renderPhaseText({ pct: 45, stage: 'running' })).toContain('45%');
    expect(renderPhaseText({ pct: 45, stage: 'running' })).toContain('非下载');
  });
  it('pct 边界夹取（>100 夹 100，负值夹 0）', () => {
    expect(renderPhaseText({ pct: 120, stage: 'running' })).toContain('100%');
    expect(renderPhaseText({ pct: -5, stage: 'running' })).toContain('0%');
  });
  it('无变量 → 阶梯兜底四态', () => {
    expect(renderPhaseText({ pct: null, stage: 'no-vm' })).toContain('运行时启动中');
    expect(renderPhaseText({ pct: null, stage: 'no-targets' })).toContain('装载舞台与角色');
    expect(renderPhaseText({ pct: null, stage: 'not-running' })).toContain('等待启动');
    expect(renderPhaseText({ pct: null, stage: 'running' })).toContain('渲染首帧');
    expect(renderPhaseText({ pct: null, stage: 'loading-targets' })).toContain('编译工程数据');
  });
});

describe('handoverVerdict（交接判定：镜像 v1.06 五通道 + 硬封顶）', () => {
  it('反馈层 hidden（五通道任一命中）→ dismiss', () => {
    expect(handoverVerdict({ feedbackHidden: true, elapsedSec: 3 })).toBe('dismiss');
  });
  it('反馈层未 hidden 且未到封顶 → hold', () => {
    expect(handoverVerdict({ feedbackHidden: false, elapsedSec: 3 })).toBe('hold');
  });
  it('无反馈层（nofb 模式 null）→ 封顶前 hold', () => {
    expect(handoverVerdict({ feedbackHidden: null, elapsedSec: 3 })).toBe('hold');
  });
  it('硬封顶兜底：200s（默认值）→ dismiss（fast-face 不允许永久遮挡）', () => {
    expect(handoverVerdict({ feedbackHidden: null, elapsedSec: 200 })).toBe('dismiss');
    expect(handoverVerdict({ feedbackHidden: false, elapsedSec: 199 })).toBe('hold');
  });
  it('自定义封顶（回归通道可用短封顶）', () => {
    expect(handoverVerdict({ feedbackHidden: null, elapsedSec: 5 }, 5)).toBe('dismiss');
  });
});
