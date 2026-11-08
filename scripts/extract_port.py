#!/usr/bin/env python3
"""
Pixel.XL.0827.html → 真实多文件网页工程 忠实移植提取器
- 674 个 base85 数据分块 → 44,129,064B zip（字节级一致）→ 解包 project.json + assets/
- script[2] / script[3] 运行时 bundle 原样出库（字节级一致）
- script[3] 内嵌扩展源码解码导出为 extensions/*.js（参考副本）
- 由原骨架程序化重建 index.html（除加载层外逐字节一致）
"""
import re, os, struct, json, zipfile, hashlib, urllib.parse, shutil

SRC = '/home/z/my-project/work/Pixel.XL.0827.html'
OUT = '/home/z/my-project/download/pixel-xxl'
QWQ = '/home/z/my-project/work/qwq1018.js'

text = open(SRC, encoding='utf-8').read()
total = len(text)

# ---------- 1. 标签定位（清除 bundle 内假匹配） ----------
tags = []
for m in re.finditer(r'<(script|style)\b([^>]*)>', text, re.I):
    kind = m.group(1).lower()
    close = text.find('</' + kind + '>', m.end())
    t = {'kind': kind, 'start': m.start(), 'open_end': m.end(),
         'close_start': close, 'end': close + len(kind) + 3, 'attrs': m.group(2)}
    if tags and t['start'] < tags[-1]['end']:
        continue
    tags.append(t)

styles = [t for t in tags if t['kind'] == 'style']
chunks = [t for t in tags if t['kind'] == 'script' and t['attrs'].lstrip().startswith('data=')]
plain = [t for t in tags if t['kind'] == 'script' and not t['attrs'].lstrip().startswith('data=')]
core, app, decoder, getdata, run = plain[0], plain[1], plain[2], plain[3], plain[4]
print(f"tags={len(tags)} styles={len(styles)} chunks={len(chunks)} plain_scripts={len(plain)}")
assert len(chunks) == 674 and len(plain) == 5

def body(t): return text[t['open_end']:t['close_start']]

# ---------- 2. base85 → zip（1:1 复现 packager 解码逻辑） ----------
def b85val(code: int) -> int:
    if code == 0x28: code = 0x3c   # ( -> <
    if code == 0x29: code = 0x3e   # ) -> >
    return code - 0x2a

EXPECTED = 44129064
buf = bytearray(EXPECTED)
off = 0
for t in chunks:
    m = re.match(r'\s*data="([^"]*)"\s*', t['attrs'])
    assert m, t['attrs'][:50]
    data_attr = m.group(1)
    size_arg = int(re.search(r'decodeChunk\((\d+)\)', body(t)).group(1))
    n = len(data_attr) // 5 * 4
    assert off + n <= EXPECTED
    pos = off
    for i in range(0, len(data_attr) - 4, 5):
        v = (b85val(ord(data_attr[i])) + b85val(ord(data_attr[i+1])) * 85 +
             b85val(ord(data_attr[i+2])) * 85**2 + b85val(ord(data_attr[i+3])) * 85**3 +
             b85val(ord(data_attr[i+4])) * 85**4)
        struct.pack_into('<I', buf, pos, v)
        pos += 4
    assert pos - off == size_arg, f"chunk size mismatch {pos-off} vs {size_arg}"
    off = pos
assert off == EXPECTED, f"total {off} != {EXPECTED}"
assert bytes(buf[:4]) == b'PK\x03\x04', 'zip magic missing'
print(f"zip decoded: {off:,} bytes, PK header OK")

zip_path = '/home/z/my-project/work/Pixel.XL.0827.project.zip'
open(zip_path, 'wb').write(buf)

# ---------- 3. 解包 ----------
os.makedirs(OUT, exist_ok=True)
for d in ['lib', 'assets', 'extensions', 'extensions-extra', 'docs', 'scripts', '_original']:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

zf = zipfile.ZipFile(zip_path)
bad = zf.testzip()
assert bad is None, f"zip CRC fail: {bad}"
names = zf.namelist()
project_json_name = [n for n in names if n.endswith('project.json')]
assert project_json_name, 'project.json missing'
pj_name = project_json_name[0]
asset_files = [n for n in names if n != pj_name]
print(f"zip entries: {len(names)} | project.json={pj_name} | assets={len(asset_files)}")

open(os.path.join(OUT, 'project.json'), 'wb').write(zf.read(pj_name))
from collections import Counter
ext_counter = Counter()
for n in asset_files:
    base = os.path.basename(n)
    zf.extract(n, '/tmp/pxl_unzip') if False else None
    data = zf.read(n)
    ext = base.rsplit('.', 1)[-1].lower() if '.' in base else 'bin'
    ext_counter[ext] += 1
    with open(os.path.join(OUT, 'assets', base), 'wb') as f:
        f.write(data)
print("asset types:", dict(ext_counter))

pj = json.loads(zf.read(pj_name))
print("project meta:", pj.get('meta', {}))
print("extensions field:", json.dumps(pj.get('extensions', []), ensure_ascii=False)[:600])
print("targets:", len(pj.get('targets', [])))

# ---------- 4. 运行时 bundle 原样出库（字节级一致） ----------
core_body, app_body = body(core), body(app)
open(os.path.join(OUT, 'lib', 'turbowarp-core.js'), 'w', encoding='utf-8').write(core_body)
open(os.path.join(OUT, 'lib', 'pixel-xxl-app.js'), 'w', encoding='utf-8').write(app_body)
print(f"lib/turbowarp-core.js: {len(core_body):,} chars")
print(f"lib/pixel-xxl-app.js:  {len(app_body):,} chars")

# ---------- 5. 扩展源码解码导出（script[3] 内嵌数组 → 真实 .js 文件） ----------
ext_sources = re.findall(r'decodeURIComponent\("((?:[^"\\]|\\.)*)"\)', app_body)
print(f"embedded extension sources found: {len(ext_sources)}")
ext_manifest = []
for i, enc in enumerate(ext_sources):
    src = urllib.parse.unquote(enc)
    m_id = re.search(r'extensionId["\']?\s*[:=]\s*["\']([a-zA-Z0-9_-]+)', src) or \
           re.search(r'getExtensionInfo\(\)\s*\{[^}]*?id["\']?\s*[:=]\s*["\']([a-zA-Z0-9_-]+)', src, re.S)
    ext_id = m_id.group(1) if m_id else f'ext{i:02d}'
    fname = f"{i:02d}-{ext_id}.js"
    open(os.path.join(OUT, 'extensions', fname), 'w', encoding='utf-8').write(src)
    head = src.strip().split('\n')[0][:100]
    ext_manifest.append({'file': fname, 'id': ext_id, 'bytes': len(src), 'head': head})
    print(f"  {fname:44} {len(src):>9,}  {head}")

# ---------- 6. GPU 液态玻璃（未集成的伴随扩展） ----------
if os.path.exists(QWQ):
    shutil.copy(QWQ, os.path.join(OUT, 'extensions-extra', 'qwq1018-gpu-liquid-glass-v4.js'))

# ---------- 7. 重建 index.html（除加载层外逐字节一致） ----------
head_part = text[:core['start']]                    # DOCTYPE..DOM 骨架..（到 core 前）
run_part = text[run['start']:run['end']]            # run 脚本原样
tail_part = text[run['end']:]                       # </body></html>
loader_src = '''<script src="lib/project-loader.js"></script>'''
index = (head_part
         + '<script src="lib/turbowarp-core.js"></script>\n'
         + '<script src="lib/pixel-xxl-app.js"></script>\n'
         + loader_src + '\n'
         + run_part + tail_part)
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(index)
print(f"index.html rebuilt: {len(index):,} chars (原 {total:,}；差值=内嵌数据层体积)")

# ---------- 8. 完整性报告 ----------
def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for blk in iter(lambda: f.read(1 << 20), b''):
            h.update(blk)
    return h.hexdigest()
report = {
    'original_html_sha256': sha(SRC),
    'original_html_bytes': total,
    'zip_sha256': sha(zip_path),
    'zip_bytes': EXPECTED,
    'project_json_bytes': os.path.getsize(os.path.join(OUT, 'project.json')),
    'assets_count': len(asset_files),
    'core_sha256': hashlib.sha256(core_body.encode()).hexdigest(),
    'app_sha256': hashlib.sha256(app_body.encode()).hexdigest(),
    'extensions_extracted': len(ext_sources),
}
json.dump(report, open('/home/z/my-project/work/port_report.json', 'w'), indent=2)
json.dump(ext_manifest, open(os.path.join(OUT, 'extensions', 'manifest.json'), 'w'), indent=2, ensure_ascii=False)
print(json.dumps(report, indent=2))
