#!/usr/bin/env python3
"""
extract-wallpapers.py — 壁纸提取与主色采样（构建期）

源：旧工程 assets/ 下的伪 SVG（Scratch 导出时把位图包成 <image xlink:href="data:image/webp">）。
产出：
  public/wallpapers/w{N}-{360|720|1080}.webp   分级尺寸（首屏用 360，高清用 1080）
  public/wallpapers/w{N}-blur.webp             24px 模糊占位（LQIP，首帧先上它再换真图）
  scripts/wallpaper-colors.json                每张壁纸的 k-means 簇（供 HCT 打分生成调色板）

用法：python3 scripts/extract-wallpapers.py <旧仓库 assets 目录>
"""
import base64
import io
import json
import os
import re
import sys

import numpy as np
from PIL import Image

WALLPAPERS = [
    ("1aca054a16851970e2971f950a3816e5.svg", "w1"),
    ("e5c4a727f8175c18f2273e4f680bd4a8.svg", "w2"),
    ("32fa956a27a3c720b573fe7449a7f49f.svg", "w3"),
    ("cc06d09b5556eed367d53a2cc7cdefa4.svg", "w4"),
    ("bbfe9bae419249f7bb17bac44bf37a13.svg", "w5"),
]

SIZES = [("360", 360), ("720", 720), ("1080", 1080)]


def kmeans(pixels, k=10, iters=18):
    """极简 k-means：像素量小（128×256 降采样后），构建期一次跑完。"""
    rng = np.random.default_rng(7)
    idx = rng.choice(len(pixels), size=min(k, len(pixels)), replace=False)
    centers = pixels[idx].astype(np.float64)

    for _ in range(iters):
        d = ((pixels[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        labels = d.argmin(axis=1)
        for i in range(len(centers)):
            mask = labels == i
            if mask.any():
                centers[i] = pixels[mask].mean(axis=0)

    counts = np.bincount(labels, minlength=len(centers))
    total = counts.sum()
    out = []
    for i, c in enumerate(centers):
        if counts[i] == 0:
            continue
        out.append({
            "rgb": [int(round(v)) for v in c],
            "weight": float(counts[i] / total),
        })
    out.sort(key=lambda x: -x["weight"])
    return out


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "../pixel-xxl/assets"
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = os.path.join(root, "public", "wallpapers")
    os.makedirs(outdir, exist_ok=True)

    catalog = []
    for filename, wid in WALLPAPERS:
        path = os.path.join(src, filename)
        if not os.path.exists(path):
            print(f"skip (missing): {filename}")
            continue
        svg = open(path, encoding="utf-8", errors="ignore").read()
        m = re.search(r'data:image/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)', svg)
        if not m:
            print(f"skip (no embedded bitmap): {filename}")
            continue

        raw = base64.b64decode(m.group(2))
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = img.size

        # 分级尺寸（视网膜屏最多到 1080 宽，手机 CSS 宽 360~430）
        for suffix, target_w in SIZES:
            if target_w >= w:
                scaled = img
            else:
                scaled = img.resize((target_w, round(h * target_w / w)), Image.LANCZOS)
            scaled.save(os.path.join(outdir, f"{wid}-{suffix}.webp"),
                        "WEBP", quality=82, method=6)

        # LQIP：24px 缩略，首帧先铺它（<1KB），再换真图 —— 零白屏
        lqip = img.resize((24, round(h * 24 / w)), Image.LANCZOS)
        lqip.save(os.path.join(outdir, f"{wid}-blur.webp"), "WEBP", quality=60, method=6)

        # 主色采样：降采样后 k-means
        small = img.resize((128, round(h * 128 / w)), Image.LANCZOS)
        px = np.asarray(small).reshape(-1, 3).astype(np.float64)
        clusters = kmeans(px, k=10)

        catalog.append({
            "id": wid,
            "size": [w, h],
            "clusters": clusters,
        })
        print(f"{wid}: {w}x{h} → {len(clusters)} clusters, top={clusters[0]['rgb']}")

    with open(os.path.join(root, "scripts", "wallpaper-colors.json"), "w") as f:
        json.dump(catalog, f, indent=1)
    print(f"\nwallpapers: {len(catalog)}")


if __name__ == "__main__":
    main()
