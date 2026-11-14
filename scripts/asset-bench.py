#!/usr/bin/env python3
"""asset-bench.py — 素材层基准（P0 第一批实测 · 本地可跑，不依赖 WebGL）

目的：把「75→98% 素材解码段」真实拆开——181 SVG 光栅化 vs 177 PNG decode 各占多少。

为什么本地能跑：Scratch 的解码链是
    fetch bytes → (SVG: DOM 解析 + 光栅化) / (PNG: decode) → canvas → texImage2D
前两步只需 2D canvas，**不需要 WebGL 上下文**。本脚本测的正是前两步，
textureImage2d 的开销留待 P0 真机 profile 补齐（本沙箱 WebGL 全失，已记 HANDOFF 已知坑）。

口径：
- serial：逐件串行 = scratch-storage 的保守下界；
- parallel(8)：8 并发 = 真实加载器的并发量级；
- 每个样本记录 fetch / decode(rasterize) 两段时间，输出 p50 / p95 / total。

用法：python3 scripts/asset-bench.py [--concurrency 8] [--out docs/asset-bench.json]
"""
import argparse
import json
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8091

JS_COLLECT = r"""
async () => {
  const res = await fetch('project.json');
  const p = await res.json();
  const out = [];
  for (const t of p.targets || []) {
    for (const c of (t.costumes || [])) {
      out.push({ id: c.md5ext || (c.assetId + '.' + c.dataFormat), fmt: c.dataFormat,
                 name: c.name, res: c.bitmapResolution || 1 });
    }
  }
  return out;
}
"""

JS_BENCH = r"""
async ({items, concurrency}) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });

  const decodeOne = async (it) => {
    const t0 = performance.now();
    let bytes;
    try {
      const r = await fetch('assets/' + it.id);
      bytes = await r.arrayBuffer();
    } catch (e) { return { id: it.id, fmt: it.fmt, error: 'fetch' }; }
    const t1 = performance.now();

    try {
      if (it.fmt === 'svg') {
        const blob = new Blob([bytes], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = () => rej(new Error('img'));
          img.src = url;
        });
        // 光栅化落盘：Scratch 真实路径也会把 SVG 画进 canvas 再上传
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, Math.min(img.width || 256, 1024), Math.min(img.height || 256, 1024));
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([bytes]);
        const bmp = await createImageBitmap(blob);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bmp, 0, 0, Math.min(bmp.width, 1024), Math.min(bmp.height, 1024));
        bmp.close();
      }
    } catch (e) {
      return { id: it.id, fmt: it.fmt, error: 'decode', fetch_ms: t1 - t0 };
    }
    const t2 = performance.now();
    return { id: it.id, fmt: it.fmt, bytes: bytes.byteLength,
             fetch_ms: t1 - t0, decode_ms: t2 - t1 };
  };

  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await decodeOne(items[i]);
    }
  });
  const t0 = performance.now();
  await Promise.all(workers);
  const wall = performance.now() - t0;
  return { wall_ms: wall, results };
}
"""


def pct(vals, p):
    if not vals:
        return None
    s = sorted(vals)
    k = min(len(s) - 1, max(0, int(round((len(s) - 1) * p))))
    return round(s[k], 2)


def summarize(rows, fmt):
    sel = [r for r in rows if r.get('fmt') == fmt and not r.get('error')]
    dec = [r['decode_ms'] for r in sel]
    fet = [r.get('fetch_ms', 0) for r in sel]
    return {
        'count': len(sel),
        'errors': len([r for r in rows if r.get('fmt') == fmt and r.get('error')]),
        'decode_sum_ms': round(sum(dec), 1),
        'decode_p50_ms': pct(dec, 0.5),
        'decode_p95_ms': pct(dec, 0.95),
        'fetch_sum_ms': round(sum(fet), 1),
        'bytes': sum(r.get('bytes', 0) for r in sel),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--concurrency', type=int, default=8)
    ap.add_argument('--out', default='docs/asset-bench.json')
    ap.add_argument('--port', type=int, default=PORT)
    args = ap.parse_args()

    server = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(args.port), '--bind', '127.0.0.1',
         '--directory', ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    base = f'http://127.0.0.1:{args.port}'
    out = {'base': base, 'concurrency': args.concurrency}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
            page = browser.new_page(viewport={'width': 800, 'height': 600})
            page.goto(base + '/README.md', wait_until='domcontentloaded')
            items = page.evaluate(JS_COLLECT)
            out['items_total'] = len(items)
            out['items_by_fmt'] = {
                'svg': len([i for i in items if i['fmt'] == 'svg']),
                'png': len([i for i in items if i['fmt'] == 'png']),
            }

            # 1) 串行（下界）
            ser = page.evaluate(JS_BENCH, {'items': items, 'concurrency': 1})
            # 2) 并发 8（真实量级）
            par = page.evaluate(JS_BENCH, {'items': items, 'concurrency': args.concurrency})

            out['serial'] = {
                'wall_ms': round(ser['wall_ms'], 1),
                'svg': summarize(ser['results'], 'svg'),
                'png': summarize(ser['results'], 'png'),
            }
            out['parallel'] = {
                'wall_ms': round(par['wall_ms'], 1),
                'svg': summarize(par['results'], 'svg'),
                'png': summarize(par['results'], 'png'),
            }
            browser.close()
    finally:
        server.terminate()

    os.makedirs(os.path.join(ROOT, os.path.dirname(args.out)), exist_ok=True)
    path = os.path.join(ROOT, args.out)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print(json.dumps({k: v for k, v in out.items() if k != 'serial'}, ensure_ascii=False, indent=1))
    print('\n--- 分段耗时（串行 / 并发%d）---' % args.concurrency)
    for k in ('serial', 'parallel'):
        s = out[k]
        print(f"[{k}] wall={s['wall_ms']/1000:.2f}s  "
              f"svg_decode={s['svg']['decode_sum_ms']/1000:.2f}s (n={s['svg']['count']}, p95={s['svg']['decode_p95_ms']}ms)  "
              f"png_decode={s['png']['decode_sum_ms']/1000:.2f}s (n={s['png']['count']}, p95={s['png']['decode_p95_ms']}ms)")
    print('written:', path)


if __name__ == '__main__':
    main()
