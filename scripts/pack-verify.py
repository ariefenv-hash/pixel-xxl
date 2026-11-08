#!/usr/bin/env python3
"""v1.04 合并包验证（v1.05 跨沙箱适配版）：
A) 正常链路：pack 单请求、零逐文件 fetch、零 404/报错、启动屏出现、
   #boot-feedback 反馈层随点击出现（v1.05 完整版，#boot-hint 已被超集覆盖移除）；
B) SW 二访（同一浏览器实例内 reload）：pack 命中缓存（transferSize=0）；
C) 兜底：拦截 pack 请求 → 回退逐文件 fetch，装载链仍完整
   （route.abort 的 net::ERR_FAILED 属预期网络噪声，不计入错误）。
反馈层收层时序（点亮/300s 兑底）由 boot-feedback-probe.py 专项覆盖，此处不断言。
"""
import json
import os
import re
import subprocess
import time

from playwright.sync_api import sync_playwright

# v1.05 适配：服务根 = 仓库根（原硬编码对侧沙箱 /home/z/my-project/download，
# 跨沙箱不可复跑——HANDOFF.md 已知坑「脚本不得绑定实例路径」）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8086
BASE = f'http://127.0.0.1:{PORT}'

LAUNCH_JS = "!document.getElementById('launch').hidden"


def new_page(pw):
    browser = pw.chromium.launch(headless=True, args=[
        '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
        '--disable-dev-shm-usage', '--no-sandbox'])
    page = browser.new_page(viewport={'width': 720, 'height': 900})
    reqs, errors, console_err, warns = [], [], [], []
    page.on('requestfinished', lambda r: reqs.append(r.url))
    page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    page.on('pageerror', lambda e: console_err.append('pageerror: ' + str(e)[:160]))
    page.on('console', lambda m: (
        warns.append(m.text[:160]) if m.type == 'warning' else (
            console_err.append(f'console.{m.type}: {m.text[:160]}') if m.type == 'error' else None)))
    return browser, page, reqs, errors, console_err, warns


def classify(reqs):
    pack = [u for u in reqs if re.search(r'/assets/pack-[0-9a-f]{8}\.bin$', u)]
    perfile = [u for u in reqs if re.search(r'/assets/[0-9a-f]{32}\.\w+$', u)]
    return pack, perfile


def main():
    server = subprocess.Popen(
        ['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    out = {}
    try:
        with sync_playwright() as pw:
            # ---------- A) 正常链路 + B) SW 二访（同一浏览器实例） ----------
            browser, page, reqs, errors, cerr, warns = new_page(pw)
            page.goto(BASE + '/', wait_until='load', timeout=60000)
            page.wait_for_function(LAUNCH_JS, timeout=300000)
            pack, perfile = classify(reqs)
            out['A'] = {
                'pack_fetches': len(pack),
                'perfile_fetches': len(perfile),
                'http_ge400': errors,
                'errors': cerr[:6],
            }
            page.click('#launch')
            try:
                page.wait_for_function(
                    "!document.getElementById('boot-feedback').hidden", timeout=5000)
                out['A']['feedback_shown'] = True
            except Exception:
                out['A']['feedback_shown'] = False
            out['A']['vm_targets'] = page.evaluate(
                "() => (window.vm && vm.runtime) ? vm.runtime.targets.length : 0")

            # B) SW 二访：同页 reload，pack 应命中缓存（transferSize=0）
            reqs.clear()
            page.reload(wait_until='load', timeout=60000)
            page.wait_for_function(LAUNCH_JS, timeout=300000)
            pack_b, perfile_b = classify(reqs)
            entries = page.evaluate(
                "() => performance.getEntriesByType('resource')"
                ".filter(e => /assets\\/pack-/.test(e.name))"
                ".map(e => ({name: e.name.split('/').pop(), t: e.transferSize}))")
            out['B'] = {
                'pack_fetches': len(pack_b),
                'perfile_fetches': len(perfile_b),
                'sw_controlled': page.evaluate("!!navigator.serviceWorker.controller"),
                'pack_transfer_sizes': entries,
                'errors': cerr[:6],
            }
            browser.close()

            # ---------- C) pack 兜底 ----------
            browser, page, reqs, errors, cerr, warns = new_page(pw)
            page.route(re.compile(r'/assets/pack-[0-9a-f]{8}\.bin$'),
                       lambda route: route.abort())
            page.goto(BASE + '/', wait_until='load', timeout=60000)
            page.wait_for_function(LAUNCH_JS, timeout=300000)
            pack, perfile = classify(reqs)
            out['C'] = {
                'pack_fetches': len(pack),
                'perfile_fetches': len(perfile),
                'fallback_warned': any('falling back' in m for m in warns),
                'errors': [m for m in cerr if 'net::ERR_FAILED' not in m][:6],
                'noise_dropped': sum(1 for m in cerr if 'net::ERR_FAILED' in m),
            }
            browser.close()
    finally:
        server.terminate()
    print(json.dumps(out, ensure_ascii=False, indent=1))
    ok = (out['A']['pack_fetches'] == 1 and out['A']['perfile_fetches'] == 0
          and not out['A']['http_ge400'] and not out['A']['errors']
          and out['A']['feedback_shown']
          and out['A']['vm_targets'] > 0
          and out['B']['pack_fetches'] == 1 and out['B']['sw_controlled']
          and all(e['t'] == 0 for e in out['B']['pack_transfer_sizes'])
          and out['C']['pack_fetches'] == 0 and out['C']['perfile_fetches'] > 100
          and out['C']['fallback_warned'] and not out['C']['errors'])
    print('VERDICT:', 'PASS' if ok else 'FAIL')


if __name__ == '__main__':
    main()
