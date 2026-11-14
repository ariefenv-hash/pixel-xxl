import { defineConfig, type Plugin } from 'vite';

/**
 * 首屏关键 CSS 内联（性能预算第 1 条）
 *
 * 入口 CSS 是渲染桌面所必需的（壁纸/状态栏/图标栅格），必须在首字节 HTML 里
 * 就位，否则首帧会是无样式白屏。这里在产物阶段把它塞进 <style> 并删掉对应
 * <link>，省掉一个关键路径往返（移动端 4G 一个 RTT ≈ 120ms，直接吃掉预算的
 * 1/8）。
 *
 * 异步 chunk 的 CSS（各 app）不动：vite 会在动态 import 时自动插入 <link>，
 * 属于「用到才付钱」。
 */
function inlineCriticalCss(): Plugin {
  return {
    name: 'inline-critical-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);

      for (const key of Object.keys(bundle)) {
        if (!key.endsWith('.css')) continue;
        // 只内联入口 CSS：入口 chunk 命名固定为 assets/index-*.css
        if (!/assets\/index-[\w-]+\.css$/.test(key)) continue;
        const asset = bundle[key];
        if (asset.type !== 'asset') continue;
        const css = String(asset.source);
        const base = key.split('/').pop() as string;
        const linkRe = new RegExp(`<link[^>]+href="[^"]*${base}"[^>]*>`, 'g');
        if (!linkRe.test(source)) continue;
        source = source.replace(linkRe, `<style>${css}</style>`);
        delete bundle[key];
      }
      html.source = source;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [inlineCriticalCss()],
  build: {
    target: 'es2020',
    cssCodeSplit: true, // 入口 CSS 内联、app CSS 按需
    assetsInlineLimit: 8192,
    modulePreload: { polyfill: false },
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // 入口与 vendor 分离，便于长缓存
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: { port: 5173 },
});
