#!/usr/bin/env python3
"""Pixel XXL 打开/关闭动画逐 tick 测量探针 v2（R131 · 打开关闭动画不连贯诊断）。
v2：引导页 next 按钮点击 + VM 步进级 trace（皮肤 id/造型/尺寸/tick 间隔）。
输出：/tmp/anim-probe/{report.json, anim-trace.json}
"""
import json, os, subprocess, time, sys

ROOT = '/home/z/my-project/pixel-xxl'
PORT = 8087
OUT = '/tmp/anim-probe'
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
REPORT = {}

def save():
    json.dump(REPORT, open(f'{OUT}/report.json', 'w'), ensure_ascii=False, indent=1, default=str)

def log(step, data):
    REPORT[step] = data
    print(f"[+{time.time()-T0:6.1f}s] [{step}] {json.dumps(data, ensure_ascii=False)[:420]}", flush=True)
    save()

ARM_JS = r"""() => {
  window.__anim = {steps: [], longtasks: [], fetches: [], raf: []};
  const S = window.__anim;
  // 1) VM 步进 trace
  const rt = vm.runtime;
  const origStep = rt._step.bind(rt);
  let stepN = 0;
  rt._step = (...a) => {
    const t = performance.now();
    try {
      const stage = rt.getTargetForStage();
      const g = n => { for (const k in stage.variables) { const v = stage.variables[k]; if (v && v.name === n) return v.value; } };
      const rec = {i: stepN++, t: Math.round(t), th: rt.threads.length,
                   fly: g('飞入动画状态'), open: g('当前打开应用'),
                   bw: g('填充图标宽'), bl: g('填充图标长'), blur: g('模糊'), bging: g('后台进入中？')};
      // 找与当前打开应用同名的最大克隆（窗口），记录其造型与皮肤 id
      if (rec.open) {
        let best = null;
        for (const tg of rt.targets) {
          if (tg.isOriginal || tg.isStage || !tg.sprite || tg.sprite.name !== '应用') continue;
          const me = tg.variables && Object.values(tg.variables).find(v => v.name === '我是？');
          if (!me || String(me.value) !== String(rec.open)) continue;
          if (!best || Math.abs(tg.size) > Math.abs(best.size)) best = tg;
        }
        if (best) {
          const cs = best.getCostumes()[best.currentCostume];
          rec.win = {cos: best.currentCostume, name: cs ? cs.name : '?',
                     skin: cs && cs.skin ? (cs.skin.id !== undefined ? cs.skin.id : '?') : '?',
                     size: Math.round(best.size), x: Math.round(best.x), y: Math.round(best.y)};
        }
      }
      S.steps.push(rec);
    } catch (e) { S.steps.push({i: stepN++, t: Math.round(t), err: String(e).slice(0,80)}); }
    return origStep(...a);
  };
  // 2) longtask（对照）
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) S.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]); })
      .observe({type: 'longtask', buffered: true});
  } catch (e) {}
  // 3) fetch 计时
  const of = window.fetch;
  if (of) window.fetch = function(u, o) {
    const url = String(u && u.url || u);
    const t0 = performance.now();
    return of.apply(this, arguments).finally(() => {
      if (/assets\/|\.bin|\.svg|\.png|\.mp3|\.json/.test(url))
        S.fetches.push([url.slice(-48), Math.round(t0), Math.round(performance.now() - t0)]);
    });
  };
  return 'armed';
}"""

VARS_JS = r"""() => {
  if (!window.vm) return {vm: false};
  const rt = vm.runtime; const stage = rt.getTargetForStage();
  const g = n => { for (const k in stage.variables) { const v = stage.variables[k]; if (v && v.name === n) return v.value; } };
  const clones = [];
  let guideVisible = null;
  for (const tg of rt.targets) {
    if (tg.isStage) continue;
    if (tg.sprite && tg.sprite.name === '开机及引导') guideVisible = tg.visible;
    if (!tg.sprite || tg.sprite.name !== '应用') continue;
    const cs = tg.getCostumes();
    const me = Object.values(tg.variables || {}).find(v => v.name === '我是？');
    clones.push({x: Math.round(tg.x), y: Math.round(tg.y), size: Math.round(tg.size),
                 cos: cs[tg.currentCostume] ? cs[tg.currentCostume].name : '?', me: me ? String(me.value) : '', orig: tg.isOriginal});
  }
  return {bootAnim: g('开机动画中？'), renders: g('渲染的进度') + '/' + g('渲染数'),
          guide: g('开机引导页'), guideVis: guideVisible, lock: g('锁屏'), open: g('当前打开应用'),
          fly: g('飞入动画状态'), nClones: clones.length, clones: clones.slice(0, 16)};
}"""

server = subprocess.Popen(['python3', '-u', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                          cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=[
            '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
            '--disable-dev-shm-usage', '--no-sandbox'])
        page = browser.new_page(viewport={'width': 720, 'height': 900})
        page.on('pageerror', lambda e: log('pageerror', {'msg': str(e)[:200]}))
        page.goto(f'http://127.0.0.1:{PORT}/?nofb=1', wait_until='load', timeout=180000)
        page.wait_for_function("!document.getElementById('launch').hidden", timeout=180000)
        log('launch_ready', {})
        page.evaluate(ARM_JS)
        page.click('#launch')
        # 等渲染满 + 引导页开始
        for i in range(120):
            page.wait_for_timeout(2000)
            st = page.evaluate(VARS_JS)
            if i % 8 == 0:
                log('boot_poll', {k: st.get(k) for k in ('bootAnim', 'renders', 'guide', 'nClones')})
            if st.get('renders', 'x/x').split('/')[0] == st.get('renders', 'x/x').split('/')[1] and int(st.get('guide') or 0) >= 1:
                break
        # 点 next 按钮 (Scratch 95,-320) 推进引导页直到不再变化
        px_next = 157.5 + (95 + 162) / 324 * 405
        py_next = (360 - (-320)) / 720 * 900
        log('next_btn_px', {'px': round(px_next, 1), 'py': round(py_next, 1)})
        seen4, done = False, False
        for i in range(24):
            page.mouse.click(px_next, py_next)
            page.wait_for_timeout(3200)
            st = page.evaluate(VARS_JS)
            g1 = str(st.get('guide'))
            if g1 == '4':
                seen4 = True
            log('guide_tap', {'i': i, 'guide': g1, 'guideVis': st.get('guideVis'), 'open': st.get('open')})
            if seen4 and (g1 == '0' or st.get('guideVis') is False):
                done = True
                break
        log('guide_done', {'done': done})
        st = page.evaluate(VARS_JS)
        log('icons', st)
        # 选桌面图标（非 orig、me 非空、cos 以 -APP 结尾优先），避免 dock 原生
        target = None
        for c in st.get('clones', []):
            if not c['orig'] and c['me'] and str(c['cos']).endswith('-APP'):
                target = c; break
        if target is None:
            cands = [c for c in st.get('clones', []) if not c['orig'] and c['me']] or [c for c in st.get('clones', []) if not c['orig']]
            target = cands[0] if cands else None
        if not target:
            log('NO_ICON', {}); sys.exit(1)
        log('icon_pick', target)
        geo = page.evaluate("""() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; }""")
        px = geo['x'] + (target['x'] + 162) / 324 * geo['w']
        py = geo['y'] + (360 - target['y']) / 720 * geo['h']
        log('mapping', {'px': round(px, 1), 'py': round(py, 1)})
        page.mouse.click(px, py)
        page.wait_for_timeout(7000)
        st_open = page.evaluate(VARS_JS)
        log('after_open', {'open': st_open.get('open'), 'fly': st_open.get('fly')})
        # 关闭：底部上滑
        page.mouse.move(360, 885)
        page.mouse.down()
        for yy in (855, 810, 750, 670, 560, 430, 300, 180):
            page.mouse.move(360, yy, steps=2)
            page.wait_for_timeout(40)
        page.mouse.up()
        page.wait_for_timeout(6000)
        st_close = page.evaluate(VARS_JS)
        log('after_close', {'open': st_close.get('open'), 'fly': st_close.get('fly')})
        data = page.evaluate("() => window.__anim")
        json.dump(data, open(f'{OUT}/anim-trace.json', 'w'))
        steps = data['steps']
        log('trace_summary', {'n_steps': len(steps), 'n_longtasks': len(data['longtasks']), 'n_fetches': len(data['fetches'])})
        browser.close()
finally:
    server.terminate()
print('ANIM-PROBE-DONE')
