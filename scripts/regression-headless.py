#!/usr/bin/env python3
"""无头回归 v2：python-playwright 直控，截图 + 运行时状态取证 + 双版对比"""
import json, subprocess, time, sys
from playwright.sync_api import sync_playwright

STEPS = [(25, 't25'), (25, 't50'), (30, 't80')]

def probe(pw, url, tag):
    print(f"===== {tag}: {url}")
    browser = pw.chromium.launch(headless=True, args=[
        '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
        '--disable-dev-shm-usage', '--no-sandbox'])
    page = browser.new_page(viewport={'width': 720, 'height': 900})
    console, errors = [], []
    page.on('console', lambda m: console.append(f"[{m.type}] {m.text[:160]}"))
    page.on('pageerror', lambda e: errors.append(str(e)[:200]))
    page.goto(url, wait_until='load', timeout=180000)
    # 等启动屏出现
    page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
    print("LAUNCH READY")
    page.click('#launch')
    shots = []
    for sec, name in STEPS:
        time.sleep(sec)
        path = f"/tmp/render/{tag}-{name}.png"
        try:
            page.screenshot(path=path, full_page=False)
            shots.append(path)
        except Exception as e:
            print("shot fail:", e)
        state = page.evaluate("""() => {
          if (!window.vm) return {vm:false};
          const rt = vm.runtime;
          const stage = rt.getTargetForStage();
          const vars = {};
          if (stage) for (const [k,v] of Object.entries(stage.variables)) {
            const nm = stage.variables[k].name; if (nm) vars[nm] = stage.variables[k].value;
          }
          return {
            vm: true, targets: rt.targets.length,
            stepping: !!rt._steppingFlags,
            greenflag: rt._tickCounter !== undefined,
            stageW: stage && stage.renderer ? undefined : undefined,
            vars,
          };
        }""")
        print(f"  [{name}] vm={state.get('vm')} targets={state.get('targets')} keyvars=", end='')
        vv = state.get('vars', {})
        keys = [k for k in vv if any(s in str(k) for s in ['开机', '锁屏', '亮度模式', '壁纸编号', '渲染'])]
        print({k: vv[k] for k in sorted(keys)[:10]})
    print("console:", len(console), "errors:", len(errors))
    for c in console[-4:]: print("  C", c[:140])
    for e in errors[-4:]: print("  E", e[:140])
    browser.close()
    return {'console': console, 'errors': errors, 'shots': shots}

with sync_playwright() as pw:
    r1 = probe(pw, 'http://127.0.0.1:8082/Pixel.XL.0827.html', 'orig')
    r2 = probe(pw, 'http://127.0.0.1:8081/', 'port')
json.dump({'orig': r1, 'port': r2}, open('/tmp/render/regression.json', 'w'), ensure_ascii=False, indent=2)
print("saved /tmp/render/regression.json")
