#!/usr/bin/env python3
"""v1.03 素材瘦身：SVG 壳内 base64 照片 → WebP q90 重嵌入。

原则（忠实移植红线）：
- SVG 壳（矢量结构/尺寸/rotationCenter）逐字节不动，只替换 <image xlink:href="data:image/...;base64,..."> 的位图载荷；
- 内嵌位图重编码为 WebP（quality=90, method=6），最长边超过 MAX_SIDE 才降采样，否则原分辨率保留；
- 文件扩展名保持 .svg，dataFormat 语义不变；内容变了 → md5 变 → 文件名随 md5 改，
  project.json 的 assetId/md5ext 同步更新（已核实 md5 仅被 project.json 引用）；
- 只有新载荷显著更小（<90%）才替换；解码失败/替换不划算 → 原样保留。
"""
import base64, hashlib, json, os, re, sys
from io import BytesIO
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
PJ = os.path.join(ROOT, 'project.json')
SVG_MIN_BYTES = 150_000    # 只处理大到可能有照片载荷的 SVG
PHOTO_MIN_BYTES = 80_000   # 只重编码大于 80KB 的内嵌位图
MAX_SIDE = 2436            # 手机原生分辨率上限（原素材最长边即此）
QUALITY = 90

DATA_URI_RE = re.compile(rb'data:image/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)')

def recompress(img_bytes: bytes) -> bytes | None:
    """PNG/JPEG 位图 → WebP(q90)；返回新字节，不划算/失败返回 None。"""
    try:
        img = Image.open(BytesIO(img_bytes))
        img.load()
    except Exception as e:
        print(f'    [skip] 解码失败: {e}')
        return None
    w, h = img.size
    if max(w, h) > MAX_SIDE:
        r = MAX_SIDE / max(w, h)
        img = img.resize((round(w * r), round(h * r)), Image.LANCZOS)
    out = BytesIO()
    img.save(out, 'WEBP', quality=QUALITY, method=6)
    new = out.getvalue()
    return new if len(new) < len(img_bytes) * 0.9 else None

def slim_svg(data: bytes, name: str):
    saved = 0; swapped = 0; kept = 0
    def repl(m):
        nonlocal saved, swapped, kept
        payload = m.group(2)
        if len(payload) < PHOTO_MIN_BYTES:
            kept += 1; return m.group(0)
        raw = base64.b64decode(payload)
        new = recompress(raw)
        if new is None:
            kept += 1; return m.group(0)
        b64 = base64.b64encode(new).decode('ascii')
        saved += len(raw) - len(new); swapped += 1
        return b'data:image/webp;base64,' + b64.encode('ascii')
    out = DATA_URI_RE.sub(repl, data)
    return out, swapped, kept, saved

def main():
    pj = json.load(open(PJ, encoding='utf-8'))
    renames = []  # (old_name, new_name)
    report = []
    files = sorted(os.listdir(ASSETS))
    for f in files:
        p = os.path.join(ASSETS, f)
        if not f.endswith('.svg') or os.path.getsize(p) < SVG_MIN_BYTES:
            continue
        old_bytes = open(p, 'rb').read()
        new_bytes, swapped, kept, saved = slim_svg(old_bytes, f)
        mb = lambda n: f'{n/1e6:.2f}MB'
        if new_bytes == old_bytes:
            report.append(f'{f}: no change')
            continue
        new_md5 = hashlib.md5(new_bytes).hexdigest()
        new_name = new_md5 + '.svg'
        open(os.path.join(ASSETS, new_name), 'wb').write(new_bytes)
        os.remove(p)
        renames.append((f[:-4], new_md5))
        report.append(f'{f} -> {new_name}: {mb(len(old_bytes))} -> {mb(len(new_bytes))}  (photos swapped={swapped} kept={kept}, payload saved={mb(saved)})')

    # project.json 同步：assetId 与 md5ext
    hit = 0
    for t in pj.get('targets', []):
        for kind in ('costumes', 'sounds'):
            for a in t.get(kind, []):
                old_md5 = (a.get('md5ext') or '').split('.')[0]
                for om, nm in renames:
                    if old_md5 == om:
                        a['assetId'] = nm
                        a['md5ext'] = nm + '.' + a.get('dataFormat', 'svg')
                        hit += 1
    json.dump(pj, open(PJ, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

    print('=== slim report ===')
    for r in report: print(' ', r)
    print(f'project.json updated refs: {hit}')

    # 双向完整性核对（与 v1.00 移植同一口径）
    used, missing = set(), []
    for t in pj.get('targets', []):
        for kind in ('costumes', 'sounds'):
            for a in t.get(kind, []):
                mx = a.get('md5ext')
                if not mx: continue
                used.add(mx)
                if not os.path.exists(os.path.join(ASSETS, mx)):
                    missing.append(mx)
    on_disk = set(os.listdir(ASSETS))
    print(f'integrity: referenced={len(used)} missing={missing} on_disk={len(on_disk)} orphan={len(on_disk - used)}')
    total = sum(os.path.getsize(os.path.join(ASSETS, f)) for f in on_disk)
    print(f'assets total after slim: {total/1e6:.2f}MB')

if __name__ == '__main__':
    main()
