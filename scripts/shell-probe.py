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

            # ---------- D. shade 两段 + 三态磁贴（L2 首批 · #18 验收面） ----------
            d_ok = True
            # D1: 两段 DOM 齐备（scrim / 通知段时钟 / QS 段）
            d_ok &= page.evaluate("document.querySelector('.shade-scrim') !== null")
            d_ok &= page.evaluate("document.querySelector('.shade-clock') !== null")
            d_ok &= page.evaluate("document.querySelector('.shade-qs') !== null")
            # D2: 六磁贴三态可切换（wifi inactive→active→inactive；网格限定——
            #     R137 起折叠行同 id 实例共存，无限定选择器会命中二段不可见的折叠行）
            wifi_state = page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='wifi']\").dataset.state"
            )
            d_ok &= wifi_state == "inactive"
            page.click(".qs-grid .qs-tile[data-tile-id='wifi']")
            page.wait_for_timeout(200)
            wifi_after = page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='wifi']\").dataset.state"
            )
            d_ok &= wifi_after == "active"
            page.click(".qs-grid .qs-tile[data-tile-id='wifi']")
            page.wait_for_timeout(200)
            d_ok &= page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='wifi']\").dataset.state"
            ) == "inactive"
            # D3: dark-mode 磁贴 → 壳层换肤（html[data-shade-theme]）真实副作用
            page.click(".qs-tile[data-tile-id='dark-mode']")
            page.wait_for_timeout(200)
            theme_after = page.evaluate("document.documentElement.dataset.shadeTheme")
            d_ok &= theme_after == "light"
            page.click(".qs-tile[data-tile-id='dark-mode']")
            page.wait_for_timeout(200)
            d_ok &= page.evaluate("document.documentElement.dataset.shadeTheme") == "dark"
            # D4: shade token 曲线实值断言（scrim alpha @ progress=1 = 1；QS 段 alpha = 1）
            scrim_op = page.evaluate("Number(document.querySelector('.shade-scrim').style.opacity)")
            d_ok &= abs(scrim_op - 1.0) < 1e-6  # getNotificationScrimAlpha(1) = 1
            qs_op = page.evaluate("Number(document.querySelector('.shade-qs').style.opacity)")
            d_ok &= abs(qs_op - 1.0) < 1e-6  # getShadeContentAlpha(1) = 1
            # D5: 通知段时钟在位（一段可见性已由 A/C 的面板 visible 间接覆盖）
            clock_txt = page.evaluate("document.querySelector('.shade-clock').textContent || ''")
            d_ok &= len(clock_txt) == 5 and ":" in clock_txt
            # D6: 锁屏 unavailable 分支（R137 续点 1 交付面）：写「锁屏」=1（工程既有
            #     变量、写通道纪律内）→ 网络类 unavailable；手电筒/深色主题始终可用；
            #     解锁 → wifi 恢复 inactive（R137 语义修正：内部态保留，解锁恢复先前选择）
            page.evaluate("window.__PIXEL_SHELL.bridge.setVar('锁屏','1')")
            page.wait_for_timeout(700)  # > 轮询 500ms 一拍
            wifi_locked = page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='wifi']\").dataset.state"
            )
            d_ok &= wifi_locked == "unavailable"
            flash_locked = page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='flashlight']\").dataset.state"
            )
            d_ok &= flash_locked != "unavailable"  # 锁屏手电筒可用（惯例，self:）
            page.evaluate("window.__PIXEL_SHELL.bridge.setVar('锁屏','0')")
            page.wait_for_timeout(700)
            wifi_unlocked = page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='wifi']\").dataset.state"
            )
            d_ok &= wifi_unlocked == "inactive"
            # D7: 折叠态磁贴行（#18 任务 1「折叠态显示 N 个」· R137）：N=4 + 网格状态同步。
            #     折叠行随通知段 notifFade 曲线（一段可见、二段隐藏 = AOSP 语义），
            #     先探针瞬置拉回一段（progress=0.3）再交互。
            #     D7a: 一段可见性实断言（R137 位移模型修正的验收面：一段全量位
            #     progress=0.5 时面板恰好贴顶，通知段时钟真实入视口）
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(0.5)")
            page.wait_for_timeout(200)
            clock_top = page.evaluate(
                "document.querySelector('.shade-clock').getBoundingClientRect().top"
            )
            d_ok &= 0 <= clock_top < 844  # 一段全量位时钟真实入视口（位移模型修正）
            quick_count = page.evaluate(
                "document.querySelectorAll('.shade-quick-row .qs-tile').length"
            )
            d_ok &= quick_count == 4
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(0.5)")
            page.wait_for_timeout(200)
            page.click(".shade-quick-row .qs-tile[data-tile-id='wifi']")
            page.wait_for_timeout(200)
            grid_after_quick = page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='wifi']\").dataset.state"
            )
            d_ok &= grid_after_quick == "active"  # 折叠行/网格共享同一状态机
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(1)")
            page.wait_for_timeout(200)
            # D8: 长按磁贴详情（AOSP tile dialog 同构位）：pointerdown 400ms → 详情卡
            #     出现 → 「关闭磁贴」钮 → 磁贴 inactive（网格同步）→ 点 scrim 关卡
            page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='wifi']\")"
                ".dispatchEvent(new PointerEvent('pointerdown', {pointerId: 9, bubbles: true}))"
            )
            page.wait_for_timeout(520)
            detail_visible = page.evaluate(
                "!document.querySelector('.qs-tile-detail').hidden"
            )
            d_ok &= detail_visible
            detail_title = page.evaluate(
                "document.querySelector('.qs-detail-title')?.textContent || ''"
            )
            d_ok &= detail_title == "WLAN"
            btn_txt = page.evaluate(
                "document.querySelector('.qs-detail-action')?.textContent || ''"
            )
            d_ok &= "关闭" in btn_txt
            page.click(".qs-tile-detail .qs-detail-action")
            page.wait_for_timeout(200)
            wifi_after_close = page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='wifi']\").dataset.state"
            )
            d_ok &= wifi_after_close == "inactive"
            d_ok &= page.evaluate(
                "(document.querySelector('.qs-detail-status')?.textContent || '').includes('关')"
            )  # dialog 保持打开且文案实刷新（AOSP 语义）
            # 点 scrim 关卡（点卡片外空白区——卡片居中，scrim 默认中心点会被卡体拦截）
            page.click(".qs-detail-scrim", position={"x": 20, "y": 780})
            page.wait_for_timeout(150)
            d_ok &= page.evaluate("document.querySelector('.qs-tile-detail').hidden")
            # D9: QS 段超高滚动窗（#18 面板高度长尾 · R137）：overflow-y = auto
            d_ok &= page.evaluate(
                "getComputedStyle(document.querySelector('.shade-qs')).overflowY === 'auto'"
            )
            # D10: QS 展开编辑页（#18 对照稿余项 · R138）：入口钮 → 覆层卡 →
            #      真指针拖动重排（airplane 尾位→首位）→ drop 提交 → 网格/折叠行
            #      跟随新序 → 状态机跨 rebuild 保留 → 反向拖回还原默认序
            e_ok = True
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(1)")
            page.wait_for_timeout(150)
            e_ok &= page.evaluate("document.querySelector('.qs-edit-entry') !== null")
            # 状态机跨 rebuild 预置：airplane 切 active（重排/rebuild 后必须保留）
            page.click(".qs-grid .qs-tile[data-tile-id='airplane']")
            page.wait_for_timeout(150)
            e_ok &= page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='airplane']\").dataset.state"
            ) == "active"
            page.click(".qs-edit-entry")
            page.wait_for_timeout(200)
            e_ok &= page.evaluate("!document.querySelector('.qs-edit-card').hidden")
            ids0 = page.evaluate(
                "Array.from(document.querySelectorAll('.qs-edit-grid .qs-edit-item')).map(el => el.dataset.tileId)"
            )
            e_ok &= ids0[0] == "wifi" and ids0[5] == "airplane" and ids0[-1] == "clock"  # 默认序签名（airplane 位 5、clock 收尾）
            pos = page.evaluate(
                "(() => { const g = document.querySelector('.qs-edit-grid');"
                " const a = g.querySelector(\".qs-edit-item[data-tile-id='airplane']\").getBoundingClientRect();"
                " const b = g.querySelector('.qs-edit-item').getBoundingClientRect();"
                " return {x1: a.x + a.width/2, y1: a.y + a.height/2,"
                " x2: b.x + b.width/2, y2: b.y + b.height/2}; })()"
            )
            # airplane（默认位 5）→ 首格：真指针 8 步拖动（mousedown/mousemove/mouseup）
            page.mouse.move(pos["x1"], pos["y1"])
            page.mouse.down()
            for _i in range(1, 9):
                page.mouse.move(
                    pos["x1"] + (pos["x2"] - pos["x1"]) * _i / 8,
                    pos["y1"] + (pos["y2"] - pos["y1"]) * _i / 8,
                )
                page.wait_for_timeout(25)
            page.mouse.up()
            page.wait_for_timeout(300)
            order1 = page.evaluate(
                "Array.from(document.querySelectorAll('.qs-edit-grid .qs-edit-item')).map(el => el.dataset.tileId)"
            )
            e_ok &= order1[0] == "airplane"  # drop 提交（工作序落地编辑列表）
            page.click(".qs-edit-done")
            page.wait_for_timeout(250)
            e_ok &= page.evaluate("document.querySelector('.qs-edit-card').hidden")
            grid_order = page.evaluate("document.querySelector('.qs-grid').dataset.order.split(',')")
            e_ok &= grid_order[0] == "airplane"  # 网格 rebuild 跟随新序
            e_ok &= page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='airplane']\").dataset.state"
            ) == "active"  # 状态机跨 rebuild 保留（states Map 会话自持）
            quick_first = page.evaluate(
                "document.querySelector('.shade-quick-row .qs-tile').dataset.tileId"
            )
            e_ok &= quick_first == "airplane"  # 折叠行跟随（当前序前 4 toggle 族）
            e_ok &= page.evaluate(
                "document.querySelectorAll('.shade-quick-row .qs-tile').length"
            ) == 4
            # 反向拖回（airplane 首位→默认位 5）→ 默认序还原（第二轮重排路径验证）
            page.click(".qs-edit-entry")
            page.wait_for_timeout(200)
            e_ok &= page.evaluate(
                "document.querySelector('.qs-edit-grid .qs-edit-item').dataset.tileId"
            ) == "airplane"  # 编辑列表与当前序同步（重开即 rebuild）
            pos2 = page.evaluate(
                "(() => { const g = document.querySelector('.qs-edit-grid');"
                " const a = g.querySelector(\".qs-edit-item[data-tile-id='airplane']\").getBoundingClientRect();"
                " const b = g.children[5].getBoundingClientRect();"
                " return {x1: a.x + a.width/2, y1: a.y + a.height/2,"
                " x2: b.x + b.width/2, y2: b.y + b.height/2}; })()"
            )
            page.mouse.move(pos2["x1"], pos2["y1"])
            page.mouse.down()
            for _i in range(1, 9):
                page.mouse.move(
                    pos2["x1"] + (pos2["x2"] - pos2["x1"]) * _i / 8,
                    pos2["y1"] + (pos2["y2"] - pos2["y1"]) * _i / 8,
                )
                page.wait_for_timeout(25)
            page.mouse.up()
            page.wait_for_timeout(300)
            page.click(".qs-edit-done")
            page.wait_for_timeout(250)
            restored = page.evaluate("document.querySelector('.qs-grid').dataset.order.split(',')")
            e_ok &= restored == ids0  # 默认序还原
            quick_restored = page.evaluate(
                "document.querySelector('.shade-quick-row .qs-tile').dataset.tileId"
            )
            e_ok &= quick_restored == "wifi"  # 折叠行还原
            # 收尾：airplane 切回 inactive（状态机基线还原）
            page.click(".qs-grid .qs-tile[data-tile-id='airplane']")
            page.wait_for_timeout(150)
            e_ok &= page.evaluate(
                "document.querySelector(\".qs-grid .qs-tile[data-tile-id='airplane']\").dataset.state"
            ) == "inactive"
            evidence["checks"]["d10_edit_page"] = {
                "verdict": "PASS" if e_ok else "FAIL",
                "default_order_first": ids0[0],
                "reordered_first": order1[0],
                "grid_order_first_after_commit": grid_order[0],
                "quick_row_first_after_commit": quick_first,
                "quick_row_count": 4,
                "order_restored": restored == ids0,
                "quick_row_restored_first": quick_restored,
            }
            print("[D10 edit]", "PASS" if e_ok else "FAIL",
                  "reorder %s→%s restored=%s" % (ids0[0], order1[0], restored == ids0))
            # D11: header 双态过渡（L3 Header 过渡轮 · R139）：motion.qs.fade-* 帧 14/58
            #      经语料标定点（帧 14 ≡ 位移 0.1066）位移轴消费——旧态淡出 [0→0.1066]
            #      （完成点=标定点）、新态淡入 [0.4416→1]（起点=帧 58 线性换算）、
            #      空窗 [0.1066→0.4416] 双态皆隐、纯函数反向对称。
            h_ok = True
            GATE = 0.1066
            FIN = 58 * 0.1066 / 14
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(0.05)")
            page.wait_for_timeout(100)
            old_005 = page.evaluate(
                "parseFloat(document.querySelector(\".qs-header-state[data-state='notif']\").style.opacity)"
            )
            new_005 = page.evaluate(
                "parseFloat(document.querySelector(\".qs-header-state[data-state='qs']\").style.opacity)"
            )
            new_005_vis = page.evaluate(
                "document.querySelector(\".qs-header-state[data-state='qs']\").style.visibility"
            )
            h_ok &= abs(old_005 - (1 - 0.05 / GATE)) < 0.02
            h_ok &= new_005 == 0 and new_005_vis == "hidden"
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(0.1066)")
            page.wait_for_timeout(100)
            old_gate = page.evaluate(
                "parseFloat(document.querySelector(\".qs-header-state[data-state='notif']\").style.opacity)"
            )
            h_ok &= old_gate == 0  # 完成点 = 语料标定点（complete@0.1066，#31 修正）
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(0.3)")
            page.wait_for_timeout(100)
            gap_old = page.evaluate(
                "parseFloat(document.querySelector(\".qs-header-state[data-state='notif']\").style.opacity)"
            )
            gap_new = page.evaluate(
                "parseFloat(document.querySelector(\".qs-header-state[data-state='qs']\").style.opacity)"
            )
            h_ok &= gap_old == 0 and gap_new == 0  # 空窗双态皆隐（帧序 14<58 天然导出）
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(0.5)")
            page.wait_for_timeout(100)
            new_05 = page.evaluate(
                "parseFloat(document.querySelector(\".qs-header-state[data-state='qs']\").style.opacity)"
            )
            h_ok &= abs(new_05 - (0.5 - FIN) / (1 - FIN)) < 0.02
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(1)")
            page.wait_for_timeout(100)
            new_1 = page.evaluate(
                "parseFloat(document.querySelector(\".qs-header-state[data-state='qs']\").style.opacity)"
            )
            old_1_vis = page.evaluate(
                "document.querySelector(\".qs-header-state[data-state='notif']\").style.visibility"
            )
            h_ok &= new_1 == 1 and old_1_vis == "hidden"
            # 反向对称（drag 跟手纯函数）：p 收回 0.05 旧态恢复同值可见
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(0.05)")
            page.wait_for_timeout(100)
            old_back = page.evaluate(
                "parseFloat(document.querySelector(\".qs-header-state[data-state='notif']\").style.opacity)"
            )
            h_ok &= abs(old_back - (1 - 0.05 / GATE)) < 0.02
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(1)")  # 证据截图恢复满展开
            page.wait_for_timeout(100)
            evidence["checks"]["d11_header_transition"] = {
                "verdict": "PASS" if h_ok else "FAIL",
                "old_alpha_at_005": old_005,
                "new_hidden_at_005": new_005_vis == "hidden",
                "old_alpha_at_gate_01066": old_gate,
                "gap_both_hidden": gap_old == 0 and gap_new == 0,
                "new_alpha_at_05": new_05,
                "new_alpha_at_1": new_1,
                "old_restored_after_reverse": abs(old_back - (1 - 0.05 / GATE)) < 0.02,
            }
            print("[D11 header]", "PASS" if h_ok else "FAIL",
                  "old@0.05=%.3f new@0.5=%.3f" % (old_005, new_05))
            # D12: 媒体卡全生命周期（L3 通知面第一批 · R140 · #18 任务 4）：
            #      数据源 = 既有事件链只读（music播放状态 "0"/"1" / 当前播放music 曲名，
            #      project.json 写块实证防发明）→ MediaStyle 同构位卡出现/更新/撤除/
            #      回空态 + ongoing 卡 swipe 不可消除 + 清除全部钮显隐语义。
            n_ok = True
            page.evaluate("window.__PIXEL_SHELL.panel.setProgressForProbe(0.2)")  # 一段：通知段可见
            page.wait_for_timeout(150)

            def notif_probe():
                return page.evaluate("""(() => {
                  const list = document.querySelector('.shade-notif-list');
                  const empty = document.querySelector('.shade-notif-empty');
                  const clear = document.querySelector('.shade-notif-clear');
                  const cards = list ? list.querySelectorAll('.shade-notif-item') : [];
                  const first = cards[0] || null;
                  return {
                    empty_visible: !empty.hidden,
                    card_count: cards.length,
                    card_app: first ? first.querySelector('.shade-notif-item-app').textContent : null,
                    card_title: first ? first.querySelector('.shade-notif-item-title').textContent : null,
                    card_text: first ? first.querySelector('.shade-notif-item-text').textContent : null,
                    clear_hidden: clear.hidden,
                  };
                })()""")

            page.evaluate("window.__PIXEL_SHELL.bridge.setVar('music播放状态','0')")
            page.evaluate("window.__PIXEL_SHELL.bridge.setVar('当前播放music','fripSide - only my railgun')")
            page.wait_for_timeout(700)  # 等 ≥1 轮询拍（500ms）
            p0 = notif_probe()
            n_ok &= p0["empty_visible"] and p0["card_count"] == 0
            n_ok &= p0["clear_hidden"]  # 无可消除卡 → 清除全部隐藏（AOSP 空态语义）

            page.evaluate("window.__PIXEL_SHELL.bridge.setVar('music播放状态','1')")
            page.wait_for_timeout(700)
            p1 = notif_probe()
            n_ok &= (not p1["empty_visible"]) and p1["card_count"] == 1
            n_ok &= p1["card_app"] == "音乐"
            n_ok &= p1["card_title"] == "fripSide - only my railgun"
            n_ok &= p1["card_text"] == "正在播放"
            n_ok &= p1["clear_hidden"]  # ongoing 卡不可消除 → 清除全部仍隐藏

            # 换曲：upsert 保位更新（AOSP 同 id 通知 update 不重排）
            page.evaluate("window.__PIXEL_SHELL.bridge.setVar('当前播放music','探针 D12 - 换曲断言')")
            page.wait_for_timeout(700)
            p2 = notif_probe()
            n_ok &= p2["card_count"] == 1 and p2["card_title"] == "探针 D12 - 换曲断言"

            # ongoing 卡 swipe 无消除（对卡 pointer 拖动 dx≈100px → 卡保留）
            card_box = page.evaluate(
                """(() => { const c = document.querySelector('.shade-notif-item');
                   const r = c.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; })()"""
            )
            if card_box:
                cx, cy = card_box["x"] + card_box["w"] / 2, card_box["y"] + card_box["h"] / 2
                page.mouse.move(cx, cy)
                page.mouse.down()
                page.mouse.move(cx + 100, cy, steps=6)
                page.mouse.up()
                page.wait_for_timeout(200)
                p3 = notif_probe()
                n_ok &= p3["card_count"] == 1  # ongoing：swipe 不消除
                card_dx = page.evaluate(
                    "document.querySelector('.shade-notif-item').style.transform || ''"
                )
                # 未绑 swipe 通道 → transform 恒空（跟手位移不存在）
                n_ok &= card_dx == ""
            else:
                n_ok = False

            # 停播撤除 → 回空态
            page.evaluate("window.__PIXEL_SHELL.bridge.setVar('music播放状态','0')")
            page.wait_for_timeout(700)
            p4 = notif_probe()
            n_ok &= p4["empty_visible"] and p4["card_count"] == 0

            evidence["checks"]["d12_media_notif"] = {
                "verdict": "PASS" if n_ok else "FAIL",
                "empty_initial": p0["empty_visible"],
                "card_on_play": p1["card_count"] == 1,
                "card_app": p1["card_app"],
                "card_title": p1["card_title"],
                "song_upsert_swap": p2["card_title"],
                "ongoing_no_swipe_dismiss": card_box is not None and p3["card_count"] == 1,
                "removed_on_stop": p4["card_count"] == 0,
                "empty_back": p4["empty_visible"],
            }
            print("[D12 media]", "PASS" if n_ok else "FAIL",
                  "empty=%s play=%s swap=%s stop=%s" % (
                      p0["card_count"], p1["card_count"], p2["card_title"], p4["card_count"]))
            evidence["checks"]["d_shade_tiles"] = {
                "verdict": "PASS" if d_ok else "FAIL",
                "wifi_initial": wifi_state,
                "wifi_toggled": wifi_after,
                "theme_after_dark_toggle": theme_after,
                "scrim_opacity_at_full": scrim_op,
                "qs_opacity_at_full": qs_op,
                "clock": clock_txt,
                "wifi_locked": wifi_locked,
                "flashlight_locked": flash_locked,
                "wifi_unlocked": wifi_unlocked,
                "quick_row_count": quick_count,
                "grid_after_quick_toggle": grid_after_quick,
                "detail_title": detail_title,
                "detail_btn": btn_txt,
                "wifi_after_detail_close": wifi_after_close,
            }
            print("[D shade]", "PASS" if d_ok else "FAIL",
                  "wifi %s→%s theme=%s scrim=%.3f lock:%s/%s→%s quick=%s detail=%s" % (
                      wifi_state, wifi_after, theme_after, scrim_op,
                      wifi_locked, flash_locked, wifi_unlocked, quick_count, detail_title))

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
