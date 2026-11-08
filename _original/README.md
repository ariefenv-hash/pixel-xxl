# 原始文件留档（_original/）

## 来源

`Pixel.XL.0827.html` 由 **ariefenv-hash/md3** 仓库 Release `nnnj` 发布：

- 发布页：https://github.com/ariefenv-hash/md3/releases/tag/nnnj
- 资产：`Pixel.XL.0827.html`（57,470,525 字节）
- 下载通道：沙箱内 `raw.githubusercontent.com` 不可达，实际走
  `api.github.com` 的 release asset octet-stream 代理（断点续传完成）

## 指纹（提取时实测）

| 文件 | 字节数 | SHA-256 |
| --- | --- | --- |
| Pixel.XL.0827.html | 57,470,525 | `98db52e05fe4ed38ecca4d94832532f7ebf99e82d628970cb99797ade1901308` |
| 内嵌 zip（674 分块解码产物） | 44,129,064 | `f987e999d7c41d6c2f96dcc96455ee809cdc0dd15c35a1b243ac7ff906fac8e3` |
| project.json（zip 内） | 1,054,272 | 见 `docs/PORTING.md` 校验节 |
| 运行时 core bundle（script[2]） | 1,796,250 | `b5aed7bcb364843c653e7e2fb97f46af02065d60d898f33174b682783a1b4802` |
| 运行时 app bundle（script[3]） | 456,746 | `d581cdb4673ec42aceaf97d6beafe58fa4ba4c3d93ac8734d7d8e1daa56debbb` |

> 57.4MB 的原始 HTML 本体不随本仓库分发（md3 Release 即为永久真相源），
> 本仓库保存的是其解包后的全部真实文件，逐字节校验见 `docs/PORTING.md`。

## 伴随扩展

`qwq1018.js`（GPU 液态玻璃 性能优化版 v4，863 行）为打包之后单独开发的扩展，
**构建内完全不含**（原 HTML 中 `GPULiquidGlass`/`qwq1018` 零命中）。
已收录为 `extensions-extra/qwq1018-gpu-liquid-glass-v4.js`，未集成进运行时
（需 unsandboxed 模式直接拿 `renderer._gl` 才可用）。
