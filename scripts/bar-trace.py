#!/usr/bin/env python3
"""v1.07 进度条行为取证：逐次记录 #loading-inner 宽度与 #loading-note 文案变化。

背景：用户反馈「进页先有一根加载条跑完，之后才出现真正的资源加载条」。
代码层怀疑：reportProgress() 的下载段与素材段都映射 0.1→0.75，包下载完成（75%）
后第一个素材解码把条拉回 ~10% 重填——视觉上像两根条。

判据：宽度序列是否单调不减；出现回落（>0.3 个百分点）即「回跳」实锤。
场景：
  first  — 首访（空 IDB、空 SW 缓存）：下载段→解码段全程
  second — 同浏览器 reload（IDB 命中）：快路径→解码段

输出：docs/bar-trace.json（证据）+ 控制台判定。
"""
import json
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

DL = '/home/z/my-project/download'
PORT = 8087
BASE = f'http://127.0.0.1:{PORT}/pixel-xxl'

INIT_JS = """
window.__barLog = [];
(() => {
  let installed = false;
  const install = () => {
    if (installed) return;
    const bar = document.getElementById('loading-inner');
    const note = document.getElementById('loading-note');
    if (!bar) { setTimeout(install, 20); return; }
    installed = true;
    const push = (k, v) => window.__barLog.push({
      t: Math.round(performance.now()), k: k, v: v });
    new MutationObserver(() => push('bar', bar.style.width))
      .observe(bar, { attributes: true, attributeFilter: ['style'] });
    if (note) {
      new MutationObserver(() => push('note', note.textContent))
        .observe(note, { childList: true, characterData: true, subtree: true });
    }
  };
  install();
})();
"""

LAUNCH_READY = "!document.getElementById('launch').hidden"


def widths(log):
    return [(e['t'], float(e['v'][:-1])) for e in log
            if e['k'] == 'bar' and e['v'] and e['v'].endswith('%')]


def notes(log):
    seen, out = None, []
    for e in log:
        if e['k'] == 'note' and e['v'] and e['v'] != seen:
            seen = e['v']
            out.append((e['t'], e['v']))
    return out


def analyze(log):
    ws = widths(log)
    drops = []
    for i in range(1, len(ws)):
        delta = ws[i][1] - ws[i - 1][1]
        if delta < -0.3:
            drops.append({'at_ms': ws[i][0], 'from': ws[i - 1][1], 'to': ws[i][1]})
    return ws, drops


def main():
    srv = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
        cwd=DL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    result = {'scenarios': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=[
                '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
                '--disable-dev-shm-usage', '--no-sandbox'])
            ctx = browser.new_context(viewport={'width': 390, 'height': 844})
            page = ctx.new_page()

            # ---- 场景 1：首访 ----
            page.add_init_script(INIT_JS)
            t0 = time.time()
            page.goto(BASE + '/', wait_until='domcontentloaded', timeout=180000)
            page.wait_for_function(LAUNCH_READY, timeout=180000)
            first_ms = round((time.time() - t0) * 1000)
            log1 = page.evaluate('window.__barLog')
            ws1, drops1 = analyze(log1)
            result['scenarios'].append({
                'name': 'first', 'load_to_launch_ms': first_ms,
                'width_events': len(ws1),
                'widths_head': ws1[:6], 'widths_tail': ws1[-6:],
                'notes': notes(log1), 'drops': drops1,
            })
            print(f"[first] events={len(ws1)} drops={len(drops1)} "
                  f"load→launch={first_ms}ms")
            for t, v in ws1:
                print(f"  {t:6d}ms  {v:6.2f}%")

            # ---- 场景 2：同浏览器 reload（IDB 命中）----
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function(LAUNCH_READY, timeout=180000)
            log2 = page.evaluate('window.__barLog')
            src2 = page.evaluate('window.__packSource ? window.__packSource() : null')
            ws2, drops2 = analyze(log2)
            result['scenarios'].append({
                'name': 'second', 'pack_source': src2,
                'width_events': len(ws2),
                'widths_head': ws2[:6], 'widths_tail': ws2[-6:],
                'notes': notes(log2), 'drops': drops2,
            })
            print(f"[second] source={src2} events={len(ws2)} drops={len(drops2)}")
            for t, v in ws2:
                print(f"  {t:6d}ms  {v:6.2f}%")

            browser.close()
    finally:
        srv.terminate()

    verdict = all(not s['drops'] for s in result['scenarios'])
    result['verdict'] = 'PASS' if verdict else 'FAIL（进度条存在回跳）'
    with open(f'{DL}/pixel-xxl/docs/bar-trace.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print('VERDICT:', result['verdict'])
    sys.exit(0 if verdict else 1)


if __name__ == '__main__':
    main()
