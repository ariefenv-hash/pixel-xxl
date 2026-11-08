#!/bin/bash
# Pixel XXL 一站式无头回归：开机→引导→桌面→开应用→返回→锁屏→解锁
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 0. 服务器保活
if ! curl -s -o /dev/null http://127.0.0.1:8130/index.html; then
  (nohup python3 "$ROOT/scripts/dev-server.py" 8130 "$ROOT" >/tmp/pxl-server2.log 2>&1 &)
  sleep 1.2
fi

agent-browser open "$URL"
sleep 1

# 1. 启动 → 跳过开机动画
agent-browser eval "(()=>{document.getElementById('splash').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1})()" >/dev/null
sleep 0.8
agent-browser eval "(()=>{const s=document.querySelector('.boot-skip');s.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1})()" >/dev/null
sleep 1.2

# 2. 三页引导
for i in 1 2 3; do
  agent-browser eval "(()=>{const b=document.querySelector('.ob-next');if(!b)return 'MISSING';b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1})()" >/dev/null
  sleep 1.1
done

# 3. 桌面检查点
agent-browser eval "(()=>{const d=document.getElementById('desktop');const ok=!d.hidden&&d.querySelectorAll('.d-icon').length===10;return ok?'CHECK-desktop-OK':'CHECK-desktop-FAIL'})()"

# 4. 点开「设置」图标（合成点击）
agent-browser eval "(()=>{const t=[...document.querySelectorAll('#desktop .d-icon')].find(n=>n.querySelector('.lbl')?.textContent==='设置');const o={bubbles:true,cancelable:true,pointerId:7,pointerType:'mouse',isPrimary:true};t.dispatchEvent(new PointerEvent('pointerdown',o));t.dispatchEvent(new PointerEvent('pointerup',o));return 1})()" >/dev/null
sleep 1.4
agent-browser eval "(()=>{const w=document.querySelector('.app-window');const t=w?.querySelector('.aw-header .t')?.textContent;return (w&&t==='设置')?'CHECK-appopen-OK:'+t:'CHECK-appopen-FAIL'})()"

# 5. Esc 返回 → 关窗
agent-browser eval "(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return 1})()" >/dev/null
sleep 1.2
agent-browser eval "(()=>document.querySelector('.app-window')?'CHECK-close-FAIL':'CHECK-close-OK')()"

# 6. A 锁屏 / D 解锁
agent-browser eval "(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'a'}));return 1})()" >/dev/null
sleep 0.6
agent-browser eval "(()=>document.getElementById('lockscreen').hidden?'CHECK-lock-FAIL':'CHECK-lock-OK')()"
agent-browser eval "(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'}));return 1})()" >/dev/null
sleep 0.6
agent-browser eval "(()=>document.getElementById('lockscreen').hidden?'CHECK-unlock-OK':'CHECK-unlock-FAIL')()"

# 7. 终态断言：回到桌面、无残留窗口
agent-browser eval "(()=>{const ok=!document.getElementById('desktop').hidden&&!document.querySelector('.app-window')&&document.getElementById('lockscreen').hidden;return ok?'CHECK-final-OK':'CHECK-final-FAIL'})()"

# 8. 桌面截图存档
agent-browser screenshot /tmp/render/px-final-desktop.png
agent-browser errors
echo "REGRESSION-DONE"
