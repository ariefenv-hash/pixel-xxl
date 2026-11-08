/**
 * lib/project-loader.js — 真实多文件加载层
 *
 * 移植说明（详见 docs/PORTING.md）：
 * 原单文件打包态中，本层由三部分组成：
 *   1. base85 解码器脚本（getBase85DecodeValue / base85decode / decodeChunk）
 *   2. 674 个 <script data="...">decodeChunk(N)</script> 数据分块（内嵌 44,129,064B zip）
 *   3. getProjectData 脚本（JSZip 解包 → project.json + 按 md5 从 zip 取素材）
 * 真实多文件版把这三部分替换为：project.json 与 assets/ 目录中的真实文件，
 * 其余运行时（lib/turbowarp-core.js、lib/pixel-xxl-app.js、run 启动脚本）与原版逐字节一致。
 * 素材文件名 = project.json 内的 md5ext（Scratch 官方素材存储规范）。
 */
const getProjectData = (function() {
  const storage = scaffolding.storage;
  storage.onprogress = (total, loaded) => {
    setProgress(interpolate(0.75, 0.98, total ? loaded / total : 0));
  };

  // 素材总数：从 project.json 统计（进度条用，与原版 0.1→0.75 分段对应）
  let assetTotal = 0;
  let assetLoaded = 0;
  const assetCache = new Map();

  const reportProgress = () => {
    if (assetTotal > 0) {
      setProgress(interpolate(0.1, 0.75, Math.min(1, assetLoaded / assetTotal)));
    }
  };

  storage.addHelper({
    load: (assetType, assetId, dataFormat) => {
      const path = assetId + '.' + dataFormat;
      if (assetCache.has(path)) {
        assetLoaded++;
        reportProgress();
        return Promise.resolve(assetCache.get(path));
      }
      return fetch('assets/' + path)
        .then((response) => {
          if (!response.ok) {
            console.error('Asset is not in assets/: ' + path);
            return null;
          }
          return response.arrayBuffer();
        })
        .then((buffer) => {
          if (!buffer) return null;
          const asset = storage.createAsset(assetType, dataFormat, new Uint8Array(buffer), assetId);
          assetCache.set(path, asset);
          assetLoaded++;
          reportProgress();
          return asset;
        });
    }
  });

  return () => fetch('project.json').then((response) => {
    if (!response.ok) {
      throw new Error('project.json fetch failed: ' + response.status);
    }
    return response.arrayBuffer();
  }).then((data) => {
    try {
      const project = JSON.parse(new TextDecoder().decode(data));
      let count = 0;
      for (const target of project.targets || []) {
        count += (target.costumes || []).length;
        count += (target.sounds || []).length;
      }
      assetTotal = count;
    } catch (e) {
      assetTotal = 0;
    }
    reportProgress();
    return data;
  });
})();
