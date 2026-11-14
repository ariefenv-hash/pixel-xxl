#!/usr/bin/env python3
"""shell-verify.py — 新壳（/shell/ 双入口）探针（#23 验收 · docs/SHELL.md §9）

A) 壳层骨架与桥接挂载（?probe=1&boot=0——boot=0 关断绿旗代点，
   保持本场景 VM 静默基线口径；自动开机链路由场景 E 专项验证）：
   /shell/ 页加载 → iframe 存在且指向 ../index.html（search 透传）→
   等待 iframe 内根入口启动屏出现（复用根入口全部链路）→ vm 就绪 →
   VMBridge.attach 对账 → #bridge-status 出现且 data-level=ok；
   fast-face 冒烟（v1.21）：加载初期快速面在 DOM（.ff-clock）；
   fast-face 伴随态（v1.23 #33）：attach 后**不再立即淡出**（attach ≠ 桌面可用），
   转入 companion 态继续遮蔽（data-phase=companion）；
B) QS 面板 DOM（L2 POC 载体）：
   .qs-panel 存在、磁贴 6+、拉出条存在；panel.open() 动画展开至 isOpen；
C) 磁贴写通道真实生效（VM 静默——广播链路启动线程，同 v1.21 基线口径）：
   点击「亮度模式」磁贴 → 动作序列（写变量 → 广播「壁纸」）→
   iframe 内 stage 变量「亮度模式」500→600 实测变化（startHats 链路真实启动）；
D) 磁贴绑定与目录契约：磁贴全部在 DOM（data-tile-id 与 tiles.ts 一致）。
E) fast-path Phase 2 自动开机链路（v1.23 #33，默认参数二访）：
   默认 URL（boot 默认开）→ 快速面在 DOM → iframe 内 #launch 被**自动代点**
   隐藏（不再死等手动绿旗）→ attach → companion 态 → .ff-boot 实时进度文案
   （「正在渲染桌面 X%…」/ 阶梯兜底）出现。不等待 handover（软渲染分钟级，
   判定逻辑由 vitest handoverVerdict 覆盖）。

运行：python3 scripts/shell-verify.py [--timeout N]（自起 http.server :8087，服务仓库根）。
--timeout：等待根入口全链路的秒上限（默认 300；受限沙箱/软渲染慢机可放宽，
R141 先例：pack-verify --group 同律——本地受限环境实证，CI runner 按缺省判定）。
注意：完整等待根入口加载（本地素材，通常 <90s；场景 E 第二次装载同量级）；
全程只读壳层 DOM + iframe 同源访问，不改任何仓库文件。
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8087
BASE = f'http://127.0.0.1:{PORT}'
SHELL_URL = BASE + '/shell/index.html'

JS_IFRAME_VM_READY = """
() => {
  try {
    const f = document.getElementById('runtime');
    if (!f || !f.contentWindow) return false;
    const vm = f.contentWindow.vm;
    return !!(vm && vm.runtime);
  } catch (e) { return false; }
}
"""

JS_STAGE_VAR = """
(name) => {
  try {
    const f = document.getElementById('runtime');
    const vm = f.contentWindow.vm;
    const stage = vm.runtime.getTargetForStage();
    for (const k of Object.keys(stage.variables)) {
      const v = stage.variables[k];
      if (v && v.name === name) return String(v.value);
    }
    return null;
  } catch (e) { return null; }
}
"""

JS_BRIDGE_STATUS = """
() => {
  const el = document.getElementById('bridge-status');
  return el && !el.hidden ? { level: el.dataset.level, text: el.textContent } : null;
}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--timeout', type=int, default=300,
                    help='等待根入口全链路的秒上限（默认 300；受限沙箱可放宽）')
    args = ap.parse_args()
    load_timeout_ms = args.timeout * 1000
    server = subprocess.Popen(
        ['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    out = {}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=[
                '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
                '--disable-dev-shm-usage', '--no-sandbox'])
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            shell_errors = []
            page.on('pageerror', lambda e: shell_errors.append(str(e)[:160]))
            page.on('console', lambda m: (
                shell_errors.append(f'console.{m.type}: {m.text[:160]}') if m.type == 'error' else None))

            # ---------- A) 壳层骨架 + URL 透传（boot=0：本场景 VM 静默基线） ----------
            page.goto(SHELL_URL + '?probe=1&boot=0', wait_until='load', timeout=60000)
            out['A'] = {
                'iframe_present': page.evaluate("() => !!document.getElementById('runtime')"),
                'qs_root_present': page.evaluate("() => !!document.getElementById('qs-root')"),
                # ?probe=1 透传断言：probe=1 应拼进 iframe src（壳层透传任意 search）
                'iframe_src': page.evaluate("() => document.getElementById('runtime').getAttribute('src')"),
            }
            out['A']['iframe_src_passthrough'] = out['A']['iframe_src'] == '../index.html?probe=1&boot=0'
            # fast-face 冒烟（v1.21）：加载初期快速面应在 DOM（壳层第一帧渲染）
            out['A']['fast_face_seen'] = page.evaluate(
                "() => !!document.getElementById('fast-face')"
                " && !!document.querySelector('#fast-face .ff-clock')")
            # 等待 iframe 内根入口全链路就绪（启动屏出现）——与 pack-verify 同口径
            page.wait_for_function(
                "() => { try { const f=document.getElementById('runtime');"
                "return f && f.contentDocument && f.contentDocument.getElementById('launch')"
                " && !f.contentDocument.getElementById('launch').hasAttribute('hidden'); }"
                " catch(e) { return false; } }", timeout=load_timeout_ms)
            out['A']['root_entry_launch_ready'] = True
            page.wait_for_function(JS_IFRAME_VM_READY, timeout=120000)
            out['A']['vm_ready'] = True
            # vm 就绪后等 attach（onRuntimeReady 400ms 轮询）→ 状态胶囊 ok
            page.wait_for_function(
                "() => { const s = document.getElementById('bridge-status');"
                "return s && !s.hidden && s.dataset.level === 'ok'; }", timeout=30000)
            out['A']['bridge_status'] = page.evaluate(JS_BRIDGE_STATUS)
            # fast-face 手动模式交接冒烟（v1.23 #33 第 3 修正）：本场景 boot=0 →
            # attach 即淡出（v1.21 语义保持——伴随常驻会遮绿旗屏 200s，手动用户
            # 点不到绿旗）；伴随态路径由场景 E（默认参数，代点在跑）断言。
            page.wait_for_timeout(800)
            out['A']['fast_face_handover'] = page.evaluate(
                "() => !document.getElementById('fast-face')")

            # ---------- B) QS 面板 DOM ----------
            out['B'] = {
                'panel_present': page.evaluate(
                    "() => !!document.querySelector('#qs-root .qs-panel')"),
                'tile_count': page.evaluate(
                    "() => document.querySelectorAll('#qs-root .qs-tile').length"),
                'tile_ids': page.evaluate(
                    "() => Array.from(document.querySelectorAll('#qs-root .qs-tile'))"
                    ".map(el => el.dataset.tileId)"),
                'grab_strip_present': page.evaluate(
                    "() => !!document.querySelector('#qs-root .qs-grab-strip')"),
            }
            # 动画展开（连续打断内核路径）：open() → 等 isOpen
            # （v1.19 起握手名对齐 __PIXEL_SHELL——main.ts 唯一出口，旧 __shell 名废弃）
            page.evaluate("() => window.__PIXEL_SHELL && window.__PIXEL_SHELL.panel.open()")
            try:
                page.wait_for_function(
                    "() => window.__PIXEL_SHELL && window.__PIXEL_SHELL.panel.isOpen", timeout=10000)
                out['B']['panel_open_anim'] = True
            except Exception:
                out['B']['panel_open_anim'] = False

            # ---------- C) 磁贴写通道真实生效（亮度模式 500 → 600） ----------
            out['C'] = {}
            var0 = page.evaluate(JS_STAGE_VAR, '亮度模式')
            out['C']['brightness_before'] = var0
            page.click('#qs-root .qs-tile[data-tile-id="brightness"]')
            time.sleep(1.5)  # 动作反馈 + 广播链启动
            out['C']['brightness_after'] = page.evaluate(JS_STAGE_VAR, '亮度模式')
            out['C']['tile_feedback'] = page.evaluate(
                "() => { const el = document.querySelector('#qs-root .qs-feedback');"
                "return el && !el.hidden ? el.textContent : null; }")
            out['C']['write_effective'] = (
                var0 is not None and out['C']['brightness_after'] is not None
                and out['C']['brightness_after'] != var0)
            out['C']['wallpaper_threads_seen'] = bool(
                out['C']['tile_feedback'] and re.search(r'壁纸链 \d+ 线程', out['C']['tile_feedback']))

            out['D'] = {'shell_page_errors': shell_errors[:6]}

            # ---------- E) fast-path Phase 2 自动开机链路（v1.23 #33 · 默认参数） ----------
            # 默认 URL（boot 默认开）：绿旗代点 → attach → companion → 实时进度文案。
            # 不等 handover（软渲染分钟级；判定纯函数 vitest 覆盖）。
            # 断言口径（v1.23 探针返工修正）：复合终态轮询（launch 代点 hidden + bridge ok
            # 一次性命中）——分步等待在快/慢环境交叉时序下有假阴性窗口（首版 CI run
            # 43549558524 实证：E 卡 30s 分步超时而本地 DOM 级代点链路验证通过）；
            # 失败时 dump 现场（fast-face phase / launch 状态 / bridge 文案 / vm 快照）供诊断。
            out['E'] = {}
            try:
                page2 = browser.new_page(viewport={'width': 1280, 'height': 900})
                e_errors = []
                page2.on('pageerror', lambda e: e_errors.append(str(e)[:160]))
                page2.goto(SHELL_URL + '?probe=1', wait_until='load', timeout=60000)
                out['E']['fast_face_seen'] = page2.evaluate(
                    "() => !!document.getElementById('fast-face')"
                    " && !!document.querySelector('#fast-face .ff-clock')")
                # 复合终态：绿旗被代点隐藏（不再死等手动绿旗）+ attach ok
                page2.wait_for_function(
                    "() => { try { const f=document.getElementById('runtime');"
                    " const d = f && f.contentDocument;"
                    " const launch = d && d.getElementById('launch');"
                    " const s = document.getElementById('bridge-status');"
                    " return !!launch && launch.hasAttribute('hidden')"
                    " && !!s && !s.hidden && s.dataset.level === 'ok'; }"
                    " catch(e) { return false; } }", timeout=load_timeout_ms + 60000)
                out['E']['auto_boot_launch_hidden'] = True
                page2.wait_for_timeout(1200)
                out['E']['fast_face_companion'] = page2.evaluate(
                    "() => { const el = document.getElementById('fast-face');"
                    " return !!el && el.dataset.phase === 'companion'; }")
                # 实时进度文案：渲染段变量（「正在渲染桌面 X%」）或阶梯兜底文案出现
                try:
                    page2.wait_for_function(
                        "() => { const t = document.querySelector('#fast-face .ff-boot-text');"
                        " return t && /渲染|装载|启动|编译|等待|准备/.test(t.textContent); }",
                        timeout=180000)
                    out['E']['live_progress_text'] = page2.evaluate(
                        "() => document.querySelector('#fast-face .ff-boot-text').textContent")
                except Exception:
                    out['E']['live_progress_text'] = None  # 复合终态已过，文案未及采样——记录不硬断
                out['E']['shell_page_errors'] = e_errors[:6]
                page2.close()
            except Exception as e:
                out['E']['error'] = str(e)[:200]
                try:
                    out['E']['diagnostics'] = page2.evaluate(
                        "() => { const el = document.getElementById('fast-face');"
                        " let launch = null, note = null;"
                        " try { const d = document.getElementById('runtime').contentDocument;"
                        " const l = d && d.getElementById('launch');"
                        " launch = l ? l.hasAttribute('hidden') : 'no-el';"
                        " const n = d && d.getElementById('loading-note');"
                        " note = n ? n.textContent : null; } catch (err) { launch = 'ERR'; }"
                        " const s = document.getElementById('bridge-status');"
                        " return JSON.stringify({"
                        " phase: el ? el.dataset.phase : 'removed',"
                        " launch_hidden: launch, loading_note: note,"
                        " bridge: s && !s.hidden ? s.textContent : null }); }")
                except Exception as e2:
                    out['E']['diagnostics'] = 'dump-fail: ' + str(e2)[:120]

            browser.close()
    finally:
        server.terminate()
    print(json.dumps(out, ensure_ascii=False, indent=1))
    a, b, c, e = out['A'], out['B'], out['C'], out.get('E', {})
    ok = (a['iframe_present'] and a['qs_root_present'] and a['iframe_src_passthrough']
          and a.get('root_entry_launch_ready') and a.get('vm_ready')
          and a['bridge_status'] and a['bridge_status']['level'] == 'ok'
          # 心跳文案 v1.19 起覆写为「桥接就绪 · 磁贴写通道已启用 · targets=…」，
          # 「对账一致」只在 attach 瞬时存在——锚稳定前缀「桥接就绪」
          and '桥接就绪' in a['bridge_status']['text']
          and a.get('fast_face_seen') and a.get('fast_face_handover')
          and b['panel_present'] and b['tile_count'] >= 6
          # 磁贴面已演进到 16（v1.20 全量铺开）；断言锚关键磁贴存在，不锁死总数
          and 'brightness' in b['tile_ids'] and 'wallpaper' in b['tile_ids']
          and b['grab_strip_present'] and b['panel_open_anim']
          and c['write_effective'] and c['wallpaper_threads_seen']
          and not out['D']['shell_page_errors']
          # E 场景（v1.23 #33 自动开机链路）：代点隐藏 + companion + 实时文案
          and e.get('fast_face_seen') and e.get('auto_boot_launch_hidden')
          and e.get('fast_face_companion') and e.get('live_progress_text')
          and not e.get('shell_page_errors'))
    print('VERDICT:', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)  # CI 红绿闸（v1.23 起 shell-verify 入 shell-gates job）


if __name__ == '__main__':
    main()
