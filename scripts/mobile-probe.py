#!/usr/bin/env python3
"""手机仿真实测 v2：精确定位触屏输入链断点。
输出：/tmp/render/mobile/report.json + probe 日志（每步立即落盘）
"""
import json, os, subprocess, time, traceback

ROOT = '/home/z/my-project/download/pixel-xxl'
PORT = 8083
OUT = '/tmp/render/mobile'
os.makedirs(OUT, exist_ok=True)
T0 = time.time()

REPORT = {}
def save():
    json.dump(REPORT, open(f'{OUT}/report.json', 'w'), ensure_ascii=False, indent=2, default=str)

def log(step, data):
    REPORT[step] = data
    print(f"[+{time.time()-T0:6.1f}s] [{step}] {json.dumps(data, ensure_ascii=False)[:260]}", flush=True)
    save()

LISTENERS_JS = """() => {
  window.__evc = {touchstart:0, touchend:0, pointerdown:0, pointerup:0, click:0, pointercancel:0};
  ['touchstart','touchend','pointerdown','pointerup','pointercancel','click'].forEach(t => {
    document.addEventListener(t, e => { window.__evc[t]++; }, {capture: true, passive: true});
  });
  return 'armed';
}"""

GEOMETRY_JS = """() => {
  const c = document.querySelector('.sc-canvas') || document.querySelector('#app canvas');
  const r = c ? c.getBoundingClientRect() : null;
  return {
    innerW: innerWidth, innerH: innerHeight,
    vvW: visualViewport ? Math.round(visualViewport.width) : null,
    vvH: visualViewport ? Math.round(visualViewport.height) : null,
    scale: visualViewport ? +visualViewport.scale.toFixed(3) : null,
    dpr: devicePixelRatio,
    canvas: r ? {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width),
                 h: Math.round(r.height), ratio: +(r.width/r.height).toFixed(4)} : null,
    canvasTouchAction: c ? getComputedStyle(c).touchAction : null,
    overW: document.body.scrollWidth, overH: document.body.scrollHeight,
  };
}"""

STATE_JS = """() => {
  if (!window.vm) return {vm: false};
  const stage = vm.runtime.getTargetForStage();
  const vars = {};
  if (stage) for (const k of Object.keys(stage.variables)) {
    const v = stage.variables[k];
    if (v && v.name) vars[v.name] = v.value;
  }
  const pick = {};
  for (const k of Object.keys(vars)) if (/开机|锁屏|渲染|引导|桌面/.test(k)) pick[k] = vars[k];
  return {vm: true, targets: vm.runtime.targets.length, vars: pick};
}"""

def shot(page, name):
    try:
        page.screenshot(path=f'{OUT}/{name}.png')
        return name
    except Exception as e:
        log(f'shot_fail_{name}', str(e)[:120])
        return None

server = subprocess.Popen(
    ['python3', '-u', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=[
            '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
            '--disable-dev-shm-usage', '--no-sandbox'])
        ctx = browser.new_context(
            viewport={'width': 390, 'height': 844}, device_scale_factor=3,
            is_mobile=True, has_touch=True,
            user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 '
                       '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36')
        page = ctx.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)[:140]))
        page.on('console', lambda m: errs.append(f'CON-{m.type} ' + m.text[:140])
                if m.type == 'error' else None)

        page.goto(f'http://127.0.0.1:{PORT}/', wait_until='load', timeout=180000)
        page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
        log('launch_ready', {})

        page.evaluate(LISTENERS_JS)
        g0 = page.evaluate(GEOMETRY_JS)
        log('geometry_at_launch', g0)
        shot(page, '1-launch')

        # —— 触控测试 1：点启动屏，2 秒内逐 0.5s 观察绿旗是否生效 ——
        page.touchscreen.tap(g0['innerW'] / 2, g0['innerH'] / 2)
        boot_timeline = []
        for i in range(8):
            time.sleep(0.5)
            s = page.evaluate(STATE_JS)
            h = page.evaluate("() => document.getElementById('launch').hidden")
            boot_timeline.append({'t': round(0.5 * (i + 1), 1), 'launchHidden': h,
                                  'anim': s.get('vars', {}).get('开机动画中？'), 'targets': s.get('targets')})
        log('after_touch_tap', {'evc': page.evaluate("() => window.__evc"), 'timeline': boot_timeline})
        shot(page, '2-after-touch-tap')

        launch_hidden = boot_timeline and boot_timeline[-1]['launchHidden']
        if not launch_hidden:
            log('TOUCH_TAP_DEAD_on_launch', {'diagnosis': 'touch tap did not trigger click'})
            page.mouse.click(g0['innerW'] / 2, g0['innerH'] / 2)
            time.sleep(2)
            log('mouse_fallback', {'launchHidden': page.evaluate(
                "() => document.getElementById('launch').hidden")})

        # —— 观察绿旗生效时刻（每 2s，最多 60s）——
        gf_time = None
        for i in range(30):
            s = page.evaluate(STATE_JS)
            anim = s.get('vars', {}).get('开机动画中？')
            tg = s.get('targets')
            if anim not in (0, '0', None, ''):
                gf_time = 2 * (i + 1)
                log('greenflag_effective', {'after_s': gf_time, 'anim': anim, 'targets': tg})
                break
            time.sleep(2)
        if gf_time is None:
            log('greenflag_NOT_effective_60s', {'note': 'try vm.greenFlag() direct'})
            page.evaluate("() => vm.greenFlag()")
            time.sleep(3)
            s = page.evaluate(STATE_JS)
            log('greenflag_direct_result', {'anim': s.get('vars', {}).get('开机动画中？'),
                                            'targets': s.get('targets')})

        # —— 等门控（渲染的进度 >= 渲染数）或引导页出现，最长 420s ——
        gate_ok, last = False, None
        dl = time.time() + 420
        while time.time() < dl:
            time.sleep(8)
            last = page.evaluate(STATE_JS)
            v = last.get('vars', {})
            try:
                prog = float(v.get('渲染的进度', 0)); total = float(v.get('渲染数', 0))
                guide = float(v.get('开机引导页', -1))
            except (TypeError, ValueError):
                continue
            if (total and prog >= total) or guide >= 1:
                gate_ok = True
                break
        log('gate', {'ok': gate_ok, 'state': last})
        shot(page, '3-gate-or-timeout')

        # —— 触控测试 2：引导页点按推进（复现"进不了桌面与引导"）——
        page.evaluate(LISTENERS_JS)
        b = page.evaluate(STATE_JS)
        shot(page, '4-before-guide-tap')
        page.touchscreen.tap(g0['innerW'] / 2, g0['innerH'] / 2)
        time.sleep(3)
        a1 = page.evaluate(STATE_JS)
        shot(page, '5-after-guide-tap1')
        log('guide_tap_1', {'evc': page.evaluate("() => window.__evc"),
                            'before': b.get('vars'), 'after': a1.get('vars')})
        page.touchscreen.tap(g0['innerW'] / 2, g0['innerH'] / 2)
        time.sleep(3)
        a2 = page.evaluate(STATE_JS)
        shot(page, '6-after-guide-tap2')
        log('guide_tap_2', {'after': a2.get('vars')})

        log('geometry_final', page.evaluate(GEOMETRY_JS))
        log('errors_tail', errs[-12:])
        browser.close()
finally:
    server.terminate()

save()
print('DONE report ->', f'{OUT}/report.json')
