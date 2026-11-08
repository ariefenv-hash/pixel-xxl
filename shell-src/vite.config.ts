import { defineConfig } from 'vite';

/**
 * shell-src/vite.config.ts — Pixel XXL 新壳构建配置（#23 结构性混合渲染）
 *
 * 零构建红线（docs/HANDOFF.md）：main 分支根目录仍是零构建忠实态；
 * 本工程产物输出到 ../shell/（GitHub Pages 直达 /pixel-xxl/shell/），
 * 与根入口并存（双入口），根 index.html / lib/* / assets/* / project.json 零改动。
 *
 * 运行时零复制：shell-src/index.html 以 iframe 嵌 ../index.html（根入口原样），
 * 无需引用运行时脚本，产物天然零重复。
 */
export default defineConfig({
  // 相对 base：产物内资源引用全部相对化，Pages 任意子路径（/pixel-xxl/shell/）直接可用
  base: './',
  build: {
    // 产物输出到仓库根的 shell/（root 外目录 Vite 默认不 emptyOutDir）
    outDir: '../shell',
    emptyOutDir: false,
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2019',
  },
  server: {
    // dev server 允许访问仓库根（iframe src=../index.html 与 vendored 资产）
    fs: { allow: ['.', '..'] },
  },
});
