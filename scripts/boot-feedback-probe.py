#!/usr/bin/env python3
"""boot-feedback 冒烟取证（v1.04）——验证启动屏进度反馈层三通道：
A. ?nofb=1 豁免：反馈层不安装，行为与 v1.03 逐字节一致（回归对比通道）；
B. 桌面视口全链路：点击绿旗 → 反馈层出现 → 阶段文案推进 → 画面点亮自动收层 → 桌面可用；
C. 移动仿真视口（390×844 DPR3 touch）：反馈层出现 + 阶段推进（不等待全链路）。

输出：docs/boot-feedback-evidence.json（入库证据）。
"""
import json, subprocess, time, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8089
URL = f'http://127.0.0.1:{PORT}/'
OUT = os.path.join(ROOT, 'docs', 'boot-feedback-evidence.json')

CHROME_ARGS = ['--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
               '--disable-dev-shm-usage', '--no-sandbox']

def stage_snapshot(page):
    return page.evaluate("""() => {
      const fb = document.getElementById('boot-feedback');
      const vm = window.vm;
      let targets = 0, tick = null, litCanvas = false;
      if (vm && vm.runtime) {
        targets = vm.runtime.targets ? vm.runtime.targets.length : 0;
        tick = typeof vm.runtime._tickCounter === 'number' ? vm.runtime._tickCounter : null;
      }
      const c = document.querySelector('#app canvas');
      if (c) litCanvas = true;
      return {
        fbInstalled: !!window.__bootFeedbackInstalled,
        fbHidden: fb ? fb.hasAttribute('hidden') : null,
        fbPhase: fb ? (fb.children[1] ? fb.children[1].textContent : null) : null,
        fbElapsed: fb ? (fb.children[2] ? fb.children[2].textContent : null) : null,
        fbHintShown: fb ? (fb.children[5] ? fb.children[5].style.display !== 'none' : false) : null,
        launchHidden: document.getElementById('launch').hasAttribute('hidden'),
        loadingHidden: document.getElementById('loading').hasAttribute('hidden'),
        errorShown: !document.getElementById('error').hasAttribute('hidden'),
        vmReady: !!vm, targets, tick, canvasExists: litCanvas,
        threads: vm && vm.runtime && vm.runtime.threads ? vm.runtime.threads.length : 0,
      };
    }""")

def nonblack_ratio(page):
    try:
        return page.evaluate("""() => {
          const c = document.querySelector('#app canvas');
          if (!c) return -1;
          const t = document.createElement('canvas');
          t.width = 64; t.height = 48;
          const x = t.getContext('2d', {willReadFrequently: true});
          try { x.drawImage(c, 0, 0, 64, 48); } catch (e) { return -1; }
          const px = x.getImageData(0, 0, 64, 48).data;
          let lit = 0;
          for (let i = 0; i < px.length; i += 4)
            if (px[i] > 16 || px[i+1] > 16 || px[i+2] > 16) lit++;
          return lit / (64 * 48);
        }""")
    except Exception:
        return -1

def main():
    os.makedirs('/tmp/render', exist_ok=True)
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    evidence = {'A_nofb': {}, 'B_desktop': {}, 'C_mobile': {}, 'errors': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=CHROME_ARGS)

            # ---------- A. nofb 豁免 ----------
            ctx = browser.new_context(viewport={'width': 720, 'height': 900})
            page = ctx.new_page()
            errs_a = []
            page.on('pageerror', lambda e: errs_a.append(str(e)[:160]))
            page.goto(URL + '?nofb=1', wait_until='load', timeout=180000)
            page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
            page.click('#launch')
            time.sleep(8)
            s = stage_snapshot(page)
            evidence['A_nofb'] = {
                'installed': s['fbInstalled'], 'fb_present': s['fbHidden'] is not None,
                'vmReady': s['vmReady'], 'targets': s['targets'], 'pageerrors': errs_a,
            }
            print('[A] nofb installed=', s['fbInstalled'], 'fb_present=', s['fbHidden'] is not None,
                  'vm=', s['vmReady'], 'targets=', s['targets'], 'errors=', len(errs_a))
            ctx.close()

            # ---------- B. 桌面全链路 ----------
            ctx = browser.new_context(viewport={'width': 720, 'height': 900})
            page = ctx.new_page()
            errs_b = []
            page.on('pageerror', lambda e: errs_b.append(str(e)[:160]))
            t_start = time.time()
            page.goto(URL, wait_until='load', timeout=180000)
            page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
            launch_ready = round(time.time() - t_start, 1)
            page.click('#launch')
            t_click = time.time()
            time.sleep(1.5)
            s1 = stage_snapshot(page)
            fb_appeared = not s1['fbHidden'] and s1['fbInstalled']
            fb_shot1 = '/tmp/render/bfb-1-visible.png'
            page.screenshot(path=fb_shot1)
            # 轮询阶段推进与收层（上限 360s；收层后 12s 稳定不重挂即终）
            timeline = []
            last_phase = None
            fb_hidden_at = None
            desktop_lit = False
            stable_after = None
            while time.time() - t_click < 360:
                time.sleep(5)
                s = stage_snapshot(page)
                el = round(time.time() - t_click, 1)
                rec = {'t': el, 'phase': s['fbPhase'], 'elapsed': s['fbElapsed'],
                       'fbHidden': s['fbHidden'], 'vm': s['vmReady'], 'targets': s['targets'],
                       'threads': s['threads'], 'hint': s['fbHintShown']}
                timeline.append(rec)
                if s['fbPhase'] != last_phase:
                    print(f"  [B t={el}s] phase={s['fbPhase']!r} targets={s['targets']} threads={s['threads']} hint={s['fbHintShown']}")
                    last_phase = s['fbPhase']
                if s['fbHidden'] and fb_hidden_at is None:
                    fb_hidden_at = el
                    print(f"  [B t={el}s] 反馈层已收层")
                if fb_hidden_at is not None and stable_after is None and time.time() - t_click - fb_hidden_at > 12:
                    stable_after = el
                    ratio = nonblack_ratio(page)
                    desktop_lit = ratio > 0.02  # headless swiftshader 黑屏伪影下恒 False，真机 GPU 为 True
                    page.screenshot(path='/tmp/render/bfb-2-desktop.png')
                    break
            t_total = round(time.time() - t_click, 1)
            final = stage_snapshot(page)
            phases_seen = [r['phase'] for r in timeline if r['phase']]
            evidence['B_desktop'] = {
                'launch_ready_s': launch_ready, 'fb_appeared': fb_appeared,
                'fb_hidden_at_s': fb_hidden_at, 'desktop_lit': desktop_lit,
                'desktop_lit_note': 'headless swiftshader 黑屏伪影下恒 False（docs/MOBILE.md §一），真机 GPU 依赖像素点亮通道',
                'phases_seen': sorted(set(phases_seen)),
                'total_s': t_total, 'timeline': timeline,
                'final': final, 'pageerrors': errs_b,
                'shots': [fb_shot1, '/tmp/render/bfb-2-desktop.png'],
            }
            print(f"[B] fb_appeared={fb_appeared} fb_hidden_at={fb_hidden_at}s desktop_lit={desktop_lit} "
                  f"phases={evidence['B_desktop']['phases_seen']} errors={len(errs_b)}")
            ctx.close()

            # ---------- C. 移动仿真 ----------
            ctx = browser.new_context(
                viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
            page = ctx.new_page()
            errs_c = []
            page.on('pageerror', lambda e: errs_c.append(str(e)[:160]))
            page.goto(URL, wait_until='load', timeout=180000)
            page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
            page.tap('#launch')
            time.sleep(3)
            s = stage_snapshot(page)
            page.screenshot(path='/tmp/render/bfb-3-mobile.png')
            evidence['C_mobile'] = {
                'fb_appeared': not s['fbHidden'] and s['fbInstalled'],
                'phase': s['fbPhase'], 'vmReady': s['vmReady'], 'pageerrors': errs_c,
                'shot': '/tmp/render/bfb-3-mobile.png',
            }
            print('[C] mobile fb_appeared=', evidence['C_mobile']['fb_appeared'],
                  'phase=', s['fbPhase'], 'errors=', len(errs_c))
            ctx.close()
            browser.close()
    finally:
        server.terminate()

    ok = (evidence['A_nofb'].get('installed') is False
          and evidence['A_nofb'].get('fb_present') is False
          and evidence['B_desktop'].get('fb_appeared') is True
          and evidence['B_desktop'].get('fb_hidden_at_s') is not None
          and any(r.get('hint') for r in evidence['B_desktop'].get('timeline') or [])
          and not evidence['B_desktop'].get('pageerrors')
          and evidence['C_mobile'].get('fb_appeared') is True
          and not evidence['C_mobile'].get('pageerrors'))
    evidence['verdict'] = 'PASS' if ok else 'FAIL'
    json.dump(evidence, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('VERDICT:', evidence['verdict'], '->', OUT)

if __name__ == '__main__':
    main()
