import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

// Content is read at runtime (fetch), not imported, so Vite never sees it. Copy it into the build
// unchanged: the CSVs reference images by path, and editors must be able to swap CSVs without a rebuild.
const runtimeContent = ['landing.config.json', 'data', 'assets/images'];
// Raw design sources kept next to their exports; never shipped.
const excluded = [/assets\/images\/.*-new\.(png|jpe?g)$/, /\.crdownload$/];

function copyRuntimeContent() {
  let outDir;
  return {
    name: 'copy-runtime-content',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    writeBundle() {
      for (const path of runtimeContent) {
        if (!existsSync(path)) continue;
        cpSync(path, resolve(outDir, path), { recursive: true, filter: source => !excluded.some(pattern => pattern.test(source)) });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isProduction = mode === 'production';
  return {
    // Relative by default so the build works under any sub-path (e.g. snapppay.ir/ec-automotive/).
    base: env.VITE_BASE || './',
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: ['es2020', 'safari14', 'chrome87'], // older in-app webviews
      minify: isProduction,
      cssMinify: isProduction,
      sourcemap: !isProduction,
      reportCompressedSize: isProduction,
    },
    plugins: [copyRuntimeContent()],
  };
});
