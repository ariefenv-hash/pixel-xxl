#!/usr/bin/env python3
"""v1.03 瘦身验证：保真度（新旧 SVG 渲染像素差）+ 应用冒烟（装载链/报错/SW 缓存命中）。

A) 保真度：git 历史旧 SVG（download/slimcheck/old-*.svg）vs 瘦身后 assets/*.svg，
   同尺寸渲染到 canvas 逐像素比对（mean abs diff / 高阈值差像素占比）。
B) 冒烟：本地起服 → 首访装载（查素材 404 与页面错误）→ 二次访问
   （SW 已控制 → 断言素材从缓存出：transferSize==0 占比）。
"""
import json, os, subprocess, time
from playwright.sync_api import sync_playwright

PROJ = '/home/z/my-project/download/pixel-xxl'
DL = '/home/z/my-project/download'
PORT = 8083
BASE = f'http://127.0.0.1:{PORT}'

PAIRS = [
    ('0b290d131f945ce92457f0481b0a35fe', '9116b0d449227e6b3a436d04747f16f0'),
    ('2bbdf5974d36aad1e4b7b0c2bb97a77d', '083f4ed7919dd89a43c5bda2a3e60af7'),
    ('2db1b55cc3076085f4e759ad24d665d1', 'cc06d09b5556eed367d53a2cc7cdefa4'),
    ('3f157749b3dde1a784f7b0bdf8a93edd', 'e5c4a727f8175c18f2273e4f680bd4a8'),
    ('7d39f6b7e149e27d3a70bb018ee8a6bd', '1aca054a16851970e2971f950a3816e5'),
    ('94010506b21a1246797458deb40aef0d', '32fa956a27a3c720b573fe7449a7f49f'),
    ('9f698dc9703f11fa7700fd93addd22a7', '9f6e62946dbe70f92cc3be999a9ca032'),
    ('a55b9126da74e48bfca803b5d255685c', 'bbfe9bae419249f7bb17bac44bf37a13'),
    ('cf91df2b94256119a86a49dc17cb0e03', 'c74cc3451bc8ffea056b82de9656c8d1'),
    ('df67bf9809fdb75d76a61613319b544e', 'a2389ccd048940744872120e944d8e03'),
]

DIFF_JS = """
async ([oldUrl, newUrl]) => {
  const load = (src) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('img fail ' + src));
    im.src = src;
  });
  const a = await load(oldUrl), b = await load(newUrl);
  const W = 240, H = Math.round(W * (a.naturalHeight / a.naturalWidth));
  const ca = Object.assign(document.createElement('canvas'), {width: W, height: H});
  const cb = Object.assign(document.createElement('canvas'), {width: W, height: H});
  ca.getContext('2d').drawImage(a, 0, 0, W, H);
  cb.getContext('2d').drawImage(b, 0, 0, W, H);
  const da = ca.getContext('2d').getImageData(0, 0, W, H).data;
  const db = cb.getContext('2d').getImageData(0, 0, W, H).data;
  let sum = 0, big = 0, maxd = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d = (Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2])) / 3;
    sum += d; maxd = Math.max(maxd, d);
    if (d > 24) big++;
  }
  const n = da.length / 4;
  return {mean: +(sum / n).toFixed(2), bigPct: +(100 * big / n).toFixed(3), maxd: +maxd.toFixed(0)};
}
"""

def main():
    server = subprocess.Popen(
        ['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', DL],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    result = {}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=[
                '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
                '--disable-dev-shm-usage', '--no-sandbox'])

            # A) 保真度
            page = browser.new_page(viewport={'width': 480, 'height': 1040})
            page.goto(f'{BASE}/slimcheck/', wait_until='load')  # 同源起点，避免 canvas 污染
            fidelity = []
            for old, new in PAIRS:
                r = page.evaluate(DIFF_JS, [f'{BASE}/slimcheck/old-{old}.svg', f'{BASE}/pixel-xxl/assets/{new}.svg'])
                fidelity.append({'old': old[:8], 'new': new[:8], **r})
                print(f"A {old[:8]} -> {new[:8]}: mean={r['mean']} big%={r['bigPct']} max={r['maxd']}")
            page.close()
            result['fidelity'] = fidelity

            # B) 首访冒烟
            page = browser.new_page(viewport={'width': 720, 'height': 900})
            console, errors = [], []
            page.on('console', lambda m: console.append(m.text[:200]))
            page.on('pageerror', lambda e: errors.append(str(e)[:200]))
            page.goto(f'{BASE}/pixel-xxl/', wait_until='load', timeout=120000)
            page.wait_for_function("!document.getElementById('launch').hidden", timeout=120000)
            page.click('#launch')
            time.sleep(30)
            asset_err = [c for c in console if 'Asset is not in assets/' in c]
            other_err = [c for c in console if 'error' in c.lower() and 'Asset is not' not in c]
            page.screenshot(path='/tmp/render/slim-boot.png')
            print(f"B1 first-visit: asset404={len(asset_err)} otherConsoleErr={len(other_err)} pageErrors={len(errors)}")
            for c in other_err[:3]: print('   C', c[:150])
            for e in errors[:3]: print('   E', e[:150])
            result['first_visit'] = {'asset404': asset_err, 'consoleErr': other_err[:5], 'pageErrors': errors[:5]}

            # B) 二次访问：SW 缓存命中
            page.evaluate("() => new Promise(r => setTimeout(r, 3000))")  # 给 SW 安装留时间
            sw_state = page.evaluate("""async () => ({
              supported: 'serviceWorker' in navigator,
              controlled: !!navigator.serviceWorker.controller,
              caches: 'caches' in window ? await caches.keys() : [],
            })""")
            print('B2 sw-state before reload:', sw_state)
            page.reload(wait_until='load')
            page.wait_for_function("!document.getElementById('launch').hidden", timeout=120000)
            res_stats = page.evaluate("""() => {
              const rs = performance.getEntriesByType('resource');
              const assets = rs.filter(r => r.name.includes('/assets/'));
              const fromCache = assets.filter(r => r.transferSize === 0);
              return {assets: assets.length, fromCache: fromCache.length};
            }""")
            sw_state2 = page.evaluate("""async () => ({
              controlled: !!navigator.serviceWorker.controller,
              caches: 'caches' in window ? await caches.keys() : [],
            })""")
            print(f"B2 reload: assets={res_stats['assets']} fromCache={res_stats['fromCache']} sw={sw_state2}")
            page.screenshot(path='/tmp/render/slim-reload.png')
            result['sw'] = {'before': sw_state, 'reload_stats': res_stats, 'after': sw_state2}

            browser.close()
    finally:
        server.terminate()
    json.dump(result, open('/tmp/render/slim-verify.json', 'w'), ensure_ascii=False, indent=2)
    print('saved /tmp/render/slim-verify.json')

if __name__ == '__main__':
    os.makedirs('/tmp/render', exist_ok=True)
    main()
