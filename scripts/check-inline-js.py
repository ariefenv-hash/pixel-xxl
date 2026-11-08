#!/usr/bin/env python3
"""check-inline-js.py — index.html 内联 <script> 逐块语法校验闸（#4 CI 静态闸）

出处：1a97a66（v1.10 fixup，Job 2933040）提交信息声明「新增 scripts/check-inline-js.py
逐块语法校验闸（4 内联块全过）」，但该文件未随树落库——本文件按其描述物化补齐
（v1.12 · Job 2933110 · #30 返工表精神：声明与树不一致时以树为准并补账）。

背景缺陷（fixup 原文）：API 合流构建器以 rfind('  </script>\\n</body>\\n</html>') 锚点
切片时把对侧 #boot-feedback 层的闭合 </script> 一并切除，本方块自带的 </script> 被
浏览器用于闭合反馈层脚本，本方块正文落入其 JS 上下文 → 「Unexpected token '<'」
pageerror → 反馈层 IIFE 不执行。本闸在合流/改动 index.html 后、推送前逐块抓此类缺陷。

口径：
- 仅校验无 src 的 JS 块；type 缺省 / javascript / module 参与，
  importmap / application(+json) / text/template 等非 JS 块跳过；
- 先按 CommonJS（.js）node --check，失败落盘 .mjs 复检（ESM）——两态均败才 FAIL；
- 退出码：0 = 全过；1 = 有 FAIL（CI 直接判红）。
依赖：python3 标准库 + node（runner/沙箱自带）。
"""
import os
import re
import subprocess
import sys
import tempfile
import pathlib

HTML = pathlib.Path(__file__).resolve().parent.parent / "index.html"
SKIP_TYPE = re.compile(
    r"type\s*=\s*[\"'](importmap|application/(json|[a-z]+\+json)|text/template)", re.I)


def main():
    html = HTML.read_text(encoding="utf-8")
    blocks = []
    for m in re.finditer(r"<script\b([^>]*)>(.*?)</script\s*>", html, re.S | re.I):
        attrs = m.group(1) or ""
        if re.search(r"\bsrc\s*=", attrs, re.I):
            continue
        if SKIP_TYPE.search(attrs):
            continue
        body = m.group(2)
        if body.strip():
            blocks.append(body)

    fails = []
    with tempfile.TemporaryDirectory() as td:
        for i, body in enumerate(blocks):
            p = os.path.join(td, "block%d.js" % i)
            with open(p, "w", encoding="utf-8") as f:
                f.write(body)
            r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
            ok = r.returncode == 0
            err = (r.stderr or "")[:400]
            if not ok:
                # ESM 复检：type=module 或含 import/export 语法的块
                p2 = p[:-3] + ".mjs"
                os.rename(p, p2)
                r2 = subprocess.run(["node", "--check", p2], capture_output=True, text=True)
                if r2.returncode == 0:
                    ok = True
                else:
                    err = (r2.stderr or "")[:400]
            print("block%d: %s (%d chars)" % (i, "OK" if ok else "FAIL", len(body)))
            if not ok:
                fails.append((i, err))

    for i, err in fails:
        print("--- block%d stderr ---" % i)
        print(err)
    print("inline-js gate: %d blocks, %d fail" % (len(blocks), len(fails)))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
