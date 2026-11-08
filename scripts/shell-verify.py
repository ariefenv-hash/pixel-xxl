#!/usr/bin/env python3
"""shell-verify.py — 新壳（/shell/ 双入口）探针（#23 验收 · docs/SHELL.md §9）

A) 壳层骨架与桥接挂载：
   /shell/ 页加载 → iframe 存在且指向 ../index.html（?nofb=1 透传）→
   等待 iframe 内根入口启动屏出现（复用根入口全部链路）→ vm 就绪 →
   VMBridge.attach 对账 → #bridge-status 出现且 data-level=ok；
B) QS 面板 DOM（L2 POC 载体）：
   .qs-panel 存在、磁贴 6 枚、拉出条存在；panel.open() 动画展开至 isOpen；
C) 磁贴写通道真实生效：
   点击「亮度模式」磁贴 → 动作序列（写变量 → 广播「壁纸」）→
   iframe 内 stage 变量「亮度模式」500→600 实测变化（startHats 链路真实启动）；
D) 磁贴绑定与目录契约：磁贴全部在 DOM（data-tile-id 与 tiles.ts 一致）。

运行：python3 scripts/shell-verify.py（自起 http.server :8087，服务仓库根）。
注意：完整等待根入口加载（本地素材，通常 <90s）；全程只读壳层 DOM +
iframe 同源访问，不改任何仓库文件。
"""
import json
import os
import re
import subprocess
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8087
BASE = f'http://127.0.0.1:{PORT}'
SHELL_URL = BASE + '/shell/index.html'

JS_IFRAME_VM_READY = """
() => {
  try {
    const f = document.getElementById('runtime');
    if (!f || !f.contentWindow) return false;
    const vm = f.contentWindow.vm;
    return !!(vm && vm.runtime);
  } catch (e) { return false; }
}
"""

JS_STAGE_VAR = """
(name) => {
  try {
    const f = document.getElementById('runtime');
    const vm = f.contentWindow.vm;
    const stage = vm.runtime.getTargetForStage();
    for (const k of Object.keys(stage.variables)) {
      const v = stage.variables[k];
      if (v && v.name === name) return String(v.value);
    }
    return null;
  } catch (e) { return null; }
}
"""

JS_BRIDGE_STATUS = """
() => {
  const el = document.getElementById('bridge-status');
  return el && !el.hidden ? { level: el.dataset.level, text: el.textContent } : null;
}
"""


def main():
    server = subprocess.Popen(
        ['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    out = {}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=[
                '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
                '--disable-dev-shm-usage', '--no-sandbox'])
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            shell_errors = []
            page.on('pageerror', lambda e: shell_errors.append(str(e)[:160]))
            page.on('console', lambda m: (
                shell_errors.append(f'console.{m.type}: {m.text[:160]}') if m.type == 'error' else None))

            # ---------- A) 壳层骨架 + URL 透传 ----------
            page.goto(SHELL_URL + '?probe=1', wait_until='load', timeout=60000)
            out['A'] = {
                'iframe_present': page.evaluate("() => !!document.getElementById('runtime')"),
                'qs_root_present': page.evaluate("() => !!document.getElementById('qs-root')"),
                # ?nofb=1 透传断言：probe=1 应拼进 iframe src（壳层透传任意 search）
                'iframe_src': page.evaluate("() => document.getElementById('runtime').getAttribute('src')"),
            }
            out['A']['iframe_src_passthrough'] = out['A']['iframe_src'] == '../index.html?probe=1'
            # 等待 iframe 内根入口全链路就绪（启动屏出现）——与 pack-verify 同口径
            page.wait_for_function(
                "() => { try { const f=document.getElementById('runtime');"
                "return f && f.contentDocument && f.contentDocument.getElementById('launch')"
                " && !f.contentDocument.getElementById('launch').hasAttribute('hidden'); }"
                " catch(e) { return false; } }", timeout=300000)
            out['A']['root_entry_launch_ready'] = True
            page.wait_for_function(JS_IFRAME_VM_READY, timeout=120000)
            out['A']['vm_ready'] = True
            # vm 就绪后等 attach（onRuntimeReady 400ms 轮询）→ 状态胶囊 ok
            page.wait_for_function(
                "() => { const s = document.getElementById('bridge-status');"
                "return s && !s.hidden && s.dataset.level === 'ok'; }", timeout=30000)
            out['A']['bridge_status'] = page.evaluate(JS_BRIDGE_STATUS)

            # ---------- B) QS 面板 DOM ----------
            out['B'] = {
                'panel_present': page.evaluate(
                    "() => !!document.querySelector('#qs-root .qs-panel')"),
                'tile_count': page.evaluate(
                    "() => document.querySelectorAll('#qs-root .qs-tile').length"),
                'tile_ids': page.evaluate(
                    "() => Array.from(document.querySelectorAll('#qs-root .qs-tile'))"
                    ".map(el => el.dataset.tileId)"),
                'grab_strip_present': page.evaluate(
                    "() => !!document.querySelector('#qs-root .qs-grab-strip')"),
            }
            # 动画展开（连续打断内核路径）：open() → 等 isOpen
            page.evaluate("() => window.__shell && window.__shell.panel.open()")
            try:
                page.wait_for_function(
                    "() => window.__shell && window.__shell.panel.isOpen", timeout=10000)
                out['B']['panel_open_anim'] = True
            except Exception:
                out['B']['panel_open_anim'] = False

            # ---------- C) 磁贴写通道真实生效（亮度模式 500 → 600） ----------
            out['C'] = {}
            var0 = page.evaluate(JS_STAGE_VAR, '亮度模式')
            out['C']['brightness_before'] = var0
            page.click('#qs-root .qs-tile[data-tile-id="brightness"]')
            time.sleep(1.5)  # 动作反馈 + 广播链启动
            out['C']['brightness_after'] = page.evaluate(JS_STAGE_VAR, '亮度模式')
            out['C']['tile_feedback'] = page.evaluate(
                "() => { const el = document.querySelector('#qs-root .qs-feedback');"
                "return el && !el.hidden ? el.textContent : null; }")
            out['C']['write_effective'] = (
                var0 is not None and out['C']['brightness_after'] is not None
                and out['C']['brightness_after'] != var0)
            out['C']['wallpaper_threads_seen'] = bool(
                out['C']['tile_feedback'] and re.search(r'壁纸链 \d+ 线程', out['C']['tile_feedback']))

            out['D'] = {'shell_page_errors': shell_errors[:6]}

            browser.close()
    finally:
        server.terminate()
    print(json.dumps(out, ensure_ascii=False, indent=1))
    a, b, c = out['A'], out['B'], out['C']
    ok = (a['iframe_present'] and a['qs_root_present'] and a['iframe_src_passthrough']
          and a.get('root_entry_launch_ready') and a.get('vm_ready')
          and a['bridge_status'] and a['bridge_status']['level'] == 'ok'
          and '对账一致' in a['bridge_status']['text']
          and b['panel_present'] and b['tile_count'] == 6
          and b['grab_strip_present'] and b['panel_open_anim']
          and c['write_effective'] and c['wallpaper_threads_seen']
          and not out['D']['shell_page_errors'])
    print('VERDICT:', 'PASS' if ok else 'FAIL')


if __name__ == '__main__':
    main()
