#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shell-probe.py — 新壳 /shell/ 无头回归（#23 立项 · 语言迁移轮验收探针）

三通道断言（对齐仓内既有探针风格：自起服务、逐步落盘、软渲染安全——
不依赖像素点亮，全部走数据层与 DOM 层断言）：
  A. 壳层载入：/shell/index.html 200，iframe 存在，__PIXEL_SHELL 握手出现；
  B. 桥接链路：window.vm 挂载 → targets 装载 → getVar(壁纸编号) 返回工程初值；
  C. QS 磁贴动作：拉出面板 → 点「壁纸」磁贴 → 变量经「壁纸」广播链生效（值变化）；
     连续打断：面板动画在飞中重复 open() 不抛错且最终落位展开态。
D. 红线核验（独立函数，可 --fidelity 单跑）：lib/*、project.json、sw.js、index.html
   的 sha256 与 git HEAD 一致——本壳轮零触碰忠实态。

证据落 docs/shell-evidence.json（verdict 字段 = PASS/FAIL）。
用法：python3 scripts/shell-probe.py [--fidelity-only] [--timeout N]
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVIDENCE = os.path.join(REPO_ROOT, "docs", "shell-evidence.json")
PORT = 8791

# 红线文件（相对仓库根；逐字节核验清单）
FIDELITY_FILES = [
    "index.html",
    "sw.js",
    "project.json",
    "lib/turbowarp-core.js",
    "lib/pixel-xxl-app.js",
    "lib/project-loader.js",
]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git_head_sha256(rel):
    """git HEAD 中该文件的 blob sha256（git hash-object 语义需对象内容，
    这里直接 git show 到内存再哈希，等价于工作树零改动核验）。"""
    blob = subprocess.run(
        ["git", "show", "HEAD:%s" % rel], cwd=REPO_ROOT, capture_output=True, check=True
    ).stdout
    return hashlib.sha256(blob).hexdigest()


def check_fidelity():
    results = {}
    ok = True
    for rel in FIDELITY_FILES:
        p = os.path.join(REPO_ROOT, rel)
        work = sha256_file(p)
        head = git_head_sha256(rel)
        results[rel] = {"worktree": work[:16], "head": head[:16], "match": work == head}
        ok &= work == head
    return ok, results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fidelity-only", action="store_true")
    ap.add_argument("--timeout", type=int, default=240)
    args = ap.parse_args()

    evidence = {"time": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "port": PORT, "checks": {}}

    # ---------- D. 红线核验（不依赖浏览器，总是跑） ----------
    ok, fid = check_fidelity()
    evidence["checks"]["fidelity"] = {"verdict": "PASS" if ok else "FAIL", "files": fid}
    print("[fidelity]", "PASS" if ok else "FAIL")
    if args.fidelity_only or not ok:
        # 红线破了直接落盘退出（后续通道无意义）
        with open(EVIDENCE, "w", encoding="utf-8") as f:
            json.dump(evidence, f, ensure_ascii=False, indent=2)
        sys.exit(0 if (ok or args.fidelity_only) else 1)
    if args.fidelity_only:
        with open(EVIDENCE, "w", encoding="utf-8") as f:
            json.dump(evidence, f, ensure_ascii=False, indent=2)
        return

    # ---------- 起静态服务（仓库根 = Pages 根语义） ----------
    from playwright.sync_api import sync_playwright

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = "http://localhost:%d" % PORT
    errors = []
    try:
        time.sleep(1.0)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--use-gl=swiftshader"])
            page = browser.new_page(viewport={"width": 390, "height": 844})
            page.on("pageerror", lambda e: errors.append("pageerror: %s" % e))
            page.on(
                "console",
                lambda m: errors.append("console.error: %s" % m.text) if m.type == "error" else None,
            )

            # ---------- A. 壳层载入 ----------
            resp = page.goto("%s/shell/index.html" % base, wait_until="domcontentloaded")
            a_ok = resp is not None and resp.status == 200
            a_ok &= page.evaluate("!!document.getElementById('runtime')")
            # 握手对象出现在桥接就绪之后（main.ts 兜底），此处等待
            try:
                page.wait_for_function("() => !!window.__PIXEL_SHELL", timeout=args.timeout * 1000)
            except Exception as e:
                errors.append("handshake timeout: %s" % e)
            a_ok &= page.evaluate("!!window.__PIXEL_SHELL")
            evidence["checks"]["a_shell_load"] = {"verdict": "PASS" if a_ok else "FAIL"}
            print("[A shell-load]", "PASS" if a_ok else "FAIL")

            # ---------- B. 桥接链路 ----------
            b_ok = True
            b_ok &= page.evaluate("window.__PIXEL_SHELL.bridge.ready")
            b_ok &= page.evaluate("window.__PIXEL_SHELL.bridge.projectLoaded")
            init_wp = page.evaluate("window.__PIXEL_SHELL.bridge.getVar('壁纸编号')")
            b_ok &= init_wp is not None and str(init_wp) != ""
            status_text = page.evaluate("document.getElementById('bridge-status')?.textContent || ''")
            b_ok &= "桥接就绪" in status_text
            evidence["checks"]["b_bridge"] = {
                "verdict": "PASS" if b_ok else "FAIL",
                "initial_壁纸编号": str(init_wp),
                "status": status_text,
            }
            print("[B bridge]", "PASS" if b_ok else "FAIL", "initial壁纸编号=", init_wp)

            # ---------- C. QS 磁贴动作（写变量 → 广播链生效） ----------
            c_ok = True
            # C1: 拉出条点击 → 面板展开（动画路径）
            page.click(".qs-grab-strip", position={"x": 195, "y": 12})
            page.wait_for_timeout(500)  # in 320ms + 余量
            c_ok &= page.evaluate(
                "getComputedStyle(document.querySelector('.qs-panel')).visibility === 'visible'"
            )
            # C2: 连续打断——在飞中重复触发不抛错，最终落位
            page.click(".qs-grab-strip", position={"x": 195, "y": 12})  # 收起中
            page.wait_for_timeout(80)
            page.evaluate("document.querySelector('.qs-grab-strip').dispatchEvent(new PointerEvent('pointerdown'))")  # 打断
            page.wait_for_timeout(60)
            page.click(".qs-grab-strip", position={"x": 195, "y": 12})  # 再展开
            page.wait_for_timeout(500)
            c_ok &= page.evaluate(
                "getComputedStyle(document.querySelector('.qs-panel')).visibility === 'visible'"
            )
            # C3: 壁纸磁贴动作 → 变量值经「壁纸」链变化
            before = page.evaluate("String(window.__PIXEL_SHELL.bridge.getVar('壁纸编号'))")
            page.click(".qs-tile[data-tile-id='wallpaper']")
            page.wait_for_timeout(300)
            after = page.evaluate("String(window.__PIXEL_SHELL.bridge.getVar('壁纸编号'))")
            c_ok &= before != after
            # C4: 亮度模式磁贴 → 变量变化 + 「壁纸」广播链无异常
            before_b = page.evaluate("String(window.__PIXEL_SHELL.bridge.getVar('亮度模式'))")
            page.click(".qs-tile[data-tile-id='brightness']")
            page.wait_for_timeout(300)
            after_b = page.evaluate("String(window.__PIXEL_SHELL.bridge.getVar('亮度模式'))")
            c_ok &= before_b != after_b
            # 壳层自身零 JS 错误（运行时 iframe 的软渲染黑屏是已知非缺陷，不采集）
            shell_errors = [e for e in errors if "shell" in e.lower() or "pageerror" in e.lower()]
            c_ok &= len(shell_errors) == 0
            evidence["checks"]["c_qs_tiles"] = {
                "verdict": "PASS" if c_ok else "FAIL",
                "wallpaper_before": before,
                "wallpaper_after": after,
                "brightness_before": before_b,
                "brightness_after": after_b,
                "shell_errors": shell_errors[:5],
            }
            print("[C qs-tiles]", "PASS" if c_ok else "FAIL",
                  "壁纸 %s→%s 亮度 %s→%s" % (before, after, before_b, after_b))

            page.screenshot(path=os.path.join(REPO_ROOT, "docs", "shell-evidence.png"))
            browser.close()
    finally:
        server.terminate()

    verdict = all(c.get("verdict") == "PASS" for c in evidence["checks"].values())
    evidence["verdict"] = "PASS" if verdict else "FAIL"
    with open(EVIDENCE, "w", encoding="utf-8") as f:
        json.dump(evidence, f, ensure_ascii=False, indent=2)
    print("VERDICT:", evidence["verdict"])
    sys.exit(0 if verdict else 1)


if __name__ == "__main__":
    main()
