#!/usr/bin/env python3
"""v4 对照实验：桌面上下文（DPR1+鼠标）同一时序截图，判定黑屏是否为软渲染伪影。"""
import json, os, subprocess, time

ROOT = '/home/z/my-project/download/pixel-xxl'
PORT = 8085
OUT = '/tmp/render/mobile'
T0 = time.time()

server = subprocess.Popen(['python3', '-u', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                          cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
STATE_JS = """() => {
  const stage = vm.runtime.getTargetForStage(); const vars = {};
  if (stage) for (const k of Object.keys(stage.variables)) { const v = stage.variables[k]; if (v && v.name) vars[v.name] = v.value; }
  return {anim: vars['开机动画中？'], renders: vars['渲染数'] + '/' + vars['渲染的进度'], guide: vars['开机引导页'], lock: vars['锁屏']};
}"""
try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=[
            '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
            '--disable-dev-shm-usage', '--no-sandbox'])
        page = browser.new_page(viewport={'width': 720, 'height': 900})
        page.goto(f'http://127.0.0.1:{PORT}/', wait_until='load', timeout=180000)
        page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
        print(f"[+{time.time()-T0:.0f}s] LAUNCH READY", flush=True)
        page.click('#launch')
        page.wait_for_timeout(800)
        page.screenshot(path=f'{OUT}/d0-after-click.png')
        for sec, name in [(30, 'd30'), (60, 'd60'), (90, 'd90'), (150, 'd150')]:
            page.wait_for_timeout((sec - (0 if name == 'd30' else [30,60,90][['d60','d90','d150'].index(name)])) * 1000)
            st = page.evaluate(STATE_JS)
            try:
                page.screenshot(path=f'{OUT}/{name}.png')
            except Exception as e:
                print('shot fail', name, str(e)[:80], flush=True)
            print(f"[+{time.time()-T0:.0f}s] {name}: {json.dumps(st, ensure_ascii=False)[:200]}", flush=True)
        browser.close()
finally:
    server.terminate()
print('DONE4')
