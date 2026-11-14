#!/usr/bin/env python3
"""
perf-gate.py — 首屏性能门禁（CI 可跑）

在「中端机 + 4G 冷启」条件下实测首屏，超出预算即退出码 1：

    可交互      < 1000ms
    首屏内容    < 1500ms（FCP）
    传输总量    < 200KB（gzip 后）

条件模拟：CDP Network.emulateNetworkConditions（1.6Mbps / RTT 150ms）
        + Emulation.setCPUThrottlingRate（4x，贴近中端机）。

用法：python3 scripts/perf-gate.py [--dist dist] [--json out.json]
"""
import argparse
import gzip
import io
import json
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

BUDGET = {"interactive": 1000, "fcp": 1500, "transfer_kb": 200}

# 4G：1.6Mbps 下行 / 750Kbps 上行 / RTT 150ms
NET = {
    "offline": False,
    "downloadThroughput": int(1.6 * 1024 * 1024 / 8),
    "uploadThroughput": int(750 * 1024 / 8),
    "latency": 150,
}
CPU_THROTTLE = 4


SERVER_SNIPPET = r"""
import gzip, io, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = sys.argv[1]
PORT = int(sys.argv[2])
TEXT = {'.html', '.js', '.css', '.svg', '.json', '.txt'}

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()
        ext = os.path.splitext(path)[1]
        if ext not in TEXT or 'gzip' not in self.headers.get('Accept-Encoding', ''):
            return super().send_head()
        data = open(path, 'rb').read()
        raw = gzip.compress(data, 6)
        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Vary', 'Accept-Encoding')
        self.end_headers()
        return io.BytesIO(raw)
    def log_message(self, *a):
        pass

ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
"""


def run(dist: str, port: int = 8096) -> dict:
    """起一个带 gzip 的静态服务器：真实部署（GitHub Pages）会压缩，
    用未压缩的 http.server 测会把传输量高估 3~4 倍。"""
    root = os.path.abspath(dist)
    server = subprocess.Popen(
        [sys.executable, "-c", SERVER_SNIPPET, root, str(port)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)
    out = {}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True, args=["--no-sandbox", "--enable-unsafe-swiftshader"]
            )
            # 全新 context：保证无缓存，等价「冷启」
            ctx = browser.new_context(viewport={"width": 420, "height": 910})
            page = ctx.new_page()
            client = ctx.new_cdp_session(page)
            client.send("Network.enable")
            client.send("Network.emulateNetworkConditions", NET)
            client.send("Emulation.setCPUThrottlingRate", {"rate": CPU_THROTTLE})

            bytes_total = {"n": 0}

            def on_response(resp):
                try:
                    length = resp.headers.get("content-length")
                    if length:
                        bytes_total["n"] += int(length)
                except Exception:
                    pass

            page.on("response", on_response)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)[:160]))

            t0 = time.time()
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="load", timeout=90000)
            load_ms = (time.time() - t0) * 1000

            # 等首屏报告落地（main.ts 在 load 后写 __perf）
            page.wait_for_function("() => window.__perf && window.__perf.interactive > 0", timeout=15000)
            perf = page.evaluate("() => window.__perf")

            # 桌面是否真的可见（壁纸 + 图标栅格有尺寸）
            visible = page.evaluate(
                """() => {
                  const grid = document.getElementById('desktopGrid');
                  const icons = grid ? grid.querySelectorAll('.icon').length : 0;
                  const wp = document.getElementById('wallpaper');
                  const bg = wp ? getComputedStyle(wp).backgroundImage : '';
                  return { icons, wallpaper: bg !== 'none', height: document.getElementById('screen').offsetHeight };
                }"""
            )

            out = {
                "budget": BUDGET,
                "conditions": {"network": "4G 1.6Mbps/150ms", "cpu_throttle": f"{CPU_THROTTLE}x"},
                "interactive_ms": perf.get("interactive", 0),
                "fcp_ms": perf.get("fcp", 0),
                "dcl_ms": perf.get("dcl", 0),
                "shell_ms": perf.get("shellReady", 0),
                "load_ms": round(load_ms),
                "long_tasks": perf.get("longTasks", 0),
                "max_task_ms": perf.get("maxTask", 0),
                "transfer_kb": round(bytes_total["n"] / 1024, 1),
                "desktop": visible,
                "page_errors": errors[:5],
            }
            browser.close()
    finally:
        server.terminate()

    fails = []
    if out["interactive_ms"] > BUDGET["interactive"]:
        fails.append(f"interactive {out['interactive_ms']}ms > {BUDGET['interactive']}ms")
    if out["fcp_ms"] > BUDGET["fcp"]:
        fails.append(f"fcp {out['fcp_ms']}ms > {BUDGET['fcp']}ms")
    if out["transfer_kb"] > BUDGET["transfer_kb"]:
        fails.append(f"transfer {out['transfer_kb']}KB > {BUDGET['transfer_kb']}KB")
    if not out["desktop"]["wallpaper"] or out["desktop"]["icons"] < 10:
        fails.append("desktop not painted (icons/wallpaper missing)")
    if out["page_errors"]:
        fails.append(f"page errors: {out['page_errors'][:2]}")

    out["fails"] = fails
    out["verdict"] = "PASS" if not fails else "FAIL"
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", default="dist")
    ap.add_argument("--json", default="")
    args = ap.parse_args()

    result = run(args.dist)
    print(json.dumps(result, ensure_ascii=False, indent=1))
    if args.json:
        with open(args.json, "w") as f:
            json.dump(result, f, ensure_ascii=False, indent=1)
    print("VERDICT:", result["verdict"])
    return 0 if result["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
