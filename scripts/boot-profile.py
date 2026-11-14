#!/usr/bin/env python3
"""boot-profile.py — 启动四段打点（P0 量化 · #34）

口径（对齐 docs/PORTING.md §12.4 的段位账）：
    t0 navigationStart
    t1 DOMContentLoaded            —— 壳/HTML 就绪
    t2 pack ready                  —— __packState().ready（分片就绪，含 IDB 命中）
    t3 vm present                  —— window.vm 出现（core 解析 + Scaffolding 完成）
    t4 targets >= 3                —— vm.loadProject 反序列化完成
    t5 threads > 0                 —— 项目脚本开始跑（绿旗后）
    t6 渲染完成                    —— 变量「渲染的进度」>= 「渲染数」（671）

用法：
    python3 scripts/boot-profile.py                 # 默认参数（自动开机开）
    python3 scripts/boot-profile.py --no-autoboot   # ?boot=0 手动通道
    python3 scripts/boot-profile.py --timeout 900   # 低端环境放宽

无 WebGL 环境会输出 status=skipped（不假绿）：本沙箱 Chromium WebGL 全失，
根入口连 scaffolding 都起不来（HANDOFF 已知坑首条）。真机/CI runner 可用。

输出：docs/boot-profile.json + 分段表。
"""
import argparse
import json
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 采样器：页面一加载就装上，16ms 粒度记录各里程碑首次命中时刻
JS_SAMPLER = r"""
() => {
  if (window.__bp) return;
  const marks = {};
  const t0 = performance.timing ? performance.timing.navigationStart : Date.now();
  const now = () => (performance.now ? performance.now() : Date.now() - t0);
  const hit = (k) => { if (marks[k] == null) marks[k] = now(); };
  const readVar = (name) => {
    try {
      const vm = window.vm;
      if (!vm || !vm.runtime) return null;
      const stage = vm.runtime.getTargetForStage();
      if (!stage || !stage.variables) return null;
      for (const id in stage.variables) {
        const v = stage.variables[id];
        if (v && v.name === name) return v.value;
      }
    } catch (e) {}
    return null;
  };
  window.__bp = { marks, readVar };
  if (document.readyState !== 'loading') hit('dcl');
  else document.addEventListener('DOMContentLoaded', () => hit('dcl'));

  const tick = () => {
    try {
      if (typeof window.__packState === 'function' && window.__packState().ready) hit('pack');
      const vm = window.vm;
      if (vm) {
        hit('vm');
        const rt = vm.runtime;
        if (rt && rt.targets && rt.targets.length >= 3) hit('targets');
        if (rt && rt.threads && rt.threads.length > 0) hit('threads');
        const p = readVar('渲染的进度'), n = readVar('渲染数');
        if (p != null && n != null && Number(n) > 0 && Number(p) >= Number(n)) hit('render');
      }
    } catch (e) {}
    if (!marks.render) setTimeout(tick, 16);
  };
  tick();
}
"""

JS_WEBGL = """() => {
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    return g ? (g.getParameter(g.VERSION) + ' | ' + g.getParameter(g.RENDERER)) : 'NO-WEBGL';
  } catch (e) { return 'NO-WEBGL'; }
}"""

JS_STATE = """() => {
  const b = window.__bp || { marks: {} };
  const m = b.marks;
  const out = {};
  for (const k of ['dcl','pack','vm','targets','threads','render']) out[k] = m[k] == null ? null : Math.round(m[k]);
  try {
    if (typeof window.__packState === 'function') out.packState = window.__packState();
  } catch (e) {}
  try {
    out.threads = out.threads;
    out.renderProgress = b.readVar ? b.readVar('渲染的进度') : null;
    out.renderTotal = b.readVar ? b.readVar('渲染数') : null;
  } catch (e) {}
  return out;
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8092)
    ap.add_argument('--timeout', type=int, default=600, help='总等待秒数（低端放宽）')
    ap.add_argument('--no-autoboot', action='store_true')
    ap.add_argument('--out', default='docs/boot-profile.json')
    args = ap.parse_args()

    server = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(args.port), '--bind', '127.0.0.1',
         '--directory', ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    base = f'http://127.0.0.1:{args.port}'
    query = '?probe=1' + ('&boot=0' if args.no_autoboot else '')
    out = {'url': base + '/index.html' + query, 'status': 'unknown'}

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=[
                '--no-sandbox', '--enable-unsafe-swiftshader',
                '--disable-dev-shm-usage'])
            page = browser.new_page(viewport={'width': 720, 'height': 900})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)[:200]))

            page.goto(base + '/index.html', wait_until='domcontentloaded')
            webgl = page.evaluate(JS_WEBGL)
            out['webgl'] = webgl
            if webgl == 'NO-WEBGL':
                out['status'] = 'skipped'
                out['reason'] = 'no-webgl: 根入口无法启动（HANDOFF 已知坑首条）'
                out['page_errors'] = errors[:3]
                browser.close()
            else:
                cdp = page.context.new_cdp_session(page)
                cdp.send('Performance.enable')
                m0 = {m['name']: m['value'] for m in
                      cdp.send('Performance.getMetrics')['metrics']}

                page.goto(base + '/index.html' + query, wait_until='domcontentloaded')
                page.evaluate(JS_SAMPLER)
                deadline = time.time() + args.timeout
                state = {}
                while time.time() < deadline:
                    try:
                        state = page.evaluate(JS_STATE)
                    except Exception:
                        state = {}
                    if state.get('render') is not None:
                        break
                    page.wait_for_timeout(1000)

                m1 = {m['name']: m['value'] for m in
                      cdp.send('Performance.getMetrics')['metrics']}
                browser.close()

                marks = {k: state.get(k) for k in ('dcl', 'pack', 'vm', 'targets', 'threads', 'render')}
                segs = []
                order = ['dcl', 'pack', 'vm', 'targets', 'threads', 'render']
                prev = 0
                for k in order:
                    v = marks.get(k)
                    if v is None:
                        segs.append({'segment': k, 'at_ms': None, 'delta_ms': None})
                    else:
                        segs.append({'segment': k, 'at_ms': v, 'delta_ms': v - prev})
                        prev = v
                out.update({
                    'status': 'completed' if marks.get('render') is not None else 'timeout',
                    'marks_ms': marks,
                    'segments': segs,
                    'render_progress': state.get('renderProgress'),
                    'render_total': state.get('renderTotal'),
                    'pack_state': state.get('packState'),
                    'page_errors': errors[:6],
                    'cdp_delta': {k: round(m1.get(k, 0) - m0.get(k, 0), 1) for k in
                                  ('ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration',
                                   'TaskDuration') if k in m0},
                })
    finally:
        server.terminate()

    os.makedirs(os.path.join(ROOT, os.path.dirname(args.out)), exist_ok=True)
    path = os.path.join(ROOT, args.out)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print(json.dumps(out, ensure_ascii=False, indent=1)[:3000])
    if out['status'] == 'completed':
        print('\n--- 分段表 ---')
        for s in out['segments']:
            if s['at_ms'] is not None:
                print(f"  {s['segment']:<9} @{s['at_ms']/1000:7.2f}s  (+{s['delta_ms']/1000:6.2f}s)")
    print('written:', path)


if __name__ == '__main__':
    main()
