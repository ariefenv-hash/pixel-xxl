#!/usr/bin/env python3
"""v3：解剖"绿旗→开机动画"空窗。采样：线程栈/控制台/AudioContext/渲染计数。"""
import json, os, subprocess, time

ROOT = '/home/z/my-project/download/pixel-xxl'
PORT = 8084
OUT = '/tmp/render/mobile'
T0 = time.time()
REPORT = {}

def save():
    json.dump(REPORT, open(f'{OUT}/report3.json', 'w'), ensure_ascii=False, indent=2, default=str)

def log(step, data):
    REPORT[step] = data
    print(f"[+{time.time()-T0:6.1f}s] [{step}] {json.dumps(data, ensure_ascii=False)[:290]}", flush=True)
    save()

STATE_JS = """() => {
  if (!window.vm) return {vm: false};
  const rt = vm.runtime;
  const stage = rt.getTargetForStage();
  const vars = {};
  if (stage) for (const k of Object.keys(stage.variables)) {
    const v = stage.variables[k]; if (v && v.name) vars[v.name] = v.value;
  }
  const threads = rt.threads.slice(0, 6).map(t => ({
    target: t.target ? t.target.getName() : '?',
    status: t.status,
    top: (() => { try {
      const bc = t.blockContainer;
      if (!bc || !bc._blocks) return '?';
      const bid = Object.keys(bc._blocks).find(k => bc._blocks[k] && bc._blocks[k].topLevel);
      return bid ? (bc._blocks[bid].opcode || '?') : '?';
    } catch (e) { return 'ERR'; } })(),
  }));
  let audio = 'n/a';
  try { audio = (window.scaffolding && scaffolding.audioContext) ? scaffolding.audioContext.state : 'no-ctx'; } catch (e) {}
  return {
    vm: true, targets: rt.targets.length, threads: rt.threads.length, threadSample: threads,
    audio, anim: vars['开机动画中？'], renders: vars['渲染数'] + '/' + vars['渲染的进度'],
    guide: vars['开机引导页'], lock: vars['锁屏'],
  };
}"""

server = subprocess.Popen(['python3', '-u', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                          cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=[
            '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
            '--disable-dev-shm-usage', '--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3,
                                  is_mobile=True, has_touch=True,
                                  user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 '
                                             '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36')
        page = ctx.new_page()
        cons = []
        page.on('console', lambda m: cons.append(f"[{m.type}] {m.text[:110]}"))
        page.on('pageerror', lambda e: cons.append('[PAGEERR] ' + str(e)[:110]))
        page.goto(f'http://127.0.0.1:{PORT}/', wait_until='load', timeout=180000)
        page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
        log('launch_ready', {'audio0': page.evaluate(
            "() => (window.scaffolding && scaffolding.audioContext) ? scaffolding.audioContext.state : 'no-ctx'")})
        page.touchscreen.tap(195, 422)
        log('tapped', {})

        stall_resolved = False
        for i in range(75):  # 2s × 75 = 150s
            time.sleep(2)
            s = page.evaluate(STATE_JS)
            log(f'p{i:02d}', s)
            if s.get('anim') not in (0, '0', None, ''):
                stall_resolved = True
                log('anim_STARTED', {'at_s': 2 * (i + 1)})
                break
        log('stall_resolved', {'ok': stall_resolved, 'console_tail': cons[-8:]})

        # 尝试主动 resume 音频，看是否是音频阻塞（若是，resume 后 anim 应在数秒内翻转）
        if not stall_resolved:
            r = page.evaluate("""() => { try {
              if (window.scaffolding && scaffolding.audioContext) {
                scaffolding.audioContext.resume();
                return 'resumed:' + scaffolding.audioContext.state;
              } return 'no-ctx';
            } catch (e) { return 'ERR ' + e; } }""")
            log('audio_resume_attempt', r)
            for i in range(10):
                time.sleep(2)
                s = page.evaluate(STATE_JS)
                log(f'r{i:02d}', s)
                if s.get('anim') not in (0, '0', None, ''):
                    log('AUDIO_WAS_THE_BLOCKER', {'at_s': 2 * (i + 1)})
                    break
        browser.close()
finally:
    server.terminate()
save()
print('DONE3')
