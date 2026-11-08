#!/usr/bin/env python3
"""v1.05 分片包 + CDN 前置验证（v1.06 跨沙箱适配 + #boot-feedback 断言迁移）：
A) 正常链路（本地：CDN 上还没有新分片名 → 观察到「CDN 尝试→404→回退同源」链路）：
   分片恰 2 个、逐文件 fetch=0、装载完整、启动屏出现、提示条出现并显示真实百分比、自动隐藏；
B) SW 二访（同浏览器 reload）：同源分片命中缓存（transferSize=0）；
C) 兜底：拦截两个主机的分片请求 → 回退逐文件 fetch，装载链仍完整
   （route.abort 的 net::ERR_FAILED 属预期网络噪声；未推送前 CDN 404 属预期回退）。
"""
import json
import re
import subprocess
import time

from playwright.sync_api import sync_playwright

# v1.06 跨沙箱适配：服务根 = 仓库根推导（原硬编码实例路径跨沙箱不可复跑——
# HANDOFF.md 已知坑「脚本不得绑定实例路径」）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8086
BASE = f'http://127.0.0.1:{PORT}'

LAUNCH_JS = "!document.getElementById('launch').hidden"


def new_page(pw):
    browser = pw.chromium.launch(headless=True, args=[
        '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
        '--disable-dev-shm-usage', '--no-sandbox'])
    page = browser.new_page(viewport={'width': 720, 'height': 900})
    reqs, errors, console_err, warns, resps = [], [], [], [], []
    page.on('requestfinished', lambda r: reqs.append(r.url))
    page.on('response', lambda r: (
        resps.append(f'{r.status} {r.url}'),
        errors.append(f'{r.status} {r.url}') if r.status >= 400 else None))
    page.on('pageerror', lambda e: console_err.append('pageerror: ' + str(e)[:160]))
    page.on('console', lambda m: (
        warns.append(m.text[:160]) if m.type == 'warning' else (
            console_err.append(f'console.{m.type}: {m.text[:160]}') if m.type == 'error' else None)))
    return browser, page, reqs, errors, console_err, warns, resps


def classify(reqs):
    part = [u for u in reqs if re.search(r'/assets/pack-[0-9a-f]{8}-p\d+\.bin$', u)]
    cdn_part = [u for u in part if 'cdn.jsdelivr.net' in u]
    local_part = [u for u in part if 'cdn.jsdelivr.net' not in u]
    perfile = [u for u in reqs if re.search(r'/assets/[0-9a-f]{32}\.\w+$', u)]
    return part, cdn_part, local_part, perfile


def cdn_expected(errors):
    """未推送期 CDN 404/403 属预期回退；对应浏览器网络日志也属预期噪声。"""
    return [e for e in errors
            if not (('cdn.jsdelivr.net' in e and re.search(r'\b(404|403)\b', e))
                    or 'responded with a status of 404' in e
                    or 'responded with a status of 403' in e)]


def main():
    server = subprocess.Popen(
        ['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    out = {}
    try:
        with sync_playwright() as pw:
            # ---------- A) 正常链路 + B) SW 二访（同一浏览器实例） ----------
            browser, page, reqs, errors, cerr, warns, resps = new_page(pw)
            page.goto(BASE + '/', wait_until='load', timeout=60000)
            page.wait_for_function(LAUNCH_JS, timeout=300000)
            part, cdn_part, local_part, perfile = classify(reqs)
            cdn_tried = sum(1 for r in resps
                            if 'cdn.jsdelivr.net' in r and '/assets/pack-' in r)
            out['A'] = {
                'part_fetches': len(part),
                'cdn_attempts': cdn_tried,
                'local_parts': len(local_part),
                'perfile_fetches': len(perfile),
                'http_ge400_non_cdn': cdn_expected(errors),
                'errors': cdn_expected(cerr)[:6],
            }
            page.click('#launch')
            try:
                page.wait_for_function(
                    "!document.getElementById('boot-feedback').hidden", timeout=5000)
                out['A']['feedback_shown'] = True
            except Exception:
                out['A']['feedback_shown'] = False
            # ~30s 后检查百分比（渲染的进度/渲染数 变量驱动）
            time.sleep(30)
            out['A']['feedback_text'] = page.evaluate(
                "(function(){var fb=document.getElementById('boot-feedback');"
                "return fb&&fb.children[1]?fb.children[1].textContent:null})()")
            out['A']['feedback_pct_shown'] = bool(re.search(r'\d+%', out['A']['feedback_text'] or ''))
            try:
                page.wait_for_function(
                    "document.getElementById('boot-feedback').hidden", timeout=240000)
                out['A']['feedback_auto_hidden'] = True
            except Exception:
                out['A']['feedback_auto_hidden'] = False
            out['A']['vm_targets'] = page.evaluate(
                "() => (window.vm && vm.runtime) ? vm.runtime.targets.length : 0")

            # B) SW 二访：同页 reload，同源分片应命中缓存（transferSize=0）
            reqs.clear()
            errors.clear()
            page.reload(wait_until='load', timeout=60000)
            page.wait_for_function(LAUNCH_JS, timeout=300000)
            part, cdn_part, local_part, perfile = classify(reqs)
            entries = page.evaluate(
                "() => performance.getEntriesByType('resource')"
                ".filter(e => /assets\\/pack-.*-p\\d+\\.bin$/.test(e.name) && e.name.indexOf('cdn.jsdelivr.net') === -1)"
                ".map(e => ({name: e.name.split('/').pop(), t: e.transferSize}))")
            out['B'] = {
                'part_fetches': len(part),
                'local_parts': len(local_part),
                'perfile_fetches': len(perfile),
                'sw_controlled': page.evaluate("!!navigator.serviceWorker.controller"),
                'local_part_transfer_sizes': entries,
                'errors': cdn_expected(errors)[:6],
            }
            browser.close()

            # ---------- C) 分片兜底 ----------
            browser, page, reqs, errors, cerr, warns, resps = new_page(pw)
            page.route(re.compile(r'/assets/pack-[0-9a-f]{8}-p\d+\.bin$'),
                       lambda route: route.abort())
            page.goto(BASE + '/', wait_until='load', timeout=60000)
            page.wait_for_function(LAUNCH_JS, timeout=300000)
            part, cdn_part, local_part, perfile = classify(reqs)
            out['C'] = {
                'part_fetches': len(part),
                'perfile_fetches': len(perfile),
                'fallback_warned': any('falling back' in m for m in warns),
                'errors': [m for m in cerr if 'net::ERR_FAILED' not in m][:6],
                'noise_dropped': sum(1 for m in cerr if 'net::ERR_FAILED' in m),
            }
            browser.close()
    finally:
        server.terminate()
    print(json.dumps(out, ensure_ascii=False, indent=1))
    ok = (out['A']['part_fetches'] >= 2 and out['A']['cdn_attempts'] >= 2
          and out['A']['local_parts'] >= 2 and out['A']['perfile_fetches'] == 0
          and not out['A']['http_ge400_non_cdn'] and not out['A']['errors']
          and out['A']['hint_shown'] and out['A']['feedback_pct_shown']
          and out['A']['feedback_auto_hidden'] and out['A']['vm_targets'] > 0
          and out['B']['perfile_fetches'] == 0 and out['B']['sw_controlled']
          and out['B']['local_part_transfer_sizes']
          and all(e['t'] == 0 for e in out['B']['local_part_transfer_sizes'])
          and out['C']['part_fetches'] == 0 and out['C']['perfile_fetches'] > 100
          and out['C']['fallback_warned'] and not out['C']['errors'])
    print('VERDICT:', 'PASS' if ok else 'FAIL')


if __name__ == '__main__':
    main()
