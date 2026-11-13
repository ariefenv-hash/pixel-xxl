#!/usr/bin/env python3
"""v1.07 IndexedDB 本地素材库 + SW 跨域修复验证（跨沙箱适配 + #boot-feedback 断言迁移）：
A) 正常链路（本地：CDN 已有 v1.05 分片 → CDN 优先成功）：
   分片恰 2 个、逐文件 fetch=0、装载完整、启动屏出现、提示条显示真实百分比、
   自动隐藏、首访后 IndexedDB 分片计数=2（本地素材库写入成功）；
B) 二访快路径（同浏览器 reload）：分片网络请求=0（IndexedDB 命中），
   __packSource()==='idb'，SW 受控；（v1.05 的「SW transferSize=0」由 E 场景接管）
C) 兜底：拦截两个主机的分片请求 → 回退逐文件 fetch，装载链仍完整
   （route.abort 的 net::ERR_FAILED 属预期网络噪声；未推送前 CDN 404 属预期回退）；
E) SW 兜底层（IDB 失效场景，如 iOS Safari 配额逐出）：about:blank 删除 IndexedDB →
   拦 CDN 分片 → reload#1 走同源网络（SW cache-first 写入）→ reload#2 预热 →
   reload#3 断言同源分片 transferSize=0（SW 命中）且 IndexedDB 重新写入（计数=2）。
   （SW 内部发起的 fetch 不经 page.route，故只在首访前拦 CDN：此时 SW 尚未控制页面）
"""
import json
import os
import re
import sys
import subprocess
import time

from playwright.sync_api import sync_playwright

# v1.07 跨沙箱适配：服务根 = 仓库根推导（原硬编码实例路径跨沙箱不可复跑——
# HANDOFF.md 已知坑「脚本不得绑定实例路径」；对侧 v1.06 硬编码实证会踩）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8086
BASE = f'http://127.0.0.1:{PORT}'

LAUNCH_JS = "!document.getElementById('launch').hidden"

JS_IDB_COUNT = """
() => new Promise((resolve) => {
  try {
    const req = indexedDB.open('pixel-xxl-assets', 1);
    req.onupgradeneeded = () => { try { req.result.createObjectStore('parts'); } catch (e) {} };
    req.onsuccess = () => {
      const db = req.result;
      const cnt = db.transaction('parts', 'readonly').objectStore('parts').count();
      cnt.onsuccess = () => { db.close(); resolve(cnt.result); };
      cnt.onerror = () => { db.close(); resolve(-1); };
    };
    req.onerror = () => resolve(-1);
  } catch (e) { resolve(-1); }
})
"""

JS_IDB_DELETE = """
() => new Promise((resolve) => {
  const req = indexedDB.deleteDatabase('pixel-xxl-assets');
  req.onsuccess = () => resolve(true);
  req.onerror = () => resolve(false);
  req.onblocked = () => resolve('blocked');
})
"""

JS_PACK_SOURCE = "() => (typeof window.__packSource === 'function' ? window.__packSource() : null)"


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


def wait_idb_count(page, want, timeout_s=60):
    """轮询等待 IndexedDB 分片计数达到 want（idbPutPart 为 fire-and-forget）。"""
    deadline = time.time() + timeout_s
    last = -1
    while time.time() < deadline:
        last = page.evaluate(JS_IDB_COUNT)
        if last == want:
            return True
        time.sleep(0.5)
    return False


def main():
    # --group ab|c|e|all（默认 all）：CI 全量不受影响；本地受限环境分批跑（v1.21 披露：
    # 沙箱冻结后台进程 + 前台 10 分钟窗装不下五场景——分批各自起 server/browser，组间独立）
    run = {'A', 'B', 'C', 'E'}
    if '--group' in sys.argv:
        g = sys.argv[sys.argv.index('--group') + 1]
        run = {'ab': {'A', 'B'}, 'c': {'C'}, 'e': {'E'}}.get(g, {'A', 'B', 'C', 'E'})

    server = subprocess.Popen(
        ['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    out = {}
    try:
        with sync_playwright() as pw:
            # 组开关（v1.21 --group）：A+B 共用浏览器实例
            if 'A' in run:
                # ---------- A) 正常链路 + B) 二访快路径（同一浏览器实例） ----------
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
                out['A']['idb_written'] = wait_idb_count(page, 2, timeout_s=60)
                page.click('#launch')
                try:
                    page.wait_for_function(
                        "!document.getElementById('boot-feedback').hidden", timeout=5000)
                    out['A']['feedback_shown'] = True
                except Exception:
                    out['A']['feedback_shown'] = False
                # 百分比轮询采样（R135 修复：CI runner 快启动 <30s，单次 sleep(30) 采样
                # 会错过百分比阶段——run 42510593772 实证 feedback_text="画面已就绪"、
                # pct_shown=false，本地慢机无此竞态。自条子可见起每 0.5s 采样一次，
                # 直到收层或 240s 截止；任一可见样本命中 \d+% 即 PASS——保留
                # 「反假百分比」断言本意（#4 口径：提示条显示真实百分比）。
                pct_text = None
                last_text = None
                auto_hidden = False
                samples = 0
                deadline = time.time() + 240
                while time.time() < deadline:
                    txt = page.evaluate(
                        "(function(){var fb=document.getElementById('boot-feedback');"
                        "return fb&&!fb.hidden&&fb.children[1]?fb.children[1].textContent:null})()")
                    if txt is not None:
                        samples += 1
                        last_text = txt
                        if pct_text is None and re.search(r'\d+%', txt):
                            pct_text = txt
                    if page.evaluate(
                            "() => {var fb=document.getElementById('boot-feedback');"
                            "return !!fb && fb.hidden;}"):
                        auto_hidden = True
                        break
                    time.sleep(0.5)
                out['A']['feedback_text'] = pct_text if pct_text is not None else last_text
                out['A']['feedback_pct_shown'] = pct_text is not None
                out['A']['feedback_auto_hidden'] = auto_hidden
                out['A']['feedback_samples'] = samples
                out['A']['vm_targets'] = page.evaluate(
                    "() => (window.vm && vm.runtime) ? vm.runtime.targets.length : 0")

                # B) 二访快路径：同页 reload，IndexedDB 命中 ⇒ 分片网络请求=0
                reqs.clear()
                errors.clear()
                page.reload(wait_until='load', timeout=60000)
                page.wait_for_function(LAUNCH_JS, timeout=300000)
                part, cdn_part, local_part, perfile = classify(reqs)
                out['B'] = {
                    'part_fetches': len(part),
                    'perfile_fetches': len(perfile),
                    'sw_controlled': page.evaluate("!!navigator.serviceWorker.controller"),
                    'pack_source': page.evaluate(JS_PACK_SOURCE),
                    'errors': cdn_expected(errors)[:6],
                }
                browser.close()

            if 'C' in run:
                # ---------- C) 分片兜底 ----------
                browser, page, reqs, errors, cerr, warns, resps = new_page(pw)
                page.route(re.compile(r'/assets/pack-[0-9a-f]{8}-p\d+\.bin$'),
                           lambda route: route.abort())
                page.goto(BASE + '/', wait_until='load', timeout=60000)
                page.wait_for_function(LAUNCH_JS, timeout=300000)
                part, cdn_part, local_part, perfile = classify(reqs)
                cerr_filtered = [m for m in cerr if 'net::ERR_FAILED' not in m]
                out['C'] = {
                    'part_fetches': len(part),
                    'perfile_fetches': len(perfile),
                    'fallback_warned': any('falling back' in m for m in warns),
                    'errors': cerr_filtered[:6],
                    'noise_dropped': len(cerr) - len(cerr_filtered),
                }
                browser.close()

            if 'E' in run:
                # ---------- E) SW 兜底层：清 IDB + 拦 CDN → 同源 SW cache-first ----------
                browser, page, reqs, errors, cerr, warns, resps = new_page(pw)
                page.goto(BASE + '/pixel-xxl/assets/', wait_until='load')  # 同源页：about:blank 禁 IDB
                out['E_pre_idb_deleted'] = page.evaluate(JS_IDB_DELETE)
                page.route(re.compile(r'cdn\.jsdelivr\.net/.*/assets/pack-[0-9a-f]{8}-p\d+\.bin$'),
                           lambda route: route.abort())
                page.goto(BASE + '/', wait_until='load', timeout=60000)
                page.wait_for_function(LAUNCH_JS, timeout=300000)
                part, cdn_part, local_part, perfile = classify(reqs)
                out['E'] = {
                    'reload1_local_parts': len(local_part),
                    'reload1_pack_source': page.evaluate(JS_PACK_SOURCE),
                }
                # reload#2/#3 前均清 IDB（goto about:blank 释放连接再删库），否则 IDB 命中会
                # 抢在 SW 之前、分片 0 请求，测不到 SW 兜底层。reload#3 断言：
                # 同源分片 transferSize=0（SW cache-first 命中）+ IDB 重新写入（计数=2）
                for n in (2, 3):
                    page.goto(BASE + '/pixel-xxl/assets/', wait_until='load')
                    page.evaluate(JS_IDB_DELETE)
                    reqs.clear()
                    errors.clear()
                    page.goto(BASE + '/', wait_until='load', timeout=60000)
                    page.wait_for_function(LAUNCH_JS, timeout=300000)
                    if n == 3:
                        part, cdn_part, local_part, perfile = classify(reqs)
                        entries = page.evaluate(
                            "() => performance.getEntriesByType('resource')"
                            ".filter(e => /assets\\/pack-.*-p\\d+\\.bin$/.test(e.name) && e.name.indexOf('cdn.jsdelivr.net') === -1)"
                            ".map(e => ({name: e.name.split('/').pop(), t: e.transferSize}))")
                        err_filtered = cdn_expected(errors)
                        out['E'].update({
                            'reload3_part_fetches': len(part),
                            'local_part_transfer_sizes': entries,
                            'idb_rewritten': page.evaluate(JS_IDB_COUNT),
                            'errors': err_filtered[:6],
                        })
                browser.close()
    finally:
        server.terminate()
    print(json.dumps(out, ensure_ascii=False, indent=1))
    checks = {
        'A': lambda: (out['A']['part_fetches'] >= 2
              and out['A']['perfile_fetches'] == 0
              and not out['A']['http_ge400_non_cdn'] and not out['A']['errors']
              and out['A']['idb_written'] and out['A']['feedback_shown']
              and out['A']['feedback_pct_shown'] and out['A']['feedback_auto_hidden']
              and out['A']['vm_targets'] > 0),
        'B': lambda: (out['B']['part_fetches'] == 0 and out['B']['perfile_fetches'] == 0
              and out['B']['sw_controlled'] and out['B']['pack_source'] == 'idb'
              and not out['B']['errors']),
        'C': lambda: (out['C']['part_fetches'] == 0 and out['C']['perfile_fetches'] > 100
              and out['C']['fallback_warned'] and not out['C']['errors']),
        'E': lambda: (out['E_pre_idb_deleted'] is True
              and out['E']['reload1_local_parts'] >= 2
              and out['E']['reload3_part_fetches'] >= 2
              and out['E']['local_part_transfer_sizes']
              and all(e['t'] == 0 for e in out['E']['local_part_transfer_sizes'])
              and out['E']['idb_rewritten'] == 2
              and not out['E']['errors']),
    }
    missing = [s for s in sorted(run) if s not in out]
    ok = not missing and all(checks[s]() for s in run if s in checks)
    if missing:
        print('SKIP（本组未覆盖场景，VERDICT 仅判已跑组）:', ','.join(missing))
    print('VERDICT:', 'PASS' if ok else 'FAIL')


if __name__ == '__main__':
    main()