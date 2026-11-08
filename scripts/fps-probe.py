#!/usr/bin/env python3
"""v1.08 动画连贯性升级验证探针（R131）。
四通道断言（每通道独立页面 + console/pageerror 采集）：
  A 缺省 ?nofb=1        → framerate=60 生效 + interpolationEnabled=true → 弱机看门狗降级 → 30（软渲染必触发）
  B ?nofb=1&fps=30      → 尊重显式 30，无看门狗消息
  C ?nofb=1&fps=orig    → 完全不动（=原始 30），console 披露 fps=orig
  D ?nofb=1&fps=90      → 显式 90 生效且看门狗豁免（软渲染下仍保持 90 = 豁免实证）
输出：docs/fps-probe-evidence.json（verdict PASS/FAIL）
"""
import json, os, subprocess, time, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8088
T0 = time.time()
EV = {'generated': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'channels': {}, 'pageerrors': []}

def log(m):
    print(f"[+{time.time()-T0:6.1f}s] {m}", flush=True)

def console_text(msg):
    try: return msg.text
    except Exception: return str(msg)

def run_channel(pw, name, qs, steps):
    """steps: list of (label, wait_sec, check_fn(ctx)->(ok, detail))"""
    browser = pw.chromium.launch(headless=True, args=[
        '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
        '--disable-dev-shm-usage', '--no-sandbox'])
    page = browser.new_page(viewport={'width': 720, 'height': 900})
    chan = {'qs': qs, 'console': [], 'checks': {}, 'ok': True}
    EV['channels'][name] = chan  # 检查函数在通道进行中读取，必须先注册
    page.on('console', lambda m: chan['console'].append(console_text(m)))
    page.on('pageerror', lambda e: (EV['pageerrors'].append({'ch': name, 'msg': str(e)[:200]}), chan.__setitem__('ok', False)))
    try:
        page.goto(f'http://127.0.0.1:{PORT}/{qs}', wait_until='load', timeout=180000)
        page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
        log(f"[{name}] launch ready")
        page.click('#launch')
        ctx = {}
        for label, wait_sec, check in steps:
            page.wait_for_timeout(wait_sec * 1000)
            ok, detail = check(page)
            ctx[label] = detail
            chan['checks'][label] = {'ok': ok, 'detail': detail}
            if not ok:
                chan['ok'] = False
            log(f"[{name}] {label}: {'OK' if ok else 'FAIL'} {json.dumps(detail, ensure_ascii=False)[:160]}")
        chan['ctx'] = ctx
    except Exception as e:
        chan['ok'] = False
        chan['error'] = str(e)[:300]
        log(f"[{name}] ERROR {str(e)[:200]}")
    finally:
        browser.close()
    EV['channels'][name] = chan
    return chan['ok']

def js_state(page):
    return page.evaluate("""() => {
      if (!window.vm || !vm.runtime) return {vm: false};
      const fl = vm.runtime.frameLoop;
      return {vm: true, fr: fl ? fl.framerate : null, interp: !!vm.runtime.interpolationEnabled,
              renders: (() => { const s = vm.runtime.getTargetForStage(); if (!s) return '0/0';
                const g = n => { for (const k in s.variables) { const v = s.variables[k]; if (v && v.name === n) return v.value; } };
                return (g('渲染的进度')||0) + '/' + (g('渲染数')||0); })()};
    }""")

def main():
    server = subprocess.Popen(['python3', '-u', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            # ---- A 缺省：自适应 60（无头 rAF 慢速→吸附下限 60）→ 看门狗降级 30 ----
            def a1(page):
                st = js_state(page)
                con = EV['channels']['A-default']['console']
                applied60 = st.get('fr') == 60 or any('framerate=60' in c for c in con)
                return (st.get('vm') and st.get('interp') is True and applied60), st
            def a2(page):
                st = js_state(page)
                con = EV['channels']['A-default']['console']
                degr = any('弱机降级' in c for c in con)
                return (st.get('fr') == 30 and degr), {'fr': st.get('fr'), 'degrade_logged': degr}
            okA = run_channel(pw, 'A-default', '?nofb=1', [
                ('fr60_applied', 14, a1),
                ('watchdog_degrade', 30, a2),
            ])
            # ---- B 显式 30 ----
            def b1(page):
                st = js_state(page)
                con = EV['channels']['B-fps30']['console']
                fr30 = any('framerate=30' in c for c in con)
                return (st.get('vm') and st.get('fr') == 30 and fr30), st
            okB = run_channel(pw, 'B-fps30', '?nofb=1&fps=30', [('fr30_respected', 14, b1)])
            # ---- C orig 通道：完全不动 = 原生 120 ----
            def c1(page):
                st = js_state(page)
                con = EV['channels']['C-orig']['console']
                orig = any('fps=orig' in c for c in con)
                return (st.get('vm') and st.get('fr') == 120 and orig), st
            okC = run_channel(pw, 'C-orig', '?nofb=1&fps=orig', [('orig_untouched', 14, c1)])
            # ---- D 显式 90 且看门狗豁免 ----
            def d1(page):
                st = js_state(page)
                con = EV['channels']['D-fps90']['console']
                fr90 = any('framerate=90' in c for c in con)
                return (st.get('vm') and st.get('fr') == 90 and fr90), st
            def d2(page):
                st = js_state(page)
                con = EV['channels']['D-fps90']['console']
                degr = any('弱机降级' in c for c in con)
                return (st.get('fr') == 90 and not degr), {'fr': st.get('fr'), 'watchdog_exempt': not degr}
            okD = run_channel(pw, 'D-fps90', '?nofb=1&fps=90', [
                ('fr90_applied', 14, d1),
                ('watchdog_exempt', 30, d2),
            ])
    finally:
        server.terminate()
    all_ok = all([okA, okB, okC, okD]) and not EV['pageerrors']
    EV['verdict'] = 'PASS' if all_ok else 'FAIL'
    os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
    json.dump(EV, open(os.path.join(ROOT, 'docs', 'fps-probe-evidence.json'), 'w'), ensure_ascii=False, indent=1)
    log(f"VERDICT: {EV['verdict']} (A={okA} B={okB} C={okC} D={okD}, pageerrors={len(EV['pageerrors'])})")
    return 0 if all_ok else 1

if __name__ == '__main__':
    sys.exit(main())
