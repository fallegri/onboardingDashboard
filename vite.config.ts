import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: '.',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined
      }
    }
  },
  resolve: {
    alias: {
      '@modules': resolve(__dirname, 'src/modules'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@types': resolve(__dirname, 'src/types')
    }
  }
});
