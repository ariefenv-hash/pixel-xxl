#!/bin/bash
# shade 专项回归：顶缘下拉 → 开启断言 → 瓷砖换亮度模式 → Esc 关闭
set -e
cd /home/z/my-project/pixel-xxl

if ! curl -s -o /dev/null http://127.0.0.1:8130/index.html; then
  (nohup python3 scripts/dev-server.py 8133 . >/tmp/pxl-server3.log 2>&1 &)
  sleep 1.2
  PORT=8133
else
  PORT=8130
fi

agent-browser open "http://127.0.0.1:$PORT/" >/dev/null
sleep 1
agent-browser eval "(()=>{document.getElementById('splash').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1})()" >/dev/null
sleep 0.8
agent-browser eval "(()=>{document.querySelector('.boot-skip').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1})()" >/dev/null
sleep 1.3
for i in 1 2 3; do
  agent-browser eval "(()=>{const b=document.querySelector('.ob-next');if(!b)return 0;b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1})()" >/dev/null
  sleep 1.1
done

# 1) 顶缘下拉（合成指针，屏幕顶缘中央 → 下拉 220px）
agent-browser eval "(()=>{const s=document.getElementById('screen').getBoundingClientRect();const x=s.left+s.width/2;const y0=s.top+8;const o=(yy)=>({bubbles:true,cancelable:true,pointerId:9,pointerType:'mouse',isPrimary:true,clientX:x,clientY:yy});const scr=document.getElementById('screen');scr.dispatchEvent(new PointerEvent('pointerdown',o(y0)));for(let k=1;k<=8;k++)scr.dispatchEvent(new PointerEvent('pointermove',o(y0+k*28)));scr.dispatchEvent(new PointerEvent('pointerup',o(y0+8*28)));return 1})()" >/dev/null
sleep 0.6
agent-browser eval "(()=>{const sh=document.getElementById('shade');const ok=!sh.hidden;return ok?'CHECK-shade-open-OK':'CHECK-shade-open-FAIL:'+JSON.stringify({hidden:sh.hidden,panel:!!sh.querySelector('.sh-panel'),tiles:sh.querySelectorAll('.sh-tile').length})})()"

# 2) 点「亮度模式」瓷砖 → localStorage 里的 brightnessMode 必须变化
BEFORE=$(agent-browser eval "JSON.parse(localStorage.getItem('pixel-xxl-state-v1')||'{}').brightnessMode ?? 500")
agent-browser eval "(()=>{const t=[...document.querySelectorAll('.sh-tile')].find(t=>t.textContent.includes('亮度模式'));t.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));return 1})()" >/dev/null
sleep 0.4
AFTER=$(agent-browser eval "JSON.parse(localStorage.getItem('pixel-xxl-state-v1')||'{}').brightnessMode ?? 500")
[ "$BEFORE" != "$AFTER" ] && echo "CHECK-tile-mode-OK ($BEFORE->$AFTER)" || echo "CHECK-tile-mode-FAIL ($BEFORE->$AFTER)"

# 3) Esc 关闭面板
agent-browser eval "(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return 1})()" >/dev/null
sleep 0.5
agent-browser eval "(()=>document.getElementById('shade').hidden?'CHECK-shade-close-OK':'CHECK-shade-close-FAIL')()"

# 4) 桌面仍健康
agent-browser eval "(()=>{const ok=!document.getElementById('desktop').hidden&&!document.querySelector('.app-window');return ok?'CHECK-desktop-after-OK':'CHECK-desktop-after-FAIL'})()"
agent-browser screenshot /tmp/render/px-shade-test.png
agent-browser errors
echo "SHADE-REGRESSION-DONE"
